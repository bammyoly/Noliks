// contract/scripts/deploy.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function waitDeployed(c) {
  if (typeof c.waitForDeployment === "function") return c.waitForDeployment(); // ethers v6
  if (typeof c.deployed === "function") return c.deployed();                   // ethers v5
}
async function getAddr(c) {
  return typeof c.getAddress === "function" ? c.getAddress() : c.address;
}
async function waitConf(c, n = 1) {
  const tx = (typeof c.deploymentTransaction === "function" && c.deploymentTransaction()) || c.deployTransaction;
  if (tx?.wait) await tx.wait(n);
}

function writeAddresses(realAddr, mockAddr) {
  const out = {
    "11155111": {
      FHEMailbox: realAddr,
      FHEMailboxMock: mockAddr
    }
  };
  const sharedAddresses = path.join(__dirname, "..", "..", "shared", "addresses.json");
  fs.mkdirSync(path.dirname(sharedAddresses), { recursive: true });
  fs.writeFileSync(sharedAddresses, JSON.stringify(out, null, 2));
  console.log(`\n💾 Saved addresses to ${sharedAddresses}`);
}

async function writeAbiFiles() {
  // Write ABI arrays (not full artifacts) so frontend can import directly
  const sharedAbiDir = path.join(__dirname, "..", "..", "shared", "abi");
  fs.mkdirSync(sharedAbiDir, { recursive: true });

  const writeAbi = async (name) => {
    const art = await hre.artifacts.readArtifact(name); // { abi, bytecode, ... }
    const outFile = path.join(sharedAbiDir, `${name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(art.abi, null, 2));
    console.log(`🧾 Wrote ABI: ${outFile}`);
  };

  await writeAbi("FHEMailbox");
  await writeAbi("FHEMailboxMock");
}

async function main() {
  // Ensure fresh build
  await hre.run("clean");
  await hre.run("compile");

  const net = await hre.ethers.provider.getNetwork();
  const chainId = Number(net.chainId?.toString?.() ?? net.chainId);
  console.log(`\n🌐 Network: ${hre.network.name} | chainId: ${chainId}`);
  if (chainId !== 11155111) throw new Error("Sepolia only (11155111).");

  console.log("\n🚀 Deploying FHEMailbox...");
  const Real = await hre.ethers.getContractFactory("FHEMailbox");
  const real = await Real.deploy();
  await waitDeployed(real);
  await waitConf(real, 1);
  const realAddr = await getAddr(real);
  console.log(`✅ FHEMailbox @ ${realAddr}`);

  console.log("\n🧪 Deploying FHEMailboxMock...");
  const Mock = await hre.ethers.getContractFactory("FHEMailboxMock");
  const mock = await Mock.deploy();
  await waitDeployed(mock);
  await waitConf(mock, 1);
  const mockAddr = await getAddr(mock);
  console.log(`✅ FHEMailboxMock @ ${mockAddr}`);

  // Write outputs for frontend/backend
  await writeAbiFiles();              // -> shared/abi/FHEMailbox*.json
  writeAddresses(realAddr, mockAddr); // -> shared/addresses.json

  console.log("\n📌 Copy these into frontend/src/contracts after deploy:");
  console.log("  - shared/addresses.json  -> frontend/src/contracts/addresses.json");
  console.log("  - shared/abi/*.json      -> frontend/src/contracts/abi/");
  console.log("");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
