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
  Dna,
  Stethoscope,
} from "lucide-react";
import { fetchEvidenceForVariant } from "../lib/api";

function MetricCard({ icon: Icon, label, value, sublabel, highlight }) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        highlight
          ? "bg-orange-500/10 border-orange-500/30"
          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          size={14}
          className={highlight ? "text-orange-400" : "text-zinc-500"}
        />
        <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold font-mono text-white tracking-tight">
        {value}
      </div>
      {sublabel && (
        <div className="text-[11px] text-zinc-400 mt-1">{sublabel}</div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    if (!variant) return;

    // Use embedded evidence if present
    if (variant.evidence) {
      setEvidence(variant.evidence);
      setError(null);
      return;
    }

    // Otherwise fetch from database API
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
              ? "No model evidence recorded yet. Run the analysis pipeline to generate predictions."
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

  // Extract ClinVar status — prefer dedicated field, fall back to parsing explanation string
  let clinVarNote = evidence?.clinvar_status || null;
  let cleanExplanation = evidence?.shap_explanation || "";
  if (!clinVarNote && cleanExplanation.includes("ClinVar:")) {
    const parts = cleanExplanation.split(/ClinVar:\s*/i);
    if (parts.length > 1) {
      clinVarNote = parts[1].replace(/[()]/g, "").trim();
    }
  }

  const mlScore = evidence?.ml_score;
  const isHighRisk = mlScore != null && mlScore >= 0.8;
  const disease = getDisease(evidence, variant);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 transition-opacity"
      />

      {/* Slide-in Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md border-l z-50 flex flex-col shadow-2xl animate-drawer-in overflow-hidden ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-stone-100 border-stone-300"}`}
      >
        {/* Header */}
        <div
          className={`p-6 border-b flex items-start justify-between ${theme === "dark" ? "border-zinc-800 bg-zinc-900/60" : "border-stone-300 bg-stone-50/90"}`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs font-semibold px-2 py-0.5 rounded font-mono">
                chr{variant.chrom}:{variant.pos?.toLocaleString()}
              </span>
              {isPathogenic ? (
                <span className="badge-pathogenic text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                  <AlertTriangle size={11} /> Pathogenic
                </span>
              ) : status === "benign" ? (
                <span className="badge-benign text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                  <CheckCircle2 size={11} /> Benign
                </span>
              ) : status === "vus" ? (
                <span className="badge-vus text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1">
                  <HelpCircle size={11} /> VUS
                </span>
              ) : (
                <span className="badge-pending text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  Pending
                </span>
              )}
            </div>
            <h2
              className={`text-lg font-bold tracking-tight flex items-center gap-2 ${theme === "dark" ? "text-white" : "text-stone-900"}`}
            >
              <span>{variant.ref}</span>
              <span className="text-zinc-500">→</span>
              <span className="text-orange-400">{variant.alt}</span>
              <span className="text-zinc-400 text-xs font-normal font-sans ml-2">
                (Substitution)
              </span>
            </h2>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-colors ${theme === "dark" ? "text-zinc-400 hover:text-white hover:bg-zinc-800 border-zinc-800" : "text-stone-600 hover:text-stone-900 hover:bg-stone-200 border-stone-300"}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-zinc-400">
                Loading variant evidence...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
              <HelpCircle size={24} className="mx-auto text-zinc-500 mb-2" />
              <p
                className={`text-xs font-medium ${theme === "dark" ? "text-zinc-300" : "text-stone-700"}`}
              >
                {error}
              </p>
              <p
                className={`text-[11px] mt-1 ${theme === "dark" ? "text-zinc-500" : "text-stone-600"}`}
              >
                Click "Run Analysis" on the dashboard to compute ML
                pathogenicity and SHAP scores.
              </p>
            </div>
          )}

          {evidence && !loading && (
            <>
              {/* Primary Risk Card */}
              <div
                className={`p-5 rounded-xl border ${
                  isHighRisk
                    ? "bg-gradient-to-br from-orange-500/15 via-zinc-900 to-zinc-900 border-orange-500/40 shadow-lg shadow-orange-500/5"
                    : "bg-zinc-900 border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain
                      size={16}
                      className={
                        isHighRisk ? "text-orange-400" : "text-zinc-400"
                      }
                    />
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      ML Pathogenicity Score
                    </span>
                  </div>
                  <span
                    className={`text-2xl font-black font-mono ${
                      isHighRisk ? "text-orange-400" : "text-emerald-400"
                    }`}
                  >
                    {mlScore != null ? (mlScore * 100).toFixed(1) + "%" : "—"}
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isHighRisk
                        ? "bg-gradient-to-r from-orange-600 to-orange-400"
                        : "bg-gradient-to-r from-emerald-600 to-emerald-400"
                    }`}
                    style={{ width: `${Math.min((mlScore ?? 0) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1.5 font-mono">
                  <span>0.0 (Benign)</span>
                  <span>0.2 / 0.8</span>
                  <span>1.0 (Pathogenic)</span>
                </div>
              </div>

              {/* 2x2 Metric Grid */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  icon={Activity}
                  label="Allele Frequency"
                  value={
                    evidence.frequency != null
                      ? evidence.frequency === 0
                        ? "< 0.00001"
                        : evidence.frequency.toFixed(5)
                      : "—"
                  }
                  sublabel={
                    evidence.frequency != null
                      ? evidence.frequency < 0.01
                        ? "Ultra-rare in population"
                        : "Common polymorphism"
                      : null
                  }
                  highlight={
                    evidence.frequency != null && evidence.frequency < 0.01
                  }
                />

                <MetricCard
                  icon={Database}
                  label="CADD Score"
                  value={
                    evidence.conservation_score != null
                      ? evidence.conservation_score.toFixed(1)
                      : "—"
                  }
                  sublabel={
                    evidence.conservation_score != null
                      ? evidence.conservation_score > 25
                        ? "Top 0.5% deleterious"
                        : "Low deleteriousness"
                      : null
                  }
                  highlight={
                    evidence.conservation_score != null &&
                    evidence.conservation_score > 25
                  }
                />

                <MetricCard
                  icon={BarChart3}
                  label="ClinVar Status"
                  value={
                    clinVarNote ||
                    (isPathogenic
                      ? "Pathogenic"
                      : status === "benign"
                        ? "Benign"
                        : "Reported")
                  }
                  sublabel="Clinical database record"
                />

                <MetricCard
                  icon={Dna}
                  label="Model Engine"
                  value="RandomForest"
                  sublabel="Trained on CADD & AF"
                />
              </div>

              <div className={`p-4 rounded-xl border ${disease ? "bg-teal-500/10 border-teal-500/25" : "bg-zinc-900 border-zinc-800"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope size={14} className={disease ? "text-teal-300" : "text-zinc-500"} />
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-400">Tested Condition</span>
                </div>
                <p className={`m-0 text-sm leading-relaxed ${disease ? "text-teal-50" : "text-zinc-400"}`}>
                  {disease || "No condition association was returned for this variant."}
                </p>
                <p className="m-0 mt-2 text-[10px] text-zinc-500">Condition associations require clinical correlation and source review.</p>
              </div>

              {/* SHAP Explanation */}
              {evidence.shap_explanation && (
                <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain size={15} className="text-orange-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200 m-0">
                      SHAP Interpretability
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-zinc-950/80 p-3.5 rounded-lg border border-zinc-800/80 m-0">
                    {evidence.shap_explanation}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className={`p-4 border-t flex items-center justify-between text-xs ${theme === "dark" ? "border-zinc-800 bg-zinc-900/80 text-zinc-500" : "border-stone-300 bg-stone-50 text-stone-600"}`}
        >
          <span>Variant ID: {variant.id.slice(0, 8)}...</span>
          <button
            onClick={onClose}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${theme === "dark" ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-stone-200 hover:bg-stone-300 text-stone-800"}`}
          >
            Close Panel
          </button>
        </div>
      </div>
    </>
  );
}
