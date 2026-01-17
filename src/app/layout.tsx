import type { Metadata } from "next";
import "~/app/globals.css";
import { Providers } from "~/app/providers";
import { ThemeProvider } from "~/components/providers/ThemeProvider";
import { METADATA } from "~/lib/utils";

export const metadata: Metadata = {
  title: METADATA.name,
  description: METADATA.description,
  openGraph: {
    title: METADATA.name,
    description: METADATA.description,
    images: [METADATA.bannerImageUrl],
    url: METADATA.homeUrl,
    siteName: METADATA.name
  },
  // --- Farcaster Mini App (v2) Configuration ---
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: METADATA.bannerImageUrl,
      button: {
        title: "Check Stats",
        action: {
          type: "launch_frame",
          name: METADATA.name,
          url: METADATA.homeUrl,
          splashImageUrl: METADATA.iconImageUrl,
          splashBackgroundColor: METADATA.splashBackgroundColor,
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning wajib ada untuk next-themes agar tidak error di console
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            {children}
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}