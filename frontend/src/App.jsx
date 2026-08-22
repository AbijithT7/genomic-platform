import { useState, useEffect, useCallback } from "react";
import {
  Dna,
  FlaskConical,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Sun,
  Moon,
  Stethoscope,
  Activity,
  Microscope,
  HeartPulse,
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
  const [analyzeError, setAnalyzeError] = useState(null);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [recentPatients, setRecentPatients] = useState([]);

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
        if (patientsList?.length > 0 && !patient) {
          // Default to most recent patient if available
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
    fetchPatients()
      .then((list) => {
        setRecentPatients(list);
        // If uploaded patient didn't have variants attached in result, get full patient
        if (!uploadedPatient.variants?.length && result.patientId) {
          const found = list.find((p) => p.id === result.patientId);
          if (found) {
            setPatient(found);
            setVariants(found.variants || []);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!patient?.id) return;

    setAnalyzing(true);
    setAnalyzeError(null);

    try {
      await analyzePatient(patient.id);
      // Refresh patient data to get updated variants with evidence
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

  const handleSelectRecentPatient = async (pId) => {
    try {
      const p = await fetchPatient(pId);
      setPatient(p);
      setVariants(p.variants || []);
      setSelectedVariant(null);
      setAnalyzeError(null);
    } catch (err) {
      console.error("Failed to load patient:", err);
    }
  };

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

  const pathogenicCount = variants.filter(
    (v) => (v.status || "").toLowerCase() === "pathogenic",
  ).length;

  const benignCount = variants.filter(
    (v) => (v.status || "").toLowerCase() === "benign",
  ).length;

  const vusCount = variants.filter(
    (v) => (v.status || "").toLowerCase() === "vus",
  ).length;

  const analyzedCount = variants.filter((v) => v.evidence).length;
  const analysisReady = analyzedCount > 0;
  const currentPath = window.location.pathname;
  const knownPaths = ["/", "/index.html"];

  const summaryStats = {
    pathogenic: pathogenicCount,
    benign: benignCount,
    vus: vusCount,
  };

  if (!knownPaths.includes(currentPath)) {
    return (
      <NotFoundPage
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />
    );
  }

  return (
    <div
      className={`relative isolate min-h-screen flex flex-col overflow-hidden font-sans selection:bg-teal-400/30 selection:text-white transition-colors duration-300 ${theme === "dark" ? "theme-dark bg-[#0c1718] text-slate-300" : "theme-light bg-[#f5f6f0] text-slate-800"}`}
    >
      <div aria-hidden="true" className={`fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat ${theme === "dark" ? "opacity-[0.14]" : "opacity-[0.08]"}`} style={{ backgroundImage: "url('/nucleo-helix-hero.png')" }} />
      <div aria-hidden="true" className={`fixed inset-0 -z-10 ${theme === "dark" ? "bg-[#0c1718]/80" : "bg-[#e9f2ef]/75"}`} />
      {/* Top Navigation Bar */}
      <header
        className={`border-b backdrop-blur-md sticky top-0 z-30 px-4 py-3 ${theme === "dark" ? "border-teal-950 bg-[#0c1718]/90" : "border-[#d5dfd9] bg-[#f5f6f0]/92"}`}
      >
        <div className="max-w-[96rem] mx-auto flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-300 to-teal-500 flex items-center justify-center text-[#082322] shadow-lg shadow-teal-500/25">
              <Dna size={16} className="mr-1" />
              <Stethoscope size={16} className="ml-1" />
            </div>
            <div>
              <span className={`font-mono text-[15px] md:text-[17px] font-medium uppercase tracking-[0.12em] ${theme === "dark" ? "text-white" : "text-[#183334]"}`}>
              <HeartPulse size={16} className="mr-1" />
                Genomic Variant Interpretation Platform
            </span>
            </div>
          </div>

          {/* Right Header: Status, Dataset dropdown, and Reset Database button */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 text-xs mr-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === "connected"
                    ? "bg-teal-400 shadow-sm shadow-teal-400/50"
                    : backendStatus === "disconnected"
                      ? "bg-red-500"
                      : "bg-amber-500 animate-pulse"
                }`}
              />
              <span
                className={`text-xs font-mono ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
              >
                {backendStatus === "connected"
                  ? "API :3001"
                  : backendStatus === "disconnected"
                    ? "API Offline"
                    : "Connecting"}
              </span>
            </div>

            {recentPatients.length > 1 && (
              <select
                value={patient?.id || ""}
                onChange={(e) => handleSelectRecentPatient(e.target.value)}
                className={`border text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-orange-500 font-mono ${theme === "dark" ? "bg-zinc-800 border-zinc-700 text-zinc-300" : "bg-stone-100 border-stone-300 text-stone-700"}`}
              >
                {recentPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.filename} ({p.variants?.length || 0} vars)
                  </option>
                ))}
              </select>
            )}

            {/* Reset Database Button */}
            <button
              onClick={handleClearDatabase}
              disabled={clearing || (recentPatients.length === 0 && !patient)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${theme === "dark" ? "text-zinc-400 hover:text-red-400 bg-zinc-800/70 hover:bg-red-500/10 border-zinc-700 hover:border-red-500/30 disabled:hover:bg-zinc-800/70 disabled:hover:text-zinc-400" : "text-stone-600 hover:text-red-500 bg-stone-200/70 hover:bg-red-500/10 border-stone-300 hover:border-red-400/30 disabled:hover:bg-stone-200/70 disabled:hover:text-stone-600"}`}
              title="Clear all patients and database history"
            >
              <Trash2
                size={13}
                className={clearing ? "animate-spin text-red-400" : ""}
              />
              <span>{clearing ? "Clearing..." : "Reset Database"}</span>
            </button>

            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-lg transition-all ${theme === "dark" ? "text-zinc-300 bg-zinc-800/80 border-zinc-700 hover:bg-zinc-700" : "text-stone-700 bg-stone-200 border-stone-300 hover:bg-stone-300"}`}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[96rem] mx-auto w-full px-4 py-4 flex-1 space-y-4">
        <section
          className={`relative overflow-hidden rounded-2xl border p-5 md:p-7 animate-fade-in clinical-grid signal-sweep ${theme === "dark" ? "border-teal-950 bg-[#112326]" : "border-[#d5dfd9] bg-[#fcfcf8]"}`}
        >
          <div className="absolute -top-20 -right-12 w-56 h-56 rounded-full bg-teal-400/20 blur-3xl animate-float-slow pointer-events-none" />
          <div className="absolute -bottom-20 left-12 w-52 h-52 rounded-full bg-cyan-300/15 blur-3xl animate-float-fast pointer-events-none" />
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <img
              src="/nucleo-helix-hero.png"
              alt="DNA helix in a clinical laboratory"
              className="w-full h-full object-cover object-right scale-105 animate-hero-pan"
            />
          </div>
          <div
            className={`absolute inset-0 pointer-events-none ${theme === "dark" ? "bg-gradient-to-r from-[#112326] via-[#112326]/88 to-[#112326]/20" : "bg-gradient-to-r from-[#fcfcf8] via-[#fcfcf8]/88 to-[#f5f6f0]/20"}`}
          />
          <div className="relative flex flex-col items-center justify-center text-center">
            <div>
              <h1
                className={`m-0 text-2xl md:text-3xl font-semibold tracking-tight ${theme === "dark" ? "text-white" : "text-[#183334]"}`}
              >
                Clinical Variant Review Workspace
              </h1>
              <p
                className={`m-0 mt-1 text-xs md:text-sm ${theme === "dark" ? "text-zinc-300" : "text-stone-600"}`}
              >
                Review, interpret, and document clinically relevant genomic findings.
              </p>
            </div>
            {analysisReady && patient?.id && (
              <div className="mt-5 w-[230px] max-w-full">
                <ExportReportButton
                  patientId={patient.id}
                  summaryStats={summaryStats}
                  variants={variants}
                  theme={theme}
                />
              </div>
            )}
          </div>
        </section>

        {/* Upload & Quick Action Section */}
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
          <div className="lg:col-span-2 space-y-2">
            <div className="mb-2">
              <h2
                className={`text-base font-bold tracking-tight m-0 ${theme === "dark" ? "text-white" : "text-stone-900"}`}
              >
                Upload & Ingest VCF
              </h2>
              <p
                className={`text-xs m-0 mt-1 ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
              >
                Upload a standard Variant Call Format (
                <code className="text-orange-400 font-mono">.vcf</code>) file.
                Variants will be stream-parsed line-by-line and stored in
                SQLite.
              </p>
            </div>
            <FileUpload onUploadSuccess={handleUploadSuccess} theme={theme} />
          </div>

          {/* Pipeline Controller & Stats Card */}
          <div
            className={`xl:col-span-3 surface-card p-4 border space-y-4 flex flex-col justify-between self-stretch ${theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-stone-300 bg-stone-50"}`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
                >
                  Review actions
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${theme === "dark" ? "bg-zinc-800 text-zinc-400" : "bg-stone-200 text-stone-600"}`}
                >
                  Current case
                </span>
              </div>

              {patient ? (
                <div className="space-y-3">
                  <div
                    className={`p-3 rounded-lg border text-xs ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-stone-100 border-stone-300"}`}
                  >
                    <p
                      className={`m-0 ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
                    >
                      Active Dataset:
                    </p>
                    <p
                      className={`font-mono font-medium truncate m-0 mt-0.5 ${theme === "dark" ? "text-white" : "text-stone-900"}`}
                    >
                      {patient.filename}
                    </p>
                    <p
                      className={`text-[11px] m-0 mt-1 font-mono ${theme === "dark" ? "text-zinc-500" : "text-stone-500"}`}
                    >
                      ID: {patient.id.slice(0, 12)}...
                    </p>
                  </div>

                  {/* Stat counters */}
                  <div className="grid grid-cols-4 gap-2 text-center pt-1">
                    <div
                      className={`p-2.5 rounded-lg border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-stone-100 border-stone-300"}`}
                    >
                      <div
                        className={`text-lg font-bold font-mono ${theme === "dark" ? "text-white" : "text-stone-900"}`}
                      >
                        {variants.length}
                      </div>
                      <div
                        className={`text-[10px] uppercase ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
                      >
                        Total
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-stone-100 border-stone-300"}`}
                    >
                      <div
                        className={`text-lg font-bold font-mono ${pathogenicCount > 0 ? "text-orange-400" : "text-zinc-400"}`}
                      >
                        {pathogenicCount}
                      </div>
                      <div className="text-[10px] text-orange-400/80 uppercase font-semibold">
                        Pathogenic
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-stone-100 border-stone-300"}`}
                    >
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {benignCount}
                      </div>
                      <div className="text-[10px] text-emerald-400/80 uppercase">
                        Benign
                      </div>
                    </div>

                    <div
                      className={`p-2.5 rounded-lg border ${theme === "dark" ? "bg-zinc-950 border-zinc-800" : "bg-stone-100 border-stone-300"}`}
                    >
                      <div className="text-lg font-bold font-mono text-amber-500">
                        {vusCount}
                      </div>
                      <div className="text-[10px] text-amber-500/80 uppercase">
                        VUS
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p
                  className={`text-xs ${theme === "dark" ? "text-zinc-500" : "text-stone-600"}`}
                >
                  Upload a VCF file to begin a review. Analysis tools become available once it is loaded.
                </p>
              )}
            </div>

            {/* Run Analysis Trigger Button */}
            <div>
              <button
                onClick={handleAnalyze}
                disabled={!patient?.id || analyzing}
                className="w-full py-3 px-4 rounded-xl btn-highlight font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Running analysis...</span>
                  </>
                ) : (
                  <>
                    <FlaskConical size={16} />
                    <span>Run Variant Analysis</span>
                  </>
                )}
              </button>

              {analysisReady && !analyzing && (
                <p className="text-[11px] text-emerald-400 text-center mt-2 flex items-center justify-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>
                    {analyzedCount} variants analyzed with SHAP explanations
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Error notification banner */}
        {analyzeError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-3 animate-fade-in">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm m-0 text-red-300">
                Pipeline Execution Error
              </p>
              <p className="m-0 mt-1 leading-relaxed text-red-400/90">
                {analyzeError}
              </p>
            </div>
          </div>
        )}

        {/* Variants Data Table Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className={`text-base font-bold tracking-tight m-0 ${theme === "dark" ? "text-white" : "text-stone-900"}`}
              >
                Annotated Genomic Variants
              </h2>
              <p
                className={`text-xs m-0 mt-0.5 ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
              >
                Click any variant row to inspect full evidence, CADD scores,
                allele frequencies, and SHAP explanations.
              </p>
            </div>

            {patient && variants.length > 0 && (
              <span
                className={`text-xs font-mono px-3 py-1 rounded-lg border ${theme === "dark" ? "text-zinc-400 bg-zinc-900 border-zinc-800" : "text-stone-600 bg-stone-100 border-stone-300"}`}
              >
                Sorted by Pathogenicity & ML Risk Score
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
      <footer className={`relative z-10 mx-auto flex w-full max-w-[96rem] items-center justify-between px-4 pb-5 pt-1 text-[10px] font-mono uppercase tracking-[0.12em] ${theme === "dark" ? "text-slate-500" : "text-slate-500"}`}>
        <span>Clinical genomics workspace</span>
        <span>Evidence • review • report</span>
      </footer>
    </div>
  );
}
