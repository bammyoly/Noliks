import { http, createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
const sepoliaRpc = import.meta.env.VITE_SEPOLIA_RPC || 'https://rpc.sepolia.org'

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId,
      showQrModal: true,
    }),
  ],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
  },
})
