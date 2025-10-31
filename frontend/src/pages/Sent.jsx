import React, { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString(); } catch { return iso || ""; } };
const etherscanTx = (hash) => (hash ? `https://sepolia.etherscan.io/tx/${hash}` : "#");
const stripHtml = (html) =>
  typeof html === "string" ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";

function normalizeRow(r) {
  const bodyPlain = r.body ? stripHtml(r.body) : "";
  const subject =
    (r.subject && r.subject.trim()) ||
    (bodyPlain ? bodyPlain.slice(0, 80) : "(encrypted/hidden)");
  const snippet =
    bodyPlain
      ? bodyPlain.slice(0, 90)
      : (r.cid ? `CID: ${r.cid}` : (r.txHash ? `tx: ${r.txHash.slice(0, 10)}…` : ""));

  return {
    key: r.txHash || r._id || r.mailId || r.id || Math.random().toString(36).slice(2),
    id: r.id ?? r.mailId ?? null,
    to: r.to,
    from: r.from,
    cid: r.cid,
    txHash: r.txHash,
    blockNumber: r.blockNumber,
    date: r.blockTime || r.timestamp || r.createdAt,
    subject,
    snippet,
    bodyPlain,
    read: r.unread === false,
    source: r.source || (r.blockNumber ? "chain" : "db"),
  };
}

export default function Sent() {
  const { address } = useAccount();

  const [items, setItems] = useState([]);
  const [selectedMail, setSelectedMail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [mock, setMock] = useState(false);

  const unreadCount = useMemo(
    () => items.filter((m) => m.read === false).length,
    [items]
  );

  function mergeRows(rows) {
    const map = new Map();
    for (const r of rows) {
      const k = r.txHash || r.mailId || r.id || r._id || "";
      const next = normalizeRow(r);
      if (!k) {
        map.set(next.key, next);
        continue;
      }
      const cur = map.get(k);
      if (!cur) {
        map.set(k, next);
      } else {
        const betterSubject =
          cur.subject === "(encrypted/hidden)" && next.subject !== "(encrypted/hidden)"
            ? next.subject
            : cur.subject;
        const betterBodyPlain =
          (next.bodyPlain || "").length > (cur.bodyPlain || "").length ? next.bodyPlain : cur.bodyPlain;
        map.set(k, {
          ...cur,
          ...next,
          subject: betterSubject,
          bodyPlain: betterBodyPlain,
        });
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.blockNumber && b.blockNumber) return b.blockNumber - a.blockNumber;
      return new Date(b.date || 0) - new Date(a.date || 0);
    });
    return arr;
  }

  const load = async () => {
    if (!address) return;
    setLoading(true);
    setErr("");
    try {
      const url = `${API_BASE_URL}/api/mail/sent/${address}${mock ? "?mock=true" : ""}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to fetch sent messages");
      const rows = Array.isArray(data.sent) ? data.sent : [];
      const merged = mergeRows(rows);
      setItems(merged);
      setSelectedMail((cur) => cur || merged[0] || null);
    } catch (e) {
      setErr(e.message || "Failed to load sent");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [address, mock]);

  async function loadDbDetails(txHash) {
    if (!txHash) return null;
    const r = await fetch(`${API_BASE_URL}/api/mail/by-tx/${txHash}`);
    if (!r.ok) return null;
    const { mail } = await r.json();
    if (!mail) return null;
    return {
      subject: mail.subject || "(encrypted/hidden)",
      bodyPlain: stripHtml(mail.body),
    };
  }

  const onSelect = async (mail) => {
    if ((!mail.bodyPlain || mail.subject === "(encrypted/hidden)") && mail.txHash) {
      const extra = await loadDbDetails(mail.txHash);
      if (extra) {
        const updated = { ...mail, ...extra };
        setSelectedMail(updated);
        setItems((prev) => prev.map((m) => (m.key === mail.key ? updated : m)));
        return;
      }
    }
    setSelectedMail(mail);
  };

  const MessageList = () => (
    <div className="w-80 border-r border-gray-200 h-full overflow-y-auto bg-white shadow-lg">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Sent ({unreadCount} unread)</h2>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={mock} onChange={(e) => setMock(e.target.checked)} />
          Mock
        </label>
      </div>

      {loading && !items.length ? (
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-4 text-sm text-gray-500">No sent messages yet.</div>
      ) : (
        items.map((mail) => (
          <div
            key={mail.key}
            onClick={() => onSelect(mail)}
            className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
              selectedMail?.key === mail.key ? "bg-red-50 border-l-4 border-red-600" : "hover:bg-gray-50"
            }`}
          >
            <div className={`font-semibold ${mail.read ? "text-gray-600" : "text-gray-900"}`}>
              To: {shortAddr(mail.to)}
            </div>
            <div className={`text-sm ${mail.read ? "text-gray-500" : "text-gray-700"}`}>{mail.subject}</div>
            <div className="text-xs text-gray-400 truncate">{mail.snippet}</div>
          </div>
        ))
      )}
    </div>
  );

  const MessageDetail = () => {
    if (!selectedMail) {
      return (
        <div className="flex-1 p-10 text-center text-gray-500">
          Select a message to view.
        </div>
      );
    }

    return (
      <div className="flex-1 h-full overflow-y-auto p-8">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-1">{selectedMail.subject}</h2>
          <div className="flex flex-wrap gap-3 items-center text-sm text-gray-500">
            <p>
              To: <span className="font-medium text-gray-700">{shortAddr(selectedMail.to)}</span>
            </p>
            <p>{fmtTime(selectedMail.date)}</p>
            {selectedMail.blockNumber != null && (
              <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-1">#{selectedMail.blockNumber}</span>
            )}
            <span className="text-xs rounded-full px-2 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200">
              {selectedMail.source?.toUpperCase?.() || (mock ? "MOCK" : "CHAIN")}
            </span>
            {selectedMail.txHash && (
              <a
                href={etherscanTx(selectedMail.txHash)}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 hover:underline"
              >
                View on Etherscan ↗
              </a>
            )}
          </div>
        </div>

        <div className="mb-8 space-x-3">
          <button
            onClick={load}
            className="px-4 py-2 text-sm bg-yellow-600 hover:bg-red-700 text-white rounded-lg"
          >
            Refresh
          </button>
          {selectedMail.cid && (
            <button
              onClick={() => navigator.clipboard.writeText(selectedMail.cid)}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg"
            >
              Copy CID
            </button>
          )}
        </div>

        <div className="text-gray-700 leading-relaxed bg-gray-50 p-6 rounded-lg border border-gray-200">
          {selectedMail.bodyPlain ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{selectedMail.bodyPlain}</p>
          ) : (
            <>
              <p>
                Message body goes here. This is a mock message in a situation the relayer sdk didnt initialize
              </p>
              {selectedMail.cid && (
                <p className="mt-4 text-xs italic text-gray-500">CID: {selectedMail.cid}</p>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  if (!address) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-gray-600">
        Connect your wallet to view sent messages.
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] bg-gray-50">
      <MessageList />
      <MessageDetail />
    </div>
  );
}
