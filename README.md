# ZAMail
# Send Encrypted Messages Onchain

## Structure
- `frontend/` React (Vite)
- `backend/` Express API
- `contract/` Hardhat
- `shared/` ABIs + addresses used by FE/BE

## Setup
1. Copy envs:
   - `cp contract/.env.example contract/.env`
   - `cp backend/.env.example backend/.env`
   - `cp frontend/.env.example frontend/.env`
2. Install:
   - `(cd contract && npm i)`
   - `(cd backend && npm i)`
   - `(cd frontend && npm i)`
3. Run:
   - Backend: `(cd backend && npm run dev)`
   - Frontend: `(cd frontend && npm run dev)`
4. Deploy contracts (Sepolia):
   - `(cd contract && npx hardhat run scripts/deploy.js --network sepolia)`
   - This writes ABIs + addresses into `shared/` (commit updates).

## Notes
- Do **not** commit real `.env` files.
- `shared/` is source of truth for ABIs/addresses.


# Solution Overview

* **What it is:** A Web3 private mailbox on **Ethereum Sepolia** that lets users send/receive mail with **on-chain privacy** using **Zama FHE/fhEVM** and a **hybrid off-chain store**.
* **Problem solved:** Normal smart contracts make data public. This app keeps sensitive mail content private while still recording tamper-proof mail events on-chain.
* **How it works (high level):**

  * **On-chain (private metadata):** Encrypted `timestamp`, `subjectHash`, and `unread` flag are stored using **FHE types**; only sender/recipient can decrypt handles.
  * **Off-chain (message body):** Full message (subject/body) is stored off-chain (MongoDB; optional IPFS CID). Frontend can decrypt client-side in the real FHE path.
  * **Tx-first flow:** User signs and sends a transaction **first** (real FHE or mock). Backend then saves the reference + optional plaintext (for testing) to DB.
  * **Fallback mock:** If FHE engine isn’t ready, a **Mock contract** stores public equivalents so you can test end-to-end quickly.

---

# Key Features

* **Dual contract support**

  * **FHEMailbox (real):** Uses fhEVM encrypted types (`euint64`, `euint256`, `ebool`) + **Zama Relayer SDK** proofs.
  * **FHEMailboxMock (testing):** Plain `uint64/uint256/bool` to simulate the flow when FHE isn’t available.

* **Compose & Send**

  * **Wallet transaction first** (Sepolia), then backend save.
  * **Auto-detect FHE engine:** Use real FHE path when ready; **fallback to mock** otherwise.
  * **Proof handling:** Client generates/attaches proof for real FHE calls.

* **Inbox & Sent**

  * **Combined view:** Merges **chain events** with **DB rows** (dedupe by `txHash/mailId`).
  * **Hydration:** If chain row lacks plaintext, UI **fetches DB details by txHash** to show subject/body.
  * **Etherscan links, CID copy, unread badge**, block/time chips.

* **Privacy & Security**

  * **No plaintext on-chain.** Only encrypted metadata and a CID/string reference are recorded.
  * **Access control:** `FHE.allow` grants decrypt rights to sender/recipient.
  * **Client-side decrypt path:** Frontend can decrypt handles with the Relayer SDK; off-chain payload can be encrypted (e.g., AES-GCM) for end-to-end privacy.

* **Resilient event scanning**

  * **Chunked log queries** to respect free RPC limits (e.g., Alchemy 10-block window).
  * Configurable via `.env`: `START_BLOCK`, `LOG_WINDOW`, `LOG_CHUNK`.

* **Shared build artifacts**

  * **`/shared` folder** holds **ABIs** and **addresses.json** for **both** FE & BE.
  * **Deploy script** writes fresh ABIs/addresses after each deployment.

* **Developer experience**

  * **Mock mode** toggle in UI (`?mock=true` on API) for quick testing.
  * **Automatic Sepolia switch/add** in the browser.
  * **Clear errors & fallbacks** when FHE/CDN/wallet isn’t ready.

---

# Architecture (brief)

* **Frontend (React + Wagmi)**

  * FHE detection/context; real vs mock path.
  * Inbox/Sent pages with dedupe + hydration.
  * Etherscan links, CID copy, Quill editor support.

* **Backend (Node/Express + MongoDB)**

  * `POST /api/mail/send` (tx-first save; legacy forward supported).
  * `GET /api/mail/inbox/:address` & `GET /api/mail/sent/:address` (mock toggle).
  * `GET /api/mail/by-tx/:txHash` (hydrate subject/body).
  * Chunked chain scans to avoid RPC range limits.

* **Contracts (Hardhat)**

  * `FHEMailbox.sol` (real, fhEVM).
  * `FHEMailboxMock.sol` (testing).
  * Deploys to **Sepolia**; outputs to `/shared`.

---

# Limitations / Notes

* **FHE engine required** for real private on-chain writes (Relayer SDK + proofs).
* **Off-chain message encryption** current mock path may store plaintext in DB for testing.
* **RPC limits**: Free providers limit `eth_getLogs`; use provided chunking or set `START_BLOCK` to deployment height for faster queries.

