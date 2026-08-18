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
} from "lucide-react";

function StatusBadge({ status }) {
  const s = (status || "pending").toLowerCase();

  const configs = {
    pathogenic: {
      className: "badge-pathogenic",
      icon: AlertTriangle,
      label: "Pathogenic",
    },
    benign: {
      className: "badge-benign",
      icon: CheckCircle2,
      label: "Benign",
    },
    vus: {
      className: "badge-vus",
      icon: HelpCircle,
      label: "VUS",
    },
    pending: {
      className: "badge-pending",
      icon: null,
      label: "Pending",
    },
  };

  const config = configs[s] || configs.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${config.className}`}
    >
      {Icon && <Icon size={12} className="flex-shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
}

function RiskBar({ score }) {
  if (score == null) {
    return <span className="text-zinc-500 text-xs font-mono">—</span>;
  }

  const pct = Math.min(Math.max(score * 100, 0), 100);
  const colorClass =
    pct >= 70
      ? "bg-orange-500 text-orange-400"
      : pct >= 40
        ? "bg-amber-500 text-amber-400"
        : "bg-emerald-500 text-emerald-400";

  const textColorClass =
    pct >= 70
      ? "text-orange-400 font-bold"
      : pct >= 40
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 h-2 rounded-full bg-zinc-800 overflow-hidden flex-shrink-0 border border-zinc-700/50">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass.split(" ")[0]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-mono ${textColorClass}`}>
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

export default function VariantTable({
  variants,
  selectedVariantId,
  onSelectVariant,
  theme = "dark",
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Filter and sort: Pathogenic variants at the top, then by ML score descending
  const filteredAndSorted = useMemo(() => {
    if (!variants?.length) return [];

    return variants
      .filter((v) => {
        // Status filter
        if (statusFilter !== "ALL") {
          if (
            (v.status || "pending").toLowerCase() !== statusFilter.toLowerCase()
          ) {
            return false;
          }
        }

        // Search term filter (matches coordinates, alleles, status and evidence)
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
      })
      .sort((a, b) => {
        // Rule: Pathogenic variants appear at the very top
        const aPath = (a.status || "").toLowerCase() === "pathogenic" ? 1 : 0;
        const bPath = (b.status || "").toLowerCase() === "pathogenic" ? 1 : 0;
        if (bPath !== aPath) return bPath - aPath;

        // Then sort by ML score descending
        const aScore = a.evidence?.ml_score ?? -1;
        const bScore = b.evidence?.ml_score ?? -1;
        return bScore - aScore;
      });
  }, [variants, searchTerm, statusFilter]);

  if (!variants?.length) {
    return (
      <div
        className={`surface-card p-12 text-center border ${theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-stone-300 bg-stone-50"}`}
      >
        <div
          className={`w-12 h-12 rounded-xl border flex items-center justify-center mx-auto mb-3 ${theme === "dark" ? "bg-zinc-800/80 border-zinc-700/60 text-zinc-500" : "bg-stone-200 border-stone-300 text-stone-600"}`}
        >
          <Dna size={22} />
        </div>
        <p
          className={`text-sm font-medium ${theme === "dark" ? "text-zinc-300" : "text-stone-700"}`}
        >
          No variants loaded yet.
        </p>
        <p
          className={`text-xs mt-1 ${theme === "dark" ? "text-zinc-500" : "text-stone-600"}`}
        >
          Upload a VCF file above to populate and interpret variants.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`surface-card overflow-hidden animate-fade-in shadow-xl border ${theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-stone-300 bg-stone-50"}`}
    >
      {/* Table Toolbar */}
      <div
        className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${theme === "dark" ? "border-zinc-800 bg-zinc-900/90" : "border-stone-300 bg-stone-100/90"}`}
      >
        <form
          className="relative flex flex-1 min-w-[245px] max-w-md gap-2"
          onSubmit={(event) => { event.preventDefault(); setSearchTerm(searchInput); }}
        >
          <Search
            size={14}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === "dark" ? "text-zinc-500" : "text-stone-500"}`}
          />
          <input
            type="text"
            aria-label="Search variants"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Variant, position, allele, or status"
            className={`w-full pl-9 pr-8 py-2 border rounded-lg text-xs focus:outline-none focus:border-teal-500/60 transition-colors ${theme === "dark" ? "bg-zinc-950 border-zinc-800 text-zinc-200 placeholder-zinc-500" : "bg-white/80 border-[#bfd4ce] text-[#193233] placeholder-[#75908b]"}`}
          />
          {searchInput && <button type="button" onClick={() => { setSearchInput(""); setSearchTerm(""); }} aria-label="Clear variant search" className={`absolute right-[76px] top-1/2 -translate-y-1/2 ${theme === "dark" ? "text-zinc-500 hover:text-white" : "text-slate-500 hover:text-teal-800"}`}><X size={14} /></button>}
          <button type="submit" className="rounded-lg bg-teal-500 px-3 text-xs font-bold text-[#062421] transition-colors hover:bg-teal-300">Search</button>
        </form>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs flex items-center gap-1 ${theme === "dark" ? "text-zinc-500" : "text-stone-600"}`}
          >
            <Filter size={12} /> Filter:
          </span>
          {["ALL", "PATHOGENIC", "BENIGN", "VUS"].map((cat) => (
            <button
              key={cat}
              onClick={() => setStatusFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                statusFilter === cat
                  ? cat === "PATHOGENIC"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                    : theme === "dark"
                      ? "bg-zinc-800 text-white border border-zinc-700"
                      : "bg-stone-200 text-stone-900 border border-stone-300"
                  : theme === "dark"
                    ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-200/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr
              className={`border-b uppercase tracking-wider font-semibold ${theme === "dark" ? "border-zinc-800 bg-zinc-950/60 text-zinc-400" : "border-stone-300 bg-stone-100 text-stone-600"}`}
            >
              <th className="py-3 px-4">Chromosome</th>
              <th className="py-3 px-4">Position</th>
              <th className="py-3 px-4">Ref</th>
              <th className="py-3 px-4">Alt</th>
              <th className="py-3 px-4">ML Risk Score</th>
              <th className="py-3 px-4">Classification</th>
              <th className="py-3 px-4">Tested Condition</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody
            className={`${theme === "dark" ? "divide-y divide-zinc-800/60" : "divide-y divide-stone-200"}`}
          >
            {filteredAndSorted.map((variant) => {
              const isSelected = variant.id === selectedVariantId;
              const isPathogenic =
                (variant.status || "").toLowerCase() === "pathogenic";

              return (
                <tr
                  key={variant.id}
                  onClick={() => onSelectVariant?.(variant)}
                  className={`cursor-pointer transition-all duration-150 group ${
                    isSelected
                      ? "bg-orange-500/10 border-l-4 border-l-orange-500"
                      : isPathogenic
                        ? "bg-orange-500/[0.03] hover:bg-orange-500/[0.07] border-l-2 border-l-orange-500/40"
                        : theme === "dark"
                          ? "hover:bg-zinc-800/40 border-l-2 border-l-transparent"
                          : "hover:bg-stone-100 border-l-2 border-l-transparent"
                  }`}
                >
                  {/* Chromosome */}
                  <td
                    className={`py-3 px-4 font-mono font-medium ${theme === "dark" ? "text-zinc-200" : "text-stone-800"}`}
                  >
                    <span
                      className={`px-2 py-0.5 rounded border ${theme === "dark" ? "bg-zinc-800/80 border-zinc-700/50 text-zinc-300" : "bg-stone-200 border-stone-300 text-stone-700"}`}
                    >
                      chr{variant.chrom}
                    </span>
                  </td>

                  {/* Position */}
                  <td
                    className={`py-3 px-4 font-mono font-medium ${theme === "dark" ? "text-zinc-300" : "text-stone-700"}`}
                  >
                    {variant.pos?.toLocaleString()}
                  </td>

                  {/* Reference Allele */}
                  <td className="py-3 px-4 font-mono">
                    <span
                      className={`px-2 py-0.5 rounded border ${theme === "dark" ? "bg-zinc-800 text-zinc-400 border-zinc-700/40" : "bg-stone-200 text-stone-700 border-stone-300"}`}
                    >
                      {variant.ref}
                    </span>
                  </td>

                  {/* Alternate Allele */}
                  <td className="py-3 px-4 font-mono">
                    <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 font-semibold">
                      {variant.alt}
                    </span>
                  </td>

                  {/* ML Risk Score */}
                  <td className="py-3 px-4">
                    <RiskBar score={variant.evidence?.ml_score} />
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-4">
                    <StatusBadge status={variant.status} />
                  </td>

                  <td className={`py-3 px-4 max-w-[240px] ${theme === "dark" ? "text-zinc-300" : "text-slate-700"}`}>
                    {getDisease(variant.evidence, variant) ? (
                      <span className="line-clamp-2 leading-relaxed" title={getDisease(variant.evidence, variant)}>
                        {getDisease(variant.evidence, variant)}
                      </span>
                    ) : (
                      <span className={`text-[11px] ${theme === "dark" ? "text-zinc-600" : "text-slate-400"}`}>
                        {variant.status === "pending" ? "Pending analysis" : "Not reported"}
                      </span>
                    )}
                  </td>

                  {/* Action arrow */}
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex items-center group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all ${theme === "dark" ? "text-zinc-500" : "text-stone-500"}`}
                    >
                      <ChevronRight size={15} />
                    </span>
                  </td>
                </tr>
              );
            })}
            {filteredAndSorted.length === 0 && (
              <tr><td colSpan="8" className={`px-4 py-12 text-center text-sm ${theme === "dark" ? "text-zinc-400" : "text-slate-600"}`}>No variants match “{searchTerm}”. Try a chromosome, position, allele, classification, or condition.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer statistics */}
      <div
        className={`p-3.5 border-t flex items-center justify-between text-xs ${theme === "dark" ? "border-zinc-800 bg-zinc-950/40 text-zinc-500" : "border-stone-300 bg-stone-100/80 text-stone-600"}`}
      >
        <div>
          Showing{" "}
          <span
            className={`font-medium ${theme === "dark" ? "text-zinc-300" : "text-stone-800"}`}
          >
            {filteredAndSorted.length}
          </span>{" "}
          of{" "}
          <span
            className={`font-medium ${theme === "dark" ? "text-zinc-300" : "text-stone-800"}`}
          >
            {variants.length}
          </span>{" "}
          variants
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-orange-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            {
              variants.filter(
                (v) => (v.status || "").toLowerCase() === "pathogenic",
              ).length
            }{" "}
            Pathogenic
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            {
              variants.filter(
                (v) => (v.status || "").toLowerCase() === "benign",
              ).length
            }{" "}
            Benign
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {
              variants.filter((v) => (v.status || "").toLowerCase() === "vus")
                .length
            }{" "}
            VUS
          </span>
        </div>
      </div>
    </div>
  );
}
