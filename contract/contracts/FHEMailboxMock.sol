// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    FHE,
    ebool,
    euint256,
    euint64,
    externalEbool,
    externalEuint64,
    externalEuint256
} from "@fhevm/solidity/lib/FHE.sol";

import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEMailboxMock
 * @notice Hybrid mailbox for fhEVM:
 *         - Real path: accepts external encrypted inputs + proof (Relayer SDK).
 *         - Mock path: DEV/TEST ONLY, accepts plaintext and wraps with FHE.as* on-chain.
 * @dev    Same storage layout & events as your real contract, so the frontend/back-end can reuse it.
 */
contract FHEMailboxMock is SepoliaConfig {
    /* -------------------------- Ownable-lite (no OZ) -------------------------- */
    address public owner;
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /* --------------------------------- Storage -------------------------------- */
    struct EncryptedMail {
        address from;
        address to;
        string cid;             // IPFS CID or short ID (≤100 chars)
        euint64 timestamp;      // Encrypted timestamp
        euint256 subjectHash;   // Encrypted subject hash
        ebool unread;           // Encrypted unread flag
    }

    uint256 public nextId;
    mapping(uint256 => EncryptedMail) public mails;
    mapping(address => uint256[]) private inboxIndex;

    uint256 private constant CID_MAX_LEN = 100;

    bool public mockEnabled = true; // toggle by owner

    /* --------------------------------- Events --------------------------------- */
    event EncryptedMailSent(uint256 indexed id, address indexed from, address indexed to);
    event MailRead(uint256 indexed id, address indexed by);

    /* ---------------------------- Owner-only toggles --------------------------- */
    function setMockEnabled(bool enabled) external onlyOwner {
        mockEnabled = enabled;
    }

    /* --------------------------- REAL (FHE external) --------------------------- */
    /**
     * @notice Sends an encrypted mail using external ciphertexts from the Relayer SDK.
     * @dev    Same signature as your real contract.
     */
    function sendMailEncrypted(
        address to,
        string calldata cid,
        externalEuint64 tsIn,
        externalEuint256 subjectHashIn,
        externalEbool unreadIn,
        bytes calldata proof
    ) external returns (uint256 id) {
        require(to != address(0), "Recipient cannot be zero");
        require(bytes(cid).length <= CID_MAX_LEN, "CID too long");

        euint64 ts = FHE.fromExternal(tsIn, proof);
        euint256 subHash = FHE.fromExternal(subjectHashIn, proof);
        ebool unread = FHE.fromExternal(unreadIn, proof);

        id = _storeMail(to, cid, ts, subHash, unread);
    }

    /* ----------------------------- MOCK (no SDK) ------------------------------ */
    /**
     * @notice DEV/TEST path. Accepts plaintext and wraps into encrypted types on-chain.
     * @dev    Gate with `mockEnabled`. DO NOT use in production without the toggle.
     */
    function sendMailMock(
        address to,
        string calldata cid,
        uint64 tsPlain,
        uint256 subjectHashPlain,
        bool unreadPlain
    ) external returns (uint256 id) {
        require(mockEnabled, "Mock disabled");
        require(to != address(0), "Recipient cannot be zero");
        require(bytes(cid).length <= CID_MAX_LEN, "CID too long");

        euint64 ts = FHE.asEuint64(tsPlain);
        euint256 subHash = FHE.asEuint256(subjectHashPlain);
        ebool unread = FHE.asEbool(unreadPlain);

        id = _storeMail(to, cid, ts, subHash, unread);
    }

    /* ------------------------------- Core logic ------------------------------- */
    function _storeMail(
        address to,
        string calldata cid,
        euint64 ts,
        euint256 subHash,
        ebool unread
    ) internal returns (uint256 id) {
        id = nextId++;
        mails[id] = EncryptedMail({
            from: msg.sender,
            to: to,
            cid: cid,
            timestamp: ts,
            subjectHash: subHash,
            unread: unread
        });

        inboxIndex[to].push(id);
        emit EncryptedMailSent(id, msg.sender, to);

        // Grant decrypt rights (ACL) to recipient and sender
        FHE.allow(mails[id].timestamp, to);
        FHE.allow(mails[id].subjectHash, to);
        FHE.allow(mails[id].unread, to);

        FHE.allow(mails[id].timestamp, msg.sender);
        FHE.allow(mails[id].subjectHash, msg.sender);
        FHE.allow(mails[id].unread, msg.sender);
    }

    /* ------------------------------ Read/Helpers ------------------------------ */
    function markAsReadConfidential(uint256 id) public {
        require(id < nextId, "Invalid id");
        EncryptedMail storage m = mails[id];
        require(msg.sender == m.to, "Only recipient");

        m.unread = FHE.asEbool(false);

        FHE.allow(m.unread, m.to);
        FHE.allow(m.unread, m.from);

        emit MailRead(id, msg.sender);
    }

    function myInbox() external view returns (uint256[] memory) {
        return inboxIndex[msg.sender];
    }

    function getInbox(address user) external view returns (uint256[] memory) {
        require(user == msg.sender, "Only self");
        return inboxIndex[user];
    }

    /**
     * @notice Return ciphertext *handles* for UI user-decryption (Relayer SDK).
     * @dev Caller must be sender or recipient.
     */
    function getMailHandles(uint256 id)
        external
        view
        returns (
            address from_,
            address to_,
            string memory cid_,
            bytes32 timestampHandle_,
            bytes32 subjectHashHandle_,
            bytes32 unreadHandle_
        )
    {
        require(id < nextId, "Invalid id");
        EncryptedMail storage m = mails[id];
        require(msg.sender == m.to || msg.sender == m.from, "Not allowed");

        from_ = m.from;
        to_ = m.to;
        cid_ = m.cid;
        timestampHandle_ = FHE.toBytes32(m.timestamp);
        subjectHashHandle_ = FHE.toBytes32(m.subjectHash);
        unreadHandle_ = FHE.toBytes32(m.unread);
    }

    /**
     * @notice Return raw encrypted fields (for tools/tests); restricted to sender/recipient.
     */
    function getEncryptedMail(uint256 id)
        external
        view
        returns (
            address from_,
            address to_,
            string memory cid_,
            euint64 timestamp_,
            euint256 subjectHash_,
            ebool unread_
        )
    {
        require(id < nextId, "Invalid id");
        EncryptedMail storage m = mails[id];
        require(msg.sender == m.to || msg.sender == m.from, "Not allowed");
        return (m.from, m.to, m.cid, m.timestamp, m.subjectHash, m.unread);
    }
}
