import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from "react-router-dom"
import { FheProvider } from "./context/FheContext";

import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { createConfig, WagmiConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const sepoliaRpcUrl = import.meta.env.VITE_SEPOLIA_RPC;

const chains = [sepolia]; 

const { connectors } = getDefaultWallets({
  appName: 'My Sepolia DApp',
  projectId, 
  chains,
});

const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl || sepolia.rpcUrls.default.http[0]), 
  },
  autoConnect: true,
});


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={wagmiConfig}>
        <RainbowKitProvider chains={chains}> 
          <BrowserRouter>
            <FheProvider>
              <App />
            </FheProvider>
          </BrowserRouter>
        </RainbowKitProvider>
      </WagmiConfig>
    </QueryClientProvider>
  </StrictMode>,
);