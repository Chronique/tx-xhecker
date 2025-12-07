import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const METADATA = {
  name: "Base Stats Checker",
  description: "Check your Neynar Score and Onchain Transaction Count on Base",
  
  // --- GANTI KE LINK VERCEL KAMU + NAMA FILE DI PUBLIC ---
  heroImageUrl: 'https://tx-xhecker.vercel.app/banner.png', 
  bannerImageUrl: 'https://tx-xhecker.vercel.app/banner.png', 
  
  // Kalau icon juga mau pakai yang di folder public (icon.png)
  iconImageUrl: 'https://tx-xhecker.vercel.app/icon.png',   
  
  // Screenshot tetap pakai link eksternal atau upload dulu ke public juga
  screenshotUrls: [
    'https://tx-xhecker.vercel.app/screenshot.png',
  ],
  
  homeUrl: "https://tx-xhecker.vercel.app",
  splashBackgroundColor: "#000000"
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}