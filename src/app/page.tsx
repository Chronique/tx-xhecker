"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSendTransaction } from "wagmi";
import { createPublicClient, http, parseEther } from "viem";
import { base } from "viem/chains";
import sdk from "@farcaster/frame-sdk";

// Setup Client Base
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// INI ADALAH KODE RAHASIA (SCHEMA UID) UNTUK "COINBASE VERIFIED"
// Sesuai dengan yang ada di screenshot verify.base.dev kamu
const COINBASE_VERIFIED_SCHEMA = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  
  // Hook buat kirim transaksi (Bayar Gas)
  const { sendTransaction, isPending: isTxPending } = useSendTransaction();

  // State
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  
  const [myTxCount, setMyTxCount] = useState<number | null>(null);
  const [neynarScore, setNeynarScore] = useState<string>("Loading...");
  
  // State Khusus Verifikasi
  const [isVerified, setIsVerified] = useState(false);
  const [isCheckingVerify, setIsCheckingVerify] = useState(false);
  
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

  // Fungsi Update Data
  const updateMyStats = async (addr: string) => {
    const count = await publicClient.getTransactionCount({ address: addr as `0x${string}` });
    setMyTxCount(count);
  };

  // --- LOGIC UTAMA: CEK KE SERVER BASE (EAS) ---
  const checkCoinbaseVerification = async (addr: string) => {
    setIsCheckingVerify(true);
    try {
      // Kita tanya ke database Base: "Wallet ini punya sertifikat Coinbase Verified gak?"
      const response = await fetch("https://base.easscan.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query Attestations($where: AttestationWhereInput) {
              attestations(where: $where) {
                id
                attester
                revoked
              }
            }
          `,
          variables: {
            where: {
              schemaId: { equals: COINBASE_VERIFIED_SCHEMA }, // Cek Schema Khusus Coinbase
              recipient: { equals: addr },
              revoked: { equals: false },
            },
          },
        }),
      });

      const result = await response.json();
      
      // Kalau hasilnya ada (lebih dari 0), berarti VERIFIED!
      if (result.data.attestations && result.data.attestations.length > 0) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    } catch (e) {
      console.error("Gagal cek verifikasi base", e);
      setIsVerified(false);
    }
    setIsCheckingVerify(false);
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
        
        // Format Score jadi Persen
        if (user.score) {
          const formattedScore = (user.score * 100).toFixed(1) + "%";
          setNeynarScore(formattedScore);
        } else {
          setNeynarScore("N/A"); 
        }

        const userAddress = user.verified_addresses.eth_addresses[0] || user.custody_address;
        if (userAddress) {
          updateMyStats(userAddress);
          checkCoinbaseVerification(userAddress); // JALANKAN CEK VERIFIKASI
        }
      }
    } catch (error) {
      console.error("Gagal load data", error);
    }
  };

  // --- FUNGSI BOOST ---
  const handleBoost = () => {
    if (!address) return;
    setTxStatus("Check wallet...");
    sendTransaction({
      to: address, 
      value: parseEther("0"), 
    }, {
      onSuccess: () => {
        setTxStatus("Waiting...");
        setTimeout(() => {
          updateMyStats(address);
          setTxStatus("Success! (+1 Tx)");
        }, 3000);
      },
      onError: () => { setTxStatus("Cancelled"); }
    });
  };

  const handleCheckOther = async () => {
    if (!targetAddress.startsWith("0x")) { alert("Invalid address!"); return; }
    setLoading(true);
    try {
      const count = await publicClient.getTransactionCount({ address: targetAddress as `0x${string}` });
      setOtherTxCount(count);
    } catch (err) { alert("Error"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono">
      <h1 className="text-3xl font-bold mb-6 text-blue-500 text-center">
        BASE STATS CHECKER
      </h1>

      {/* --- PROFILE SECTION --- */}
      <div className="bg-gray-900 p-6 rounded-xl border border-blue-500 mb-6 shadow-lg shadow-blue-500/20">
        
        {/* Header Profil */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             {farcasterUser?.pfpUrl && (
              <img src={farcasterUser.pfpUrl} alt="Profile" className="w-14 h-14 rounded-full border-2 border-white"/>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">@{farcasterUser?.username || "User"}</p>
                
                {/* --- LOGO CEKLIS BASE VERIFIED --- */}
                {isVerified ? (
                  <span className="flex items-center gap-1 bg-blue-600 px-2 py-0.5 rounded-full border border-blue-400 shadow-glow">
                    {/* Icon Centang */}
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] font-bold text-white">VERIFIED</span>
                  </span>
                ) : (
                  // Tombol ke situs verify.base.dev kalau belum verified
                  <a 
                    href="https://verify.base.dev/" 
                    target="_blank" 
                    className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded border border-gray-600 hover:text-white hover:border-gray-400 transition"
                  >
                    <span>Unverified</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-400">FID: {farcasterUser?.fid || "..."}</p>
            </div>
          </div>
        </div>

        {/* Statistik Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-gray-800 rounded-lg text-center border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-widest">Total Tx</p>
            <p className="text-3xl font-bold text-green-400 mt-1">
              {myTxCount !== null ? myTxCount : "..."}
            </p>
          </div>

          <div className="p-4 bg-gray-800 rounded-lg text-center border border-gray-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full -mr-8 -mt-8"></div>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Neynar Score</p>
            <p className="text-3xl font-bold text-purple-400 mt-1">
              {neynarScore}
            </p>
          </div>
        </div>

        {/* --- TOMBOL BOOST --- */}
        {isConnected ? (
          <div className="text-center">
            <button
              onClick={handleBoost}
              disabled={isTxPending}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 ${
                isTxPending 
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed" 
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30"
              }`}
            >
              {isTxPending ? "Confirming..." : "🔥 BOOST ACTIVITY (+1 TX)"}
            </button>
            <p className="text-[10px] text-gray-500 mt-3 flex justify-center items-center gap-1">
              <span>⛽ Gas only (~$0.01)</span>
              <span>•</span>
              <span>📈 Increases Score</span>
            </p>
            {txStatus && <p className="text-sm text-yellow-400 mt-2 font-bold animate-pulse">{txStatus}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
             {connectors.slice(0,1).map((connector) => (
               <button
                 key={connector.uid}
                 onClick={() => connect({ connector })}
                 className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition"
               >
                 Connect Wallet
               </button>
             ))}
          </div>
        )}
      </div>

      {/* --- FOOTER: CHECK OTHERS --- */}
      <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
        <h2 className="text-sm font-bold mb-3 text-gray-400 uppercase">Search Wallet</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x..."
            className="w-full p-3 bg-black border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none text-sm font-mono"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
          />
          <button
            onClick={handleCheckOther}
            disabled={loading}
            className="bg-gray-700 px-4 rounded-lg font-bold hover:bg-gray-600 disabled:opacity-50"
          >
            🔍
          </button>
        </div>
        {otherTxCount !== null && (
          <div className="mt-3 text-center bg-green-900/20 p-2 rounded border border-green-500/30">
             <p className="text-green-400 font-bold text-lg">{otherTxCount} Transactions</p>
          </div>
        )}
      </div>
    </div>
  );
}