"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useSendTransaction } from "wagmi";
import { createPublicClient, http, encodeFunctionData, concat } from "viem";
import { base } from "viem/chains"; 
import { sdk } from "@farcaster/miniapp-sdk";
import { Star, Share2, Zap, CheckCircle2, ShieldCheck, AlertTriangle, Code2, Twitter, Fingerprint, RefreshCcw, HelpCircle } from "lucide-react"; 
import { METADATA } from "~/lib/utils"; 
import { Attribution } from "ox/erc8021";

// --- IMPORT MOTION & DRIVER ---
import { motion } from "framer-motion";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// --- KONFIGURASI ---
const MY_BUILDER_CODE = "bc_2ivoo1oy"; 
const GITCOIN_API_KEY = process.env.NEXT_PUBLIC_GITCOIN_API_KEY; 
const GITCOIN_SCORER_ID = process.env.NEXT_PUBLIC_GITCOIN_SCORER_ID; 
const TALENT_API_KEY = process.env.NEXT_PUBLIC_TALENT_API_KEY; 

const BOOST_CONTRACT_ADDRESS = "0x285E7E937059f93dAAF6845726e60CD22A865caF"; 
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

// --- SCHEMAS ---
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
  const [isSubmittingPassport, setIsSubmittingPassport] = useState(false);

  // --- TOUR LOGIC (GLASSMORPHISM) ---
  const startTour = () => {
    const tourDriver = driver({
      showProgress: true,
      animate: true,
      // Class ini akan memanggil CSS Glassmorphism yang sudah kita buat di globals.css
      popoverClass: 'driver-popover', 
      steps: [
        {
          element: '#header-anim',
          popover: { title: 'Welcome!', description: 'This tool helps you analyze and boost your onchain reputation.', side: "bottom" }
        },
        {
          element: '#profile-card',
          popover: { title: 'Identity Status', description: 'Your current verification badges. Aim for "Fully Verified" to be trusted.', side: "bottom" }
        },
        {
          element: '#neynar-score',
          popover: { title: 'Neynar Score', description: 'Measures your activity on Farcaster. Post more to increase this!', side: "top" }
        },
        {
          element: '#gitcoin-card',
          popover: { title: 'Gitcoin Passport', description: 'Anti-Sybil score. If your score is 0, click the button to Calculate.', side: "top" }
        },
        {
          element: '#boost-btn',
          popover: { title: 'Boost Activity', description: 'Perform a real onchain transaction here to boost your wallet history.', side: "top" }
        }
      ]
    });
    tourDriver.drive();
  };

  // Auto-detect User
  useEffect(() => {
    const load = async () => {
      sdk.actions.ready(); 
      const context = await sdk.context;
      if (context?.user) {
        setFarcasterUser(context.user);
        setIsSDKLoaded(true);
        fetchAddressAndStats(context.user.fid);
        
        // Auto start tour on first visit
        const hasSeen = localStorage.getItem('tour_seen_v3');
        if(!hasSeen) {
            setTimeout(() => startTour(), 2000); // Tunggu animasi selesai baru tour mulai
            localStorage.setItem('tour_seen_v3', 'true');
        }
      }
    };
    if (sdk && !isSDKLoaded) load();
  }, [isSDKLoaded]);

  // --- LOGIC FETCHING ---
  const checkVerifications = async (addresses: string[]) => {
    try {
      const formattedAddresses = addresses.map(a => a.toLowerCase());
      const response = await fetch("https://base.easscan.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query Attestations($whereIdentity: AttestationWhereInput, $whereSocial: AttestationWhereInput) { identity: attestations(where: $whereIdentity) { id } social: attestations(where: $whereSocial) { id } }`,
          variables: {
            whereIdentity: { schemaId: { equals: SCHEMA_IDENTITY }, recipient: { in: formattedAddresses }, revoked: { equals: false } },
            whereSocial: { OR: [{ schemaId: { equals: SCHEMA_TWITTER }, recipient: { in: formattedAddresses }, revoked: { equals: false } }, { schemaId: { equals: SCHEMA_IDENTITY }, recipient: { in: formattedAddresses }, revoked: { equals: false } }] }
          },
        }),
      });
      const result = await response.json();
      setIsIdentityVerified(result.data?.identity?.length > 0);
      setIsSocialVerified(result.data?.social?.length > 0);
    } catch (e) { console.error("Verification check failed:", e); }
  };

  const fetchGitcoinScore = async (addresses: string[]) => {
    if (!GITCOIN_API_KEY || !GITCOIN_SCORER_ID) { setGitcoinScore(null); return; }
    try {
        const scorePromises = addresses.map(async (addr) => {
            try {
                const res = await fetch(`https://api.passport.xyz/v2/stamps/${GITCOIN_SCORER_ID}/score/${addr}`, { headers: { "X-API-Key": GITCOIN_API_KEY } });
                if (!res.ok) return 0;
                const data = await res.json();
                if (data.evidence && data.evidence.rawScore) return parseFloat(data.evidence.rawScore);
                return data.score ? parseFloat(data.score) : 0;
            } catch (e) { return 0; }
        });
        const scores = await Promise.all(scorePromises);
        const maxScore = Math.max(...scores);
        if (maxScore > 0) setGitcoinScore(maxScore.toFixed(2));
        else setGitcoinScore(null); 
    } catch (e) { setGitcoinScore(null); }
  };

  const submitPassport = async () => {
    if (!address || !GITCOIN_API_KEY || !GITCOIN_SCORER_ID) return;
    setIsSubmittingPassport(true);
    setTxStatusMessage(`Submitting ${address.slice(0,6)}...`); 
    try {
      const response = await fetch("https://api.passport.xyz/registry/submit-passport", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": GITCOIN_API_KEY },
          body: JSON.stringify({ address: address, scorer_id: GITCOIN_SCORER_ID }),
      });
      if (!response.ok) throw new Error("Failed");
      setTxStatusMessage("Submitted! Refreshing...");
      setTimeout(() => { fetchGitcoinScore([address]); setTxStatusMessage("Score updated."); setIsSubmittingPassport(false); }, 2000);
    } catch (e) { setTxStatusMessage("Error submitting."); setIsSubmittingPassport(false); }
  };

  const fetchTalentScore = async (addresses: string[]) => {
    if (!TALENT_API_KEY) { setTalentScore(null); return; }
    const targetAddr = addresses[0]; 
    try {
        const response = await fetch(`https://api.talentprotocol.com/scores?id=${targetAddr}`, { headers: { "X-API-KEY": TALENT_API_KEY } });
        const data = await response.json();
        const builderScore = data.scores?.find((s: any) => s.slug === "builder_score");
        if (builderScore) setTalentScore(builderScore.points.toString());
        else setTalentScore("0");
    } catch (e) { setTalentScore(null); }
  };

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
        if (user.verified_addresses?.eth_addresses) allAddresses.push(...user.verified_addresses.eth_addresses);
        if (allAddresses.length > 0) { checkVerifications(allAddresses); fetchGitcoinScore(allAddresses); fetchTalentScore(allAddresses); }
      }
    } catch (error) { console.error("Load error:", error); }
  };

  const handleBoostActivity = () => { 
    if (!address) return;
    setTxStatusMessage("Checking wallet...");
    try {
        const calldata = encodeFunctionData({ abi: BOOST_ABI, functionName: 'boost' });
        const finalData = concat([calldata, Attribution.toDataSuffix({ codes: [MY_BUILDER_CODE] })]);
        sendTransaction({ to: BOOST_CONTRACT_ADDRESS as `0x${string}`, data: finalData }, {
          onSuccess: () => setTxStatusMessage("Success! Activity boosted."),
          onError: () => setTxStatusMessage("Cancelled or failed.")
        });
    } catch (err: any) { console.error("Error:", err); }
  };
  
  const handleAddMiniApp = async () => { try { await sdk.actions.addMiniApp(); setIsAdded(true); } catch (e) { } };
  const handleShareCast = () => {
      const shareText = `Check my reputation on Base! 🛡️\n\nNeynar Score: ${neynarScore}\nTalent Score: ${talentScore || "N/A"}\nVerified: ${isIdentityVerified ? "✅" : "❌"}`;
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(METADATA.homeUrl)}`);
  };

  const isFullyVerified = isIdentityVerified && isSocialVerified;
  const isPartiallyVerified = isIdentityVerified || isSocialVerified;

  return (
    <div className="min-h-screen bg-black text-white p-6 font-mono overflow-x-hidden relative">
      
      {/* === HEADER BARU DENGAN ANIMASI REVEAL === */}
      <div id="header-anim" className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800/50">
          
          {/* Logo & Text Animation Container */}
          <div className="flex items-center gap-4 relative overflow-visible">
              
              {/* 1. LOGO (Posisi di Depan/Atas - z-20) */}
              <motion.div 
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="relative z-20 flex-none w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-white/10"
              >
                  <ShieldCheck className="text-white w-7 h-7" />
              </motion.div>

              {/* 2. TEKS (Posisi di Belakang Logo - z-10) */}
              <motion.div
                  initial={{ x: -60, opacity: 0 }} // Mulai sembunyi di belakang logo
                  animate={{ x: 0, opacity: 1 }}   // Geser ke kanan (muncul)
                  transition={{ delay: 0.4, type: "spring", stiffness: 100 }} // Delay agar muncul setelah logo
                  className="relative z-10 flex flex-col justify-center pl-2" // pl-2 biar ada jarak
              >
                  <h1 className="text-xl font-black italic tracking-tighter text-white leading-none">
                      REPUTATION
                  </h1>
                  <h1 className="text-xl font-black italic tracking-tighter text-blue-500 leading-none">
                      CHECKER
                  </h1>
                  <p className="text-[8px] text-gray-500 mt-1 font-bold tracking-widest uppercase">
                      Build Onchain Trust
                  </p>
              </motion.div>
          </div>

          {/* Tombol Help/Tour */}
          <button 
              onClick={startTour}
              className="p-2 text-gray-500 hover:text-white transition bg-gray-900/50 rounded-full border border-gray-800 hover:bg-gray-800"
              title="Start Tutorial"
          >
              <HelpCircle className="w-5 h-5" />
          </button>
      </div>

      {/* MAIN CARD */}
      <div id="profile-card" className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl border border-blue-500/30 mb-6 shadow-xl relative overflow-hidden">
        
        {/* Dekorasi Background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

        {/* HEADER USER */}
        <div className="flex items-center gap-4 mb-6 relative z-10">
             {farcasterUser?.pfpUrl && (
              <img src={farcasterUser.pfpUrl} alt="Profile" className="w-14 h-14 rounded-full border-2 border-gray-700 shadow-md"/>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">@{farcasterUser?.username || "User"}</p>
                {isFullyVerified ? (
                  <span className="bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/50 flex items-center gap-1 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    <span className="text-[9px] font-bold text-blue-300 tracking-wider">VERIFIED</span>
                  </span>
                ) : isPartiallyVerified ? (
                  <span className="bg-green-900/30 px-2 py-0.5 rounded border border-green-500/50 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-green-400" />
                    <span className="text-[9px] font-bold text-green-300">PARTIAL</span>
                  </span>
                ) : (
                  <span className="bg-red-900/30 px-2 py-0.5 rounded border border-red-500/50 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span className="text-[9px] font-bold text-red-300">UNVERIFIED</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">FID: {farcasterUser?.fid || "..."}</p>
            </div>
        </div>

        {/* --- GRID SCORES --- */}
        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
             
             {/* Kiri: Neynar Score */}
             <div id="neynar-score" className="p-4 bg-black/40 rounded-xl text-center border border-gray-800 flex flex-col justify-center items-center h-32 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="p-1 bg-blue-500/20 rounded-md">
                        <Zap className="w-3 h-3 text-blue-400" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Neynar</p>
                </div>
                <p className="text-3xl font-black text-white">{neynarScore}</p>
             </div>

             {/* Kanan: Stacked Scores */}
             <div className="flex flex-col gap-2">
                
                {/* Talent Protocol */}
                <div className="flex-1 p-2.5 bg-black/40 rounded-xl border border-gray-800 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <Code2 className="w-3 h-3 text-purple-400" />
                            <p className="text-[9px] text-gray-400 uppercase font-bold">Talent</p>
                        </div>
                        {!talentScore && <a href="https://talentprotocol.com/" target="_blank" className="text-[8px] text-purple-400 hover:underline">Create</a>}
                    </div>
                    <p className="text-lg font-bold text-purple-300">{talentScore || "0"}</p>
                </div>

                {/* Gitcoin Card */}
                <div id="gitcoin-card" className="flex-1 p-2.5 bg-black/40 rounded-xl border border-gray-800 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3 h-3 text-orange-400" />
                            <p className="text-[9px] text-gray-400 uppercase font-bold">Gitcoin</p>
                        </div>
                        <a href="https://passport.gitcoin.co/" target="_blank" className="text-[8px] text-orange-400 hover:underline">Manage</a>
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-orange-300">{gitcoinScore && parseFloat(gitcoinScore) > 0 ? gitcoinScore : "0.00"}</p>
                        
                        <button 
                            onClick={submitPassport} 
                            disabled={isSubmittingPassport} 
                            className={`p-1 rounded-md transition-all ${isSubmittingPassport ? 'bg-orange-900/30' : 'bg-orange-500/10 hover:bg-orange-500/30 text-orange-400'}`}
                        >
                            <RefreshCcw className={`w-3 h-3 ${isSubmittingPassport ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

             </div>
        </div>

        {/* --- TOMBOL AKSI --- */}
        {isConnected ? (
          <div className="space-y-3 relative z-10">
            {/* 1. VERIFY SOCIAL */}
            <a href={VERIFY_SOCIAL_URL} target="_blank" rel="noopener noreferrer" className={`block w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${isSocialVerified ? 'bg-blue-900/20 text-blue-400 border border-blue-500/30' : 'bg-black border border-gray-800 hover:border-blue-500/50 text-gray-300 hover:text-white'}`}>
                <Twitter className="w-4 h-4"/> {isSocialVerified ? "SOCIAL VERIFIED" : "VERIFY SOCIAL (BASE)"}
            </a>

            {/* 2. VERIFY IDENTITY */}
            <a href={VERIFY_IDENTITY_URL} target="_blank" rel="noopener noreferrer" className={`block w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${isIdentityVerified ? 'bg-green-900/20 text-green-400 border border-green-500/30' : 'bg-black border border-gray-800 hover:border-green-500/50 text-gray-300 hover:text-white'}`}>
                <Fingerprint className="w-4 h-4"/> {isIdentityVerified ? "IDENTITY VERIFIED" : "VERIFY IDENTITY (EAS)"}
            </a>

            {/* 3. TOMBOL BOOST */}
            <div id="boost-btn">
                <button onClick={handleBoostActivity} disabled={isTxPending} className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border ${isTxPending ? "bg-gray-800 text-gray-500 border-gray-700" : "bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-purple-500/30 hover:border-purple-400 text-white hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]"}`}>
                    <Zap className={`w-4 h-4 ${isTxPending ? "animate-pulse" : "text-yellow-400"}`} fill="currentColor" />
                    {isTxPending ? "PROCESSING..." : "BOOST ONCHAIN ACTIVITY (+1 TX)"}
                </button>
                {txStatusMessage && <p className="text-[10px] text-center mt-2 text-gray-400 animate-pulse">{txStatusMessage}</p>}
            </div>
            
            {/* Footer Buttons */}
            <div className="flex gap-2 mt-2">
                <button onClick={handleAddMiniApp} disabled={isAdded} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-[10px] font-bold text-gray-300 flex items-center justify-center gap-1 transition">
                    <Star className="w-3 h-3 text-yellow-500" fill="currentColor"/> {isAdded ? "Added" : "Add App"}
                </button>
                <button onClick={handleShareCast} className="flex-1 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition">
                    <Share2 className="w-3 h-3"/> Share Result
                </button>
            </div>

          </div>
        ) : (
          <div className="mt-4">
             {connectors.slice(0,1).map((connector) => (
               <button key={connector.uid} onClick={() => connect({ connector })} className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2">
                 <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Connect Wallet
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}