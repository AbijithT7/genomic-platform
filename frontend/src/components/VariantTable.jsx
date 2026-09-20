import { useMemo } from "react";
import {
  Search,
  Filter,
  ChevronRight,
  X,
  FileSpreadsheet,
} from "lucide-react";

function StatusBadge({ status }) {
  const s = (status || "pending").toLowerCase();

  const configs = {
    pathogenic: {
      className: "badge-pathogenic",
      dotClass: "bg-rose-500",
      label: "Pathogenic",
    },
    benign: {
      className: "badge-benign",
      dotClass: "bg-emerald-500",
      label: "Benign",
    },
    vus: {
      className: "badge-vus",
      dotClass: "bg-purple-500",
      label: "VUS",
    },
    pending: {
      className: "badge-pending",
      dotClass: "bg-slate-400",
      label: "Pending",
    },
  };

  const config = configs[s] || configs.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-sans font-medium ${config.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
      <span>{config.label}</span>
    </span>
  );
}

function RiskBar({ score, isLight }) {
  if (score == null || typeof score !== "number" || isNaN(score)) {
    return <span className={isLight ? "text-slate-400 text-xs font-mono" : "text-slate-500 text-xs font-mono"}>—</span>;
  }

  const pct = Math.min(Math.max(score * 100, 0), 100);

  // Exact backend thresholds: >= 0.80 Pathogenic, < 0.20 Benign, otherwise VUS
  const barColor =
    score >= 0.8
      ? "bg-rose-500"
      : score < 0.2
        ? "bg-emerald-500"
        : "bg-purple-500";

  const textColor = isLight
    ? score >= 0.8
      ? "text-rose-700 font-bold"
      : score < 0.2
        ? "text-emerald-700 font-bold"
        : "text-purple-700 font-bold"
    : score >= 0.8
      ? "text-rose-400 font-bold"
      : score < 0.2
        ? "text-emerald-400 font-bold"
        : "text-purple-300 font-bold";

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-10 ${textColor}`}>
        {score.toFixed(3)}
      </span>
      <div
        className={`w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0 ${
          isLight ? "bg-slate-200" : "bg-slate-800"
        }`}
      >
        <div
          className={`h-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
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
  searchTerm = "",
  onSearchChange,
  statusFilter = "ALL",
  onStatusFilterChange,
}) {
  const isLight = theme === "light";

  // Filter and sort: Pathogenic variants prioritized at top, then by ML score descending
  const filteredAndSorted = useMemo(() => {
    if (!variants?.length) return [];

    const query = searchTerm.toLowerCase().trim();
    const cleanQuery = query.replace(/^chr/i, "");

    return variants
      .filter((v) => {
        // Status filter
        if (statusFilter !== "ALL") {
          if ((v.status || "pending").toLowerCase() !== statusFilter.toLowerCase()) {
            return false;
          }
        }

        // Search query across all core fields
        if (query) {
          const chrom = String(v.chrom || "").toLowerCase().replace(/^chr/i, "");
          const pos = String(v.pos || "");
          const ref = String(v.ref || "").toLowerCase();
          const alt = String(v.alt || "").toLowerCase();
          const status = String(v.status || "").toLowerCase();
          const gene = String(v.gene || v.evidence?.gene || "").toLowerCase();
          const disease = String(getDisease(v.evidence, v) || "").toLowerCase();
          const rsid = String(v.rsid || "").toLowerCase();

          const matchChrom = chrom.includes(cleanQuery) || `chr${chrom}`.includes(query);
          const matchPos = pos.includes(query);
          const matchRef = ref.includes(query);
          const matchAlt = alt.includes(query);
          const matchStatus = status.includes(query);
          const matchGene = gene.includes(query);
          const matchDisease = disease.includes(query);
          const matchRsid = rsid.includes(query);

          return (
            matchChrom ||
            matchPos ||
            matchRef ||
            matchAlt ||
            matchStatus ||
            matchGene ||
            matchDisease ||
            matchRsid
          );
        }

        return true;
      })
      .sort((a, b) => {
        const aPath = (a.status || "").toLowerCase() === "pathogenic" ? 1 : 0;
        const bPath = (b.status || "").toLowerCase() === "pathogenic" ? 1 : 0;
        if (bPath !== aPath) return bPath - aPath;

        const aScore = a.evidence?.ml_score ?? -1;
        const bScore = b.evidence?.ml_score ?? -1;
        return bScore - aScore;
      });
  }, [variants, searchTerm, statusFilter]);

  if (!variants?.length) {
    return (
      <div
        className={`rounded-lg p-10 text-center border transition-colors ${
          isLight
            ? "border-slate-300 text-slate-600 bg-white"
            : "border-slate-800 text-slate-400 bg-[#0c111d]"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-md flex items-center justify-center mx-auto mb-2.5 ${
            isLight ? "bg-slate-100 text-slate-500" : "bg-slate-800 text-slate-400"
          }`}
        >
          <FileSpreadsheet size={20} />
        </div>
        <p
          className={`text-sm font-semibold m-0 ${
            isLight ? "text-slate-900" : "text-slate-100"
          }`}
        >
          No variants loaded
        </p>
        <p
          className={`text-xs mt-1 max-w-sm mx-auto m-0 ${
            isLight ? "text-slate-600" : "text-slate-400"
          }`}
        >
          Upload a VCF file above to populate the variant analysis table.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg overflow-hidden border transition-colors ${
        isLight
          ? "border-slate-300 bg-white shadow-xs"
          : "border-slate-800 bg-[#0c111d]"
      }`}
    >
      {/* Search & Filter Toolbar */}
      <div
        className={`p-3 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 ${
          isLight ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-[#0c111d]"
        }`}
      >
        {/* Search Bar */}
        <div className="relative flex-1 min-w-0 max-w-md">
          <Search
            size={14}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isLight ? "text-slate-500" : "text-slate-400"
            }`}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Filter chromosome, position, gene, rsID, condition..."
            className={`w-full pl-9 pr-8 py-1.5 border rounded-md text-xs focus:outline-none focus:border-cyan-500 font-sans transition-colors ${
              isLight
                ? "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
                : "bg-[#080d18] border-slate-700 text-slate-100 placeholder-slate-500"
            }`}
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange?.("")}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                isLight
                  ? "text-slate-500 hover:text-slate-800"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-xs flex items-center gap-1 mr-1 ${
              isLight ? "text-slate-600" : "text-slate-400"
            }`}
          >
            <Filter size={12} /> Status:
          </span>
          {["ALL", "PATHOGENIC", "BENIGN", "VUS"].map((cat) => (
            <button
              key={cat}
              onClick={() => onStatusFilterChange?.(cat)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === cat
                  ? cat === "PATHOGENIC"
                    ? "bg-rose-600 text-white font-semibold"
                    : cat === "BENIGN"
                      ? "bg-emerald-600 text-white font-semibold"
                      : cat === "VUS"
                        ? "bg-purple-600 text-white font-semibold"
                        : "bg-cyan-600 text-white font-semibold"
                  : isLight
                    ? "text-slate-700 hover:text-slate-900 hover:bg-slate-200 border border-slate-200"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Swipe Hint */}
      <div
        className={`sm:hidden px-3 py-1.5 border-b text-[11px] font-mono flex items-center justify-between ${
          isLight
            ? "bg-slate-50 text-slate-500 border-slate-200"
            : "bg-[#090d18] text-slate-400 border-slate-800"
        }`}
      >
        <span>Swipe horizontally for all fields</span>
        <span>{filteredAndSorted.length} variants</span>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr
              className={`border-b text-xs font-semibold uppercase tracking-wider ${
                isLight
                  ? "border-slate-300 bg-slate-100 text-slate-700"
                  : "border-slate-800 bg-[#080d18] text-slate-400"
              }`}
            >
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">CHROM</th>
              <th className="py-2.5 px-3">POS</th>
              <th className="py-2.5 px-3">REF</th>
              <th className="py-2.5 px-3">ALT</th>
              <th className="py-2.5 px-3">GENE</th>
              <th className="py-2.5 px-3">ML RISK SCORE</th>
              <th className="py-2.5 px-3">STATUS</th>
              <th className="py-2.5 px-3">CLINVAR</th>
              <th className="py-2.5 px-3">CADD</th>
              <th className="py-2.5 px-3">CONDITION</th>
              <th className="py-2.5 px-3 text-right">INSPECT</th>
            </tr>
          </thead>
          <tbody
            className={`divide-y ${
              isLight ? "divide-slate-200" : "divide-slate-800/80"
            }`}
          >
            {filteredAndSorted.map((variant, idx) => {
              const isSelected = variant.id === selectedVariantId;
              const isPathogenic = (variant.status || "").toLowerCase() === "pathogenic";
              const caddScore = variant.evidence?.conservation_score;
              const clinvarStatus = variant.evidence?.clinvar_status;
              const disease = getDisease(variant.evidence, variant);
              const gene = variant.gene || variant.evidence?.gene || "—";

              return (
                <tr
                  key={variant.id}
                  onClick={() => onSelectVariant?.(variant)}
                  className={`cursor-pointer transition-colors group ${
                    isSelected
                      ? isLight
                        ? "bg-cyan-50 border-l-4 border-cyan-600"
                        : "bg-cyan-950/40 border-l-4 border-cyan-400"
                      : isPathogenic
                        ? isLight
                          ? "hover:bg-rose-50"
                          : "hover:bg-rose-950/20"
                        : isLight
                          ? "hover:bg-slate-100"
                          : "hover:bg-slate-800/40"
                  }`}
                >
                  {/* # */}
                  <td
                    className={`py-2.5 px-3 ${
                      isLight ? "text-slate-500" : "text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </td>

                  {/* Chrom */}
                  <td
                    className={`py-2.5 px-3 font-semibold ${
                      isLight ? "text-slate-800" : "text-slate-300"
                    }`}
                  >
                    chr{variant.chrom}
                  </td>

                  {/* Pos */}
                  <td
                    className={`py-2.5 px-3 font-bold ${
                      isLight ? "text-slate-900" : "text-white"
                    }`}
                  >
                    {variant.pos?.toLocaleString()}
                  </td>

                  {/* Ref */}
                  <td
                    className={`py-2.5 px-3 font-semibold ${
                      isLight ? "text-slate-700" : "text-slate-400"
                    }`}
                  >
                    {variant.ref}
                  </td>

                  {/* Alt */}
                  <td
                    className={`py-2.5 px-3 font-extrabold ${
                      isLight ? "text-cyan-700" : "text-cyan-400"
                    }`}
                  >
                    {variant.alt}
                  </td>

                  {/* Gene */}
                  <td
                    className={`py-2.5 px-3 font-bold ${
                      isLight ? "text-slate-900" : "text-slate-200"
                    }`}
                  >
                    {gene}
                  </td>

                  {/* ML Risk Score */}
                  <td className="py-2.5 px-3">
                    <RiskBar score={variant.evidence?.ml_score} isLight={isLight} />
                  </td>

                  {/* Status */}
                  <td className="py-2.5 px-3">
                    <StatusBadge status={variant.status} />
                  </td>

                  {/* ClinVar */}
                  <td
                    className={`py-2.5 px-3 font-sans text-xs ${
                      isLight ? "text-slate-800" : "text-slate-300"
                    }`}
                  >
                    {clinvarStatus ? (
                      <span
                        className="truncate max-w-[130px] inline-block font-medium"
                        title={clinvarStatus}
                      >
                        {clinvarStatus}
                      </span>
                    ) : (
                      <span className={isLight ? "text-slate-400" : "text-slate-600"}>—</span>
                    )}
                  </td>

                  {/* CADD */}
                  <td className="py-2.5 px-3">
                    {caddScore != null ? (
                      <span
                        className={`font-semibold ${
                          caddScore >= 20
                            ? isLight
                              ? "text-rose-700 font-bold"
                              : "text-rose-400 font-bold"
                            : isLight
                              ? "text-slate-800"
                              : "text-slate-300"
                        }`}
                      >
                        {caddScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className={isLight ? "text-slate-400" : "text-slate-600"}>—</span>
                    )}
                  </td>

                  {/* Condition */}
                  <td
                    className={`py-2.5 px-3 font-sans max-w-[180px] ${
                      isLight ? "text-slate-800" : "text-slate-300"
                    }`}
                  >
                    {disease ? (
                      <span className="truncate block text-xs" title={disease}>
                        {disease}
                      </span>
                    ) : (
                      <span className={isLight ? "text-slate-400 text-xs" : "text-slate-600 text-xs"}>—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
                        isSelected
                          ? isLight
                            ? "text-cyan-700 font-bold"
                            : "text-cyan-400 font-bold"
                          : isLight
                            ? "text-slate-400 group-hover:text-cyan-700"
                            : "text-slate-500 group-hover:text-cyan-400"
                      }`}
                    >
                      <ChevronRight size={15} />
                    </span>
                  </td>
                </tr>
              );
            })}

            {filteredAndSorted.length === 0 && (
              <tr>
                <td
                  colSpan="12"
                  className={`px-4 py-8 text-center text-xs font-sans ${
                    isLight ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  No variants match “{searchTerm}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer statistics */}
      <div
        className={`p-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans ${
          isLight
            ? "border-slate-300 bg-slate-50 text-slate-700"
            : "border-slate-800 bg-[#080d18] text-slate-400"
        }`}
      >
        <div>
          Showing <span className={`font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{filteredAndSorted.length}</span> of{" "}
          <span className={`font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>{variants.length}</span> variants
        </div>
        <div className="flex items-center gap-3 sm:gap-4 font-mono text-[11px] sm:text-xs flex-wrap">
          <span className={isLight ? "text-rose-700 font-semibold" : "text-rose-400 font-semibold"}>
            {variants.filter((v) => (v.status || "").toLowerCase() === "pathogenic").length} Pathogenic
          </span>
          <span className={isLight ? "text-purple-700 font-semibold" : "text-purple-400 font-semibold"}>
            {variants.filter((v) => (v.status || "").toLowerCase() === "vus").length} VUS
          </span>
          <span className={isLight ? "text-emerald-700 font-semibold" : "text-emerald-400 font-semibold"}>
            {variants.filter((v) => (v.status || "").toLowerCase() === "benign").length} Benign
          </span>
        </div>
      </div>
    </div>
  );
}
