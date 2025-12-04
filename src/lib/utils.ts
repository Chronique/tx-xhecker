import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export const METADATA = {
  name: "Base Stats Checker",
  description: "Check your Neynar Score and Onchain Transaction Count on Base",
  bannerImageUrl: 'https://i.imgur.com/2bsV8mV.png', // Bisa kamu ganti nanti dengan gambar sendiri
  iconImageUrl: 'https://i.imgur.com/brcnijg.png',   // Bisa kamu ganti nanti dengan icon sendiri
  homeUrl: "https://tx-xhecker.vercel.app",
  splashBackgroundColor: "#000000" // Saya ganti hitam biar sesuai tema
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}