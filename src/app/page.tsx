"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useSendTransaction } from "wagmi";
import { createPublicClient, http, encodeFunctionData, concat } from "viem";
import { base, mainnet } from "viem/chains"; 
import { normalize } from 'viem/ens'; 
import sdk from "@farcaster/frame-sdk";
import { Star, Share2, Zap, CheckCircle2, ShieldCheck, ExternalLink, Fingerprint, AlertTriangle, Code2, Twitter } from "lucide-react"; 
import { METADATA } from "~/lib/utils"; 
import { Attribution } from "ox/erc8021";

// --- KONFIGURASI ---
const MY_BUILDER_CODE = "bc_2ivoo1oy"; 
// Pastikan variabel ini ada di .env.local dan Environment Variables Vercel
const GITCOIN_API_KEY = process.env.NEXT_PUBLIC_GITCOIN_API_KEY; 
const GITCOIN_SCORER_ID = process.env.NEXT_PUBLIC_GITCOIN_SCORER_ID; 
const TALENT_API_KEY = process.env.NEXT_PUBLIC_TALENT_API_KEY; 
// --------------------

const BOOST_CONTRACT_ADDRESS = "0x285E7E937059f93dAAF6845726e60CD22A865caF"; 

// --- URL VERIFIKASI ---
const VERIFY_SOCIAL_URL = "https://verify.base.dev/verifications"; 
const VERIFY_IDENTITY_URL = "https://www.coinbase.com/onchain-verify"; 

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
  { "inputs": [], "name": "boost", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

const publicClient = createPublicClient({ chain: base, transport: http() });

// --- SCHEMAS (EAS BASE) ---
const SCHEMA_IDENTITY = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";
const SCHEMA_TWITTER = "0x6291a26f3020617306263907727103a088924375375772392462332997632626";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { sendTransaction, isPending: isTxPending } = useSendTransaction();

  // State
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  
  // Scores
  const [neynarScore, setNeynarScore] = useState<string>("...");
  const [gitcoinScore, setGitcoinScore] = useState<string | null>(null);
  const [talentScore, setTalentScore] = useState<string | null>(null);
  
  // Verification States
  const [isIdentityVerified, setIsIdentityVerified] = useState(false); 
  const [isSocialVerified, setIsSocialVerified] = useState(false);     
  
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

  // --- LOGIC: VERIFIKASI (EAS) ---
  const checkVerifications = async (addresses: string[]) => {
    try {
      const formattedAddresses = addresses.map(a => a.toLowerCase());
      
      const response = await fetch("https://base.easscan.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query Attestations($whereIdentity: AttestationWhereInput, $whereSocial: AttestationWhereInput) {
              identity: attestations(where: $whereIdentity) { id }
              social: attestations(where: $whereSocial) { id }
            }
          `,
          variables: {
            whereIdentity: {
              schemaId: { equals: SCHEMA_IDENTITY },
              recipient: { in: formattedAddresses }, 
              revoked: { equals: false },
            },
            whereSocial: {
               OR: [
                 { schemaId: { equals: SCHEMA_TWITTER }, recipient: { in: formattedAddresses }, revoked: { equals: false } },
                 { schemaId: { equals: SCHEMA_IDENTITY }, recipient: { in: formattedAddresses }, revoked: { equals: false } }
               ]
            }
          },
        }),
      });
      const result = await response.json();
      
      setIsIdentityVerified(result.data?.identity?.length > 0);
      setIsSocialVerified(result.data?.social?.length > 0);

    } catch (e) {
      console.error("Verification check failed:", e);
    }
  };

  // --- LOGIC: GITCOIN SCORE (LOGIKA SNIPPET TERBARU) ---
  const fetchGitcoinScore = async (addresses: string[]) => {
    if (!GITCOIN_API_KEY || !GITCOIN_SCORER_ID) {
        console.warn("Gitcoin Env Vars missing");
        setGitcoinScore(null); return;
    }

    try {
        const scorePromises = addresses.map(async (addr) => {
            try {
                // Fetch tanpa Content-Type header sesuai permintaan
                const scoreResponse = await fetch(
                  `https://api.passport.xyz/v2/stamps/${GITCOIN_SCORER_ID}/score/${addr}`,
                  {
                    headers: { "X-API-Key": GITCOIN_API_KEY }
                  }
                );
                
                if (!scoreResponse.ok) return 0;

                const scoreData = await scoreResponse.json();
                return scoreData && scoreData.score ? parseFloat(scoreData.score) : 0;
            } catch (e) { 
                return 0; 
            }
        });

        const scores = await Promise.all(scorePromises);
        const maxScore = Math.max(...scores);

        console.log("Gitcoin Scores Found:", scores); 

        if (maxScore > 0) {
            setGitcoinScore(maxScore.toFixed(2));
        } else {
            setGitcoinScore(null); 
        }
    } catch (e) {
        setGitcoinScore(null); 
    }
  };

  // --- LOGIC: TALENT PROTOCOL SCORE ---
  const fetchTalentScore = async (addresses: string[]) => {
    if (!TALENT_API_KEY) { setTalentScore(null); return; }
    
    const targetAddr = addresses[0]; 

    try {
        const response = await fetch(`https://api.talentprotocol.com/scores?id=${targetAddr}`, {
            headers: { "X-API-KEY": TALENT_API_KEY }
        });
        const data = await response.json();
        
        const builderScore = data.scores?.find((s: any) => s.slug === "builder_score");
        
        if (builderScore) {
            setTalentScore(builderScore.points.toString());
        } else {
            setTalentScore("0");
        }
    } catch (e) {
        console.error("Talent fetch error:", e);
        setTalentScore(null);
    }
  };

  // --- MAIN FETCH ---
  const fetchAddressAndStats = async (fid: number) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
      if (!apiKey) return;
      const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, { headers: { accept: "application/json", api_key: apiKey } });
      const data = await res.json();
      
      if (data.users && data.users[0]) {
        const user = data.users[0];
        setNeynarScore(user.score ? user.score.toFixed(2) : "N/A");
        
        const allAddresses: string[] = [];
        if (user.custody_address) allAddresses.push(user.custody_address);
        if (user.verified_addresses?.eth_addresses) {
            allAddresses.push(...user.verified_addresses.eth_addresses);
        }

        if (allAddresses.length > 0) {
            checkVerifications(allAddresses);
            fetchGitcoinScore(allAddresses);
            fetchTalentScore(allAddresses); 
        }
      }
    } catch (error) { console.error("Load error:", error); }
  };

  const handleBoostActivity = () => { 
    if (!address) return;
    setTxStatusMessage("Checking wallet...");
    try {
        const calldata = encodeFunctionData({ abi: BOOST_ABI, functionName: 'boost' });
        const dataSuffix = Attribution.toDataSuffix({ codes: [MY_BUILDER_CODE] });
        const finalData = concat([calldata, dataSuffix]);

        sendTransaction({
          to: BOOST_CONTRACT_ADDRESS as `0x${string}`, 
          data: finalData, 
        }, {
          onSuccess: (hash) => {
             setTxStatusMessage("Success! Activity score has been boosted. (Tx Confirmed)");
          },
          onError: (err) => {
             setTxStatusMessage("Cancelled or failed.");
          }
        });
    } catch (err: any) { console.error("Error:", err); }
  };
  
  const handleAddMiniApp = async () => {
      try { await sdk.actions.addMiniApp(); setIsAdded(true); alert(`Added! 🎉`); } catch (e) { }
  };

  const handleShareCast = () => {
      const shareText = `Check my reputation on Base! 🛡️\n\nNeynar Score: ${neynarScore}\nTalent Score: ${talentScore || "N/A"}\nVerified: ${isIdentityVerified ? "✅" : "❌"}\n\n${METADATA.homeUrl}`;
      const encodedText = encodeURIComponent(shareText);
      const encodedEmbed = encodeURIComponent(METADATA.homeUrl);
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedEmbed}`);
  };

  // --- BADGE LOGIC ---
  const isFullyVerified = isIdentityVerified && isSocialVerified;
  const isPartiallyVerified = isIdentityVerified || isSocialVerified;

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono overflow-x-hidden">
      
      <div className="mb-6 overflow-hidden w-full relative py-2">
        <h1 className="text-3xl font-black whitespace-nowrap animate-marquee">
          REPUTATION CHECKER • BUILD YOUR ONCHAIN TRUST • REPUTATION CHECKER
        </h1>
      </div>

      <div className="bg-gray-900 p-6 rounded-xl border border-blue-500 mb-6 shadow-lg shadow-blue-500/20">
        
        {/* HEADER USER */}
        <div className="flex items-center gap-4 mb-6">
             {farcasterUser?.pfpUrl && (
              <img src={farcasterUser.pfpUrl} alt="Profile" className="w-14 h-14 rounded-full border-2 border-white"/>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">@{farcasterUser?.username || "User"}</p>
                
                {/* --- DINAMIS BADGE (COLORS SWAPPED) --- */}
                {isFullyVerified ? (
                  // FULLY VERIFIED -> BLUE (Efek Glowing)
                  <span className="bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500 flex items-center gap-1 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse">
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-bold text-blue-400 tracking-wider">FULLY VERIFIED</span>
                  </span>
                ) : isPartiallyVerified ? (
                  // PARTIAL VERIFIED -> GREEN
                  <span className="bg-green-500/20 px-2 py-0.5 rounded-full border border-green-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] font-bold text-green-400">VERIFIED</span>
                  </span>
                ) : (
                  <span className="bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-[10px] font-bold text-red-400">UNVERIFIED</span>
                  </span>
                )}
                {/* ------------------- */}

              </div>
              <p className="text-xs text-gray-400">FID: {farcasterUser?.fid || "..."}</p>
            </div>
        </div>

        {/* --- GRID SCORES --- */}
        <div className="grid grid-cols-2 gap-4 mb-6">
             
             {/* Kiri: Neynar Score */}
             <div className="p-4 bg-gray-800 rounded-lg text-center border border-blue-500/30 flex flex-col justify-center items-center h-40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full -mr-8 -mt-8"></div>
                <div className="flex items-center gap-1 mb-2">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">Neynar Score</p>
                </div>
                <p className="text-4xl font-bold text-blue-400">{neynarScore}</p>
             </div>

             {/* Kanan: Stacked Scores */}
             <div className="flex flex-col gap-3">
                
                {/* Talent Protocol */}
                <div className="flex-1 p-3 bg-gray-800/80 rounded-lg border border-purple-500/30 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1">
                            <Code2 className="w-3 h-3 text-purple-400" />
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Builder Score</p>
                        </div>
                        {!talentScore && (
                            <a href="https://talentprotocol.com/" target="_blank" className="text-[8px] bg-purple-900/50 px-1.5 py-0.5 rounded border border-purple-500/30 text-purple-300">Create</a>
                        )}
                    </div>
                    {talentScore ? (
                        <p className="text-2xl font-bold text-purple-400">{talentScore}</p>
                    ) : (
                        <p className="text-lg font-bold text-gray-600">0</p>
                    )}
                </div>

                {/* Gitcoin */}
                <div className="flex-1 p-3 bg-gray-800/80 rounded-lg border border-orange-500/30 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-orange-400" />
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Gitcoin Score</p>
                        </div>
                        {!gitcoinScore && (
                            <a href="https://passport.gitcoin.co/" target="_blank" className="text-[8px] bg-orange-900/50 px-1.5 py-0.5 rounded border border-orange-500/30 text-orange-300">Create</a>
                        )}
                    </div>
                    {gitcoinScore ? (
                        <p className="text-2xl font-bold text-orange-400">{gitcoinScore}</p>
                    ) : (
                        <p className="text-lg font-bold text-gray-600">0.00</p>
                    )}
                </div>

             </div>
        </div>

        {/* --- TOMBOL AKSI --- */}
        {isConnected ? (
          <div className="space-y-4">
            
            {/* 1. VERIFY SOCIAL (Base Verify) - LIQUID EFFECT */}
            <div>
                {isSocialVerified ? (
                    <a href={VERIFY_SOCIAL_URL} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-blue-900/20 text-blue-400 border border-blue-500/50 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                        <Twitter className="w-4 h-4"/> SOCIAL VERIFIED
                    </a>
                ) : (
                    <a href={VERIFY_SOCIAL_URL} target="_blank" rel="noopener noreferrer" className="group relative w-full py-3 bg-black rounded-xl overflow-hidden transition-all duration-300 active:scale-95 hover:shadow-[0_0_20px_rgba(14,165,233,0.6)] block text-center border border-sky-900">
                        {/* Efek Liquid / Blob (Cyan/Sky) */}
                        <div className="absolute inset-0 w-[200%] h-[200%] top-[-50%] left-[-50%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#0ea5e9_50%,#000000_100%)] opacity-60 group-hover:opacity-100 transition-opacity"></div>
                        <div className="absolute inset-[2px] bg-gray-900 rounded-xl z-10 flex items-center justify-center"></div>
                        <div className="relative z-20 flex items-center justify-center gap-2 text-white font-bold text-sm tracking-wider group-hover:text-sky-200 transition-colors">
                            <Twitter className="w-4 h-4 text-sky-400 group-hover:text-white" />
                            VERIFY SOCIAL (BASE)
                        </div>
                    </a>
                )}
            </div>

            {/* 2. VERIFY IDENTITY (EAS / KYC) - LIQUID EFFECT */}
            <div>
                {isIdentityVerified ? (
                    <a href={VERIFY_IDENTITY_URL} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-green-900/20 text-green-400 border border-green-500/50 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-default">
                        <Fingerprint className="w-4 h-4"/> IDENTITY VERIFIED
                    </a>
                ) : (
                    <div className="flex flex-col gap-1">
                        <a href={VERIFY_IDENTITY_URL} target="_blank" rel="noopener noreferrer" className="group relative w-full py-3 bg-black rounded-xl overflow-hidden transition-all duration-300 active:scale-95 hover:shadow-[0_0_20px_rgba(59,130,246,0.6)] block text-center border border-blue-900">
                            {/* Efek Liquid / Blob (Blue) */}
                            <div className="absolute inset-0 w-[200%] h-[200%] top-[-50%] left-[-50%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#3b82f6_50%,#000000_100%)] opacity-60 group-hover:opacity-100 transition-opacity"></div>
                            <div className="absolute inset-[2px] bg-gray-900 rounded-xl z-10 flex items-center justify-center"></div>
                            <div className="relative z-20 flex items-center justify-center gap-2 text-white font-bold text-sm tracking-wider group-hover:text-blue-200 transition-colors">
                                <ShieldCheck className="w-4 h-4 text-blue-400 group-hover:text-white" />
                                VERIFY IDENTITY (EAS)
                            </div>
                        </a>
                        <p className="text-[9px] text-red-400 text-center flex items-center justify-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            Use Smart Wallet (Base App). Don't use Farcaster wallet.
                        </p>
                    </div>
                )}
            </div>

            {/* 3. TOMBOL BOOST - LIQUID EFFECT */}
            <div>
                <button onClick={handleBoostActivity} disabled={isTxPending} className={`group relative w-full py-4 bg-black rounded-xl overflow-hidden transition-all duration-300 active:scale-95 border border-purple-900 ${isTxPending ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"}`}>
                    {/* Efek Liquid / Blob (Purple) */}
                    <div className="absolute inset-0 w-[200%] h-[200%] top-[-50%] left-[-50%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#000000_0%,#a855f7_50%,#000000_100%)] opacity-60 group-hover:opacity-100 transition-opacity"></div>
                    <div className="absolute inset-[2px] bg-gray-900 rounded-xl z-10 flex items-center justify-center"></div>
                    <span className="relative z-20 flex items-center justify-center gap-2 text-white font-bold text-sm tracking-wider group-hover:text-purple-200">
                        <Zap className={`w-5 h-5 ${isTxPending ? "animate-pulse" : "text-yellow-400"}`} fill={isTxPending ? "none" : "currentColor"} />
                        {isTxPending ? "PROCESSING..." : "BOOST ACTIVITY (+1 TX)"}
                    </span>
                </button>

                <div className="text-center mt-3 space-y-2">
                    {txStatusMessage && (
                        <p className={`text-xs font-bold animate-pulse ${txStatusMessage.includes("Success") ? "text-green-400" : "text-yellow-400"}`}>
                            {txStatusMessage}
                        </p>
                    )}
                    <p className="text-[10px] text-gray-500 max-w-sm mx-auto leading-relaxed">
                        Note: Boost activity is experimental to increase Neynar score. 
                        Contract is verified on <a href="https://base.blockscout.com/address/0x285E7E937059f93dAAF6845726e60CD22A865caF?tab=contract" target="_blank" rel="noopener noreferrer" className="underline text-blue-400 hover:text-blue-300 transition">Blockscout</a>.
                    </p>
                </div>
            </div>
            
            <div className="flex justify-center pt-2">
                <div className="inline-flex rounded-full shadow-lg bg-purple-600 overflow-hidden border border-purple-500/50" role="group">
                    <button onClick={handleAddMiniApp} disabled={isAdded} className={`flex items-center gap-2 px-6 py-2 font-bold text-white transition hover:bg-purple-700 text-xs ${isAdded ? 'opacity-50' : ''}`}>
                        <Star className="w-3 h-3 text-yellow-300"/>
                        {isAdded ? "Added" : "Add App"}
                    </button>
                    <div className="w-px bg-white/30 my-2"></div>
                    <button onClick={handleShareCast} className="flex items-center gap-2 px-6 py-2 font-bold text-white transition hover:bg-purple-700 text-xs">
                        <Share2 className="w-3 h-3"/>
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
    </div>
  );
}