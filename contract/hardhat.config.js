require("@nomiclabs/hardhat-ethers");     
require("dotenv").config();

const {
  SEPOLIA_RPC_URL,
  SEPOLIA_PRIVATE_KEY,
  ETHERSCAN_API_KEY
} = process.env;

module.exports = {
  solidity: {
    version: "0.8.24",  
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: false   
    }
  },

  networks: {
    hardhat: {
      allowUnlimitedContractSize: true, 
    },

    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
      chainId: 11155111,
      gas: "auto",
      gasPrice: "auto",
      timeout: 120000,
    },
  },

  etherscan: {
    apiKey: ETHERSCAN_API_KEY || "",
  },

  fhevm: {
    network: "sepolia",
    verify: true,         
  },
};
