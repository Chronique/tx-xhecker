import { createConfig, http, WagmiProvider as Provider } from "wagmi";
import { base, optimism, type Chain } from "wagmi/chains"; 
import { baseAccount, injected, walletConnect } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { METADATA } from "../../lib/utils";

const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL;
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

let baseChainConfig: Chain = base;
if (paymasterUrl) {
  baseChainConfig = {
    ...base,
    rpcUrls: {
      ...base.rpcUrls,
      default: { http: [paymasterUrl] },
      public: { http: [paymasterUrl] }
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
    injected(),  // ✅ Tanpa target = support semua wallet (Rabby, OKX, MetaMask, dll)
    baseAccount({
      appName: METADATA.name,
      appLogoUrl: METADATA.iconImageUrl,
    }),
    ...(walletConnectProjectId
      ? [walletConnect({ projectId: walletConnectProjectId, metadata: { name: METADATA.name, description: "", url: METADATA.homeUrl, icons: [METADATA.iconImageUrl] } })]
      : []
    ),
  ],
});

const queryClient = new QueryClient();

export default function WagmiProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}