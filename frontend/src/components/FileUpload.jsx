import { useState, useCallback, useRef } from "react";
import {
  Upload,
  Download,
  FileCheck,
  AlertCircle,
  X,
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

  // Upload completed state
  if (uploadResult && !error) {
    return (
      <div
        className={`surface-card p-6 animate-fade-in border ${theme === "dark" ? "border-zinc-800 bg-zinc-900" : "border-stone-300 bg-stone-50"}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
              <FileCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p
                  className={`font-semibold text-sm m-0 ${theme === "dark" ? "text-white" : "text-stone-900"}`}
                >
                  VCF Successfully Loaded
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono ${theme === "dark" ? "bg-zinc-800 text-zinc-400" : "bg-stone-200 text-stone-600"}`}
                >
                  {uploadResult.totalVariants ??
                    uploadResult.patient?.variants?.length ??
                    0}{" "}
                  variants
                </span>
              </div>
              <p
                className={`text-xs font-mono mt-1 m-0 ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
              >
                {file?.name || uploadResult.filename}
              </p>
              {uploadResult.patientId && (
                <p className="text-orange-400/90 text-xs mt-2 m-0 flex items-center gap-1">
                  <span>Patient ID:</span>
                  <span className="font-mono text-zinc-300">
                    {uploadResult.patientId.slice(0, 8)}...
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={reset}
            className={`p-1.5 rounded-md transition-colors ${theme === "dark" ? "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" : "text-stone-500 hover:text-stone-800 hover:bg-stone-200"}`}
            title="Upload another file"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`surface-card p-8 text-center cursor-pointer transition-all duration-200 relative overflow-hidden group ${
          isDragging
            ? "border-orange-500 bg-orange-500/5 ring-2 ring-orange-500/20"
            : error
              ? "border-red-500/40 bg-red-500/5"
              : theme === "dark"
                ? "border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 hover:bg-zinc-900"
                : "border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100"
        }`}
      >
        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-zinc-950/85 flex flex-col items-center justify-center gap-3 z-10">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-zinc-300 text-sm font-medium">
              Parsing and storing VCF variants...
            </p>
          </div>
        )}

        <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto mb-4 text-zinc-400 group-hover:text-orange-400 group-hover:border-orange-500/40 group-hover:bg-orange-500/10 transition-all">
          <Upload size={22} />
        </div>

        <h3
          className={`text-base font-semibold mb-1 ${theme === "dark" ? "text-white" : "text-stone-900"}`}
        >
          {isDragging
            ? "Drop your VCF file here"
            : "Drop your VCF file here or browse"}
        </h3>
        <p
          className={`text-xs max-w-sm mx-auto mb-4 ${theme === "dark" ? "text-zinc-400" : "text-stone-600"}`}
        >
          Securely ingest a standard genomic <code className="text-teal-500 font-mono">.vcf</code> or compressed <code className="text-teal-500 font-mono">.vcf.gz</code> file.
        </p>

        <div className="flex items-center justify-center">
          <button
            type="button"
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${theme === "dark" ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700" : "bg-stone-200 hover:bg-stone-300 text-stone-800 border-stone-300"}`}
          >
            Select .VCF File
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".vcf,.vcf.gz"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-red-400 text-xs animate-fade-in">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sample VCF download link */}
      <div className={`mt-4 flex items-center justify-between text-xs ${theme === "dark" ? "text-zinc-500" : "text-stone-500"}`}>
        <span>Need a demo file to try?</span>
        <button
          type="button"
          onClick={downloadSampleVcf}
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${theme === "dark" ? "border-zinc-800 hover:border-zinc-700 text-zinc-300" : "border-stone-200 hover:border-stone-300 text-stone-600"}`}
        >
          <Download size={12} />
          Download sample VCF
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
##source=GenoLabTest
##reference=GRCh38
##INFO=<ID=GENE,Number=1,Type=String,Description="Gene symbol">
##INFO=<ID=AF,Number=1,Type=Float,Description="Allele Frequency">
##contig=<ID=chr1,length=248956422>
##contig=<ID=chr7,length=159345973>
##contig=<ID=chr17,length=83257441>
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
chr1	10019	rs1234	A	G	99	PASS	GENE=BRCA1;AF=0.0001
chr7	140453136	rs113488022	A	T	99	PASS	GENE=BRAF;AF=0.00001
chr7	117559590	rs121913529	T	C	99	PASS	GENE=EGFR;AF=0.0001
chr17	43094464	rs80357906	A	G	99	PASS	GENE=BRCA1;AF=0.0001
chr17	7674220	rs80359550	T	C	99	PASS	GENE=TP53;AF=0.00001
chr1	150551945	rs121909218	T	G	99	PASS	GENE=LMNA;AF=0.0001
chr7	92170277	rs113993960	G	A	99	PASS	GENE=CFTR;AF=0.002
chr1	216369765	rs121913530	C	T	99	PASS	GENE=USH2A;AF=0.0001
chr17	43092075	rs80357713	T	A	99	PASS	GENE=BRCA1;AF=0.00001
chr5	112839514	rs121434416	C	T	99	PASS	GENE=APC;AF=0.0001
`;
