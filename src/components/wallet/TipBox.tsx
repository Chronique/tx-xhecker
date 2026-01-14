"use client";

import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { sdk } from "@farcaster/miniapp-sdk";

const RECIPIENT_ADDRESS = "0x4fba95e4772be6d37a0c931D00570Fe2c9675524";
const PRESET_AMOUNTS = ["1", "3", "5", "10"];

export function TipBox() {
  const [amount, setAmount] = useState<string>("5");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  const handleSendTip = async () => {
    setIsProcessing(true);
    setStatus(null);

    try {
      const result = await sdk.actions.sendToken({
        token: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base USDC
        amount: (parseFloat(amount) * 1000000).toString(), 
        recipientAddress: RECIPIENT_ADDRESS,
      });

      if (result.success) {
        setStatus({ type: 'success', msg: `Successfully sent $${amount} tip!` });
      } else {
        setStatus({ type: 'error', msg: result.error?.message || "Failed to send tip" });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: "An error occurred while sending" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto mb-6 p-5 bg-gray-900/80 border border-blue-500/30 rounded-2xl shadow-xl backdrop-blur-sm">
      <h3 className="text-lg font-bold mb-4 text-center text-white italic tracking-tighter">SUPPORT DEVELOPER ☕</h3>
      
      {/* Tombol Preset menggunakan tag button standar agar tidak error variant */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(preset)}
            className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
              amount === preset 
                ? "bg-blue-600 text-white border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                : "bg-black/40 text-gray-400 border-gray-800 hover:border-blue-500/50"
            }`}
          >
            ${preset}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1" htmlFor="custom-tip">
          Or custom amount (USD)
        </Label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-bold">$</span>
          <Input
            id="custom-tip"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-7 bg-black/40 border-gray-800 text-white focus:border-blue-500 transition-colors"
            placeholder="0.00"
          />
        </div>
      </div>

      {status && (
        <div className={`p-2 rounded text-[10px] font-bold mb-4 text-center ${status.type === 'success' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {status.msg.toUpperCase()}
        </div>
      )}

      <Button 
        onClick={handleSendTip} 
        disabled={isProcessing || !amount || parseFloat(amount) <= 0}
        isLoading={isProcessing}
        className="bg-blue-600 hover:bg-blue-500 text-white font-black italic tracking-wider py-4 shadow-lg active:scale-95 transition-transform"
      >
        SEND ${amount} TIP
      </Button>
      
      <p className="text-[9px] text-center text-gray-600 mt-3 font-bold uppercase tracking-tighter">
        Transacted in USDC via Base Network
      </p>
    </div>
  );
}