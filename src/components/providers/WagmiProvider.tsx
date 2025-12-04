import { createConfig, http, WagmiProvider as Provider } from "wagmi";
import { base, optimism, type Chain } from "wagmi/chains"; 
import { baseAccount } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { METADATA } from "../../lib/utils";

// --- DETEKSI PAYMASTER ---
const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL;

// --- KONFIGURASI CHAIN BASE ---
let baseChainConfig: Chain = base;

if (paymasterUrl) {
    baseChainConfig = {
        ...base,
        rpcUrls: {
            ...base.rpcUrls,
            default: {
                http: [paymasterUrl],
            },
            public: {
                http: [paymasterUrl],
            }
        }
    } as Chain;
}

const chains = [baseChainConfig, optimism] as const; 

export const config = createConfig({
  chains: chains as unknown as [Chain, ...Chain[]], 
  transports: {
    [baseChainConfig.id]: http(),
    [optimism.id]: http(),
  },
  connectors: [
    farcasterMiniApp(), 
    baseAccount({
      appName: METADATA.name,
      appLogoUrl: METADATA.iconImageUrl,
    })
  ],
});

const queryClient = new QueryClient();

// ✅ FIX: Ganti nama export default menjadi WagmiProvider
export default function WagmiProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}