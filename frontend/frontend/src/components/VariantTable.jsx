import { useState, useMemo } from "react";
import {
  Dna,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  X,
  Download,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";

function StatusBadge({ status }) {
  const s = (status || "pending").toLowerCase();

  const configs = {
    pathogenic: {
      className: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
      icon: AlertTriangle,
      label: "Pathogenic",
    },
    benign: {
      className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
      icon: CheckCircle2,
      label: "Benign",
    },
    vus: {
      className: "bg-amber-500/10 text-amber-400 border border-amber-500/25",
      icon: HelpCircle,
      label: "VUS",
    },
    pending: {
      className: "bg-zinc-800/60 text-zinc-400 border border-zinc-700/60",
      icon: null,
      label: "Pending",
    },
  };

  const config = configs[s] || configs.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider ${config.className}`}
    >
      {Icon && <Icon size={11} className="flex-shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
}

function RiskBar({ score }) {
  if (score == null) {
    return <span className="text-zinc-600 text-xs font-mono">—</span>;
  }

  const pct = Math.min(Math.max(score * 100, 0), 100);
  const isHigh = pct >= 80;
  const isMid = pct >= 40;
  const barColor = isHigh ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" : isMid ? "bg-amber-500 shadow-[0_0_8px_#f59e0b]" : "bg-emerald-500 shadow-[0_0_8px_#10b981]";
  const textColor = isHigh ? "text-rose-400" : isMid ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-16 h-1.5 rounded-full bg-zinc-900 overflow-hidden flex-shrink-0 border border-zinc-800/85">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-bold ${textColor}`}>
        {score.toFixed(3)}
      </span>
    </div>
  );
}

function getDisease(evidence, variant) {
  if (evidence?.disease) return evidence.disease;
  if (variant?.disease) return variant.disease;
  const match = String(evidence?.shap_explanation || "").match(/\(Disease:\s*([^)]+)\)/i);
  return match?.[1]?.trim() || null;
}

// Convert variants to CSV
function variantsToCsv(variants) {
  const headers = [
    "Chromosome",
    "Position",
    "Reference",
    "Alternate",
    "Status",
    "ML_Score",
    "CADD_Score",
    "Allele_Frequency",
    "Disease",
    "ClinVar",
  ];
  const rows = variants.map((v) => [
    v.chrom || "",
    v.pos || "",
    v.ref || "",
    v.alt || "",
    v.status || "pending",
    v.evidence?.ml_score ?? "",
    v.evidence?.conservation_score ?? "",
    v.evidence?.frequency ?? "",
    getDisease(v.evidence, v) || "",
    v.evidence?.clinvar_status || "",
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    )
    .join("\n");
  return csv;
}

function variantsToJson(variants) {
  return JSON.stringify(variants, null, 2);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function VariantTable({
  variants,
  selectedVariantId,
  onSelectVariant,
  theme = "dark",
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("default"); // default | score-asc | score-desc | position

  const filteredAndSorted = useMemo(() => {
    if (!variants?.length) return [];

    const filtered = variants.filter((v) => {
      if (statusFilter !== "ALL") {
        if (
          (v.status || "pending").toLowerCase() !== statusFilter.toLowerCase()
        ) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchChrom = String(v.chrom).toLowerCase().includes(query);
        const matchPos = String(v.pos).includes(query);
        const matchRef = String(v.ref).toLowerCase().includes(query);
        const matchAlt = String(v.alt).toLowerCase().includes(query);
        const matchStatus = String(v.status || "").toLowerCase().includes(query);
        const matchGene = String(v.gene || v.evidence?.gene || "").toLowerCase().includes(query);
        const matchDisease = String(getDisease(v.evidence, v) || "").toLowerCase().includes(query);
        return matchChrom || matchPos || matchRef || matchAlt || matchStatus || matchGene || matchDisease;
      }

      return true;
    });

    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "score-desc") {
        return (b.evidence?.ml_score ?? -1) - (a.evidence?.ml_score ?? -1);
      }
      if (sortBy === "score-asc") {
        return (a.evidence?.ml_score ?? Infinity) - (b.evidence?.ml_score ?? Infinity);
      }
      if (sortBy === "position") {
        const ca = String(a.chrom || "");
        const cb = String(b.chrom || "");
        if (ca !== cb) return ca.localeCompare(cb);
        return (a.pos || 0) - (b.pos || 0);
      }
      // default: pathogenic first, then score desc
      const aPath = (a.status || "").toLowerCase() === "pathogenic" ? 1 : 0;
      const bPath = (b.status || "").toLowerCase() === "pathogenic" ? 1 : 0;
      if (bPath !== aPath) return bPath - aPath;
      return (b.evidence?.ml_score ?? -1) - (a.evidence?.ml_score ?? -1);
    });

    return sorted;
  }, [variants, searchTerm, statusFilter, sortBy]);

  const hasFilters = searchTerm || statusFilter !== "ALL" || sortBy !== "default";

  const resetFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setStatusFilter("ALL");
    setSortBy("default");
  };

  const handleExportCsv = () => {
    downloadFile(
      `variants-${Date.now()}.csv`,
      variantsToCsv(filteredAndSorted),
      "text/csv",
    );
  };

  const handleExportJson = () => {
    downloadFile(
      `variants-${Date.now()}.json`,
      variantsToJson(filteredAndSorted),
      "application/json",
    );
  };

  const isDark = theme === "dark";

  if (!variants?.length) {
    return (
      <div className={`glass-panel p-12 text-center border glow-border ${isDark ? "border-zinc-800/80" : "border-stone-200 bg-white"}`}>
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-4 ${isDark ? "bg-[#0c1a1b] border-teal-900/40 text-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.15)]" : "bg-stone-100 border-stone-200 text-slate-500"}`}>
          <Dna size={22} className={isDark ? "animate-spin" : ""} style={{ animationDuration: "12s" }} />
        </div>
        <p className={`text-base font-bold ${isDark ? "text-white" : "text-slate-700"}`}>
          No VCF Payload Ingested
        </p>
        <p className={`text-xs mt-1.5 ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
          Ingest a genomic variant database (.vcf) above to deploy predictions.
        </p>
      </div>
    );
  }

  const filterBtnBase = "px-3 py-1 rounded-md text-[11px] font-mono transition-all font-semibold uppercase tracking-wider border";
  const filterBtnIdle = isDark
    ? "border-transparent text-zinc-400 hover:text-teal-400 hover:bg-teal-950/20"
    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-stone-100";
  const filterBtnActive = isDark
    ? "bg-teal-950/30 text-teal-400 border-teal-900/60 shadow-[0_0_10px_rgba(20,184,166,0.1)]"
    : "bg-stone-200 border-stone-300 text-slate-900";

  return (
    <div className={`glass-panel overflow-hidden border glow-border shadow-2xl ${isDark ? "border-zinc-800/45 bg-[#0a1a1b]/80" : "border-stone-200 bg-white"}`}>
      {/* Table Toolbar */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-4 ${isDark ? "border-teal-950/30" : "border-stone-200"}`}>
        <form
          className="relative flex flex-1 min-w-[260px] max-w-md gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            setSearchTerm(searchInput);
          }}
        >
          <Search
            size={14}
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? "text-teal-500/80" : "text-slate-400"}`}
          />
          <input
            type="text"
            aria-label="Search variant matrices"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Interrogate coords, status, genes, diseases…"
            className={`w-full pl-9 pr-8 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${
              isDark
                ? "bg-zinc-950/80 border-teal-900/40 text-teal-300 placeholder-teal-800/80"
                : "bg-white border-stone-300 text-slate-900 placeholder-slate-400"
            }`}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
              }}
              aria-label="Clear filter"
              className={`absolute right-[75px] top-1/2 -translate-y-1/2 ${isDark ? "text-teal-600 hover:text-teal-400" : "text-slate-400 hover:text-slate-700"}`}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-xs font-bold text-black uppercase tracking-wider font-mono shadow-[0_0_10px_rgba(20,184,166,0.2)] transition-all"
          >
            Query
          </button>
        </form>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-xs flex items-center gap-1 font-mono uppercase font-semibold ${isDark ? "text-zinc-500" : "text-slate-500"}`}
          >
            <Filter size={12} className="text-teal-500" /> Filter:
          </span>
          {["ALL", "PATHOGENIC", "BENIGN", "VUS"].map((cat) => (
            <button
              key={cat}
              onClick={() => setStatusFilter(cat)}
              className={`${filterBtnBase} ${
                statusFilter === cat
                  ? cat === "PATHOGENIC"
                    ? "bg-rose-500/15 border-rose-950/40 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                    : filterBtnActive
                  : filterBtnIdle
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs flex items-center gap-1 font-mono uppercase font-semibold ${isDark ? "text-zinc-500" : "text-slate-500"}`}
          >
            <ArrowUpDown size={12} className="text-teal-500" /> Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort dataset matrix"
            className={`text-xs border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/30 font-mono ${
              isDark
                ? "bg-zinc-950 border-teal-900/40 text-teal-400"
                : "bg-white border-stone-300 text-slate-700 shadow-sm"
            }`}
          >
            <option value="default">Default determination</option>
            <option value="score-desc">ML priority index (high → low)</option>
            <option value="score-asc">ML priority index (low → high)</option>
            <option value="position">Genomic coordinate</option>
          </select>
        </div>
      </div>

      {/* Toolbar second row: stats & downloads */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 ${isDark ? "border-teal-950/30 bg-zinc-950/40" : "border-stone-200 bg-stone-50"}`}>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={resetFilters}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-mono uppercase tracking-wider transition-colors ${
                isDark
                  ? "text-teal-400 hover:text-teal-300 hover:bg-teal-950/20"
                  : "text-slate-600 hover:text-slate-900 hover:bg-stone-200"
              }`}
            >
              <RotateCcw size={11} /> Reset matrix filter
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Export Matrix:</span>
          <button
            onClick={handleExportCsv}
            disabled={filteredAndSorted.length === 0}
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase px-3 py-1 rounded-md border transition-all disabled:opacity-30 ${
              isDark
                ? "border-teal-900/40 text-teal-400 hover:bg-teal-950/25"
                : "border-stone-300 text-slate-700 hover:bg-stone-100"
            }`}
          >
            <Download size={11} /> CSV
          </button>
          <button
            onClick={handleExportJson}
            disabled={filteredAndSorted.length === 0}
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase px-3 py-1 rounded-md border transition-all disabled:opacity-30 ${
              isDark
                ? "border-teal-900/40 text-teal-400 hover:bg-teal-950/25"
                : "border-stone-300 text-slate-700 hover:bg-stone-100"
            }`}
          >
            <Download size={11} /> JSON
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr
              className={`uppercase tracking-wider font-semibold font-mono border-b text-[10px] ${
                isDark
                  ? "border-teal-950/30 bg-zinc-950/50 text-zinc-500"
                  : "border-stone-200 bg-stone-50 text-slate-500"
              }`}
            >
              <th className="py-3 px-5">Chromosome</th>
              <th className="py-3 px-5">Position</th>
              <th className="py-3 px-5">Ref</th>
              <th className="py-3 px-5">Alt</th>
              <th className="py-3 px-5">ML score index</th>
              <th className="py-3 px-5">Status</th>
              <th className="py-3 px-5">Tested condition</th>
              <th className="py-3 px-5 text-right">Interrogate</th>
            </tr>
          </thead>
          <tbody className={isDark ? "divide-y divide-teal-950/15" : "divide-y divide-stone-100"}>
            {filteredAndSorted.map((variant) => {
              const isSelected = variant.id === selectedVariantId;
              const isPathogenic =
                (variant.status || "").toLowerCase() === "pathogenic";

              return (
                <tr
                  key={variant.id}
                  onClick={() => onSelectVariant?.(variant)}
                  className={`cursor-pointer transition-all duration-150 relative ${
                    isSelected
                      ? isDark
                        ? "bg-teal-500/10 border-l-4 border-l-teal-500"
                        : "bg-teal-50"
                      : isPathogenic
                        ? isDark
                          ? "bg-rose-500/[0.04] hover:bg-rose-500/[0.08]"
                          : "bg-rose-50/50 hover:bg-rose-50"
                        : isDark
                          ? "hover:bg-teal-950/20"
                          : "hover:bg-stone-50"
                  }`}
                >
                  <td className="py-3.5 px-5 font-mono">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${
                        isDark ? "bg-[#061011] border-teal-950/60 text-teal-400" : "bg-stone-100 text-slate-700"
                      }`}
                    >
                      chr{variant.chrom}
                    </span>
                  </td>

                  <td
                    className={`py-3.5 px-5 font-mono font-medium ${isDark ? "text-zinc-300" : "text-slate-700"}`}
                  >
                    {variant.pos?.toLocaleString()}
                  </td>

                  <td className="py-3.5 px-5 font-mono">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] border ${
                        isDark ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-stone-100 text-slate-600"
                      }`}
                    >
                      {variant.ref}
                    </span>
                  </td>

                  <td className="py-3.5 px-5 font-mono">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                      isDark
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {variant.alt}
                    </span>
                  </td>

                  <td className="py-3.5 px-5">
                    <RiskBar score={variant.evidence?.ml_score} />
                  </td>

                  <td className="py-3.5 px-5">
                    <StatusBadge status={variant.status} />
                  </td>

                  <td className={`py-3.5 px-5 max-w-[260px] font-mono text-[11px] ${isDark ? "text-zinc-400" : "text-slate-700"}`}>
                    {getDisease(variant.evidence, variant) ? (
                      <span className={`line-clamp-2 leading-relaxed flex items-center gap-1.5 ${isDark ? "text-teal-300" : "text-slate-800"}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0 animate-pulse" />
                        {getDisease(variant.evidence, variant)}
                      </span>
                    ) : (
                      <span className={`text-[10px] ${isDark ? "text-zinc-600" : "text-slate-400"}`}>
                        {variant.status === "pending" ? "AWAITING_ANALYTICS" : "NONE_REPORTED"}
                      </span>
                    )}
                  </td>

                  <td className={`py-3.5 px-5 text-right ${isDark ? "text-teal-600/80" : "text-slate-400"}`}>
                    <ChevronRight size={15} className="inline transition-transform duration-200 group-hover:translate-x-1" />
                  </td>
                </tr>
              );
            })}
            {filteredAndSorted.length === 0 && (
              <tr>
                <td
                  colSpan="8"
                  className={`px-5 py-12 text-center text-sm font-mono ${
                    isDark ? "text-zinc-600" : "text-slate-500"
                  }`}
                >
                  // QUERY EMPTY: "{searchTerm}" MATCHED ZERO RECORDS.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer statistics */}
      <div
        className={`p-4 border-t flex items-center justify-between text-[11px] font-mono tracking-wide uppercase flex-wrap gap-3 ${
          isDark ? "border-teal-950/30 text-zinc-500 bg-zinc-950/30" : "border-stone-200 text-slate-500"
        }`}
      >
        <div>
          Showing{" "}
          <span className={`font-semibold ${isDark ? "text-teal-400" : "text-slate-800"}`}>
            {filteredAndSorted.length}
          </span>{" "}
          of{" "}
          <span className={`font-semibold ${isDark ? "text-teal-400" : "text-slate-800"}`}>
            {variants.length}
          </span>{" "}
          records
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-rose-400 font-semibold text-shadow-glow">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            {variants.filter((v) => (v.status || "").toLowerCase() === "pathogenic").length} pathogenic
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            {variants.filter((v) => (v.status || "").toLowerCase() === "benign").length} benign
          </span>
          <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
            {variants.filter((v) => (v.status || "").toLowerCase() === "vus").length} VUS
          </span>
        </div>
      </div>
    </div>
  );
}