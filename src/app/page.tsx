"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAccount, useConnect } from "wagmi";
import { useCapabilities, useWriteContracts } from "wagmi/experimental"; 
import { sdk } from "@farcaster/miniapp-sdk";
import { METADATA } from "~/lib/utils"; 
import { TipBox } from "~/components/wallet/TipBox";
import { ThemeToggle } from "~/components/ui/ThemeToggle";

// --- IMPORT ICON ---
import { MdContentPasteSearch } from "react-icons/md"; 
import { 
  Star, Share2, Zap, CheckCircle2, ShieldCheck, 
  AlertTriangle, Code2, Twitter, Fingerprint, RefreshCcw, HelpCircle, Smartphone, Trophy, Palette
} from "lucide-react"; 

// --- IMPORT MOTION & DRIVER ---
import { motion } from "framer-motion";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// --- KONFIGURASI ---
const GITCOIN_API_KEY = process.env.NEXT_PUBLIC_GITCOIN_API_KEY; 
const GITCOIN_SCORER_ID = process.env.NEXT_PUBLIC_GITCOIN_SCORER_ID; 
const TALENT_API_KEY = process.env.NEXT_PUBLIC_TALENT_API_KEY; 
const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || ""; 
const BOOST_CONTRACT_ADDRESS = "0x285E7E937059f93dAAF6845726e60CD22A865caF"; 
const VERIFY_SOCIAL_URL = "https://verify.base.dev/verifications"; 
const VERIFY_IDENTITY_URL = "https://www.coinbase.com/onchain-verify"; 

const BOOST_ABI = [
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "Boosted", "type": "event" },
  { "inputs": [], "name": "boost", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

const SCHEMA_IDENTITY = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";
const SCHEMA_TWITTER = "0x6291a26f3020617306263907727103a088924375375772392462332997632626";

export default function Home() {
  const { address, isConnected, chainId } = useAccount(); 
  const { connectors, connect } = useConnect();
  const { writeContracts, isPending: isTxPending } = useWriteContracts();
  
  const [mounted, setMounted] = useState(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  
  // --- STATE SKOR ---
  const [neynarScore, setNeynarScore] = useState<string>("...");
  const [gitcoinScore, setGitcoinScore] = useState<string | null>(null);
  
  // --- STATE TALENT (LENGKAP) ---
  const [talentBuilderScore, setTalentBuilderScore] = useState<string>("0");
  const [talentBuilderRank, setTalentBuilderRank] = useState<string>("-");
  const [talentCreatorScore, setTalentCreatorScore] = useState<string>("0");

  const [isIdentityVerified, setIsIdentityVerified] = useState(false); 
  const [isSocialVerified, setIsSocialVerified] = useState(false);     
  const [txStatusMessage, setTxStatusMessage] = useState(""); 
  const [isAdded, setIsAdded] = useState(false); 

  useEffect(() => { setMounted(true); }, []);

  // --- LOGIC PAYMASTER ---
  const { data: availableCapabilities } = useCapabilities({ account: address, query: { enabled: !!address } });
  const capabilities = useMemo(() => {
    if (!availableCapabilities || !chainId || !PAYMASTER_URL) return undefined;
    const caps = availableCapabilities[chainId];
    if (caps?.["paymasterService"]?.supported) return { paymasterService: { url: PAYMASTER_URL } };
    return undefined;
  }, [availableCapabilities, chainId]);

  // --- LOGIC FETCHING ---
  const checkVerifications = useCallback(async (addrs: string[]) => {
    try {
      const formatted = addrs.map(a => a.toLowerCase());
      const response = await fetch("https://base.easscan.org/graphql", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query Attestations($whereId: AttestationWhereInput, $whereSoc: AttestationWhereInput) { 
            identity: attestations(where: $whereId) { id } 
            social: attestations(where: $whereSoc) { id } 
          }`,
          variables: {
            whereId: { schemaId: { equals: SCHEMA_IDENTITY }, recipient: { in: formatted }, revoked: { equals: false } },
            whereSoc: { OR: [{ schemaId: { equals: SCHEMA_TWITTER }, recipient: { in: formatted }, revoked: { equals: false } }, { schemaId: { equals: SCHEMA_IDENTITY }, recipient: { in: formatted }, revoked: { equals: false } }] }
          },
        }),
      });
      const result = await response.json();
      setIsIdentityVerified(result.data?.identity?.length > 0);
      setIsSocialVerified(result.data?.social?.length > 0);
    } catch (e) { console.error(e); }
  }, []);

  // --- UPDATE: Menerima param FID opsional ---
  const fetchReputation = useCallback(async (addrs: string[], fid?: number) => {
    // 1. GITCOIN SCORE (Tetap via Wallet)
    if (GITCOIN_API_KEY && GITCOIN_SCORER_ID) {
      try {
        const scores = await Promise.all(addrs.map(async (a) => {
          const res = await fetch(`https://api.passport.xyz/v2/stamps/${GITCOIN_SCORER_ID}/score/${a}`, { headers: { "X-API-Key": GITCOIN_API_KEY } });
          const d = await res.json();
          return d.evidence?.rawScore ? parseFloat(d.evidence.rawScore) : (d.score ? parseFloat(d.score) : 0);
        }));
        setGitcoinScore(Math.max(...scores).toFixed(2));
      } catch (e) { setGitcoinScore("0.00"); }
    }

    // 2. TALENT PROTOCOL (Cek Wallet + Cek FID)
    if (TALENT_API_KEY) {
      try {
        const headers = { "X-API-KEY": TALENT_API_KEY };
        
        // --- Gabungkan Address & FID ke dalam satu list target ---
        const targets = [...addrs];
        if (fid) targets.push(fid.toString()); // Tambah FID ke antrian cek

        console.log("🔍 Checking Talent for:", targets);

        const talentPromises = targets.map(async (target) => {
          try {
            // Fetch ke endpoint /scores dengan ID dinamis (Wallet atau FID)
            const res = await fetch(`https://api.talentprotocol.com/scores?id=${target}`, { headers });
            const data = res.ok ? await res.json() : null;
            
            const scoresList = data?.scores || [];
            
            // Ambil Builder Score
            const builderData = scoresList.find((s: any) => s.slug === 'builder_score');
            const builderPoints = builderData?.points || 0;
            const builderRank = builderData?.rank_position || 0;

            // Ambil Creator Score
            const creatorData = scoresList.find((s: any) => s.slug === 'creator_score');
            const creatorPoints = creatorData?.points || 0;

            console.log(`👤 Target ${target.slice(0,10)}... -> Builder: ${builderPoints}, Rank: ${builderRank}`);
            
            return { builderPoints, builderRank, creatorPoints };
          } catch (err) {
            return { builderPoints: 0, builderRank: 0, creatorPoints: 0 };
          }
        });

        const results = await Promise.all(talentPromises);

        // Cari hasil terbaik
        const bestResult = results.reduce((prev, current) => {
          if (current.builderPoints > prev.builderPoints) return current;
          if (current.builderPoints === prev.builderPoints) {
             if (current.builderRank > 0 && (prev.builderRank === 0 || current.builderRank < prev.builderRank)) return current;
          }
          return prev;
        }, { builderPoints: 0, builderRank: 0, creatorPoints: 0 });

        console.log("🏆 Best Talent Result:", bestResult);

        setTalentBuilderScore(bestResult.builderPoints.toString());
        setTalentCreatorScore(bestResult.creatorPoints.toString());
        
        if (bestResult.builderRank > 0) {
          setTalentBuilderRank(bestResult.builderRank.toLocaleString());
        } else {
          setTalentBuilderRank("-");
        }

      } catch (e) { 
        console.error("Talent API Error:", e);
      }
    }
  }, []);

  const fetchAddressAndStats = useCallback(async (fid: number) => {
    if (!NEYNAR_API_KEY) return;
    try {
      const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, { headers: { api_key: NEYNAR_API_KEY } });
      const data = await res.json();
      if (data.users?.[0]) {
        const user = data.users[0];
        setNeynarScore(user.score ? user.score.toFixed(2) : "0.00");
        const addrs = [user.custody_address, ...(user.verified_addresses?.eth_addresses || [])].filter(Boolean);
        
        // Pass FID juga ke sini
        if (addrs.length > 0) { 
          checkVerifications(addrs); 
          fetchReputation(addrs, fid); 
        }
      }
    } catch (e) { console.error(e); }
  }, [checkVerifications, fetchReputation]);

  // --- HANDLERS ---
  const handleBoost = () => {
    if (!address) return;
    setTxStatusMessage("Processing transaction...");
    writeContracts({
      contracts: [{ address: BOOST_CONTRACT_ADDRESS, abi: BOOST_ABI, functionName: 'boost', args: [] }],
      capabilities,
    }, {
      onSuccess: () => setTxStatusMessage("Success! Activity boosted."),
      onError: () => setTxStatusMessage("Failed. Try again.")
    });
  };

  const handleAddMiniApp = async () => { try { await sdk.actions.addMiniApp(); setIsAdded(true); } catch (e) {} };
  const handleShareCast = () => {
    const rankTxt = talentBuilderRank !== "-" ? `Rank #${talentBuilderRank}` : `Score ${talentBuilderScore}`;
    const txt = `Check my reputation on Base! 🛡️\n\nTalent: ${rankTxt}\nCreator: ${talentCreatorScore}\nNeynar: ${neynarScore}\nVerified: ${isIdentityVerified ? "✅" : "❌"}`;
    sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(txt)}&embeds[]=${encodeURIComponent(METADATA.homeUrl)}`);
  };

  const startTour = () => {
    if (typeof driver === 'undefined') return;
    driver({
      showProgress: true, animate: true, popoverClass: 'driver-popover',
      steps: [
        { element: '#header-anim', popover: { title: 'Welcome!', description: 'Check your onchain reputation hub.', side: "bottom" } },
        { element: '#profile-card', popover: { title: 'Your Stats', description: 'Monitor your scores.', side: "bottom" } },
        { element: '#boost-btn', popover: { title: 'Boost Activity', description: 'Execute transactions to improve history.', side: "top" } }
      ]
    }).drive();
  };

  useEffect(() => {
    const init = async () => {
      try {
        sdk.actions.ready();
        const ctx = await sdk.context;
        if (ctx?.user) {
          setFarcasterUser(ctx.user);
          setIsSDKLoaded(true);
          fetchAddressAndStats(ctx.user.fid);
          if (!localStorage.getItem('tour_seen_v5')) {
            setTimeout(startTour, 2000);
            localStorage.setItem('tour_seen_v5', 'true');
          }
        }
      } catch (e) {}
    };
    if (sdk && !isSDKLoaded) init();
  }, [isSDKLoaded, fetchAddressAndStats]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-mono transition-colors duration-300 flex flex-col overflow-x-hidden relative">
      
      {/* === HEADER === */}
      <div id="header-anim" className="flex items-center justify-between mb-8 pb-4 border-b border-border relative z-20">
        <div className="flex items-center gap-4 relative overflow-visible">
          <motion.div 
            initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
            className="relative z-20 flex-none w-12 h-12 bg-[#0052FF] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,82,255,0.5)] border border-white/20"
          >
            <MdContentPasteSearch className="text-white w-7 h-7" />
          </motion.div>
          <div className="relative z-10 flex flex-col justify-center pl-2">
            <h1 className="text-xl font-black italic tracking-tighter leading-none">BASE STATS</h1>
            <h1 className="text-xl font-black italic tracking-tighter text-primary leading-none">CHECKER</h1>
            <p className="text-[8px] text-muted-foreground mt-1 font-bold tracking-widest uppercase">Reputation Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={startTour} className="p-2 text-muted-foreground hover:text-foreground transition bg-muted/50 rounded-full border border-border">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* MAIN CARD */}
      <div id="profile-card" className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-primary/20 mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

        <div className="flex items-center gap-4 mb-6 relative z-10">
          {farcasterUser?.pfpUrl && <img src={farcasterUser.pfpUrl} alt="PFP" className="w-14 h-14 rounded-full border-2 border-border shadow-md" />}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold">@{farcasterUser?.username || "Builder"}</p>
              <div id="verification-status">
                {isIdentityVerified && isSocialVerified ? (
                  <span className="bg-primary/20 px-2 py-0.5 rounded border border-primary/50 flex items-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-bold text-primary tracking-wider uppercase">Verified</span>
                  </span>
                ) : (isIdentityVerified || isSocialVerified) ? (
                  <span className="bg-green-500/10 px-2 py-0.5 rounded border border-green-500/50 flex items-center gap-1 text-green-500">
                    <ShieldCheck className="w-3 h-3" />
                    <span className="text-[9px] font-bold uppercase">Partial</span>
                  </span>
                ) : (
                  <span className="bg-destructive/10 px-2 py-0.5 rounded border border-destructive/50 flex items-center gap-1 text-destructive">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-[9px] font-bold uppercase">Unverified</span>
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-mono">FID: {farcasterUser?.fid || "..."}</p>
          </div>
        </div>

        {/* --- SCORES GRID (TALENT LEFT BIG) --- */}
        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
          
          {/* LEFT: TALENT PROTOCOL (BIG) */}
          <div id="talent-card" className="p-4 bg-muted/40 rounded-xl text-center border border-border h-auto flex flex-col justify-center items-center group hover:border-primary/50 transition-colors relative overflow-hidden">
            <div className="relative z-10 w-full">
              {/* Header */}
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Trophy className="w-4 h-4 text-purple-400" />
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Talent Protocol</p>
              </div>

              {/* Main Stat: Builder Score */}
              <div className="flex flex-col items-center mb-3">
                <p className="text-4xl font-black text-purple-400 leading-none">{talentBuilderScore}</p>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Builder Score</p>
              </div>

              {/* Sub Stats: Rank & Creator */}
              <div className="flex justify-between w-full border-t border-border/50 pt-2 mt-2 px-2">
                <div className="text-left">
                  <p className="text-[8px] text-muted-foreground font-bold uppercase">Rank</p>
                  <p className="text-sm font-bold text-foreground">#{talentBuilderRank}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-muted-foreground font-bold uppercase">Creator</p>
                  <div className="flex items-center justify-end gap-1">
                    <Palette className="w-3 h-3 text-pink-400" />
                    <p className="text-sm font-bold text-foreground">{talentCreatorScore}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
          </div>

          {/* RIGHT: NEYNAR & GITCOIN (STACKED) */}
          <div className="flex flex-col gap-2">
            
            <div id="neynar-card" className="flex-1 p-2.5 bg-muted/40 rounded-xl border border-border flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3 h-3 text-primary" />
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Neynar</p>
              </div>
              <p className="text-xl font-black text-foreground">{neynarScore}</p>
            </div>

            <div id="gitcoin-card" className="flex-1 p-2.5 bg-muted/40 rounded-xl border border-border flex flex-col justify-center">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-orange-400" />
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Gitcoin</p>
                </div>
                {/* Tombol Refresh mengirim FID juga */}
                <button onClick={() => address && fetchReputation([address], farcasterUser?.fid)} className="text-orange-400 hover:rotate-180 transition-transform">
                  <RefreshCcw className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xl font-black text-orange-400">{gitcoinScore || "0.00"}</p>
            </div>

          </div>
        </div>

        {/* --- ACTIONS --- */}
        {isConnected ? (
          <div className="space-y-3 relative z-10">
            <div id="verification-box" className="border border-primary/20 bg-primary/5 rounded-xl p-3 relative pt-5 mb-2">
              <div className="absolute -top-2.5 right-3 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded shadow-lg border border-white/10 flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> BASE APP ONLY
              </div>

              <div className="space-y-2">
                <a href={VERIFY_SOCIAL_URL} target="_blank" className="group relative w-full py-2.5 block rounded-lg overflow-hidden transition-all active:scale-95 border border-primary/30">
                  <div className="absolute inset-0 w-[200%] h-[200%] top-[-50%] left-[-50%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,#3b82f6_50%,transparent_100%)] opacity-20 group-hover:opacity-60 transition-opacity"></div>
                  <div className="absolute inset-[1px] bg-card rounded-lg z-10"></div>
                  <div className="relative z-20 flex items-center justify-center gap-2 font-bold text-xs">
                    <Twitter className={`w-4 h-4 ${isSocialVerified ? 'text-primary' : 'text-muted-foreground'}`} />
                    {isSocialVerified ? 'SOCIAL VERIFIED' : 'VERIFY SOCIAL'}
                  </div>
                </a>

                <a href={VERIFY_IDENTITY_URL} target="_blank" className="group relative w-full py-2.5 block rounded-lg overflow-hidden transition-all active:scale-95 border border-green-500/30">
                  <div className="absolute inset-0 w-[200%] h-[200%] top-[-50%] left-[-50%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,#22c55e_50%,transparent_100%)] opacity-20 group-hover:opacity-60 transition-opacity"></div>
                  <div className="absolute inset-[1px] bg-card rounded-lg z-10"></div>
                  <div className="relative z-20 flex items-center justify-center gap-2 font-bold text-xs">
                    <Fingerprint className={`w-4 h-4 ${isIdentityVerified ? 'text-green-500' : 'text-muted-foreground'}`} />
                    {isIdentityVerified ? 'IDENTITY VERIFIED' : 'VERIFY IDENTITY'}
                  </div>
                </a>
              </div>
            </div>

            <div id="boost-btn">
              <button onClick={handleBoost} disabled={isTxPending} className="group relative w-full py-4 bg-primary rounded-xl overflow-hidden transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_20px_rgba(0,82,255,0.2)]">
                <div className="absolute inset-0 w-[200%] h-[200%] top-[-50%] left-[-50%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,#ffffff_50%,transparent_100%)] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <div className="absolute inset-[2px] bg-primary rounded-xl z-10"></div>
                <span className="relative z-20 flex items-center justify-center gap-2 text-primary-foreground font-bold text-xs tracking-widest">
                  <Zap className={`w-4 h-4 ${isTxPending ? "animate-pulse" : ""}`} />
                  {isTxPending ? "PROCESSING..." : "BOOST ACTIVITY (+1 TX)"}
                </span>
              </button>
              {txStatusMessage && <p className="text-[10px] text-center mt-2 text-muted-foreground animate-pulse">{txStatusMessage}</p>}
            </div>
            
            <div className="flex gap-2">
              <button onClick={handleAddMiniApp} className="flex-1 py-2 bg-muted hover:bg-muted/80 rounded-lg text-[10px] font-bold border border-border">
                <Star className={`w-3 h-3 mr-1 inline ${isAdded ? 'text-yellow-500' : ''}`} fill={isAdded ? "currentColor" : "none"}/> Add App
              </button>
              <button onClick={handleShareCast} className="flex-1 py-2 bg-foreground text-background rounded-lg text-[10px] font-bold hover:opacity-90">
                <Share2 className="w-3 h-3 mr-1 inline"/> Share Result
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => {
              const fcConnector = connectors.find(c => c.id === 'farcaster-miniapp');
              const otherConnector = connectors.find(c => c.id !== 'farcaster-miniapp'); 

              if (isSDKLoaded && fcConnector) {
                connect({ connector: fcConnector });
              } else {
                connect({ connector: otherConnector || connectors[0] });
              }
            }} 
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* FOOTER */}
      <div id="tip-box-container" className="mt-auto">
        <TipBox />
        <p className="text-[8px] text-center text-muted-foreground uppercase tracking-widest mt-4">
          Built with 🔵 on Base by Chronique
        </p>
      </div>
    </div>
  );
}