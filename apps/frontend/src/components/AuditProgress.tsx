import { useEffect, useRef, useState } from "react";
import { Radar, Volume2 } from "lucide-react";

function host(u?: string) {
  if (!u) return "the site";
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

// Full-screen animated "audit in progress" screen with a one-time voice line.
export function AuditProgress({
  company,
  yourUrl,
  competitorUrl,
  queuePosition,
}: {
  company?: string;
  yourUrl?: string;
  competitorUrl?: string;
  queuePosition?: number;
}) {
  const [step, setStep] = useState(0);
  const spokeRef = useRef(false);

  const messages = [
    `Capturing ${host(yourUrl)}…`,
    competitorUrl ? `Capturing ${host(competitorUrl)}…` : "Capturing competitors…",
    "Measuring domain authority & backlinks…",
    "Analyzing your ranking keywords…",
    "Checking speed & Core Web Vitals…",
    "Scoring design, UX & conversion…",
    "Comparing head-to-head…",
    "Building your report…",
  ];

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % messages.length), 3500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Narrate the audit out loud, line by line, over ~20-30s (queued so each line
  // plays after the previous). Cancelled when the report is ready (unmount).
  useEffect(() => {
    if (spokeRef.current || !("speechSynthesis" in window)) return;
    spokeRef.current = true;
    const name = company?.trim() ? company.trim() : "there";
    const script = [
      `Hey ${name}. Starting your website audit now.`,
      "Capturing your site and your competitor.",
      "Measuring your domain authority and backlinks.",
      "Analyzing the keywords you rank for.",
      "Checking your page speed and core web vitals.",
      "Scoring your design, user experience and conversion.",
      "Almost there. Putting your report together.",
    ];
    let keepAlive: ReturnType<typeof setInterval> | undefined;
    try {
      window.speechSynthesis.cancel();
      for (const line of script) {
        const u = new SpeechSynthesisUtterance(line);
        u.rate = 0.98;
        u.pitch = 1;
        window.speechSynthesis.speak(u); // queued — plays in sequence
      }
      // Chrome stops speech after ~15s; pause/resume keeps long narration alive.
      keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);
    } catch {
      /* ignore */
    }
    return () => {
      if (keepAlive) clearInterval(keepAlive);
      window.speechSynthesis?.cancel();
    };
  }, [company]);

  return (
    <div className="booth-bg flex flex-col items-center justify-center p-6 text-center">
      {/* Radar animation */}
      <div className="relative mb-10 flex h-48 w-48 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500/20" />
        <span className="absolute inline-flex h-32 w-32 animate-ping rounded-full bg-indigo-400/20 [animation-delay:400ms]" />
        <span className="absolute inline-flex h-20 w-20 animate-pulse rounded-full bg-indigo-500/30" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl">
          <Radar className="animate-spin text-white [animation-duration:3s]" size={34} />
        </div>
      </div>

      <h2 className="text-2xl font-black sm:text-3xl">
        {company?.trim() ? `Hey ${company.trim()},` : "Hang tight,"} your audit is running
      </h2>
      <p className="mt-3 flex items-center gap-2 text-lg text-indigo-200">
        <Volume2 size={18} className="animate-pulse" /> {messages[step]}
      </p>

      {queuePosition && queuePosition > 0 ? (
        <p className="mt-6 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white/70">
          You're #{queuePosition} in the queue — starting shortly…
        </p>
      ) : (
        <div className="mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/3 animate-[shimmer_1.6s_infinite] rounded-full bg-indigo-400" style={{ animation: "indeterminate 1.6s ease-in-out infinite" }} />
        </div>
      )}

      <style>{`@keyframes indeterminate { 0%{margin-left:-33%} 100%{margin-left:100%} }`}</style>
      <p className="mt-8 max-w-md text-sm text-white/40">This usually takes about a minute — we're capturing both sites and scoring them with AI.</p>
    </div>
  );
}
