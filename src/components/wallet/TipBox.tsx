"use client";

import { useState } from "react";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/input";
import { pay } from '@base-org/account'; // Import dari base pay logic

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
      // Menggunakan fungsi pay() yang sama dengan BasePay.tsx
      await pay({
        amount: amount,
        to: RECIPIENT_ADDRESS,
        testnet: false
      });
      
      setStatus({ type: 'success', msg: "Payment Initiated!" });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', msg: "Payment Failed" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto mt-10 mb-6 p-3 bg-gray-900/40 border border-gray-800 rounded-xl backdrop-blur-sm">
      <h3 className="text-[10px] font-black mb-3 text-center text-gray-500 italic tracking-widest uppercase">
        ☕ BUY ME A COFFEE
      </h3>
      
      <div className="flex gap-2 mb-3">
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(preset)}
            className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${
              amount === preset 
                ? "bg-blue-600 text-white border-blue-400" 
                : "bg-black/20 text-gray-500 border-gray-800 hover:border-gray-700"
            }`}
          >
            ${preset}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-500 font-bold">$</span>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 pl-6 text-[10px] bg-black/40 border-gray-800 text-white"
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
        className="py-2 text-[10px] font-black italic tracking-wider shadow-md bg-blue-600"
      >
        TIP ${amount} VIA BASE PAY
      </Button>
    </div>
  );
}