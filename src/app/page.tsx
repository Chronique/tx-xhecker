"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAccount, useConnect } from "wagmi";
import { useCapabilities, useWriteContracts } from "wagmi/experimental";
import { sdk } from "@farcaster/miniapp-sdk";
import { motion } from "framer-motion";
import { driver } from "driver.js";
import { useTheme } from "next-themes";

// --- UI COMPONENTS ---
import { TipBox } from "~/components/wallet/TipBox";
import { ThemeToggle } from "~/components/ui/ThemeToggle";
import "driver.js/dist/driver.css";

// --- UTILS & CONSTANTS ---
import { METADATA } from "~/lib/utils";
import { MdContentPasteSearch } from "react-icons/md";
import {
  Star, Share2, Zap, CheckCircle2, ShieldCheck,
  AlertTriangle, Code2, Twitter, Fingerprint, RefreshCcw, 
  HelpCircle, Smartphone
} from "lucide-react";

const GITCOIN_API_KEY = process.env.NEXT_PUBLIC_GITCOIN_API_KEY;
const GITCOIN_SCORER_ID = process.env.NEXT_PUBLIC_GITCOIN_SCORER_ID;
const TALENT_API_KEY = process.env.NEXT_PUBLIC_TALENT_API_KEY;
const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
const PAYMASTER_URL = process.env.NEXT_PUBLIC_PAYMASTER_URL || "";

const BOOST_CONTRACT_ADDRESS = "0x285E7E937059f93dAAF6845726e60CD22A865caF";
const VERIFY_SOCIAL_URL = "https://verify.base.dev/verifications";
const VERIFY_IDENTITY_URL = "https://www.coinbase.com/onchain-verify";

const SCHEMA_IDENTITY = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";
const SCHEMA_TWITTER = "0x6291a26f3020617306263907727103a088924375375772392462332997632626";

const BOOST_ABI = [
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "Boosted", "type": "event" },
  { "inputs": [], "name": "boost", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
] as const;

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect } = useConnect();
  const { writeContracts, isPending: isTxPending } = useWriteContracts();
  const { theme } = useTheme();

  // --- STATE ---
  const [mounted, setMounted] = useState(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [farcasterUser, setFarcasterUser] = useState<any>(null);
  const [neynarScore, setNeynarScore] = useState<string>("...");
  const [gitcoinScore, setGitcoinScore] = useState<string | null>(null);
  const [talentScore, setTalentScore] = useState<string | null>(null);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [isSocialVerified, setIsSocialVerified] = useState(false);
  const [txStatusMessage, setTxStatusMessage] = useState("");
  const [isAdded, setIsAdded] = useState(false);
  const [isSubmittingPassport, setIsSubmittingPassport] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // --- PAYMASTER LOGIC ---
  const { data: availableCapabilities } = useCapabilities({
    account: address,
    query: { enabled: !!address, retry: false }
  });

  const capabilities = useMemo(() => {
    if (!availableCapabilities || !chainId || !PAYMASTER_URL) return undefined;
    const capabilitiesForChain = availableCapabilities[chainId];
    if (capabilitiesForChain?.["paymasterService"]?.supported) {
      return { paymasterService: { url: PAYMASTER_URL } };
    }
    return undefined;
  }, [availableCapabilities, chainId]);

  // --- REPUTATION FETCHING ---
  const checkVerifications = useCallback(async (addresses: string[]) => {
    try {
      const formatted = addresses.map(a => a.toLowerCase());
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
    } catch (e) { console.error("EAS Check error", e); }
  }, []);

  const fetchScores = useCallback(async (addresses: string[]) => {
    if (GITCOIN_API_KEY && GITCOIN_SCORER_ID) {
      try {
        const scores = await Promise.all(addresses.map(async (addr) => {
          const res = await fetch(`https://api.passport.xyz/v2/stamps/${GITCOIN_SCORER_ID}/score/${addr}`, { headers: { "X-API-Key": GITCOIN_API_KEY } });
          const data = await res.json();
          return data.evidence?.rawScore ? parseFloat(data.evidence.rawScore) : (data.score ? parseFloat(data.score) : 0);
        }));
        const max = Math.max(...scores);
        setGitcoinScore(max > 0 ? max.toFixed(2) : "0.00");
      } catch (e) { setGitcoinScore("0.00"); }
    }

    if (TALENT_API_KEY) {
      try {
        const res = await fetch(`https://api.talentprotocol.com/scores?id=${addresses[0]}`, { headers: { "X-API-KEY": TALENT_API_KEY } });
        const data = await res.json();
        const score = data.scores?.find((s: any) => s.slug === "builder_score");
        setTalentScore(score ? score.points.toString() : "0");
      } catch (e) { setTalentScore("0"); }
    }
  }, []);

  const fetchAddressAndStats = useCallback(async (fid: number) => {
    if (!NEYNAR_API_KEY) return;
    try {
      const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, { headers: { accept: "application/json", api_key: NEYNAR_API_KEY } });
      const data = await res.json();
      if (data.users?.[0]) {
        const user = data.users[0];
        setNeynarScore(user.score ? user.score.toFixed(2) : "0.00");
        const addrs = [user.custody_address, ...(user.verified_addresses?.eth_addresses || [])].filter(Boolean);
        if (addrs.length > 0) {
          checkVerifications(addrs);
          fetchScores(addrs);
        }
      }
    } catch (e) { console.error("Neynar error", e); }
  }, [checkVerifications, fetchScores]);

  // --- HANDLERS ---
  const handleBoost = () => {
    if (!address) return;
    setTxStatusMessage("Processing...");
    writeContracts({
      contracts: [{ address: BOOST_CONTRACT_ADDRESS, abi: BOOST_ABI, functionName: 'boost', args: [] }],
      capabilities,
    }, {
      onSuccess: () => setTxStatusMessage("Success! Activity boosted."),
      onError: () => setTxStatusMessage("Failed. Please try again.")
    });
  };

  const handleAddMiniApp = useCallback(async () => {
    try {
      await sdk.actions.addMiniApp();
      setIsAdded(true);
    } catch (e) {
      console.error("Add Mini App error", e);
    }
  }, []);

  const handleShareCast = useCallback(() => {
    const shareText = `Check my reputation on Base! 🛡️\n\nNeynar Score: ${neynarScore}\nTalent Score: ${talentScore || "N/A"}\nVerified: ${isIdentityVerified ? "✅" : "❌"}`;
    sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(METADATA.homeUrl)}`);
  }, [neynarScore, talentScore, isIdentityVerified]);

  const startTour = () => {
    if (typeof driver === 'undefined') return;
    driver({
      showProgress: true, animate: true, popoverClass: 'driver-popover',
      steps: [
        { element: '#header-anim', popover: { title: 'Welcome!', description: 'Check your onchain reputation hub.', side: "bottom" } },
        { element: '#profile-card', popover: { title: 'Your Stats', description: 'Monitor your scores across the ecosystem.', side: "bottom" } },
        { element: '#boost-btn', popover: { title: 'Boost Activity', description: 'Execute transactions to improve history.', side: "top" } }
      ]
    }).drive();
  };

  useEffect(() => {
    const initSDK = async () => {
      try {
        sdk.actions.ready();
        const context = await sdk.context;
        if (context?.user) {
          setFarcasterUser(context.user);
          setIsSDKLoaded(true);
          fetchAddressAndStats(context.user.fid);
          if (!localStorage.getItem('tour_seen_v5')) {
            setTimeout(startTour, 2000);
            localStorage.setItem('tour_seen_v5', 'true');
          }
        }
      } catch (e) { console.error(e); }
    };
    if (sdk && !isSDKLoaded) initSDK();
  }, [isSDKLoaded, fetchAddressAndStats]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-mono transition-colors duration-300 flex flex-col">
      
      {/* HEADER */}
      <div id="header-anim" className="flex items-center justify-between mb-8 pb-4 border-b border-border relative z-20">
        <div className="flex items-center gap-4">
          <motion.div 
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="w-12 h-12 bg-[#0052FF] rounded-xl flex items-center justify-center shadow-lg border border-white/10"
          >
            <MdContentPasteSearch className="text-white w-7 h-7" />
          </motion.div>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter leading-none">BASE STATS</h1>
            <h1 className="text-xl font-black italic tracking-tighter text-primary leading-none">CHECKER</h1>
            <p className="text-[8px] text-muted-foreground mt-1 font-bold uppercase tracking-widest">Reputation Score</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={startTour} className="p-2 bg-muted/50 rounded-full border border-border hover:text-primary transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PROFILE CARD */}
      <div id="profile-card" className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-primary/20 mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />

        <div className="flex items-center gap-4 mb-6 relative z-10">
          {farcasterUser?.pfpUrl && <img src={farcasterUser.pfpUrl} alt="PFP" className="w-14 h-14 rounded-full border-2 border-border shadow-md" />}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold">@{farcasterUser?.username || "Builder"}</p>
              <div id="verification-status">
                {isIdentityVerified && isSocialVerified ? (
                  <span className="bg-primary/20 px-2 py-0.5 rounded border border-primary/50 text-[9px] font-bold text-primary animate-pulse">VERIFIED</span>
                ) : (isIdentityVerified || isSocialVerified) ? (
                  <span className="bg-green-500/10 px-2 py-0.5 rounded border border-green-500/50 text-[9px] font-bold text-green-500">PARTIAL</span>
                ) : (
                  <span className="bg-destructive/10 px-2 py-0.5 rounded border border-destructive/50 text-[9px] font-bold text-destructive">UNVERIFIED</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">FID: {farcasterUser?.fid || "..."}</p>
          </div>
        </div>

        {/* SCORES GRID */}
        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
          <div id="neynar-card" className="p-4 bg-muted/40 rounded-xl text-center border border-border h-32 flex flex-col justify-center items-center hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3 h-3 text-primary" />
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Neynar</p>
            </div>
            <p className="text-3xl font-black">{neynarScore}</p>
          </div>

          <div className="flex flex-col gap-2">
            <div id="talent-card" className="flex-1 p-2.5 bg-muted/40 rounded-xl border border-border flex flex-col justify-center">
              <div className="flex items-center gap-1.5 mb-1">
                <Code2 className="w-3 h-3 text-purple-500" />
                <p className="text-[9px] text-muted-foreground uppercase font-bold">Talent</p>
              </div>
              <p className="text-lg font-bold text-purple-500">{talentScore || "0"}</p>
            </div>
            <div id="gitcoin-card" className="flex-1 p-2.5 bg-muted/40 rounded-xl border border-border flex flex-col justify-center">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-orange-500" />
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Gitcoin</p>
                </div>
              </div>
              <p className="text-lg font-bold text-orange-500">{gitcoinScore || "0.00"}</p>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        {isConnected ? (
          <div className="space-y-3 relative z-10">
            <div id="verification-box" className="border border-primary/20 bg-primary/5 rounded-xl p-3 relative pt-5 mb-2">
              <div className="absolute -top-2.5 right-3 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> BASE APP ONLY
              </div>
              <div className="space-y-2">
                <a href={VERIFY_SOCIAL_URL} target="_blank" className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 border transition-all ${isSocialVerified ? 'bg-primary/10 border-primary/50 text-primary' : 'bg-background border-border hover:border-primary/50'}`}>
                  <Twitter className="w-4 h-4"/> {isSocialVerified ? 'SOCIAL VERIFIED' : 'VERIFY SOCIAL'}
                </a>
                <a href={VERIFY_IDENTITY_URL} target="_blank" className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 border transition-all ${isIdentityVerified ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-background border-border hover:border-green-500/50'}`}>
                  <Fingerprint className="w-4 h-4"/> {isIdentityVerified ? 'IDENTITY VERIFIED' : 'VERIFY IDENTITY'}
                </a>
              </div>
            </div>

            <div id="boost-btn">
              <button onClick={handleBoost} disabled={isTxPending} className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-xs tracking-widest active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-primary/20">
                <Zap className={`w-4 h-4 inline-block mr-2 ${isTxPending ? "animate-pulse" : ""}`} />
                {isTxPending ? "PROCESSING..." : "BOOST ACTIVITY (+1 TX)"}
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
          <button onClick={() => connect({ connector: connectors[0] })} className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition-opacity">
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