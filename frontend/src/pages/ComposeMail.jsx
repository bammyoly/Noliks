import React, { useState } from "react";
import { useAccount } from "wagmi";
import { ethers as E } from "ethers";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useFhe } from "../context/FheContext";
import FHEMailboxABI from "../contracts/abi/FHEMailbox.json";
import FHEMailboxMockABI from "../contracts/abi/FHEMailboxMock.json";
import addresses from "../contracts/addresses.json";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const utf8Bytes = (E.utils && E.utils.toUtf8Bytes) || E.toUtf8Bytes || ((s)=>new TextEncoder().encode(String(s??"")));
const hexlify   = (E.utils && E.utils.hexlify) || E.hexlify;
const isAddress = (E.utils && E.utils.isAddress) || E.isAddress;
const keccak256 = (E.utils && E.utils.keccak256) || E.keccak256;
const getProvider = () =>
  E.providers?.Web3Provider ? new E.providers.Web3Provider(window.ethereum) : new E.BrowserProvider(window.ethereum);

const ensureSepolia = async (ethereum) => {
  const SEPOLIA_HEX = "0xaa36a7";
  const cur = await ethereum.request({ method: "eth_chainId" });
  if (cur === SEPOLIA_HEX) return;
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_HEX }] });
  } catch (err) {
    if (err?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: SEPOLIA_HEX,
          chainName: "Sepolia",
          nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://rpc.sepolia.org"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    } else {
      throw err;
    }
  }
};

const resolveAddr = (chainId, key) => {
  const cid = String(chainId);
  const a = addresses || {};
  const valid = (v) => typeof v === "string" && isAddress(v.trim());
  if (a[cid]?.[key] && valid(a[cid][key])) return a[cid][key].trim();
  if (a.sepolia?.[key] && valid(a.sepolia[key])) return a.sepolia[key].trim();
  if (a[key] && valid(a[key])) return a[key].trim();
  return "";
};

const genCidLike = () => {
  try { if (crypto?.randomUUID) return `cid:${crypto.randomUUID()}`; } catch {}
  return `cid:${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalize = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (v instanceof Uint8Array) return hexlify(v);
  if (ArrayBuffer.isView(v)) return hexlify(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
  if (v?.buffer instanceof ArrayBuffer) return hexlify(new Uint8Array(v.buffer));
  if (v?.type === "Buffer" && Array.isArray(v.data)) return hexlify(Uint8Array.from(v.data));
  try { return String(v); } catch { return ""; }
};

const ComposeMail = () => {
  const { address } = useAccount();
  const { fhe, loading } = useFhe();

  const [receiverAddress, setReceiverAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const modules = { toolbar: [[{ header: [1, 2, false] }], ["bold","italic","underline","strike","blockquote"], [{ list:"ordered" },{ list:"bullet" }], ["link","image"], ["clean"]] };
  const formats = ["header","bold","italic","underline","strike","blockquote","list","bullet","link","image"];

  if (loading) return <div className="p-8 max-w-4xl mx-auto text-gray-600">🔄 Initializing encryption engine...</div>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!address) return alert("⚠️ Connect your wallet first.");
      if (!receiverAddress || !subject || !body) return alert("⚠️ Fill all fields.");
      if (!isAddress(receiverAddress)) return alert("⚠️ Receiver address invalid.");

      setSending(true);

      if (!window.ethereum) throw new Error("Wallet not detected.");
      await ensureSepolia(window.ethereum);
      const provider = getProvider();
      if (window.ethereum?.request) await window.ethereum.request({ method: "eth_requestAccounts" });
      else if (provider.send) await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const net = await provider.getNetwork();
      const chainId = Number(net.chainId?.toString?.() ?? net.chainId);

      const REAL_ADDR = resolveAddr(chainId, "FHEMailbox");
      const MOCK_ADDR = resolveAddr(chainId, "FHEMailboxMock");

      const realContract = REAL_ADDR ? new E.Contract(REAL_ADDR, FHEMailboxABI, signer) : null;
      const mockContract = MOCK_ADDR ? new E.Contract(MOCK_ADDR, FHEMailboxMockABI, signer) : null;

      const cid = genCidLike();               
      const nowSec = Math.floor(Date.now() / 1000);
      const subjHashHex = keccak256(utf8Bytes(subject));
      const subjHashBig = BigInt(subjHashHex);

      const isFheReady =
        fhe &&
        typeof fhe.encrypt_uint64 === "function" &&
        typeof fhe.encryptUint256Auto === "function" &&
        typeof fhe.encrypt_bool === "function" &&
        typeof fhe.prove === "function" &&
        !!realContract;

      let tx, receipt, chainMailId = null, mode = "mock", usedAddr = MOCK_ADDR;

      if (isFheReady) {
        const tsIn = await fhe.encrypt_uint64(nowSec);
        const subjectHashIn = await fhe.encryptUint256Auto(subjHashHex);
        const unreadIn = await fhe.encrypt_bool(true);
        const proofBytes = await fhe.prove();
        const proof = proofBytes instanceof Uint8Array ? hexlify(proofBytes) : normalize(proofBytes);

        tx = await realContract.sendMailEncrypted(
          receiverAddress,
          cid,
          tsIn,
          subjectHashIn,
          unreadIn,
          proof
        );
        receipt = await tx.wait();

        usedAddr = REAL_ADDR;
        mode = "real";
      } else {
        if (!mockContract) throw new Error("Mock contract address missing. Add FHEMailboxMock to addresses.json.");
        tx = await mockContract.sendMailMock(
          receiverAddress,
          cid,
          nowSec,
          subjHashBig,
          true
        );
        receipt = await tx.wait();
        usedAddr = MOCK_ADDR;
        mode = "mock";
      }

      // Parse EncryptedMailSent(id, from, to)
      try {
        const iface = new E.Interface(isFheReady ? FHEMailboxABI : FHEMailboxMockABI);
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== usedAddr.toLowerCase()) continue;
          try {
            const p = iface.parseLog(log);
            if (p?.name === "EncryptedMailSent") { chainMailId = p.args?.id?.toString?.() ?? null; break; }
          } catch {}
        }
      } catch {}

      const res = await fetch(`${API_BASE_URL}/api/mail/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,                   
          cid,
          chainMailId,
          txHash: tx.hash,
          blockNumber: receipt?.blockNumber ?? null,
          chainId,
          contract: usedAddr,
          network: "sepolia",
          from: address,
          to: receiverAddress,
          subject,
          body,
          timestamp: new Date(nowSec * 1000).toISOString(),
          unread: true,
        }),
      });

      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { data = { message: raw }; }
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

      alert(`✅ Mail sent via ${mode.toUpperCase()} path and saved.`);
      setReceiverAddress(""); setSubject(""); setBody("");
    } catch (err) {
      console.error("❌ Error:", err);
      alert(err?.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Compose Mail</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sender Wallet Address</label>
          <input type="text" value={address || "Connect wallet to fill sender"} readOnly className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Receiver Wallet Address</label>
          <input type="text" value={receiverAddress} onChange={(e)=>setReceiverAddress(e.target.value)} required placeholder="0xRecipientAddress" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <input type="text" value={subject} onChange={(e)=>setSubject(e.target.value)} required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message Body</label>
          <ReactQuill theme="snow" value={body} onChange={setBody} modules={modules} formats={formats} placeholder="Compose your message here..." className="h-60 mb-12" />
        </div>
        <div className="pt-10">
          <button type="submit" disabled={!address || sending} className={`w-full py-3 px-4 rounded-lg font-semibold text-lg transition-colors ${
            address && !sending ? "bg-gray-800 hover:bg-gray-700 text-yellow-400" : "bg-gray-400 text-gray-700 cursor-not-allowed"
          }`}>
            {sending ? "Sending Tx..." : address ? "SEND MAIL" : "Connect Wallet to Send"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ComposeMail;
