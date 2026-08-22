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
  Copy,
  Check,
  Share2,
  Printer,
} from "lucide-react";
import { fetchEvidenceForVariant } from "../lib/api";

function MetricCard({ icon: Icon, label, value, sublabel, highlight }) {
  return (
    <div
      className={`p-3.5 rounded-xl border transition-all ${
        highlight
          ? "bg-rose-500/5 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
          : "bg-zinc-950/80 border-teal-950/40 hover:border-teal-900/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={12} className={highlight ? "text-rose-400" : "text-teal-500"} />
        <span className="text-[9px] font-bold font-mono tracking-wider uppercase text-zinc-500">
          {label}
        </span>
      </div>
      <div className="text-base font-bold font-mono text-white tracking-tight">{value}</div>
      {sublabel && (
        <div className="text-[10px] font-mono text-zinc-500 mt-1 leading-relaxed">{sublabel}</div>
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
  const [copiedField, setCopiedField] = useState(null);

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

  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const shareLink = async () => {
    const coord = `chr${variant.chrom}:${variant.pos} ${variant.ref}>${variant.alt}`;
    const shareText = `Variant ${coord}${variant.status ? ` (${variant.status})` : ""}`;
    const shareUrl = `${window.location.origin}${window.location.pathname}#variant=${variant.id}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Genomic Variant", text: shareText, url: shareUrl });
      } catch {
        // failed
      }
    }
    copyToClipboard(`${shareText}\n${shareUrl}`, "share");
  };

  const status = (variant.status || "pending").toLowerCase();
  const isPathogenic = status === "pathogenic";

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

  const coordText = `chr${variant.chrom}:${variant.pos?.toLocaleString()}`;
  const hgvsText = `${variant.ref}>${variant.alt}`;

  return (
    <>
      {/* Immersive backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 transition-opacity duration-300"
      />

      {/* Holographic Slide-out Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#040809] border-l border-teal-950/60 z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-drawer-in overflow-hidden">
        {/* Subtle scanning animation in drawer */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-teal-500 to-transparent opacity-20 animate-pulse" />

        {/* Header */}
        <div className="p-6 border-b border-teal-950/40 bg-zinc-950/30 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-xs font-bold px-2.5 py-0.5 rounded-md font-mono shadow-[0_0_10px_rgba(20,184,166,0.1)]">
                {coordText}
              </span>
              {isPathogenic ? (
                <span className="bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                  <AlertTriangle size={10} /> Pathogenic
                </span>
              ) : status === "benign" ? (
                <span className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                  <CheckCircle2 size={10} /> Benign
                </span>
              ) : status === "vus" ? (
                <span className="bg-amber-500/15 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase flex items-center gap-1">
                  <HelpCircle size={10} /> VUS
                </span>
              ) : (
                <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md uppercase">
                  Pending
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold flex items-center gap-2.5 text-white">
              <span className="font-mono text-zinc-400">{variant.ref}</span>
              <span className="text-teal-600 font-mono">→</span>
              <span className="text-orange-500 font-mono text-shadow-glow">{variant.alt}</span>
              <span className="text-zinc-600 text-xs font-normal font-mono uppercase tracking-wider ml-1">
                (SUB)
              </span>
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-teal-400 hover:bg-teal-950/20 transition-all border border-transparent hover:border-teal-950/40"
            title="Close Drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Operations Toolbar */}
        <div className="px-6 py-3 border-b border-teal-950/30 bg-zinc-950/50 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => copyToClipboard(coordText, "coord")}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md border border-teal-950/40 text-teal-400/80 hover:text-teal-300 hover:bg-teal-950/20 transition-all"
          >
            {copiedField === "coord" ? (
              <>
                <Check size={11} className="text-emerald-400" />
                COPIED
              </>
            ) : (
              <>
                <Copy size={11} />
                COORDS
              </>
            )}
          </button>
          <button
            onClick={() => copyToClipboard(hgvsText, "hgvs")}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md border border-teal-950/40 text-teal-400/80 hover:text-teal-300 hover:bg-teal-950/20 transition-all"
          >
            {copiedField === "hgvs" ? (
              <>
                <Check size={11} className="text-emerald-400" />
                COPIED
              </>
            ) : (
              <>
                <Copy size={11} />
                HGVS
              </>
            )}
          </button>
          <button
            onClick={() => copyToClipboard(variant.id, "id")}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md border border-teal-950/40 text-teal-400/80 hover:text-teal-300 hover:bg-teal-950/20 transition-all"
          >
            {copiedField === "id" ? (
              <>
                <Check size={11} className="text-emerald-400" />
                COPIED
              </>
            ) : (
              <>
                <Copy size={11} />
                VAR_ID
              </>
            )}
          </button>
          <button
            onClick={shareLink}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md border border-teal-950/40 text-teal-400/80 hover:text-teal-300 hover:bg-teal-950/20 transition-all"
          >
            {copiedField === "share" ? (
              <>
                <Check size={11} className="text-emerald-400" />
                LINK_COPIED
              </>
            ) : (
              <>
                <Share2 size={11} />
                SHARE
              </>
            )}
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md border border-teal-950/40 text-teal-400/80 hover:text-teal-300 hover:bg-teal-950/20 transition-all"
            title="Print metrics"
          >
            <Printer size={11} />
            PRINT
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-2 border-teal-950 border-t-teal-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xs font-mono text-zinc-500">// COMMENCING DEEP RETRIEVAL…</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-5 rounded-xl bg-zinc-950/50 border border-teal-950/40 text-center">
              <HelpCircle size={24} className="mx-auto text-teal-600/60 mb-3" />
              <p className="text-xs font-mono text-zinc-400">{error}</p>
              <p className="text-[11px] font-mono mt-2 text-zinc-600">
                // SYSTEM REPORT: RE-RUN ANALYSIS PIPELINE ON DASHBOARD TO SYNC PREDICTIONS.
              </p>
            </div>
          )}

          {evidence && !loading && (
            <>
              {/* Primary Risk Card with glowing gradients */}
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  isHighRisk
                    ? "bg-gradient-to-br from-rose-500/10 to-transparent border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.05)]"
                    : "bg-zinc-900/40 border-teal-950/30"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain
                      size={16}
                      className={isHighRisk ? "text-rose-400 animate-pulse" : "text-teal-500"}
                    />
                    <span className="text-xs font-bold font-mono text-zinc-300 uppercase tracking-wider">
                      Predictive Pathogenicity Index
                    </span>
                  </div>
                  <span
                    className={`text-2xl font-extrabold font-mono ${
                      isHighRisk ? "text-rose-400 text-shadow-glow" : "text-emerald-400"
                    }`}
                  >
                    {mlScore != null ? (mlScore * 100).toFixed(1) + "%" : "—"}
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-teal-950/40 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isHighRisk ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min((mlScore ?? 0) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mt-2 font-mono uppercase tracking-wider">
                  <span>0.0 benign</span>
                  <span>0.5 threshold</span>
                  <span>1.0 pathol</span>
                </div>
              </div>

              {/* 2x2 Metric Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <MetricCard
                  icon={Activity}
                  label="Allele frequency"
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
                        ? "Ultra-rare frequency"
                        : "Common polymorphism"
                      : null
                  }
                  highlight={evidence.frequency != null && evidence.frequency < 0.01}
                />

                <MetricCard
                  icon={Database}
                  label="CADD conservation"
                  value={
                    evidence.conservation_score != null
                      ? evidence.conservation_score.toFixed(1)
                      : "—"
                  }
                  sublabel={
                    evidence.conservation_score != null
                      ? evidence.conservation_score > 25
                        ? "Top 0.5% deleterious"
                        : "Low deleteriousness index"
                      : null
                  }
                  highlight={
                    evidence.conservation_score != null &&
                    evidence.conservation_score > 25
                  }
                />

                <MetricCard
                  icon={BarChart3}
                  label="ClinVar DB"
                  value={
                    clinVarNote ||
                    (isPathogenic
                      ? "Pathogenic"
                      : status === "benign"
                        ? "Benign"
                        : "Reported")
                  }
                  sublabel="Clinical catalog consensus"
                />

                <MetricCard
                  icon={Dna}
                  label="Predictor engine"
                  value="RandomForest"
                  sublabel="High-dim feature vector"
                />
              </div>

              {/* Disease Condition */}
              <div className={`p-4 rounded-xl border transition-colors ${disease ? "bg-teal-500/5 border-teal-500/25" : "bg-zinc-950/40 border-teal-950/30"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope size={13} className={disease ? "text-teal-400" : "text-zinc-600"} />
                  <span className="text-[9px] font-bold font-mono tracking-wider uppercase text-zinc-500">
                    Clinical association matrix
                  </span>
                </div>
                <p className={`m-0 text-sm leading-relaxed ${disease ? "text-teal-200 font-mono font-medium" : "text-zinc-500 font-sans"}`}>
                  {disease || "No reported condition associations detected."}
                </p>
                {disease && (
                  <p className="m-0 mt-2 text-[10px] font-mono text-zinc-600 leading-relaxed uppercase">
                    // ALERT: CONFIRM FINDINGS AGAINST INDEPENDENT PHENOTYPE REPORT.
                  </p>
                )}
              </div>

              {/* SHAP Explanation */}
              {evidence.shap_explanation && (
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-teal-950/40">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Brain size={13} className="text-orange-400" />
                    <h4 className="text-[10px] font-bold font-mono uppercase tracking-wider text-zinc-400 m-0">
                      SHAP neural attribution
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-mono bg-black/60 p-3.5 rounded-lg border border-teal-950/20 m-0">
                    {evidence.shap_explanation}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-teal-950/40 bg-zinc-950/30 flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>COORDS: {variant.id.slice(0, 10)}…</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-bold font-mono uppercase bg-teal-950/30 border border-teal-900/60 text-teal-400 hover:bg-teal-900/20 transition-all text-[10px]"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </>
  );
}