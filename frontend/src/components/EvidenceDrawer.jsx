import { useState, useEffect } from "react";
import {
  X,
  Activity,
  Database,
  Brain,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Stethoscope,
} from "lucide-react";
import { fetchEvidenceForVariant } from "../lib/api";

function getDisease(evidence, variant) {
  if (evidence?.disease) return evidence.disease;
  if (variant?.disease) return variant.disease;
  const match = String(evidence?.shap_explanation || "").match(/\(Disease:\s*([^)]+)\)/i);
  return match?.[1]?.trim() || null;
}

export default function EvidenceDrawer({ variant, onClose, theme = "dark" }) {
  const [evidence, setEvidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const isLight = theme === "light";

  useEffect(() => {
    if (!variant) return;

    if (variant.evidence) {
      setEvidence(variant.evidence);
      setError(null);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    fetchEvidenceForVariant(variant.id)
      .then((data) => {
        if (!isCancelled) {
          setEvidence(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(
            err.response?.status === 404
              ? "No model evidence recorded yet. Run variant analysis to compute predictions."
              : "Failed to load evidence details.",
          );
          setEvidence(null);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [variant]);

  if (!variant) return null;

  const status = (variant.status || "pending").toLowerCase();
  const isPathogenic = status === "pathogenic";

  // ClinVar status
  let clinVarNote = evidence?.clinvar_status || null;
  const cleanExplanation = evidence?.shap_explanation || "";
  if (!clinVarNote && cleanExplanation.includes("ClinVar:")) {
    const parts = cleanExplanation.split(/ClinVar:\s*/i);
    if (parts.length > 1) {
      clinVarNote = parts[1].replace(/[()]/g, "").trim();
    }
  }

  const mlScore = evidence?.ml_score;
  const caddScore = evidence?.conservation_score;
  const afValue = evidence?.frequency;
  const disease = getDisease(evidence, variant);
  const gene = variant.gene || variant.evidence?.gene || null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity"
      />

      {/* Slide-out Inspector Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-lg z-50 flex flex-col shadow-2xl overflow-hidden border-l transition-colors ${
          isLight
            ? "bg-white border-slate-300 text-slate-900"
            : "bg-[#0b101c] border-slate-800 text-slate-100"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 border-b flex items-start justify-between ${
            isLight ? "border-slate-300 bg-slate-50" : "border-slate-800 bg-[#090d18]"
          }`}
        >
          <div>
            <div
              className={`text-xs font-semibold uppercase tracking-wider font-sans mb-1 ${
                isLight ? "text-slate-600" : "text-slate-400"
              }`}
            >
              Variant Inspector
            </div>
            <div
              className={`font-mono text-base font-bold ${
                isLight ? "text-slate-900" : "text-white"
              }`}
            >
              chr{variant.chrom}:{variant.pos?.toLocaleString()}{" "}
              <span className={isLight ? "text-slate-500" : "text-slate-400"}>{variant.ref}</span> &gt;{" "}
              <span className={isLight ? "text-cyan-700 font-extrabold" : "text-cyan-400 font-extrabold"}>
                {variant.alt}
              </span>
            </div>
            {gene && (
              <div
                className={`text-xs font-mono font-bold mt-0.5 ${
                  isLight ? "text-cyan-800" : "text-cyan-300"
                }`}
              >
                Gene: {gene}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-md border transition-colors ${
              isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-200 border-slate-300"
                : "text-slate-400 hover:text-white hover:bg-slate-800 border-slate-700"
            }`}
            title="Close inspector"
          >
            <X size={16} />
          </button>
        </div>

        {/* Status bar */}
        <div
          className={`px-4 py-2 border-b flex items-center justify-between text-xs ${
            isLight ? "border-slate-200 bg-slate-100/70" : "border-slate-800 bg-[#0c1220]"
          }`}
        >
          <span className={`font-mono ${isLight ? "text-slate-600" : "text-slate-400"}`}>
            chr{variant.chrom}:{variant.pos}
          </span>
          <div>
            {isPathogenic ? (
              <span className="badge-pathogenic inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded">
                <AlertTriangle size={12} /> Pathogenic
              </span>
            ) : status === "benign" ? (
              <span className="badge-benign inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded">
                <CheckCircle2 size={12} /> Benign
              </span>
            ) : status === "vus" ? (
              <span className="badge-vus inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded">
                <HelpCircle size={12} /> VUS
              </span>
            ) : (
              <span className="badge-pending inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          className={`flex items-center gap-5 px-4 border-b text-xs font-medium ${
            isLight ? "border-slate-200 bg-white" : "border-slate-800 bg-[#090d18]"
          }`}
        >
          {["overview", "evidence", "explanation", "raw"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`py-2.5 border-b-2 capitalize transition-colors ${
                activeTab === t
                  ? isLight
                    ? "border-cyan-600 text-cyan-800 font-bold"
                    : "border-cyan-500 text-cyan-400 font-semibold"
                  : isLight
                    ? "border-transparent text-slate-600 hover:text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "explanation" ? "ML Explanation" : t === "raw" ? "Raw Data" : t}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className={`py-12 text-center text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Loading variant evidence...
            </div>
          )}

          {error && !loading && (
            <div
              className={`p-3 rounded-lg border text-center space-y-1 ${
                isLight
                  ? "bg-slate-100 border-slate-300 text-slate-800"
                  : "bg-slate-900 border-slate-700 text-slate-200"
              }`}
            >
              <p className="text-xs font-semibold m-0">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Tab 1: Overview */}
              {activeTab === "overview" && (
                <div className="space-y-3">
                  {/* ML Risk Score */}
                  <div
                    className={`rounded-lg p-3.5 border ${
                      isLight ? "bg-slate-50 border-slate-300" : "bg-[#0c1220] border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-xs font-semibold ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                        ML Risk Score
                      </span>
                      <span
                        className={`font-mono font-bold text-base ${
                          mlScore != null && mlScore >= 0.8
                            ? isLight
                              ? "text-rose-700"
                              : "text-rose-400"
                            : mlScore != null && mlScore < 0.2
                              ? isLight
                                ? "text-emerald-700"
                                : "text-emerald-400"
                              : isLight
                                ? "text-purple-700"
                                : "text-purple-300"
                        }`}
                      >
                        {mlScore != null ? mlScore.toFixed(3) : "—"}
                      </span>
                    </div>

                    <div
                      className={`w-full h-2 rounded-full overflow-hidden mb-2 ${
                        isLight ? "bg-slate-200" : "bg-slate-800"
                      }`}
                    >
                      <div
                        className={`h-full ${
                          mlScore != null && mlScore >= 0.8
                            ? "bg-rose-500"
                            : mlScore != null && mlScore < 0.2
                              ? "bg-emerald-500"
                              : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.min((mlScore ?? 0) * 100, 100)}%` }}
                      />
                    </div>

                    <div className={`flex justify-between text-[10px] ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      <span>&lt;0.20 Benign</span>
                      <span>0.20–0.79 VUS</span>
                      <span>&gt;=0.80 Pathogenic</span>
                    </div>
                  </div>

                  {/* Specification List */}
                  <dl className="space-y-1.5 text-xs">
                    <div
                      className={`flex justify-between py-1 border-b ${
                        isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                      }`}
                    >
                      <dt className={isLight ? "text-slate-600" : "text-slate-400"}>Chromosome</dt>
                      <dd className="font-mono font-semibold">chr{variant.chrom}</dd>
                    </div>
                    <div
                      className={`flex justify-between py-1 border-b ${
                        isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                      }`}
                    >
                      <dt className={isLight ? "text-slate-600" : "text-slate-400"}>Position</dt>
                      <dd className="font-mono font-bold">{variant.pos?.toLocaleString()}</dd>
                    </div>
                    <div
                      className={`flex justify-between py-1 border-b ${
                        isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                      }`}
                    >
                      <dt className={isLight ? "text-slate-600" : "text-slate-400"}>Alleles</dt>
                      <dd className="font-mono font-bold">{variant.ref} &rarr; {variant.alt}</dd>
                    </div>
                    {gene && (
                      <div
                        className={`flex justify-between py-1 border-b ${
                          isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                        }`}
                      >
                        <dt className={isLight ? "text-slate-600" : "text-slate-400"}>Gene</dt>
                        <dd className={`font-mono font-bold ${isLight ? "text-cyan-800" : "text-cyan-300"}`}>{gene}</dd>
                      </div>
                    )}
                    {variant.rsid && (
                      <div
                        className={`flex justify-between py-1 border-b ${
                          isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                        }`}
                      >
                        <dt className={isLight ? "text-slate-600" : "text-slate-400"}>dbSNP</dt>
                        <dd className="font-mono">{variant.rsid}</dd>
                      </div>
                    )}
                    <div
                      className={`flex justify-between py-1 border-b ${
                        isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                      }`}
                    >
                      <dt className={isLight ? "text-slate-600" : "text-slate-400"}>ClinVar</dt>
                      <dd className="font-medium text-right">
                        {clinVarNote || (isPathogenic ? "Pathogenic" : status === "benign" ? "Benign" : "—")}
                      </dd>
                    </div>
                    <div
                      className={`flex justify-between py-1 border-b ${
                        isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                      }`}
                    >
                      <dt className={isLight ? "text-slate-600" : "text-slate-400"}>CADD Score</dt>
                      <dd className="font-mono font-semibold">
                        {caddScore != null ? caddScore.toFixed(1) : "—"}
                      </dd>
                    </div>
                    <div
                      className={`flex justify-between py-1 border-b ${
                        isLight ? "border-slate-200 text-slate-800" : "border-slate-800 text-slate-200"
                      }`}
                    >
                      <dt className={isLight ? "text-slate-600" : "text-slate-400"}>Allele Frequency</dt>
                      <dd className="font-mono">
                        {afValue != null
                          ? afValue === 0
                            ? "< 0.00001"
                            : afValue.toFixed(5)
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {/* Condition */}
                  <div
                    className={`rounded-lg p-3 border text-xs ${
                      isLight ? "bg-slate-50 border-slate-300" : "bg-[#0c1220] border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold mb-1">
                      <Stethoscope size={13} className={isLight ? "text-cyan-700" : "text-cyan-400"} />
                      <span className={isLight ? "text-slate-800" : "text-slate-200"}>Associated Condition</span>
                    </div>
                    <p className={`m-0 leading-relaxed ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                      {disease || "No specific disease condition reported for this variant."}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Evidence */}
              {activeTab === "evidence" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div
                      className={`rounded-lg p-3 border ${
                        isLight ? "bg-slate-50 border-slate-300" : "bg-[#0c1220] border-slate-800"
                      }`}
                    >
                      <div className={`text-xs flex items-center gap-1 mb-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        <Activity size={12} className={isLight ? "text-cyan-700" : "text-cyan-400"} />
                        <span>Allele Frequency</span>
                      </div>
                      <div className={`font-mono text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                        {afValue != null
                          ? afValue === 0
                            ? "< 0.00001"
                            : afValue.toFixed(5)
                          : "—"}
                      </div>
                      <div className={`text-[10px] mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        {afValue != null && afValue < 0.01
                          ? "Rare (< 1%)"
                          : afValue != null
                            ? "Common polymorphism"
                            : "Not recorded"}
                      </div>
                    </div>

                    <div
                      className={`rounded-lg p-3 border ${
                        isLight ? "bg-slate-50 border-slate-300" : "bg-[#0c1220] border-slate-800"
                      }`}
                    >
                      <div className={`text-xs flex items-center gap-1 mb-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        <Database size={12} className={isLight ? "text-purple-700" : "text-purple-400"} />
                        <span>CADD Score</span>
                      </div>
                      <div className={`font-mono text-base font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                        {caddScore != null ? caddScore.toFixed(1) : "—"}
                      </div>
                      <div className={`text-[10px] mt-1 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        {caddScore != null && caddScore >= 20
                          ? "Deleterious (Top 1%)"
                          : "Below deleterious cutoff"}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded-lg p-3 border text-xs ${
                      isLight ? "bg-slate-50 border-slate-300" : "bg-[#0c1220] border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold mb-1">
                      <BarChart3 size={13} className={isLight ? "text-emerald-700" : "text-emerald-400"} />
                      <span className={isLight ? "text-slate-800" : "text-slate-200"}>ClinVar Clinical Assertion</span>
                    </div>
                    <p className={`m-0 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                      {clinVarNote || "No ClinVar assertion available."}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 3: ML Explanation */}
              {activeTab === "explanation" && (
                <div className="space-y-3">
                  <div
                    className={`rounded-lg p-3 border text-xs ${
                      isLight ? "bg-slate-50 border-slate-300" : "bg-[#0c1220] border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold mb-1.5">
                      <Brain size={13} className={isLight ? "text-cyan-700" : "text-cyan-400"} />
                      <span className={isLight ? "text-slate-800" : "text-slate-200"}>Random Forest Classifier</span>
                    </div>
                    <p className={`m-0 mb-2 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                      Supervised machine learning model trained strictly on two verified features:
                    </p>
                    <ul className={`space-y-1 font-mono text-[11px] pl-4 list-disc m-0 ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                      <li>
                        <strong>allele_frequency:</strong> {afValue != null ? afValue : "unannotated"}
                      </li>
                      <li>
                        <strong>cadd_score:</strong> {caddScore != null ? caddScore : "unannotated"}
                      </li>
                    </ul>
                  </div>

                  <div
                    className={`rounded-lg p-3 border text-xs ${
                      isLight ? "bg-slate-50 border-slate-300" : "bg-[#0c1220] border-slate-800"
                    }`}
                  >
                    <div className={`font-semibold mb-1.5 ${isLight ? "text-slate-800" : "text-slate-200"}`}>
                      Feature-Based Explanation
                    </div>
                    {evidence?.shap_explanation ? (
                      <p
                        className={`font-mono text-xs leading-relaxed p-2.5 rounded border m-0 ${
                          isLight
                            ? "bg-white border-slate-300 text-slate-900"
                            : "bg-[#080d18] border-slate-800 text-slate-100"
                        }`}
                      >
                        {evidence.shap_explanation}
                      </p>
                    ) : (
                      <p className={`m-0 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                        No explanation available. Run variant analysis to compute predictions.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Raw Data */}
              {activeTab === "raw" && (
                <pre
                  className={`text-[11px] font-mono p-3 rounded-lg border overflow-x-auto ${
                    isLight
                      ? "bg-slate-50 border-slate-300 text-slate-900"
                      : "bg-[#080d18] border-slate-800 text-slate-200"
                  }`}
                >
                  {JSON.stringify(
                    {
                      variant: {
                        id: variant.id,
                        chrom: variant.chrom,
                        pos: variant.pos,
                        ref: variant.ref,
                        alt: variant.alt,
                        gene: variant.gene,
                        rsid: variant.rsid,
                        genomeBuild: variant.genomeBuild,
                        status: variant.status,
                      },
                      evidence: evidence,
                    },
                    null,
                    2,
                  )}
                </pre>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-3 border-t flex items-center justify-between text-xs font-mono ${
            isLight
              ? "border-slate-300 bg-slate-50 text-slate-600"
              : "border-slate-800 bg-[#090d18] text-slate-400"
          }`}
        >
          <span>ID: {variant.id.slice(0, 8)}...</span>
          <button
            onClick={onClose}
            className={`px-2.5 py-1 rounded text-xs font-sans transition-colors ${
              isLight
                ? "bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200"
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
