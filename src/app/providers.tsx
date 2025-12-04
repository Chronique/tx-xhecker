"use client";

import dynamic from "next/dynamic";

import FrameProvider from "~/components/providers/FrameProvider";


const WagmiProvider = dynamic(
  // ✅ FIX: Next.js akan otomatis mengambil default export
  () => import("~/components/providers/WagmiProvider"),
  {
    ssr: false,
  }
);

// ErudaProvider sudah dihapus
// ...

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider>
      <FrameProvider>
        {children}
      </FrameProvider>
    </WagmiProvider>
  );
}