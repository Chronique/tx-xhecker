"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useSendTransaction } from "wagmi"; // Pakai useSendTransaction lagi
import { createPublicClient, http, encodeFunctionData, concat } from "viem"; // Tambah 'concat'
import { base, mainnet } from "viem/chains"; 
import { normalize } from 'viem/ens'; 
import sdk from "@farcaster/frame-sdk";
import { Search, Star, Share2 } from "lucide-react"; 
import { METADATA } from "~/lib/utils"; 
import { Attribution } from "ox/erc8021"; // Library untuk generate suffix

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

const publicClient = createPublicClient({
  chain: base,
  transport: http(),
});

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const COINBASE_VERIFIED_SCHEMA = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  
  // KEMBALI KE useSendTransaction (Lebih Stabil di Farcaster)
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
  const [txStatusMessage, setTxStatusMessage] = useState(""); 
  const [isAdded, setIsAdded] = useState(false); 

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
      console.error("Failed to check Base verification:", e);
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
          setNeynarScore(user.score.toFixed(2));
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
      console.error("Failed to load data:", error);
    }
  };

  // --- FUNGSI BOOST DENGAN MANUAL ATTACH BUILDER CODE ---
  const handleBoostActivity = () => { 
    if (!address) return;
    
    setTxStatusMessage("Preparing transaction...");
    
    try {
        // 1. Generate data fungsi 'boost()' seperti biasa
        const calldata = encodeFunctionData({
            abi: BOOST_ABI,
            functionName: 'boost'
        });

        // 2. Generate Suffix dari Builder Code
        const dataSuffix = Attribution.toDataSuffix({
            codes: [MY_BUILDER_CODE] 
        });

        // 3. GABUNGKAN MANUAL: Calldata + Suffix
        // Ini triknya! Kita tempel sendiri agar tidak bergantung pada kemampuan wallet.
        const finalData = concat([calldata, dataSuffix]);

        // 4. Kirim pakai sendTransaction biasa (Pasti support semua wallet)
        sendTransaction({
          to: BOOST_CONTRACT_ADDRESS as `0x${string}`, 
          data: finalData, // Data yang sudah ditempel suffix
        }, {
          onSuccess: (hash) => {
            setTxStatusMessage("Transaction submitted! Waiting confirmation...");
            
            const checkReceipt = async () => {
                try {
                    const receipt = await publicClient.waitForTransactionReceipt({ hash });
                    if (receipt.status === 'success') {
                        setTxStatusMessage("Success! Activity Boosted & Attributed 🚀");
                        updateMyStats(address);
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
      const count = await publicClient.getTransactionCount({ address: finalAddress as `0x${string}` });
      setOtherTxCount(count);
    } catch (err) { console.error(err); alert("Error fetching data."); }
    setLoading(false);
  };
  
  const handleAddMiniApp = async () => {
      try {
          await sdk.actions.addMiniApp(); 
          setIsAdded(true); 
          alert(`App ${METADATA.name} successfully added! 🎉`);
      } catch (e) {
          alert("Failed to add Mini App.");
      }
  };

  const handleShareCast = () => {
      const shareText = `Check out my stats on the ${METADATA.name} mini app on Base! Get your score and boost your activity. 🚀\n\nLink: ${METADATA.homeUrl}`;
      const encodedText = encodeURIComponent(shareText);
      const encodedEmbed = encodeURIComponent(METADATA.homeUrl);
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedEmbed}`);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono overflow-x-hidden">
      
      {/* HEADER WITH COLOR-CHANGING MARQUEE ANIMATION */}
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
                {isVerified ? (
                  <span className="flex items-center gap-1 bg-blue-600 px-2 py-0.5 rounded-full border border-blue-400 shadow-glow">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] font-bold text-white">VERIFIED</span>
                  </span>
                ) : (
                  <a href="https://verify.base.dev/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded border border-gray-600 hover:text-white hover:border-gray-400 transition">
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
            <p className="text-xs text-gray-400 uppercase tracking-widest">Total TXs</p>
            <p className="text-3xl font-bold text-green-400 mt-1">{myTxCount !== null ? myTxCount : "..."}</p>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg text-center border border-gray-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full -mr-8 -mt-8"></div>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Neynar Score</p>
            <p className="text-3xl font-bold text-purple-400 mt-1">{neynarScore}</p>
          </div>
        </div>

        {isConnected ? (
          <div className="text-center">
            <button
              onClick={handleBoostActivity}
              disabled={isTxPending}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-95 ${
                isTxPending 
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed" 
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30"
              }`}
            >
              {isTxPending 
                ? "Processing..." 
                : "🔥 BOOST ACTIVITY (Smart Contract)"
              }
            </button>
            
            <p className="text-[10px] text-gray-500 mt-3 text-center max-w-sm mx-auto leading-relaxed">
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
          </div>
        )}
      </div>
    </div>
  );
}