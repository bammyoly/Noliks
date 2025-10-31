import 'dotenv/config';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SHARED_DIR = path.resolve(__dirname, '../../..', 'shared');
const ADDR_FILE  = path.join(SHARED_DIR, 'addresses.json');
const ABI_REAL   = path.join(SHARED_DIR, 'abi', 'FHEMailbox.json');
const ABI_MOCK   = path.join(SHARED_DIR, 'abi', 'FHEMailboxMock.json');

// ----- Load shared data -----
const addresses         = JSON.parse(fs.readFileSync(ADDR_FILE, 'utf8'));
const FHEMailboxABI     = JSON.parse(fs.readFileSync(ABI_REAL, 'utf8'));
const FHEMailboxMockABI = JSON.parse(fs.readFileSync(ABI_MOCK, 'utf8'));

// ----- RPC / Keys -----
const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL;
const PK      = (process.env.BOT_PRIVATE_KEY || process.env.PRIVATE_KEY || '').trim();
if (!RPC_URL) throw new Error('Missing SEPOLIA_RPC_URL (or RPC_URL) in .env');
if (!PK)      throw new Error('Missing PRIVATE_KEY (or BOT_PRIVATE_KEY) in .env');

// ----- Chain config -----
const CHAIN_ID = Number(process.env.CHAIN_ID || 11155111);
const isAddr = (v) => typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v);

// env → chainId → sepolia → flat
function resolveAddress(key) {
  const env = process.env[`${key}_ADDRESS`];          // e.g., FHEMailbox_ADDRESS
  if (isAddr(env)) return env;

  const byId = addresses?.[String(CHAIN_ID)]?.[key];
  if (isAddr(byId)) return byId;

  const byName = addresses?.sepolia?.[key];
  if (isAddr(byName)) return byName;

  const flat = addresses?.[key];
  if (isAddr(flat)) return flat;

  throw new Error(`Address for ${key} not found (add "${CHAIN_ID}" or "sepolia" in shared/addresses.json).`);
}

// ----- Provider & Signer -----
export const provider = new ethers.JsonRpcProvider(RPC_URL);
export const wallet   = new ethers.Wallet(PK, provider);

// ----- Contracts (real + mock) -----
export const mailbox     = new ethers.Contract(resolveAddress('FHEMailbox'), FHEMailboxABI, wallet);
export const mailboxMock = new ethers.Contract(resolveAddress('FHEMailboxMock'), FHEMailboxMockABI, wallet);

// ----- Start block & log-scan limits -----
const START_BLOCK = Number(process.env.START_BLOCK || 0);
const LOG_WINDOW  = Number(process.env.LOG_WINDOW  || 1000); // scan last N blocks when START_BLOCK not set
const LOG_CHUNK   = Number(process.env.LOG_CHUNK   || 10);   // provider free-tier safe chunk

// Figure out a safe block range
async function resolveRange() {
  const latest = await provider.getBlockNumber();
  const fromEnv = Number(process.env.START_BLOCK || NaN);
  const from = Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : Math.max(0, latest - LOG_WINDOW);
  const to = latest;
  return { from, to };
}

// Query logs in small chunks to avoid provider limits
async function queryFilterChunked(contract, filter, from, to, step = LOG_CHUNK) {
  const out = [];
  for (let start = from; start <= to; start += step) {
    const end = Math.min(start + step - 1, to);
    const chunk = await contract.queryFilter(filter, start, end);
    out.push(...chunk);
  }
  return out;
}

// REAL path (needs externals + proof from frontend’s FHE SDK)
export async function sendMailEncryptedOnChain(to, cid, { tsIn, subjectHashIn, unreadIn }, proof) {
  const tx = await mailbox.sendMailEncrypted(to, cid, tsIn, subjectHashIn, unreadIn, proof);
  const receipt = await tx.wait();

  let mailId = null;
  try {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== mailbox.target.toLowerCase()) continue;
      const p = mailbox.interface.parseLog(log);
      if (p?.name === 'EncryptedMailSent') { mailId = Number(p.args.id); break; }
    }
  } catch {}
  return { txHash: receipt.hash ?? receipt.transactionHash, mailId };
}

export async function sendMailMockOnChain(to, cid, tsPlain, subjectHashPlain, unreadPlain = true) {
  const tx = await mailboxMock.sendMailMock(to, cid, tsPlain, subjectHashPlain, unreadPlain);
  const receipt = await tx.wait();

  let mailId = null;
  try {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== mailboxMock.target.toLowerCase()) continue;
      const p = mailboxMock.interface.parseLog(log);
      if (p?.name === 'EncryptedMailSent') { mailId = Number(p.args.id); break; }
    }
  } catch {}
  return { txHash: receipt.hash ?? receipt.transactionHash, mailId };
}

export { sendMailEncryptedOnChain as sendMailOnChain };

// =====================
// READ HELPERS (chunked)
// =====================

export async function getInboxFromChain(user, useMock = false) {
  const c = useMock ? mailboxMock : mailbox;
  let who = user; try { who = ethers.getAddress(user); } catch {}
  const { from, to } = await resolveRange();
  const filter = c.filters.EncryptedMailSent(null, null, who);
  const events = await queryFilterChunked(c, filter, from, to);

  const out = [];
  for (const ev of events) {
    const { id, from: sender, to: recipient } = ev.args;
    const block = await provider.getBlock(ev.blockNumber);
    out.push({
      id: Number(id),
      from: sender,
      to: recipient,
      txHash: ev.transactionHash,
      blockNumber: ev.blockNumber,
      blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
    });
  }
  return out.sort((a, b) => b.blockNumber - a.blockNumber);
}

export async function getSentFromChain(user, useMock = false) {
  const c = useMock ? mailboxMock : mailbox;
  let who = user; try { who = ethers.getAddress(user); } catch {}
  const { from, to } = await resolveRange();
  const filter = c.filters.EncryptedMailSent(null, who, null);
  const events = await queryFilterChunked(c, filter, from, to);

  const out = [];
  for (const ev of events) {
    const { id, from: sender, to: recipient } = ev.args;
    const block = await provider.getBlock(ev.blockNumber);
    out.push({
      id: Number(id),
      from: sender,
      to: recipient,
      txHash: ev.transactionHash,
      blockNumber: ev.blockNumber,
      blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
    });
  }
  return out.sort((a, b) => b.blockNumber - a.blockNumber);
}

export async function getMessageFromChain(id, useMock = false) {
  const c = useMock ? mailboxMock : mailbox;
  const { from, to } = await resolveRange();
  const topic = c.interface.getEvent('EncryptedMailSent').topicHash;
  const indexedId = ethers.zeroPadValue(ethers.toBeHex(id), 32);

  for (let start = from; start <= to; start += LOG_CHUNK) {
    const end = Math.min(start + LOG_CHUNK - 1, to);
    const logs = await provider.getLogs({
      address: c.target,
      fromBlock: start,
      toBlock: end,
      topics: [topic, indexedId],
    });
    if (logs.length) {
      const parsed = c.interface.parseLog(logs[0]);
      const block  = await provider.getBlock(logs[0].blockNumber);
      return {
        id: Number(parsed.args.id),
        from: parsed.args.from,
        to: parsed.args.to,
        txHash: logs[0].transactionHash,
        blockNumber: logs[0].blockNumber,
        blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
      };
    }
  }
  return null;
}

//Connect check
export async function checkConnection() {
  const net = await provider.getNetwork();
  return {
    chainId: Number(net.chainId),
    mailbox: mailbox.target,
    mailboxMock: mailboxMock.target,
  };
}

console.log('✅ fhEVM service ready:', {
  rpc: RPC_URL?.slice(0, 28) + '…',
  chainId: CHAIN_ID,
  mailbox: mailbox.target,
  mailboxMock: mailboxMock.target
});
