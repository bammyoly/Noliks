import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const ROOT_SHARED_DIR = path.resolve("..", "shared");
const ADDR_FILE = path.join(ROOT_SHARED_DIR, "addresses.json");
const ABI_DIR = path.join(ROOT_SHARED_DIR, "abi");

// Load addresses
const addresses = JSON.parse(fs.readFileSync(ADDR_FILE, "utf8"));
const network = process.env.NETWORK || "sepolia";
const currentAddresses = addresses[network];

if (!currentAddresses) {
  throw new Error(`❌ No addresses found for network ${network}`);
}

// Load ABIs
const mailPolicyABI = JSON.parse(fs.readFileSync(path.join(ABI_DIR, "FHEMailPolicy.json"), "utf8"));
const mailboxABI = JSON.parse(fs.readFileSync(path.join(ABI_DIR, "FHEMailbox.json"), "utf8"));

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Initialize contract instances
const mailbox = new ethers.Contract(currentAddresses.FHEMailbox, mailboxABI, wallet);

console.log(`✅ Connected to FHEMailbox @ ${mailbox.target}`);

export { mailPolicy, mailbox, provider, wallet };
