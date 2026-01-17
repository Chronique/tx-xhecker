"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Wajib ada agar tidak error saat refresh (Hydration)
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-10 h-10" />;

  return (
    <button
      // Menggunakan z-50 agar tombol selalu berada di lapisan paling atas
      className="relative z-50 flex items-center justify-center w-10 h-10 rounded-full border border-border bg-muted/50 hover:bg-accent transition-all active:scale-95"
      onClick={() => {
        console.log("Current theme:", theme); // Untuk debug di console
        setTheme(theme === "dark" ? "light" : "dark");
      }}
      type="button"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}