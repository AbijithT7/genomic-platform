import { Home, Dna } from "lucide-react";

export default function NotFoundPage({ theme = "dark", onToggleTheme }) {
  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-6 clinical-grid ${theme === "dark" ? "bg-[#0c1718] text-slate-200" : "bg-[#f5f6f0] text-slate-800"}`}
    >
      <div
        className={`relative w-full max-w-3xl rounded-3xl border overflow-hidden shadow-2xl ${theme === "dark" ? "border-teal-950 bg-[#112326]" : "border-[#d5dfd9] bg-[#fcfcf8]"}`}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img
            src="/bg.png"
            alt=""
            className="w-full h-full object-cover animate-hero-pan"
          />
        </div>
        <div
          className={`absolute inset-0 pointer-events-none ${theme === "dark" ? "bg-gradient-to-r from-zinc-900/95 to-zinc-900/75" : "bg-gradient-to-r from-stone-50/95 to-stone-50/80"}`}
        />

        <div className="relative p-8 md:p-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Dna size={20} />
            </div>
            <p className={`text-sm font-mono tracking-widest ${theme === "dark" ? "text-teal-300" : "text-teal-700"}`}>404 / ROUTE UNAVAILABLE</p>
          </div>

          <h1
            className={`text-3xl md:text-4xl font-bold tracking-tight m-0 ${theme === "dark" ? "text-white" : "text-stone-900"}`}
          >
            This route isn’t part of the review workspace.
          </h1>
          <p
            className={`mt-3 text-sm md:text-base ${theme === "dark" ? "text-zinc-300" : "text-stone-700"}`}
          >
            The page may have moved, or the address may be incomplete. Return to your workspace to continue the review.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors"
            >
              <Home size={16} />
              Return to workspace
            </button>

            <button
              onClick={onToggleTheme}
              className={`px-4 py-2.5 rounded-lg border font-medium transition-colors ${theme === "dark" ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700" : "bg-stone-200 border-stone-300 text-stone-800 hover:bg-stone-300"}`}
            >
              Switch to {theme === "dark" ? "Light" : "Dark"} Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
