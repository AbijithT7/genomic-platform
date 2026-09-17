import { Home, Dna } from "lucide-react";

export default function NotFoundPage({ theme = "dark", onToggleTheme }) {
  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden ${
        theme === "dark" ? "bg-[#06080F] text-slate-200" : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Background DNA Helix */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          alt=""
          className="w-full h-full object-cover object-right-top mix-blend-screen opacity-20 filter contrast-125 brightness-105"
          src="/dna-helix.png"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06080F] via-[#06080F]/90 to-[#06080F]/75" />
      </div>

      <div className="relative z-10 w-full max-w-2xl rounded-2xl clinical-glass p-8 md:p-10 border border-white/[0.09] shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Dna size={20} />
          </div>
          <p className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-semibold">
            404 / ROUTE UNAVAILABLE
          </p>
        </div>

        <h1 className="text-3xl md:text-4xl font-serif text-white font-normal tracking-tight m-0">
          This route isn’t part of the GENOMIX workspace.
        </h1>
        <p className="text-sm md:text-base text-slate-300 font-sans leading-relaxed m-0">
          The requested address is not recognized. Return to the primary clinical interpretation workspace to continue your variant review.
        </p>

        <div className="pt-3 flex flex-wrap gap-3 font-sans">
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-400 text-slate-950 font-semibold text-xs hover:bg-cyan-300 transition-colors shadow-sm"
          >
            <Home size={15} />
            Return to Workspace
          </button>

          <button
            onClick={onToggleTheme}
            className="px-4 py-2.5 rounded-lg border border-white/[0.12] bg-slate-900 text-slate-200 text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            Switch to {theme === "dark" ? "Light" : "Dark"} Mode
          </button>
        </div>
      </div>
    </div>
  );
}
