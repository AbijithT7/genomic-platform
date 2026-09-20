import { useState, useCallback, useRef } from "react";
import {
  Upload,
  Download,
  FileCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { uploadVcfFile } from "../lib/api";

export default function FileUpload({ onUploadSuccess, theme = "dark" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const inputRef = useRef(null);

  const validateFile = (f) => {
    if (!f) return "No file selected.";
    const name = f.name.toLowerCase();
    if (!name.endsWith(".vcf") && !name.endsWith(".vcf.gz")) {
      return "Only .vcf or .vcf.gz files are accepted.";
    }
    return null;
  };

  const handleFile = useCallback(
    async (f) => {
      setError(null);
      setUploadResult(null);

      const validationError = validateFile(f);
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(f);
      setUploading(true);

      try {
        const result = await uploadVcfFile(f);
        setUploadResult(result);
        if (onUploadSuccess) {
          onUploadSuccess(result);
        }
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.response?.data?.details ||
          "Upload failed. Check that the backend server is running on port 3001.";
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [onUploadSuccess],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      handleFile(selected);
    }
  };

  const reset = () => {
    setFile(null);
    setError(null);
    setUploadResult(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const isLight = theme === "light";

  return (
    <div className="w-full">
      {/* Uploaded active file banner */}
      {uploadResult && !error ? (
        <div
          className={`rounded-lg p-4 sm:p-5 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${
            isLight
              ? "bg-white border-slate-300 text-slate-900 shadow-sm"
              : "bg-[#0e1424] border-slate-800 text-slate-100"
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
                isLight
                  ? "bg-emerald-100 border border-emerald-300 text-emerald-700"
                  : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              }`}
            >
              <FileCheck size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs sm:text-sm font-semibold truncate max-w-[200px] sm:max-w-none">
                  {file?.name || uploadResult.filename}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                    isLight
                      ? "bg-cyan-100 text-cyan-800 border border-cyan-300"
                      : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  }`}
                >
                  {uploadResult.totalVariants ?? uploadResult.patient?.variants?.length ?? 0} variants
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  isLight ? "text-slate-600" : "text-slate-400"
                }`}
              >
                VCF ingested into pipeline. Ready for interpretation.
              </p>
            </div>
          </div>

          <button
            onClick={reset}
            className={`w-full sm:w-auto text-center px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex-shrink-0 ${
              isLight
                ? "border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100 bg-white"
                : "border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 bg-[#0a0e17]"
            }`}
          >
            Upload Another VCF
          </button>
        </div>
      ) : (
        /* The Hero Ingestion Box */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl p-6 sm:p-10 text-center cursor-pointer transition-all border relative group ${
            isDragging
              ? "border-cyan-500 ring-2 ring-cyan-500/20 bg-cyan-50"
              : error
                ? "border-rose-500/40 bg-rose-50"
                : isLight
                  ? "bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50/80 shadow-sm"
                  : "bg-[#0e1424] border-slate-800 hover:border-slate-700 hover:bg-[#11192d]"
          }`}
        >
          {uploading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-20 rounded-xl">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-slate-200 text-xs font-medium">
                Parsing and streaming VCF variants...
              </p>
            </div>
          )}

          <div className="max-w-md mx-auto space-y-4">
            <div
              className={`w-11 h-11 rounded-lg flex items-center justify-center mx-auto transition-transform group-hover:scale-105 ${
                isLight
                  ? "bg-cyan-100 border border-cyan-200 text-cyan-700"
                  : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
              }`}
            >
              <Upload size={20} />
            </div>

            <div className="space-y-1">
              <h1
                className={`text-xl sm:text-2xl font-bold tracking-tight m-0 ${
                  isLight ? "text-slate-900" : "text-white"
                }`}
              >
                Analyze a VCF
              </h1>
              <p
                className={`text-xs sm:text-sm m-0 ${
                  isLight ? "text-slate-600" : "text-slate-400"
                }`}
              >
                Upload <code className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">.vcf</code> or <code className="font-mono font-semibold text-cyan-700 dark:text-cyan-400">.vcf.gz</code>
              </p>
            </div>

            <div>
              <button
                type="button"
                className={`inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-md transition-colors shadow-xs ${
                  isLight
                    ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                }`}
              >
                Choose VCF
              </button>
            </div>

            <p
              className={`text-xs font-medium tracking-wide pt-1 m-0 ${
                isLight ? "text-slate-500" : "text-slate-400"
              }`}
            >
              ClinVar · CADD · AI/ML interpretation
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".vcf,.vcf.gz"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Clean Demo Link */}
      <div
        className={`mt-2.5 flex items-center justify-between text-xs px-1 ${
          isLight ? "text-slate-600" : "text-slate-400"
        }`}
      >
        <span>Need a test file?</span>
        <button
          type="button"
          onClick={downloadSampleVcf}
          className="inline-flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 hover:underline font-medium"
        >
          <Download size={12} />
          <span>Download sample VCF</span>
        </button>
      </div>
    </div>
  );
}

function downloadSampleVcf() {
  const blob = new Blob([SAMPLE_VCF_CONTENT], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-variants.vcf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SAMPLE_VCF_CONTENT = `##fileformat=VCFv4.2
##fileDate=20260917
##source=GenomicPlatformClinicalVCF
##reference=hg19
##INFO=<ID=GENE,Number=1,Type=String,Description="Associated Gene Symbol">
##INFO=<ID=CLNSIG,Number=.,Type=String,Description="ClinVar Clinical Significance">
##INFO=<ID=CLNDN,Number=.,Type=String,Description="ClinVar Disease/Phenotype Name">
##INFO=<ID=AF,Number=A,Type=Float,Description="Population Allele Frequency (gnomAD/1000G)">
##INFO=<ID=CADD,Number=A,Type=Float,Description="CADD Phred-scaled Deleteriousness Score">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	PATIENT_01
chr7	140453136	rs113488022	A	T	99	PASS	GENE=BRAF;CLNSIG=Pathogenic;CLNDN=Colorectal_carcinoma;AF=0.000004;CADD=32.0	GT	0/1
chr17	41276045	rs80357906	C	T	99	PASS	GENE=BRCA1;CLNSIG=Pathogenic;CLNDN=Hereditary_breast_and_ovarian_cancer_syndrome;AF=0.00001;CADD=28.5	GT	0/1
chr17	7577120	rs28934578	C	T	99	PASS	GENE=TP53;CLNSIG=Pathogenic;CLNDN=Li-Fraumeni_syndrome;AF=0.00002;CADD=33.0	GT	0/1
chr12	25398284	rs121913529	C	T	99	PASS	GENE=KRAS;CLNSIG=Pathogenic;CLNDN=Pancreatic_and_colorectal_carcinoma;AF=0.00001;CADD=29.0	GT	0/1
chr7	117199644	rs113993960	ATCT	A	99	PASS	GENE=CFTR;CLNSIG=Pathogenic;CLNDN=Cystic_fibrosis;AF=0.015;CADD=26.0	GT	0/1
chr1	11856378	rs1801133	G	A	99	PASS	GENE=MTHFR;CLNSIG=Benign;CLNDN=Hyperhomocysteinemia;AF=0.32;CADD=12.0	GT	0/1
chr6	26093141	rs1800562	G	A	99	PASS	GENE=HFE;CLNSIG=Benign;CLNDN=Hereditary_hemochromatosis;AF=0.06;CADD=14.5	GT	0/1
chr2	136608646	rs4988235	G	A	99	PASS	GENE=MCM6;CLNSIG=Benign;CLNDN=Lactase_persistence;AF=0.65;CADD=4.2	GT	0/1
chr22	19951271	rs4680	G	A	99	PASS	GENE=COMT;CLNSIG=Benign;CLNDN=Pain_sensitivity;AF=0.48;CADD=11.8	GT	0/1
chr11	66560624	rs1815739	C	T	99	PASS	GENE=ACTN3;CLNSIG=Benign;CLNDN=Athletic_performance;AF=0.52;CADD=9.1	GT	0/1
`;
