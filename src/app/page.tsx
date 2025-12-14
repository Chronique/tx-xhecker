"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useSendTransaction } from "wagmi";
import { createPublicClient, http, encodeFunctionData, concat } from "viem";
import { base, mainnet } from "viem/chains"; 
import { normalize } from 'viem/ens'; 
import sdk from "@farcaster/frame-sdk";
import { Search, Star, Share2, Zap, CheckCircle2, XCircle, Clock, Users, UserPlus, Wallet } from "lucide-react"; 
import { METADATA } from "~/lib/utils"; 
import { Attribution } from "ox/erc8021";

// --- KONFIGURASI BUILDER CODE ---
const MY_BUILDER_CODE = "bc_2ivoo1oy"; 
// --------------------------------

const BLOCK_EXPLORER_BASE_URL = "https://base.blockscout.com/"; 
const BOOST_CONTRACT_ADDRESS = "0x285E7E937059f93dAAF6845726e60CD22A865caF"; 

const BOOST_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "Boosted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "boost",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const publicClient = createPublicClient({ chain: base, transport: http() });
const mainnetClient = createPublicClient({ chain: mainnet, transport: http() });
const COINBASE_VERIFIED_SCHEMA = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { sendTransaction, isPending: isTxPending } = useSendTransaction();

  // State
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  
  // Stats
  const [myTxCount, setMyTxCount] = useState<number | null>(null);
  const [neynarScore, setNeynarScore] = useState<string>("Loading...");
  const [isVerified, setIsVerified] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  // Search & Status
  const [targetAddress, setTargetAddress] = useState("");
  const [otherTxCount, setOtherTxCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatusMessage, setTxStatusMessage] = useState(""); 
  const [isAdded, setIsAdded] = useState(false); 

  // Auto-detect User
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

  // --- LOGIC: 24h TRANSAKSI ---
  const fetch24hTxCount = async (addr: string) => {
    try {
        const response = await fetch(`https://base.blockscout.com/api?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc`);
        const data = await response.json();

        if (data.status === "1" && Array.isArray(data.result)) {
            const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
            const recentTxs = data.result.filter((tx: any) => parseInt(tx.timeStamp) > oneDayAgo);
            setMyTxCount(recentTxs.length);
        } else {
            setMyTxCount(0);
        }
    } catch (error) {
        console.error("Failed to fetch 24h txs:", error);
        setMyTxCount(null);
    }
  };

  // --- LOGIC: VERIFIKASI (EAS) ---
  const checkCoinbaseVerification = async (addresses: string[]) => {
    try {
      const formattedAddresses = addresses.map(a => a.toLowerCase());
      const response = await fetch("https://base.easscan.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query Attestations($where: AttestationWhereInput) {
              attestations(where: $where) {
                id
                attester
                recipient
                revoked
              }
            }
          `,
          variables: {
            where: {
              schemaId: { equals: COINBASE_VERIFIED_SCHEMA },
              recipient: { in: formattedAddresses }, 
              revoked: { equals: false },
            },
          },
        }),
      });
      const result = await response.json();
      if (result.data?.attestations?.length > 0) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
    } catch (e) {
      console.error("Failed to check Base verification:", e);
      setIsVerified(false);
    }
  };

  // --- FETCH DATA UTAMA ---
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
        
        // 1. Ambil Data Farcaster
        setNeynarScore(user.score ? user.score.toFixed(2) : "N/A");
        setFollowerCount(user.follower_count || 0);
        setFollowingCount(user.following_count || 0);
        
        // 2. Ambil Data Wallet
        const allAddresses: string[] = [];
        if (user.custody_address) allAddresses.push(user.custody_address);
        if (user.verified_addresses?.eth_addresses) {
            allAddresses.push(...user.verified_addresses.eth_addresses);
        }

        const primaryAddress = user.verified_addresses.eth_addresses[0] || user.custody_address;
        
        if (primaryAddress) {
          fetch24hTxCount(primaryAddress);
        }

        if (allAddresses.length > 0) {
            checkCoinbaseVerification(allAddresses);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleBoostActivity = () => { 
    if (!address) return;
    setTxStatusMessage("Preparing transaction...");
    try {
        const calldata = encodeFunctionData({ abi: BOOST_ABI, functionName: 'boost' });
        const dataSuffix = Attribution.toDataSuffix({ codes: [MY_BUILDER_CODE] });
        const finalData = concat([calldata, dataSuffix]);

        sendTransaction({
          to: BOOST_CONTRACT_ADDRESS as `0x${string}`, 
          data: finalData, 
        }, {
          onSuccess: (hash) => {
            setTxStatusMessage("Transaction submitted! Waiting confirmation...");
            const checkReceipt = async () => {
                try {
                    const receipt = await publicClient.waitForTransactionReceipt({ hash });
                    if (receipt.status === 'success') {
                        setTxStatusMessage("Success! Activity Boosted & Attributed 🚀");
                        fetch24hTxCount(address);
                    }
                } catch (e) {
                    setTxStatusMessage("Tx Sent, please check Explorer.");
                }
            };
            checkReceipt();
          },
          onError: (error) => { 
            console.error("Boost Error:", error);
            setTxStatusMessage(`Failed: ${error.message || 'Unknown error'}`);
          }
        });
    } catch (err: any) {
        console.error("Logic Error:", err);
        setTxStatusMessage(`Error: ${err.message}`);
    }
  };

  const handleSearchAddress = async () => {
    let searchInput = targetAddress.trim();
    let finalAddress = searchInput;
    setLoading(true);
    setOtherTxCount(null); 
    try {
      if (searchInput.toLowerCase().endsWith(".eth")) {
        const resolvedAddr = await mainnetClient.getEnsAddress({ name: normalize(searchInput) });
        if (resolvedAddr) finalAddress = resolvedAddr;
        else { alert("ENS name not found!"); setLoading(false); return; }
      }
      if (!finalAddress.startsWith("0x") || finalAddress.length !== 42) {
        alert("Invalid address!"); setLoading(false); return;
      }
      fetch24hTxCountForSearch(finalAddress);
    } catch (err) { console.error(err); alert("Error fetching data."); }
    setLoading(false);
  };

  const fetch24hTxCountForSearch = async (addr: string) => {
      try {
        const response = await fetch(`https://base.blockscout.com/api?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc`);
        const data = await response.json();
        if (data.status === "1" && Array.isArray(data.result)) {
            const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
            const recentTxs = data.result.filter((tx: any) => parseInt(tx.timeStamp) > oneDayAgo);
            setOtherTxCount(recentTxs.length);
        } else {
            setOtherTxCount(0);
        }
      } catch (e) { setOtherTxCount(0); }
  };
  
  const handleAddMiniApp = async () => {
      try { await sdk.actions.addMiniApp(); setIsAdded(true); alert(`App ${METADATA.name} successfully added! 🎉`); } catch (e) { alert("Failed to add Mini App."); }
  };

  const handleShareCast = () => {
      const shareText = `Check out my stats on the ${METADATA.name} mini app on Base! Get your score and boost your activity. 🚀\n\nLink: ${METADATA.homeUrl}`;
      const encodedText = encodeURIComponent(shareText);
      const encodedEmbed = encodeURIComponent(METADATA.homeUrl);
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedEmbed}`);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono overflow-x-hidden">
      
      {/* HEADER MARQUEE */}
      <div className="mb-6 overflow-hidden w-full relative py-2">
        <h1 className="text-3xl font-black whitespace-nowrap animate-marquee">
          BASE STATS CHECKER • CHECK YOUR SCORE & BOOST ACTIVITY
        </h1>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl border border-blue-500 mb-6 shadow-lg shadow-blue-500/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             {farcasterUser?.pfpUrl && (
              <img src={farcasterUser.pfpUrl} alt="Profile" className="w-14 h-14 rounded-full border-2 border-white"/>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">@{farcasterUser?.username || "User"}</p>
                {/* STATUS VERIFIKASI */}
                {isVerified ? (
                  <span className="flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded-full border border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] font-bold text-green-400 px-1">VERIFIED</span>
                  </span>
                ) : (
                  <a href="https://verify.base.dev/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/50 hover:bg-red-500/20 transition group">
                    <XCircle className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] text-red-400 px-1 group-hover:text-red-300">Unverified</span>
                  </a>
                )}
              </div>
              <p className="text-xs text-gray-400">FID: {farcasterUser?.fid || "..."}</p>
            </div>
          </div>
        </div>

        {/* --- GRID UTAMA YANG DIBALIK --- */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          
          {/* KOLOM KIRI: FARCASTER (Social + Wallet) */}
          <div className="space-y-4">
             {/* Farcaster Header */}
             <div className="flex items-center gap-2 mb-[-8px] px-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <p className="text-[10px] text-purple-300 uppercase tracking-widest">Farcaster</p>
             </div>

             {/* Followers & Following */}
             <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-gray-800/50 rounded-lg border border-gray-700 text-center">
                    <Users className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-[9px] text-gray-500 uppercase">Followers</p>
                    <p className="text-sm font-bold text-white">{followerCount !== null ? followerCount : "-"}</p>
                </div>
                <div className="p-2 bg-gray-800/50 rounded-lg border border-gray-700 text-center">
                    <UserPlus className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-[9px] text-gray-500 uppercase">Following</p>
                    <p className="text-sm font-bold text-white">{followingCount !== null ? followingCount : "-"}</p>
                </div>
             </div>

             {/* 24h Transactions (Wallet Activity) */}
             <div className="p-3 bg-gray-800/80 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">24h Wallet TXs</p>
                    <Wallet className="w-3 h-3 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-white">
                    {myTxCount !== null ? myTxCount : <span className="animate-pulse text-gray-600">...</span>}
                </p>
                <p className="text-[9px] text-gray-500 text-right mt-[-4px]">Onchain Activity</p>
             </div>
          </div>

          {/* KOLOM KANAN: BASE (Identity/Score) */}
          <div className="space-y-4">
             {/* Base Header */}
             <div className="flex items-center gap-2 mb-[-8px] px-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <p className="text-[10px] text-blue-300 uppercase tracking-widest">Base Identity</p>
             </div>

             {/* Neynar Score */}
             <div className="p-4 bg-gray-800 rounded-lg text-center border border-blue-500/30 relative overflow-hidden flex flex-col items-center justify-center min-h-[90px]">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8"></div>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Neynar Score</p>
                <p className="text-3xl font-bold text-blue-400 mt-1">{neynarScore}</p>
             </div>

             {/* Boost Status */}
             <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col justify-center h-[54px]">
                <div className="flex justify-between items-center">
                    <p className="text-[10px] text-gray-400">Boost Status</p>
                    {txStatusMessage.includes("Success") ? (
                        <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3"/> Active
                        </span>
                    ) : (
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3"/> Ready
                        </span>
                    )}
                </div>
             </div>
          </div>

        </div>

        {isConnected ? (
          <div className="text-center flex flex-col items-center">
            
            {/* --- TOMBOL ANIMASI --- */}
            <button
              onClick={handleBoostActivity}
              disabled={isTxPending}
              className={`
                group relative px-8 py-4 bg-black rounded-full overflow-hidden transition-all duration-300 active:scale-95 w-full
                ${isTxPending ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_40px_rgba(0,82,255,0.6)]"}
              `}
            >
              <div className="absolute inset-0 w-[200%] h-[200%] top-[-50%] left-[-50%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#0052ff_50%,#000000_100%)] opacity-100 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute inset-[2px] bg-gray-900 rounded-full z-10 flex items-center justify-center"></div>
              <span className="relative z-20 flex items-center gap-2 text-white font-bold text-lg tracking-wider group-hover:text-blue-200 transition-colors">
                 <Zap className={`w-5 h-5 ${isTxPending ? "animate-pulse" : "text-yellow-400"}`} fill={isTxPending ? "none" : "currentColor"} />
                 {isTxPending ? "PROCESSING..." : "BOOST BASE ACTIVITY"}
              </span>
            </button>
            {/* ---------------------- */}
            
            <p className="text-[10px] text-gray-500 mt-4 text-center max-w-sm mx-auto leading-relaxed">
              Note: Boost activity is experimental to increase Neynar score. 
              Contract is verified on <a href="https://base.blockscout.com/address/0x285E7E937059f93dAAF6845726e60CD22A865caF?tab=contract" target="_blank" rel="noopener noreferrer" className="underline text-blue-400 hover:text-blue-300 transition">Blockscout</a>.
            </p>

            {txStatusMessage && (
              <p className={`text-sm mt-4 font-bold animate-pulse text-center ${txStatusMessage.includes("Success") ? "text-green-400" : "text-yellow-400"}`}>
                {txStatusMessage}
              </p>
            )}
            
            <div className="flex justify-center mt-6">
                <div className="inline-flex rounded-full shadow-lg bg-purple-600 overflow-hidden border border-purple-500/50" role="group">
                    <button onClick={handleAddMiniApp} disabled={isAdded} className={`flex items-center gap-2 px-6 py-3 font-bold text-white transition active:bg-purple-800 hover:bg-purple-700 text-sm ${isAdded ? 'opacity-70 cursor-not-allowed bg-purple-800' : ''}`}>
                        <Star className="w-4 h-4 text-yellow-300"/>
                        {isAdded ? "Added" : "Add Mini App"}
                    </button>
                    <div className="w-px bg-white/30 my-2"></div>
                    <button onClick={handleShareCast} className="flex items-center gap-2 px-6 py-3 font-bold text-white transition active:bg-purple-800 hover:bg-purple-700 text-sm">
                        <Share2 className="w-4 h-4"/>
                        Share
                    </button>
                </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col gap-2">
             {connectors.slice(0,1).map((connector) => (
               <button key={connector.uid} onClick={() => connect({ connector })} className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition">
                 Connect Wallet
               </button>
             ))}
          </div>
        )}
      </div>

      <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
        <h2 className="text-sm font-bold mb-3 text-gray-400 uppercase">Search Wallet or ENS</h2>
        <div className="flex gap-2">
          <input type="text" placeholder="0x... or vitalik.eth" className="w-full p-3 bg-black border border-gray-700 rounded-lg text-white focus:border-blue-500 outline-none text-sm font-mono" value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} />
          <button onClick={handleSearchAddress} disabled={loading} className="bg-gray-700 px-4 rounded-lg font-bold hover:bg-gray-600 disabled:opacity-50 flex items-center justify-center">
            {loading ? "..." : <Search className="w-5 h-5" />} 
          </button>
        </div>
        {otherTxCount !== null && (
          <div className="mt-3 text-center bg-green-900/20 p-2 rounded border border-green-500/30">
             <p className="text-gray-400 text-xs mb-1">Result for wallet:</p>
             <p className="text-green-400 font-bold text-lg">{otherTxCount} Transactions</p>
             <p className="text-[10px] text-gray-500">(Last 24h)</p>
          </div>
        )}
      </div>
    </div>
  );
}