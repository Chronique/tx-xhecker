"use client";

import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/input";
import { sdk } from "@farcaster/miniapp-sdk";

// Alamat wallet tujuan
const RECIPIENT_ADDRESS = "0x4fba95e4772be6d37a0c931D00570Fe2c9675524";
const PRESET_AMOUNTS = ["1", "3", "5", "10"];

export function TipBox() {
  const [amount, setAmount] = useState<string>("3");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  const handleSendTip = async () => {
    setIsProcessing(true);
    setStatus(null);
    try {
      // Menggunakan SDK Farcaster agar "langsung" muncul di Warpcast
      const result = await sdk.actions.sendToken({
        token: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
        amount: (parseFloat(amount) * 1000000).toString(), // 6 desimal USDC
        recipientAddress: RECIPIENT_ADDRESS,
      });

      if (result.success) {
        setStatus({ type: 'success', msg: `Sent $${amount}!` });
      } else {
        setStatus({ type: 'error', msg: "Failed" });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: "Error" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto mt-10 mb-6 p-3 bg-gray-900/40 border border-gray-800 rounded-xl backdrop-blur-sm shadow-xl">
      <h3 className="text-[10px] font-black mb-3 text-center text-gray-500 italic tracking-widest uppercase">
        ☕ BUY ME A COFFEE
      </h3>
      
      {/* Pilihan Nominal Cepat */}
      <div className="flex gap-2 mb-3">
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(preset)}
            className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${
              amount === preset 
                ? "bg-blue-600 text-white border-blue-400 shadow-[0_0_8px_rgba(37,99,235,0.4)]" 
                : "bg-black/20 text-gray-500 border-gray-800 hover:border-gray-700"
            }`}
          >
            ${preset}
          </button>
        ))}
      </div>

      {/* Input Nominal Kustom */}
      <div className="relative mb-3">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 font-bold">$</span>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 pl-6 text-[10px] bg-black/40 border-gray-800 text-white focus:border-blue-500/50"
          placeholder="Custom..."
        />
      </div>

      {status && (
        <p className={`text-[9px] font-bold mb-2 text-center uppercase ${status.type === 'success' ? 'text-blue-400' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}

      <Button 
        onClick={handleSendTip} 
        disabled={isProcessing || !amount || parseFloat(amount) <= 0}
        isLoading={isProcessing}
        className="py-2 text-[10px] font-black italic tracking-wider shadow-md bg-blue-600 hover:bg-blue-500 transition-colors"
      >
        TIP ${amount} NOW
      </Button>
    </div>
  );
}