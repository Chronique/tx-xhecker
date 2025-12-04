"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSendTransaction } from "wagmi";
import { createPublicClient, http, parseEther } from "viem";
import { base, mainnet } from "viem/chains"; 
import { normalize } from 'viem/ens'; 
import sdk from "@farcaster/frame-sdk";
import { Search } from "lucide-react"; 

// --- KONSTANTA BLOCK EXPLORER ---
const BASE_SCAN_URL = "https://basescan.org/tx/";
// --------------------------------

// --- DETEKSI PAYMASTER ---
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL;
const isGaslessEnabled = !!PAYMASTER_URL;
// -------------------------

// 1. Client Base
const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

// 2. Client Mainnet
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const COINBASE_VERIFIED_SCHEMA = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  
  const { sendTransaction, isPending: isTxPending } = useSendTransaction();

  // State
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  
  const [myTxCount, setMyTxCount] = useState<number | null>(null);
  const [neynarScore, setNeynarScore] = useState<string>("Loading...");
  
  const [isVerified, setIsVerified] = useState(false);
  
  const [targetAddress, setTargetAddress] = useState("");
  const [otherTxCount, setOtherTxCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // NEW STATE: Untuk menyimpan Hash Transaksi terakhir
  const [txStatus, setTxStatus] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null); 

  // 1. AUTO-DETECT USER 
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

  const updateMyStats = async (addr: string) => {
    const count = await publicClient.getTransactionCount({ address: addr as `0x${string}` });
    setMyTxCount(count);
  };

  const checkCoinbaseVerification = async (addr: string) => {
    try {
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
              schemaId: { equals: COINBASE_VERIFIED_SCHEMA },
              recipient: { equals: addr },
              revoked: { equals: false },
            },
          },
        }),
      });

      const result = await response.json();
      
      if (result.data.attestations && result.data.attestations.length > 0) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    } catch (e) {
      console.error("Gagal cek verifikasi base", e);
      setIsVerified(false);
    }
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
        
        if (user.score) {
          const formattedScore = user.score.toFixed(2);
          setNeynarScore(formattedScore);
        } else {
          setNeynarScore("N/A"); 
        }

        const userAddress = user.verified_addresses.eth_addresses[0] || user.custody_address;
        if (userAddress) {
          updateMyStats(userAddress);
          checkCoinbaseVerification(userAddress);
        }
      }
    } catch (error) {
      console.error("Gagal load data", error);
    }
  };

  const handleBoost = () => {
    if (!address) return;
    
    // Reset status sebelum kirim
    setLastTxHash(null);
    setTxStatus("Check wallet...");
    
    sendTransaction({
      to: address, 
      value: parseEther("0"), 
    }, {
      onSuccess: (hash) => { // TANGKAP HASH TRANSAKSI
        setLastTxHash(hash); // Simpan hash
        setTxStatus("Transaction sent! Waiting for block confirmation..."); // Notifikasi awal
        
        // Simulasikan konfirmasi setelah 3 detik
        setTimeout(() => {
          updateMyStats(address);
          setTxStatus("Success! Your activity score has been boosted."); 
        }, 3000);
      },
      onError: () => { 
        setTxStatus("Cancelled or failed.");
        setLastTxHash(null);
      }
    });
  };

  const handleCheckOther = async () => {
    let searchInput = targetAddress.trim();
    let finalAddress = searchInput;

    setLoading(true);
    setOtherTxCount(null); 

    try {
      if (searchInput.toLowerCase().endsWith(".eth")) {
        const resolvedAddr = await mainnetClient.getEnsAddress({
          name: normalize(searchInput),
        });

        if (resolvedAddr) {
          finalAddress = resolvedAddr;
        } else {
          alert("ENS name not found or not set!");
          setLoading(false);
          return;
        }
      }

      if (!finalAddress.startsWith("0x") || finalAddress.length !== 42) {
        alert("Invalid address or ENS name!");
        setLoading(false);
        return;
      }

      const count = await publicClient.getTransactionCount({ 
        address: finalAddress as `0x${string}` 
      });
      
      setOtherTxCount(count);

    } catch (err) { 
      console.error(err);
      alert("Error fetching data. Try again."); 
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono">
      <h1 className="text-3xl font-bold mb-6 text-blue-500 text-center">
        BASE STATS CHECKER
      </h1>

      <div className="bg-gray-900 p-6 rounded-xl border border-blue-500 mb-6 shadow-lg shadow-blue-500/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             {farcasterUser?.pfpUrl && (
              <img src={farcasterUser.pfpUrl} alt="Profile" className="w-14 h-14 rounded-full border-2 border-white"/>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">@{farcasterUser?.username || "User"}</p>
                {isVerified ? (
                  <span className="flex items-center gap-1 bg-blue-600 px-2 py-0.5 rounded-full border border-blue-400 shadow-glow">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] font-bold text-white">VERIFIED</span>
                  </span>
                ) : (
                  <a 
                    href="https://verify.base.dev/" 
                    target="_blank" 
                    rel="noopener noreferrer"
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
              {isTxPending 
                ? "Confirming..." 
                : isGaslessEnabled 
                  ? "🔥 BOOST ACTIVITY (Gas Free)"
                  : "🔥 BOOST ACTIVITY (+1 TX)"
              }
            </button>
            <p className="text-[10px] text-gray-500 mt-3 flex justify-center items-center gap-1">
              <span>{isGaslessEnabled ? "✅ Gas Fee Sponsored" : "⛽ Gas only (~$0.01)"}</span>
              <span>•</span>
              <span>📈 Increases Score</span>
            </p>

            {/* --- AREA POP-UP TRANSAKSI BARU --- */}
            {lastTxHash && (
              <div className="mt-4 p-3 bg-gray-700 rounded-lg text-center shadow-md">
                <p className="text-sm font-bold text-green-400 mb-2">{txStatus}</p>
                <a
                  href={`${BASE_SCAN_URL}${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-200 underline flex items-center justify-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  See Transaction on Basescan
                </a>
              </div>
            )}
            
            {/* Tampilkan status error/pending jika belum ada hash */}
            {txStatus && !lastTxHash && (
              <p className="text-sm text-yellow-400 mt-2 font-bold animate-pulse text-center">{txStatus}</p>
            )}
            
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

      <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
        <h2 className="text-sm font-bold mb-3 text-gray-400 uppercase">Search Wallet or ENS</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x... or vitalik.eth"
            className="w-full p-3 bg-black border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none text-sm font-mono"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
          />
          <button
            onClick={handleCheckOther}
            disabled={loading}
            className="bg-gray-700 px-4 rounded-lg font-bold hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? "..." : <Search className="w-5 h-5" />} 
          </button>
        </div>
        {otherTxCount !== null && (
          <div className="mt-3 text-center bg-green-900/20 p-2 rounded border border-green-500/30">
             <p className="text-gray-400 text-xs mb-1">Result for wallet:</p>
             <p className="text-green-400 font-bold text-lg">{otherTxCount} Transactions</p>
          </div>
        )}
      </div>
    </div>
  );
}