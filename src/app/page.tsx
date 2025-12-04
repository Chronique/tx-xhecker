"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useSendTransaction } from "wagmi";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import sdk from "@farcaster/frame-sdk";

// Setup Client Base
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  
  // Hook buat kirim transaksi (Bayar Gas)
  const { sendTransaction, isPending: isTxPending } = useSendTransaction();

  // State
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const [myTxCount, setMyTxCount] = useState<number | null>(null);
  const [neynarScore, setNeynarScore] = useState<string>("Loading...");
  const [targetAddress, setTargetAddress] = useState("");
  const [otherTxCount, setOtherTxCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  // 1. AUTO-DETECT USER DARI FARCASTER
  useEffect(() => {
    const load = async () => {
      sdk.actions.ready(); 
      const context = await sdk.context;
      if (context?.user) {
        setFarcasterUser(context.user);
        setIsSDKLoaded(true);
        fetchAddressAndStats(context.user.fid);
      }
    };
    if (sdk && !isSDKLoaded) load();
  }, [isSDKLoaded]);

  // Fungsi Update Data (Bisa dipanggil ulang setelah boost)
  const updateMyStats = async (addr: string) => {
    const count = await publicClient.getTransactionCount({ address: addr as `0x${string}` });
    setMyTxCount(count);
  };

  const fetchAddressAndStats = async (fid: number) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
      if (!apiKey) return;

      const res = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
        { headers: { accept: "application/json", api_key: apiKey } }
      );
      const data = await res.json();

      if (data.users && data.users[0]) {
        const user = data.users[0];
        const score = user.score || user.follower_count + " Followers";
        setNeynarScore(score.toString());

        const userAddress = user.verified_addresses.eth_addresses[0] || user.custody_address;
        if (userAddress) {
          updateMyStats(userAddress);
        }
      }
    } catch (error) {
      console.error("Gagal load data", error);
    }
  };

  // --- FUNGSI BOOST (BAYAR GAS FEE) ---
  const handleBoost = () => {
    if (!address) return;
    
    setTxStatus("Please confirm in wallet...");
    
    // Kirim 0 ETH ke diri sendiri
    sendTransaction({
      to: address, 
      value: parseEther("0"), 
    }, {
      onSuccess: () => {
        setTxStatus("Transaction Sent! Waiting confirmation...");
        // Tunggu bentar lalu update angka
        setTimeout(() => {
          updateMyStats(address);
          setTxStatus("Boost Success! (+1 Tx)");
        }, 3000);
      },
      onError: () => {
        setTxStatus("Transaction Cancelled");
      }
    });
  };
  // ------------------------------------

  const handleCheckOther = async () => {
    if (!targetAddress.startsWith("0x")) {
      alert("Invalid address format!");
      return;
    }
    setLoading(true);
    try {
      const count = await publicClient.getTransactionCount({ address: targetAddress as `0x${string}` });
      setOtherTxCount(count);
    } catch (err) { alert("Error fetching data"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono">
      <h1 className="text-3xl font-bold mb-6 text-blue-500 text-center">
        BASE STATS CHECKER
      </h1>

      {/* --- PROFILE & BOOST SECTION --- */}
      <div className="bg-gray-900 p-6 rounded-xl border border-blue-500 mb-6 shadow-lg shadow-blue-500/20">
        <h2 className="text-xl font-bold mb-4">👤 Your Stats</h2>

        {/* Tampilan Profil */}
        {farcasterUser ? (
          <div className="flex items-center gap-4 mb-6">
            {farcasterUser.pfpUrl && (
              <img src={farcasterUser.pfpUrl} alt="Profile" className="w-12 h-12 rounded-full border-2 border-blue-500"/>
            )}
            <div>
              <p className="text-lg font-bold">@{farcasterUser.username}</p>
              <p className="text-xs text-gray-400">FID: {farcasterUser.fid}</p>
            </div>
          </div>
        ) : null}

        {/* Statistik */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-800 rounded-lg text-center border border-gray-700">
            <p className="text-xs text-gray-400 uppercase">Total Tx</p>
            <p className="text-3xl font-bold text-green-400 mt-1">
              {myTxCount !== null ? myTxCount : "..."}
            </p>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg text-center border border-gray-700">
            <p className="text-xs text-gray-400 uppercase">Score / Followers</p>
            <p className="text-xl font-bold text-purple-400 mt-2">
              {neynarScore}
            </p>
          </div>
        </div>

        {/* TOMBOL BOOST UTAMA */}
        {isConnected ? (
          <div className="text-center">
            <button
              onClick={handleBoost}
              disabled={isTxPending}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition transform active:scale-95 ${
                isTxPending 
                  ? "bg-gray-600 cursor-not-allowed" 
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white"
              }`}
            >
              {isTxPending ? "Confirming..." : "🚀 BOOST ACTIVITY (+1 TX)"}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Costs only gas fee (~$0.01). Increases your on-chain activity.
            </p>
            {txStatus && <p className="text-sm text-yellow-400 mt-2 font-bold animate-pulse">{txStatus}</p>}
          </div>
        ) : (
          // Tombol Connect kalau belum connect
          <div className="flex flex-col gap-2">
             {connectors.slice(0,1).map((connector) => (
               <button
                 key={connector.uid}
                 onClick={() => connect({ connector })}
                 className="bg-white text-black py-3 rounded font-bold hover:bg-gray-200"
               >
                 Connect Wallet to Boost
               </button>
             ))}
          </div>
        )}
      </div>

      {/* --- CEK WALLET LAIN --- */}
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 opacity-80">
        <h2 className="text-lg font-bold mb-4 text-gray-300">🔍 Check Others</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x..."
            className="w-full p-3 bg-black border border-gray-700 rounded text-white focus:border-blue-500 outline-none"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
          />
        </div>
        <button
          onClick={handleCheckOther}
          disabled={loading}
          className="w-full mt-3 bg-gray-700 text-white font-bold py-2 rounded hover:bg-gray-600"
        >
          {loading ? "..." : "Check"}
        </button>
        {otherTxCount !== null && (
          <p className="mt-2 text-center text-green-400 font-bold">Total Tx: {otherTxCount}</p>
        )}
      </div>
    </div>
  );
}