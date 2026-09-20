import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dna,
  Play,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  Upload,
  TableProperties,
  FileText,
  HelpCircle,
  Settings as SettingsIcon,
  Search,
  Menu,
  X,
  Trash2,
  Activity,
  CheckCircle2,
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
  const [mlServiceStatus, setMlServiceStatus] = useState("checking");
  const [recentPatients, setRecentPatients] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeNav, setActiveNav] = useState("analyze"); // 'analyze', 'overview', 'variants', 'reports', 'how_it_works', 'settings'
  const [activeModal, setActiveModal] = useState(null); // 'how_it_works', 'reports', 'settings', null

  const uploadSectionRef = useRef(null);
  const tableSectionRef = useRef(null);
  const overviewSectionRef = useRef(null);

  const isLight = theme === "light";

  useEffect(() => {
    window.localStorage.setItem("gp-theme", theme);
  }, [theme]);

  // Check backend & ML service status
  useEffect(() => {
    const checkServices = async () => {
      try {
        const patientsList = await fetchPatients();
        setBackendStatus("connected");
        setRecentPatients(patientsList || []);
        if (patientsList?.length > 0 && !patient) {
          setPatient(patientsList[0]);
          setVariants(patientsList[0].variants || []);
        }
      } catch (err) {
        console.warn("Backend check failed:", err.message);
        setBackendStatus("disconnected");
      }

      // Check ML service health 
      try {
        const res = await fetch(
          "https://genomix-ml-service.onrender.com/health"
        );
        if (res.ok) {
          setMlServiceStatus("ready");
        } else {
          setMlServiceStatus("offline");
        }
      } catch (_) {
        setMlServiceStatus("offline");
      }
    };

    checkServices();
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
    setActiveNav("overview");

    fetchPatients()
      .then((list) => {
        setRecentPatients(list);
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
      const updated = await fetchPatient(patient.id);
      setPatient(updated);
      setVariants(updated.variants || []);
      setSelectedVariant(null);
      setActiveNav("variants");
      tableSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalyzeError(
        err.response?.data?.details ||
          err.response?.data?.error ||
          err.message ||
          "Analysis pipeline failed. Ensure both backend server (port 3001) and ML service (port 8000) are running.",
      );
    } finally {
      setAnalyzing(false);
    }
  }, [patient]);

  const handleSelectVariant = useCallback((variant) => {
    setSelectedVariant((prev) => (prev?.id === variant.id ? null : variant));
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
    if (!window.confirm("Are you sure you want to clear all patient records from the database?")) {
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
      setActiveModal(null);
      setActiveNav("analyze");
    } catch (err) {
      console.error("Failed to clear database:", err);
      setAnalyzeError("Failed to clear database records.");
    } finally {
      setClearing(false);
    }
  };

  const handleTopSearch = (val) => {
    setSearchTerm(val);
    if (val) {
      setActiveNav("variants");
      tableSectionRef.current?.scrollIntoView({ behavior: "smooth" });
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
  const totalCount = variants.length;

  const pathogenicPct = totalCount ? ((pathogenicCount / totalCount) * 100).toFixed(1) : 0;
  const benignPct = totalCount ? ((benignCount / totalCount) * 100).toFixed(1) : 0;
  const vusPct = totalCount ? ((vusCount / totalCount) * 100).toFixed(1) : 0;

  // Single genome assembly reference dynamically derived
  const dynamicGenomeBuild =
    patient?.variants?.find((v) => v.genomeBuild)?.genomeBuild ||
    variants.find((v) => v.genomeBuild)?.genomeBuild ||
    "GRCh37";

  const summaryStats = {
    pathogenic: pathogenicCount,
    benign: benignCount,
    vus: vusCount,
  };

  const currentPath = window.location.pathname;
  if (!["/", "/index.html"].includes(currentPath)) {
    return (
      <NotFoundPage
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />
    );
  }

  const navigateTo = (nav) => {
    setActiveNav(nav);
    if (nav === "analyze") {
      uploadSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (nav === "overview") {
      overviewSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (nav === "variants") {
      tableSectionRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (nav === "reports") {
      setActiveModal("reports");
    } else if (nav === "how_it_works") {
      setActiveModal("how_it_works");
    } else if (nav === "settings") {
      setActiveModal("settings");
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex font-sans antialiased transition-colors duration-150 ${
        isLight ? "theme-light bg-[#f8fafc] text-slate-900" : "theme-dark bg-[#090d16] text-slate-100"
      }`}
    >
      {/* SUBTLE MOLECULAR BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          alt="Molecular double helix"
          src="/dna-helix.png"
          className={`w-full h-full object-cover object-right-top ${
            isLight ? "opacity-[0.03] mix-blend-multiply" : "opacity-10 mix-blend-screen"
          }`}
        />
      </div>

      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* REFINED SCIENTIFIC SIDEBAR (desktop) / DRAWER (mobile) */}
      <aside
        className={`lg:flex w-60 flex-shrink-0 flex-col justify-between border-r z-30 transition-colors relative overflow-hidden ${
          mobileMenuOpen
            ? "fixed inset-0 z-50 flex w-[82%] max-w-[300px] h-screen translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        } ${
          isLight ? "border-slate-300 bg-white" : "border-slate-800 bg-[#080d18]"
        } lg:sticky lg:top-0 lg:h-screen`}
      >
        <button
          onClick={() => setMobileMenuOpen(false)}
          className={`lg:hidden absolute top-3 right-3 p-1.5 rounded-md border transition-colors z-10 ${
            isLight
              ? "text-slate-500 hover:text-slate-800 border-slate-300"
              : "text-slate-400 hover:text-white border-slate-700"
          }`}
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
        {/* Subtle DNA background texture in sidebar */}
        <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden">
          <img
            alt=""
            src="/dna-helix.png"
            className="w-full h-full object-cover object-bottom"
          />
        </div>

        <div className="p-4 space-y-6 relative z-10">
          {/* Header with DNA Gene Icon & Subtitle (No "G" square) */}
          <div className="px-1 pt-1 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Dna size={18} />
              </div>
              <span
                className={`font-bold text-base tracking-wider uppercase font-sans ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                GENOMIX
              </span>
            </div>
            <p
              className={`text-[10px] tracking-wide font-medium pl-0.5 m-0 ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Genomic Intelligence Platform
            </p>
          </div>

          {/* Sectioned Navigation with Spacing & Subtle Indicators */}
          <div className="space-y-4 text-xs font-medium">
            {/* WORKSPACE GROUP */}
            <div className="space-y-1">
              <div
                className={`px-3 text-[10px] font-semibold uppercase tracking-wider font-mono ${
                  isLight ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Workspace
              </div>

              <button
                onClick={() => navigateTo("overview")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left relative ${
                  activeNav === "overview"
                    ? isLight
                      ? "bg-cyan-50/80 text-cyan-900 font-semibold border-l-2 border-cyan-600 shadow-xs"
                      : "bg-cyan-950/40 text-cyan-300 font-semibold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.08)]"
                    : isLight
                      ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Dna size={15} className={activeNav === "overview" ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"} />
                <span>Overview</span>
              </button>

              <button
                onClick={() => navigateTo("analyze")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left relative ${
                  activeNav === "analyze"
                    ? isLight
                      ? "bg-cyan-50/80 text-cyan-900 font-semibold border-l-2 border-cyan-600 shadow-xs"
                      : "bg-cyan-950/40 text-cyan-300 font-semibold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.08)]"
                    : isLight
                      ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Upload size={15} className={activeNav === "analyze" ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"} />
                <span>Analyze VCF</span>
              </button>

              <button
                onClick={() => navigateTo("variants")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left relative ${
                  activeNav === "variants"
                    ? isLight
                      ? "bg-cyan-50/80 text-cyan-900 font-semibold border-l-2 border-cyan-600 shadow-xs"
                      : "bg-cyan-950/40 text-cyan-300 font-semibold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.08)]"
                    : isLight
                      ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <TableProperties size={15} className={activeNav === "variants" ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"} />
                <span>Variants</span>
              </button>
            </div>

            {/* OUTPUT GROUP */}
            <div className="space-y-1 pt-1">
              <div
                className={`px-3 text-[10px] font-semibold uppercase tracking-wider font-mono ${
                  isLight ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Output
              </div>

              <button
                onClick={() => navigateTo("reports")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left relative ${
                  activeNav === "reports"
                    ? isLight
                      ? "bg-cyan-50/80 text-cyan-900 font-semibold border-l-2 border-cyan-600 shadow-xs"
                      : "bg-cyan-950/40 text-cyan-300 font-semibold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.08)]"
                    : isLight
                      ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <FileText size={15} className={activeNav === "reports" ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"} />
                <span>Reports</span>
              </button>
            </div>

            {/* SYSTEM GROUP */}
            <div className="space-y-1 pt-1">
              <div
                className={`px-3 text-[10px] font-semibold uppercase tracking-wider font-mono ${
                  isLight ? "text-slate-400" : "text-slate-500"
                }`}
              >
                System
              </div>

              <button
                onClick={() => navigateTo("how_it_works")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left relative ${
                  activeNav === "how_it_works"
                    ? isLight
                      ? "bg-cyan-50/80 text-cyan-900 font-semibold border-l-2 border-cyan-600 shadow-xs"
                      : "bg-cyan-950/40 text-cyan-300 font-semibold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.08)]"
                    : isLight
                      ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <HelpCircle size={15} className={activeNav === "how_it_works" ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"} />
                <span>How It Works</span>
              </button>

              <button
                onClick={() => navigateTo("settings")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-left relative ${
                  activeNav === "settings"
                    ? isLight
                      ? "bg-cyan-50/80 text-cyan-900 font-semibold border-l-2 border-cyan-600 shadow-xs"
                      : "bg-cyan-950/40 text-cyan-300 font-semibold border-l-2 border-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.08)]"
                    : isLight
                      ? "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <SettingsIcon size={15} className={activeNav === "settings" ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"} />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Active Analysis Card + System Status */}
        <div
          className={`p-3 border-t space-y-3 relative z-10 ${
            isLight ? "border-slate-300 bg-slate-50/80" : "border-slate-800 bg-[#070b14]"
          }`}
        >
          {/* Compact Active Analysis Card */}
          <div
            className={`p-2.5 rounded-md border text-xs font-mono transition-colors ${
              isLight
                ? "bg-white border-slate-200 text-slate-800"
                : "bg-[#0b101c] border-slate-800 text-slate-200"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] uppercase font-sans font-semibold text-slate-400 mb-1">
              <span>Active Analysis</span>
              <span
                className={`flex items-center gap-1 ${
                  analysisReady
                    ? "text-emerald-600 dark:text-emerald-400"
                    : patient
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    analysisReady
                      ? "bg-emerald-500"
                      : patient
                        ? "bg-amber-500"
                        : "bg-slate-400"
                  }`}
                />
                {analysisReady ? "Analyzed" : patient ? "Ready" : "Idle"}
              </span>
            </div>

            {patient ? (
              <div className="space-y-0.5">
                <div className="font-semibold truncate text-[11px]" title={patient.filename}>
                  {patient.filename}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-between">
                  <span>{totalCount} variants</span>
                  <span>{dynamicGenomeBuild}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic m-0">
                No file loaded
              </p>
            )}
          </div>

          {/* System Status: API Connected + ML Ready */}
          <div className="flex items-center justify-between text-[11px] font-mono px-1">
            <div className="flex items-center gap-2">
              <span
                className="flex items-center gap-1"
                title={backendStatus === "connected" ? "Express API running on port 3001" : "API offline"}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    backendStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                <span className={isLight ? "text-slate-600" : "text-slate-400"}>API</span>
              </span>

              <span
                className="flex items-center gap-1"
                title={mlServiceStatus === "ready" ? "Python ML service running on port 8000" : "ML offline"}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    mlServiceStatus === "ready" ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                <span className={isLight ? "text-slate-600" : "text-slate-400"}>ML</span>
              </span>
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className={`p-1 rounded transition-colors ${
                isLight
                  ? "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN APPLICATION WORKSPACE */}
      <div
        className={`flex-1 flex flex-col min-w-0 relative z-10 transition-[margin] duration-200 ${
          mobileMenuOpen ? "ml-[82%]" : "ml-0"
        }`}
      >
        {/* TOP COMPACT CASE BAR */}
        <header
          className={`sticky top-0 z-20 px-3 sm:px-6 py-2 border-b transition-colors flex flex-wrap items-center justify-between gap-2 sm:gap-4 ${
            isLight
              ? "bg-white border-slate-300 shadow-xs"
              : "bg-[#080d18]/95 border-slate-800 backdrop-blur-xs"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex-shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`font-mono text-xs sm:text-sm font-semibold truncate ${
                  isLight ? "text-slate-900" : "text-slate-100"
                }`}
              >
                {patient ? patient.filename : "No VCF loaded"}
              </span>
              {patient && (
                <span
                  className={`font-mono text-[10px] sm:text-[11px] hidden xs:inline ${
                    isLight ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  · {totalCount} variants · {dynamicGenomeBuild}
                </span>
              )}
            </div>
          </div>

          {/* Unified Working Search Bar */}
          <div className="flex-1 min-w-[180px] max-w-sm hidden sm:block">
            <div className="relative">
              <Search
                size={13}
                className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
                  isLight ? "text-slate-500" : "text-slate-400"
                }`}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleTopSearch(e.target.value)}
                placeholder="Search chromosome, gene, rsID, condition..."
                className={`w-full pl-8 pr-7 py-1.5 text-xs rounded-md border focus:outline-none focus:border-cyan-500 font-sans transition-colors ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400"
                    : "bg-[#0c1220] border-slate-700 text-slate-100 placeholder-slate-500"
                }`}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 ${
                    isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {recentPatients.length > 1 && (
              <select
                value={patient?.id || ""}
                onChange={(e) => handleSelectRecentPatient(e.target.value)}
                className={`text-xs rounded border px-2 py-1 font-mono focus:outline-none focus:border-cyan-500 ${
                  isLight
                    ? "bg-white border-slate-300 text-slate-900"
                    : "bg-[#0c1220] border-slate-700 text-slate-200"
                }`}
              >
                {recentPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.filename} ({p.variants?.length || 0} vars)
                  </option>
                ))}
              </select>
            )}

            {patient && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 ${
                  isLight
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                }`}
              >
                {analyzing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Play size={13} className="fill-current" />
                    <span>{analysisReady ? "Re-analyze" : "Run Analysis"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </header>

        {/* WORKSPACE CONTENT CONTAINER */}
        <main className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* STEP 1: INGEST VCF AT TOP OF HOME PAGE */}
          <section ref={uploadSectionRef} data-purpose="hero-ingestion">
            <FileUpload onUploadSuccess={handleUploadSuccess} theme={theme} />
          </section>

          {/* ERROR ALERT */}
          {analyzeError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400 text-xs flex items-start gap-2.5 font-sans">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Analysis Failed</strong>
                <span className="mt-0.5 block leading-relaxed">{analyzeError}</span>
              </div>
            </div>
          )}

          {/* STEP 2: OVERVIEW SUMMARY */}
          <section ref={overviewSectionRef} data-purpose="overview-summary">
            {!patient ? (
              <div
                className={`rounded-lg p-6 text-center border ${
                  isLight ? "bg-white border-slate-300 text-slate-700" : "bg-[#0c111d] border-slate-800 text-slate-400"
                }`}
              >
                <p className={`text-sm font-semibold m-0 ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                  No active analysis
                </p>
                <p className={`text-xs mt-1 m-0 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  Upload a VCF to begin.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-slate-300 dark:border-slate-800">
                  <div>
                    <h2 className={`text-sm font-semibold m-0 ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                      Cohort Summary
                    </h2>
                    <p className={`text-xs font-mono mt-0.5 m-0 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      {patient.filename} · {totalCount} variants · {dynamicGenomeBuild}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {analysisReady && (
                      <ExportReportButton
                        patientId={patient.id}
                        summaryStats={summaryStats}
                        variants={variants}
                        theme={theme}
                      />
                    )}
                  </div>
                </div>

                {/* 4 Clean Statistics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div
                    className={`rounded-lg p-3.5 border transition-colors ${
                      isLight ? "bg-white border-slate-300 shadow-xs" : "bg-[#0c111d] border-slate-800"
                    }`}
                  >
                    <div className={`text-xs font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                      Total Variants
                    </div>
                    <div className={`text-2xl font-mono font-bold mt-1 ${isLight ? "text-slate-900" : "text-white"}`}>
                      {totalCount}
                    </div>
                    <div className={`text-[11px] mt-1 font-mono ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                      {analyzedCount}/{totalCount} interpreted
                    </div>
                  </div>

                  <div
                    className={`rounded-lg p-3.5 border transition-colors ${
                      isLight ? "bg-white border-slate-300 shadow-xs" : "bg-[#0c111d] border-slate-800"
                    }`}
                  >
                    <div className={`text-xs font-semibold ${isLight ? "text-rose-700" : "text-rose-400"}`}>
                      Pathogenic
                    </div>
                    <div className={`text-2xl font-mono font-bold mt-1 ${isLight ? "text-rose-700" : "text-rose-400"}`}>
                      {pathogenicCount}
                    </div>
                    <div className={`text-[11px] mt-1 ${isLight ? "text-rose-600" : "text-rose-300"}`}>
                      Score &gt;= 0.80 ({pathogenicPct}%)
                    </div>
                  </div>

                  <div
                    className={`rounded-lg p-3.5 border transition-colors ${
                      isLight ? "bg-white border-slate-300 shadow-xs" : "bg-[#0c111d] border-slate-800"
                    }`}
                  >
                    <div className={`text-xs font-semibold ${isLight ? "text-purple-700" : "text-purple-400"}`}>
                      VUS
                    </div>
                    <div className={`text-2xl font-mono font-bold mt-1 ${isLight ? "text-purple-700" : "text-purple-400"}`}>
                      {vusCount}
                    </div>
                    <div className={`text-[11px] mt-1 ${isLight ? "text-purple-600" : "text-purple-300"}`}>
                      0.20 – 0.79 ({vusPct}%)
                    </div>
                  </div>

                  <div
                    className={`rounded-lg p-3.5 border transition-colors ${
                      isLight ? "bg-white border-slate-300 shadow-xs" : "bg-[#0c111d] border-slate-800"
                    }`}
                  >
                    <div className={`text-xs font-semibold ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                      Benign
                    </div>
                    <div className={`text-2xl font-mono font-bold mt-1 ${isLight ? "text-emerald-700" : "text-emerald-400"}`}>
                      {benignCount}
                    </div>
                    <div className={`text-[11px] mt-1 ${isLight ? "text-emerald-600" : "text-emerald-300"}`}>
                      Score &lt; 0.20 ({benignPct}%)
                    </div>
                  </div>
                </div>

                {/* Risk Distribution Bar */}
                <div
                  className={`rounded-lg p-3.5 border ${
                    isLight ? "bg-white border-slate-300 shadow-xs" : "bg-[#0c111d] border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className={`font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                      Classification Distribution
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className={isLight ? "text-rose-700 font-bold" : "text-rose-400 font-semibold"}>
                        {pathogenicCount} Pathogenic
                      </span>
                      <span className={isLight ? "text-purple-700 font-bold" : "text-purple-400 font-semibold"}>
                        {vusCount} VUS
                      </span>
                      <span className={isLight ? "text-emerald-700 font-bold" : "text-emerald-400 font-semibold"}>
                        {benignCount} Benign
                      </span>
                    </div>
                  </div>

                  <div
                    className={`h-2.5 w-full rounded-full overflow-hidden flex gap-0.5 ${
                      isLight ? "bg-slate-200" : "bg-slate-800"
                    }`}
                  >
                    {pathogenicCount > 0 && (
                      <div
                        className="h-full bg-rose-500 transition-all"
                        style={{ width: `${pathogenicPct}%` }}
                      />
                    )}
                    {vusCount > 0 && (
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${vusPct}%` }}
                      />
                    )}
                    {benignCount > 0 && (
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${benignPct}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* STEP 3: VARIANT ANALYSIS TABLE */}
          <section ref={tableSectionRef} data-purpose="variant-table" className="space-y-2.5">
            <div>
              <h2 className={`text-sm font-semibold m-0 ${isLight ? "text-slate-900" : "text-slate-100"}`}>
                Variant Analysis Table
              </h2>
              <p className={`text-xs mt-0.5 m-0 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                Click any variant row to inspect evidence, CADD score, population allele frequency, and model explanation.
              </p>
            </div>

            <VariantTable
              variants={variants}
              selectedVariantId={selectedVariant?.id}
              onSelectVariant={handleSelectVariant}
              theme={theme}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          </section>
        </main>
      </div>

      {/* VARIANT INSPECTOR DRAWER */}
      {selectedVariant && (
        <EvidenceDrawer
          variant={selectedVariant}
          onClose={() => setSelectedVariant(null)}
          theme={theme}
        />
      )}

      {/* HOW IT WORKS MODAL */}
      {activeModal === "how_it_works" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-2xl rounded-xl border p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto ${
              isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#0b101c] border-slate-800 text-slate-100"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3.5 border-slate-300 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold m-0">How GENOMIX Works</h3>
                <p className={`text-xs mt-0.5 m-0 ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  A plain-English guide to genomic interpretation and the core workflow.
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className={`p-1 rounded ${isLight ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              <div
                className={`p-3.5 rounded-lg border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#0e1424] border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-cyan-700 dark:text-cyan-400 mb-1">
                  <span>1. Upload a VCF File</span>
                </div>
                <p className={`m-0 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  When a patient's DNA is sequenced, variations from the standard human genome are saved in a <strong>Variant Call Format (.vcf)</strong> file. You upload that file into the platform at the top of the page.
                </p>
              </div>

              <div
                className={`p-3.5 rounded-lg border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#0e1424] border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-cyan-700 dark:text-cyan-400 mb-1">
                  <span>2. Automated Annotation</span>
                </div>
                <p className={`m-0 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  For every genetic change found in the file, the platform looks up public biomedical databases:
                </p>
                <ul className={`pl-4 list-disc space-y-1 mt-1.5 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  <li>
                    <strong>ClinVar:</strong> A global database of mutations submitted by clinical testing labs, showing whether a variant has been known to cause disease.
                  </li>
                  <li>
                    <strong>CADD Score:</strong> A scientific score estimating how harmful a mutation is. A score of 20 or higher means it is predicted to be in the top 1% most damaging mutations.
                  </li>
                  <li>
                    <strong>Allele Frequency:</strong> How common the mutation is in the general population (gnomAD / 1000 Genomes). Common mutations are usually harmless.
                  </li>
                </ul>
              </div>

              <div
                className={`p-3.5 rounded-lg border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#0e1424] border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-cyan-700 dark:text-cyan-400 mb-1">
                  <span>3. Machine Learning Classification</span>
                </div>
                <p className={`m-0 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  A trained Random Forest model examines the variant's population frequency and CADD score to calculate an <strong>ML Risk Score</strong> from 0.0 to 1.0:
                </p>
                <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-[11px]">
                  <div className={`p-2 rounded border ${isLight ? "bg-rose-50 border-rose-200 text-rose-800 font-semibold" : "bg-rose-950/40 border-rose-800 text-rose-300"}`}>
                    &gt;= 0.80: Pathogenic
                    <span className="block text-[10px] font-sans font-normal mt-0.5">High disease risk</span>
                  </div>
                  <div className={`p-2 rounded border ${isLight ? "bg-purple-50 border-purple-200 text-purple-800 font-semibold" : "bg-purple-950/40 border-purple-800 text-purple-300"}`}>
                    0.20 – 0.79: VUS
                    <span className="block text-[10px] font-sans font-normal mt-0.5">Uncertain significance</span>
                  </div>
                  <div className={`p-2 rounded border ${isLight ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold" : "bg-emerald-950/40 border-emerald-800 text-emerald-300"}`}>
                    &lt; 0.20: Benign
                    <span className="block text-[10px] font-sans font-normal mt-0.5">Harmless variation</span>
                  </div>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-lg border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-[#0e1424] border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm text-cyan-700 dark:text-cyan-400 mb-1">
                  <span>4. Inspect &amp; Export</span>
                </div>
                <p className={`m-0 ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                  Click any row in the table to open the <strong>Variant Inspector</strong>. You can view the raw biological metrics, read the automated model explanation narrative, and click <strong>Export PDF Report</strong> to download a formatted report for clinical review.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className={`px-4 py-1.5 rounded text-xs font-semibold ${
                  isLight
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                }`}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORTS MODAL */}
      {activeModal === "reports" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-xl border p-5 space-y-4 shadow-xl ${
              isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#0b101c] border-slate-800 text-slate-100"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-300 dark:border-slate-800">
              <h3 className="text-sm font-semibold m-0">Clinical Reports</h3>
              <button
                onClick={() => setActiveModal(null)}
                className={`p-1 rounded ${isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-white"}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className={`space-y-3 text-xs leading-relaxed ${isLight ? "text-slate-700" : "text-slate-300"}`}>
              <p className="m-0">
                Generate and download clinical summary PDF reports for the active VCF cohort. Priority findings (Pathogenic &amp; VUS) are structured with chromosome coordinates, alleles, ML risk scores, and clinical condition associations.
              </p>
              {patient?.id && analysisReady ? (
                <div className="pt-2">
                  <ExportReportButton
                    patientId={patient.id}
                    summaryStats={summaryStats}
                    variants={variants}
                    theme={theme}
                  />
                </div>
              ) : (
                <p className="text-amber-600 dark:text-amber-400 font-medium m-0">
                  Upload and analyze a VCF first to generate report exports.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {activeModal === "settings" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-xl border p-5 space-y-4 shadow-xl ${
              isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#0b101c] border-slate-800 text-slate-100"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-300 dark:border-slate-800">
              <h3 className="text-sm font-semibold m-0">Settings</h3>
              <button
                onClick={() => setActiveModal(null)}
                className={`p-1 rounded ${isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-400 hover:text-white"}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                <span className={isLight ? "text-slate-700" : "text-slate-400"}>Theme</span>
                <button
                  onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                  className={`px-2.5 py-1 rounded border text-xs font-medium ${
                    isLight ? "bg-slate-100 border-slate-300 text-slate-800" : "bg-slate-800 border-slate-700 text-slate-200"
                  }`}
                >
                  {theme === "dark" ? "Dark Mode" : "Light Mode"}
                </button>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                <span className={isLight ? "text-slate-700" : "text-slate-400"}>Backend API</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">localhost:3001</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                <span className={isLight ? "text-slate-700" : "text-slate-400"}>ML Service</span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400">localhost:8000</span>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleClearDatabase}
                  disabled={clearing}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold text-rose-700 border border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>{clearing ? "Clearing..." : "Clear Patient Database"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
