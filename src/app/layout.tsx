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
  other: {
    "talentapp:project_verification": "88cba648c9ddee23dff549d1a781a223b6256d7e50e696066f1c07b0b3a8a0d47068c9abc9b45ae6591e702bbe9e5a82271f359bd7647b782552e64d56bcb8d6",
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
    // suppressHydrationWarning wajib untuk fitur ganti tema
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