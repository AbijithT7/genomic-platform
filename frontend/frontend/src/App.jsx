import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dna,
  FlaskConical,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Sun,
  Moon,
  RefreshCw,
  Activity,
  Terminal,
} from "lucide-react";
import FileUpload from "./components/FileUpload";
import VariantTable from "./components/VariantTable";
import EvidenceDrawer from "./components/EvidenceDrawer";
import ExportReportButton from "./components/ExportReportButton";
import NotFoundPage from "./components/NotFoundPage";
import {
  analyzePatient,
  fetchPatient,
  fetchPatients,
  clearAllPatients,
} from "./lib/api";

const KNOWN_PATHS = ["/", "/index.html"];

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = window.localStorage.getItem("gp-theme");
    return saved === "light" ? "light" : "dark";
  });
  const [patient, setPatient] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [recentPatients, setRecentPatients] = useState([]);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);

  useEffect(() => {
    window.localStorage.setItem("gp-theme", theme);
  }, [theme]);

  // Check backend connectivity on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const patientsList = await fetchPatients();
        setBackendStatus("connected");
        setRecentPatients(patientsList || []);
        if (patientsList?.length > 0) {
          setPatient(patientsList[0]);
          setVariants(patientsList[0].variants || []);
        }
      } catch (err) {
        console.warn("Backend check failed:", err.message);
        setBackendStatus("disconnected");
      }
    };

    checkConnection();
  }, []);

  const refreshPatients = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await fetchPatients();
      setRecentPatients(list || []);
      return list || [];
    } catch (err) {
      console.warn("Failed to refresh patients:", err);
      return [];
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleUploadSuccess = useCallback((result) => {
    const uploadedPatient = result.patient || {
      id: result.patientId,
      filename: result.filename,
      variants: [],
    };

    setPatient(uploadedPatient);
    setVariants(uploadedPatient.variants || []);
    setSelectedVariant(null);
    setAnalyzeError(null);

    // Refresh patients list
    refreshPatients().then((list) => {
      if (!uploadedPatient.variants?.length && result.patientId) {
        const found = list.find((p) => p.id === result.patientId);
        if (found) {
          setPatient(found);
          setVariants(found.variants || []);
        }
      }
    });
  }, [refreshPatients]);

  const handleAnalyze = useCallback(async () => {
    if (!patient?.id) return;

    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      await analyzePatient(patient.id);
      const updated = await fetchPatient(patient.id);
      setPatient(updated);
      setVariants(updated.variants || []);
      setSelectedVariant(null);
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalyzeError(
        err.response?.data?.details ||
          err.response?.data?.error ||
          err.message ||
          "Analysis pipeline failed. Ensure both Node.js server (port 3001) and Python ML service (port 8000) are running.",
      );
    } finally {
      setAnalyzing(false);
    }
  }, [patient]);

  const handleSelectVariant = useCallback((variant) => {
    setSelectedVariant((prev) => (prev?.id === variant.id ? null : variant));
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setSelectedVariant(null);
  }, []);

  const handleSelectRecentPatient = useCallback(async (pId) => {
    try {
      const p = await fetchPatient(pId);
      setPatient(p);
      setVariants(p.variants || []);
      setSelectedVariant(null);
      setAnalyzeError(null);
    } catch (err) {
      console.error("Failed to load patient:", err);
    }
  }, []);

  const handleClearDatabase = async () => {
    if (recentPatients.length === 0 && !patient) return;
    if (
      !window.confirm(
        "Are you sure you want to clear all patient history and variant records?",
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      await clearAllPatients();
      setPatient(null);
      setVariants([]);
      setSelectedVariant(null);
      setRecentPatients([]);
      setAnalyzeError(null);
    } catch (err) {
      console.error("Failed to clear database:", err);
      setAnalyzeError("Failed to clear database records.");
    } finally {
      setClearing(false);
    }
  };

  const stats = useMemo(() => {
    const pathogenic = variants.filter(
      (v) => (v.status || "").toLowerCase() === "pathogenic",
    ).length;
    const benign = variants.filter(
      (v) => (v.status || "").toLowerCase() === "benign",
    ).length;
    const vus = variants.filter(
      (v) => (v.status || "").toLowerCase() === "vus",
    ).length;
    const analyzed = variants.filter((v) => v.evidence).length;
    return { pathogenic, benign, vus, analyzed, total: variants.length };
  }, [variants]);

  const analysisReady = stats.analyzed > 0;

  if (!KNOWN_PATHS.includes(currentPath)) {
    return (
      <NotFoundPage
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <div
      className={`relative min-h-screen flex flex-col font-sans transition-colors duration-300 overflow-x-hidden ${
        isDark ? "bg-[#040808] text-[#e2e8f0] clinical-grid" : "bg-[#f5f7f5] text-slate-800"
      }`}
    >
      {/* Immersive Glowing Biomolecule Blobs (Ambient Atmosphere) */}
      {isDark && (
        <>
          <div className="bg-blob bg-teal-500/10 top-[-100px] left-[-100px] animate-pulse-glow" style={{ animationDelay: "0s" }} />
          <div className="bg-blob bg-emerald-500/5 bottom-[-200px] right-[-100px] animate-pulse-glow" style={{ animationDelay: "4s" }} />
          <div className="bg-blob bg-orange-500/5 top-[40%] left-[50%] animate-pulse-glow" style={{ animationDelay: "2s" }} />
        </>
      )}

      {/* Top Header */}
      <header
        className={`border-b sticky top-0 z-30 px-6 py-4 backdrop-blur-md transition-colors ${
          isDark
            ? "border-teal-950/40 bg-[#040808]/85"
            : "border-stone-200 bg-white/90 shadow-sm"
        }`}
      >
        <div className="max-w-[96rem] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              isDark
                ? "bg-gradient-to-br from-teal-400 to-teal-600 text-black shadow-[0_0_15px_rgba(20,184,166,0.3)]"
                : "bg-teal-600 text-white shadow-md"
            }`}>
              <Dna size={20} className={isDark ? "animate-pulse" : ""} />
            </div>
            <div>
              <h1 className={`m-0 text-lg font-bold tracking-tight uppercase ${isDark ? "text-white text-shadow-glow" : "text-slate-900"}`}>
                Genomic Variant Platform
              </h1>
              <p className={`m-0 text-xs font-mono tracking-wider ${isDark ? "text-teal-400/80" : "text-slate-500"}`}>
                SYSTEM ASSEMBLY · ACTIVE WORKSPACE
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status light */}
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border font-mono ${
              isDark ? "border-teal-950/50 bg-[#061011] text-teal-400" : "border-stone-200 bg-white text-slate-700"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                backendStatus === "connected"
                  ? "bg-teal-400 shadow-[0_0_8px_#2dd4bf]"
                  : backendStatus === "disconnected"
                    ? "bg-rose-500"
                    : "bg-amber-400 animate-ping"
              }`} />
              <span>{backendStatus === "connected" ? "SYS_OK:3001" : "SYS_OFFLINE"}</span>
            </div>

            {recentPatients.length > 1 && (
              <select
                value={patient?.id || ""}
                onChange={(e) => handleSelectRecentPatient(e.target.value)}
                aria-label="Select dataset"
                className={`border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/40 font-mono ${
                  isDark
                    ? "bg-[#0c1a1b] border-teal-900/60 text-teal-300"
                    : "bg-white border-stone-300 text-slate-700 shadow-sm"
                }`}
              >
                {recentPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.filename} ({p.variants?.length || 0} vars)
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => refreshPatients()}
              disabled={refreshing || backendStatus !== "connected"}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? "border-teal-950/50 bg-[#061011] hover:bg-teal-900/20 text-teal-300"
                  : "border-stone-300 hover:bg-stone-100 text-slate-700"
              }`}
              title="Refresh Patients"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-teal-400" : ""} />
              <span>Sync</span>
            </button>

            <button
              onClick={handleClearDatabase}
              disabled={clearing || (recentPatients.length === 0 && !patient)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? "border-rose-950/40 bg-rose-950/10 hover:bg-rose-500/20 text-rose-300 hover:border-rose-500/40"
                  : "border-stone-300 hover:bg-rose-50 text-rose-700 hover:border-rose-300"
              }`}
              title="Clear Database"
            >
              <Trash2 size={13} />
              <span>{clearing ? "Wiping…" : "Clear Database"}</span>
            </button>

            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-all ${
                isDark
                  ? "border-teal-950/50 bg-[#061011] hover:bg-teal-900/20 text-teal-300"
                  : "border-stone-300 hover:bg-stone-100 text-slate-700"
              }`}
              title="Toggle Theme"
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
              <span>{isDark ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[96rem] mx-auto w-full px-6 py-6 flex-1 space-y-6">

        {/* Immersive Welcome Hero Panel with Radar Sweep */}
        <section
          className={`relative overflow-hidden rounded-2xl border p-6 md:p-8 animate-scan glow-border glass-panel`}
        >
          {/* Internal Glowing Grid elements */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.1),transparent_50%)] pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-mono text-[10px] uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                Diagnostic Mode Active
              </div>
              <h2 className={`m-0 text-xl md:text-2xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Clinical Variant Command Center
              </h2>
              <p className={`m-0 text-sm leading-relaxed ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
                Securely stream and parse Variant Call Format datasets. Interrogate machine learning
                pathogenicity indices, investigate SHAP explainability matrices, and export compliant clinical summaries.
              </p>
            </div>
            {analysisReady && patient?.id && (
              <div className="flex-shrink-0 animate-fade-in">
                <ExportReportButton
                  patientId={patient.id}
                  summaryStats={stats}
                  variants={variants}
                  theme={theme}
                />
              </div>
            )}
          </div>
        </section>

        {/* Upload & Quick Action Section */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
          <div className="xl:col-span-2 space-y-3">
            <div className="px-1">
              <h2 className={`m-0 text-sm font-bold uppercase tracking-wider ${isDark ? "text-teal-400" : "text-slate-900"}`}>
                Dataset Ingestion
              </h2>
              <p className={`m-0 mt-1 text-xs ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                Upload a standard VCF database of variants.
              </p>
            </div>
            <FileUpload onUploadSuccess={handleUploadSuccess} theme={theme} />
          </div>

          {/* Pipeline Controller & Stats Card */}
          <div className={`xl:col-span-3 glass-panel p-5 flex flex-col justify-between self-stretch relative overflow-hidden glow-border`}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[11px] font-mono tracking-wider uppercase font-semibold ${isDark ? "text-teal-500" : "text-slate-600"}`}>
                  Active Pipeline Matrix
                </span>
                {patient && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                    isDark ? "bg-teal-950/20 border-teal-900/50 text-teal-300" : "bg-stone-100 text-slate-600"
                  }`}>
                    {stats.total} VARIANTS LOADED
                  </span>
                )}
              </div>

              {patient ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${
                    isDark ? "bg-[#04090a] border-teal-950/40" : "bg-stone-50 border-stone-200"
                  }`}>
                    <p className={`m-0 text-[10px] font-mono tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                      Target Patient File
                    </p>
                    <p className={`font-semibold text-sm truncate m-0 mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>
                      {patient.filename}
                    </p>
                    <p className={`text-[10px] m-0 mt-1 font-mono ${isDark ? "text-teal-500/60" : "text-slate-500"}`}>
                      UUID: {patient.id}
                    </p>
                  </div>

                  {/* High-Fidelity Stats Tiles */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className={`p-3 rounded-lg border text-center transition-all ${
                      isDark ? "bg-[#04090a]/50 border-zinc-800 hover:border-zinc-700" : "bg-white border-stone-200 shadow-sm"
                    }`}>
                      <div className={`text-xl font-bold font-mono tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                        {stats.total}
                      </div>
                      <div className="text-[9px] uppercase font-mono text-zinc-500 mt-1">Total</div>
                    </div>

                    <div className={`p-3 rounded-lg border text-center transition-all ${
                      isDark ? "bg-rose-950/5 border-rose-950/30 hover:border-rose-500/30" : "bg-rose-50/50 border-rose-100"
                    }`}>
                      <div className={`text-xl font-bold font-mono tracking-tight ${
                        stats.pathogenic > 0 ? "text-rose-500" : "text-zinc-500"
                      }`}>
                        {stats.pathogenic}
                      </div>
                      <div className={`text-[9px] uppercase font-mono mt-1 ${isDark ? "text-rose-400" : "text-rose-700"}`}>Pathogenic</div>
                    </div>

                    <div className={`p-3 rounded-lg border text-center transition-all ${
                      isDark ? "bg-emerald-950/5 border-emerald-950/30 hover:border-emerald-500/30" : "bg-emerald-50/50 border-emerald-100"
                    }`}>
                      <div className={`text-xl font-bold font-mono tracking-tight ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                        {stats.benign}
                      </div>
                      <div className={`text-[9px] uppercase font-mono mt-1 ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>Benign</div>
                    </div>

                    <div className={`p-3 rounded-lg border text-center transition-all ${
                      isDark ? "bg-amber-950/5 border-amber-950/30 hover:border-amber-500/30" : "bg-amber-50/50 border-amber-100"
                    }`}>
                      <div className={`text-xl font-bold font-mono tracking-tight ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                        {stats.vus}
                      </div>
                      <div className={`text-[9px] uppercase font-mono mt-1 ${isDark ? "text-amber-400" : "text-amber-700"}`}>VUS</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Terminal size={24} className={`mx-auto mb-2 ${isDark ? "text-teal-600/60" : "text-slate-400"}`} />
                  <p className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                    Awaiting target genomic payload. Select or load a file.
                  </p>
                </div>
              )}
            </div>

            {/* Run Analysis Action Button (Highly interactive) */}
            <div className="mt-5 space-y-3">
              <button
                onClick={handleAnalyze}
                disabled={!patient?.id || analyzing}
                className="w-full py-3 px-4 rounded-xl btn-lab-primary font-bold text-xs flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analyzing Payload…</span>
                  </>
                ) : (
                  <>
                    <FlaskConical size={16} />
                    <span>Run Variant Pipeline</span>
                  </>
                )}
              </button>

              {analysisReady && !analyzing && (
                <div className={`p-3 rounded-lg flex items-center justify-center gap-2 border text-xs font-mono ${
                  isDark ? "bg-[#061314] border-teal-950/50 text-teal-400" : "bg-emerald-50 border-emerald-100 text-emerald-800"
                }`}>
                  <CheckCircle2 size={14} className={isDark ? "animate-pulse" : ""} />
                  <span>ANALYSIS SYNCED: {stats.analyzed} / {stats.total} RECORDS VERIFIED</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Error notification banner */}
        {analyzeError && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3.5 text-sm animate-fade-in ${
              isDark
                ? "bg-rose-500/5 border-rose-500/20 text-rose-300"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <p className="font-bold m-0 text-xs uppercase tracking-wider font-mono">System Execution Fault</p>
              <p className="m-0 mt-1.5 leading-relaxed text-xs opacity-90 font-sans">
                {analyzeError}
              </p>
            </div>
            <button
              onClick={() => setAnalyzeError(null)}
              className={`text-xs underline font-mono ${isDark ? "text-rose-400 hover:text-rose-300" : "text-red-700"}`}
            >
              CLEAR_ERR
            </button>
          </div>
        )}

        {/* Variants Data Table Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className={`m-0 text-sm font-bold uppercase tracking-wider ${isDark ? "text-teal-400" : "text-slate-900"}`}>
                Genomic Annotation Matrix
              </h2>
              <p className={`m-0 mt-1 text-xs ${isDark ? "text-zinc-500" : "text-slate-500"}`}>
                Double-click or expand any variant record to load detailed predictive and interpretative annotations.
              </p>
            </div>

            {patient && variants.length > 0 && (
              <span className={`text-[10px] font-mono px-3 py-1.5 rounded-lg border ${
                isDark ? "text-teal-300 bg-[#061011] border-teal-900/60" : "text-slate-600 bg-white border-stone-200"
              }`}>
                <Activity size={12} className="inline mr-1.5 animate-pulse text-teal-400" />
                DETERMINATION SORT: RISK INDEX
              </span>
            )}
          </div>

          <VariantTable
            variants={variants}
            selectedVariantId={selectedVariant?.id}
            onSelectVariant={handleSelectVariant}
            theme={theme}
          />
        </section>
      </main>

      {/* Slide-out Evidence Side-Panel */}
      {selectedVariant && (
        <EvidenceDrawer
          variant={selectedVariant}
          onClose={handleCloseDrawer}
          theme={theme}
        />
      )}

      <footer
        className={`mx-auto flex w-full max-w-[96rem] items-center justify-between px-6 py-6 text-[10px] font-mono tracking-wider uppercase border-t transition-colors ${
          isDark ? "border-teal-950/20 text-zinc-600" : "border-stone-200 text-slate-500"
        }`}
      >
        <span>SYS_CORE_GENOMICS_MATRIX_REV_A_2026</span>
        <span>VIT Chennai · abijith · alvin · caleb</span>
      </footer>
    </div>
  );
}