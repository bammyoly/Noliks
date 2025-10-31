import Mail from "../models/Mail.js";
import {
  sendMailEncryptedOnChain,
  sendMailMockOnChain,
  getInboxFromChain,
  getMessageFromChain,
  getSentFromChain,
  sendMailOnChain as _legacySendMailOnChain
} from "../services/blockchain.js";
import { ethers } from "ethers";

export const sendMail = async (req, res) => {
  try {
    const {
      from, to, cid,
      txHash, contract, chainId, blockNumber, mode, chainMailId,
      subject, body, timestamp, unread,
      handles, inputProof,
      tsPlain, subjectHashPlain, unreadPlain
    } = req.body || {};

    if (!from || !to || !cid) {
      return res.status(400).json({ error: "from, to, cid are required" });
    }
    ethers.getAddress(from); ethers.getAddress(to);

    let finalTxHash = txHash;
    let finalMailId = chainMailId ?? null;
    let finalBlock = blockNumber ?? null;
    let finalMode  = mode ?? null;
    let finalContract = contract ?? null;
    let finalChainId = chainId ?? 11155111;

    if (txHash && contract) {
    }
    else if (handles && inputProof) {
      const { timestampHandle, subjectHashHandle, unreadHandle } = handles;
      if (!timestampHandle || !subjectHashHandle || !unreadHandle) {
        return res.status(400).json({ error: "handles must include timestampHandle, subjectHashHandle, unreadHandle" });
      }
      const { txHash: h, mailId } = await sendMailEncryptedOnChain(
        to, cid,
        { tsIn: timestampHandle, subjectHashIn: subjectHashHandle, unreadIn: unreadHandle },
        inputProof
      );
      finalTxHash = h;
      finalMailId = mailId;
      finalMode = "real";
    }
    else if (tsPlain != null && subjectHashPlain != null) {
      const { txHash: h, mailId } = await sendMailMockOnChain(
        to, cid,
        Number(tsPlain),
        BigInt(subjectHashPlain),
        unreadPlain ?? true
      );
      finalTxHash = h;
      finalMailId = mailId;
      finalMode = "mock";
    }
    else {
      return res.status(400).json({
        error: "Invalid payload."
      });
    }

    const doc = new Mail({
      mailId: finalMailId ?? undefined,
      from: from.toLowerCase(),
      to: to.toLowerCase(),
      cid,
      txHash: finalTxHash,
      blockNumber: finalBlock ?? undefined,
      chainId: finalChainId,
      contract: finalContract ?? undefined,
      mode: finalMode ?? undefined,
      subject: subject ?? undefined,
      body: body ?? undefined,
      timestamp: timestamp ? new Date(timestamp) : undefined,
      unread: typeof unread === "boolean" ? unread : undefined,
    });
    await doc.save();

    return res.status(201).json({
      success: true,
      txHash: finalTxHash,
      mailId: finalMailId,
      mail: doc
    });
  } catch (err) {
    console.error("❌ Error sending mail:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getInboxMails = async (req, res) => {
  try {
    const { address } = req.params;
    if (!address) return res.status(400).json({ error: "Address is required" });

    const useMock = String(req.query.mock || "").toLowerCase() === "true";

    const chainMails = await getInboxFromChain(address, useMock);
    const localMails = await Mail.find({ to: address.toLowerCase() }).sort({ createdAt: -1 });

    return res.json({ source: "combined", mock: useMock, inbox: [...chainMails, ...localMails] });
  } catch (err) {
    console.error("❌ Error fetching inbox:", err);
    return res.status(500).json({ error: err.message });
  }
};

export const getSentMails = async (req, res) => {
  try {
    const { address } = req.params;
    if (!address) return res.status(400).json({ error: "Address is required" });

    const wantMock = String(req.query.mock || "").toLowerCase() === "true";

    // normalize address (checksummed) for filters
    let who;
    try { who = ethers.getAddress(address); } catch { who = address; }

    // If client asked for mock, use it. Otherwise: try real → fallback to mock if empty.
    let chainMails = await getSentFromChain(who, wantMock);
    let mockUsed = wantMock;

    if (!wantMock && chainMails.length === 0) {
      const mockTry = await getSentFromChain(who, true);
      if (mockTry.length) { chainMails = mockTry; mockUsed = true; }
    }

    const localMails = await Mail.find({ from: address.toLowerCase() }).sort({ createdAt: -1 });

    return res.json({
      source: "combined",
      mock: mockUsed,
      sent: [...chainMails, ...localMails],
    });
  } catch (err) {
    console.error("❌ Error fetching sent mails:", err);
    return res.status(500).json({ error: err.message });
  }
};


export const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const useMock = String(req.query.mock || "").toLowerCase() === "true";

    if (/^[a-f\d]{24}$/i.test(id)) {
      const mail = await Mail.findById(id);
      if (mail) return res.json({ source: "database", mail });
    }

    const numericId = Number(id);
    if (Number.isNaN(numericId)) return res.status(400).json({ error: "Invalid id" });

    const onChainMsg = await getMessageFromChain(numericId, useMock);
    if (!onChainMsg) return res.status(404).json({ error: "Not found" });

    return res.json({ source: "blockchain", mock: useMock, mail: onChainMsg });
  } catch (err) {
    console.error("❌ Error fetching mail by ID:", err);
    return res.status(500).json({ error: err.message });
  }
};


export const getMessageByTx = async (req, res) => {
  try {
    const { txHash } = req.params;
    if (!txHash) return res.status(400).json({ error: "txHash is required" });

    const mail = await Mail.findOne({ txHash: txHash.toLowerCase?.() || txHash }).lean();
    if (!mail) return res.status(404).json({ error: "Not found" });

    return res.json({ mail });
  } catch (e) {
    console.error("❌ getMessageByTx error:", e);
    return res.status(500).json({ error: e.message });
  }
};
