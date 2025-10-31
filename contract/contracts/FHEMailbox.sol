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
 * @title FHEMailbox
 * @notice Private mailbox on fhEVM using Zama FHE.
 *         Sensitive fields are encrypted off-chain via the Relayer SDK and stored on-chain as fhEVM encrypted types.
 *         Reading uses the Relayer SDK's *user decryption* on ciphertext handles returned by view functions.
 */
contract FHEMailbox is SepoliaConfig {
    struct EncryptedMail {
        address from;
        address to;
        string cid;             
        euint64 timestamp;      
        euint256 subjectHash;   
        ebool unread;           
    }

    uint256 public nextId;
    mapping(uint256 => EncryptedMail) public mails;
    mapping(address => uint256[]) private inboxIndex;

    uint256 private constant CID_MAX_LEN = 100;

    event EncryptedMailSent(uint256 indexed id, address indexed from, address indexed to);
    event MailRead(uint256 indexed id, address indexed by);

    /// @notice Sends an encrypted mail (encrypted inputs provided as external encrypted values)
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

        // Grant decrypt rights (ACL) to recipient and sender (so both can user-decrypt)
        FHE.allow(mails[id].timestamp, to);
        FHE.allow(mails[id].subjectHash, to);
        FHE.allow(mails[id].unread, to);

        FHE.allow(mails[id].timestamp, msg.sender);
        FHE.allow(mails[id].subjectHash, msg.sender);
        FHE.allow(mails[id].unread, msg.sender);
    }

    /**
     * @notice Confidentially marks a mail item as read.
     *         Writes a new encrypted 'false' and re-allows permissions on the new ciphertext.
     */
    function markAsReadConfidential(uint256 id) public {
        require(id < nextId, "Invalid id");
        EncryptedMail storage m = mails[id];
        require(msg.sender == m.to, "Only recipient");

        // Overwrite with a fresh encrypted 'false'
        m.unread = FHE.asEbool(false);

        // Re-grant rights for the new ciphertext (permissions are per-ciphertext)
        FHE.allow(m.unread, m.to);
        FHE.allow(m.unread, m.from);

        emit MailRead(id, msg.sender);
    }

    /// @notice Return caller's inbox IDs (prevents probing others' metadata)
    function myInbox() external view returns (uint256[] memory) {
        return inboxIndex[msg.sender];
    }

    /// @notice (Restricted) Return a user's inbox IDs; only the user themselves may call this.
    function getInbox(address user) external view returns (uint256[] memory) {
        require(user == msg.sender, "Only self");
        return inboxIndex[user];
    }

    /**
     * @notice Return encrypted fields as ciphertext *handles* (bytes32) for frontend user-decryption.
     * @dev Caller must be the recipient or the sender.
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
     * @notice Return raw encrypted types (for tools/tests). UIs can also call this then use user-decryption.
     * @dev Restricted to sender/recipient to reduce handle leakage.
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
