import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ink = [6, 8, 15]; // Deep obsidian #06080F
const cyan = [0, 229, 255]; // Brand Cyan #00E5FF
const paper = [248, 250, 252];

function safeScore(score) {
  return typeof score === "number" && !Number.isNaN(score) ? score.toFixed(3) : "—";
}

function classification(status) {
  const value = String(status || "Unclassified");
  return value === "VUS" ? "Uncertain significance" : value;
}

function getDisease(evidence, variant) {
  if (evidence?.disease) return evidence.disease;
  if (variant?.disease) return variant.disease;
  const match = String(evidence?.shap_explanation || "").match(/\(Disease:\s*([^)]+)\)/i);
  return match?.[1]?.trim() || "None reported";
}

export default function ExportReportButton({ patientId, summaryStats, variants, theme = "dark" }) {
  const canExport = Boolean(patientId) && Array.isArray(variants) && variants.length > 0;

  const handleExport = () => {
    if (!canExport) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const createdOn = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    const flaggedVariants = variants.filter((v) => ["pathogenic", "vus"].includes(String(v.status || "").toLowerCase()));
    const width = doc.internal.pageSize.getWidth();
    const margin = 15;
    const footer = () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setDrawColor(226, 232, 240); doc.line(margin, 286, width - margin, 286);
      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.text("GENOMIX Genomic Interpretation Summary • For clinical bioinformatics review; confirm with standard assays.", margin, 291);
      doc.text(`Page ${page}`, width - margin, 291, { align: "right" });
    };

    // Header banner
    doc.setFillColor(...ink); doc.rect(0, 0, width, 43, "F");
    doc.setFillColor(...cyan); doc.rect(0, 40, width, 3, "F");
    doc.setTextColor(0, 229, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("GENOMIX / CLINICAL BIOINFORMATICS & VARIANT INTERPRETATION", margin, 14);
    doc.setFontSize(20); doc.setTextColor(255, 255, 255); doc.text("Clinical Variant Review Report", margin, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(203, 213, 225);
    doc.text(`Case ID: ${patientId}`, margin, 34); doc.text(`Generated: ${createdOn}`, width - margin, 34, { align: "right" });

    // Review statistics at a glance
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Cohort Summary at a Glance", margin, 57);
    const statCards = [
      ["VARIANTS REVIEWED", variants.length, [241, 245, 249]],
      ["PATHOGENIC", summaryStats?.pathogenic ?? 0, [254, 226, 226]],
      ["VUS", summaryStats?.vus ?? 0, [243, 232, 255]],
      ["BENIGN", summaryStats?.benign ?? 0, [220, 252, 231]]
    ];
    statCards.forEach(([label, value, color], index) => {
      const x = margin + index * 45;
      doc.setFillColor(...color); doc.roundedRect(x, 62, 41, 20, 2, 2, "F");
      doc.setTextColor(71, 85, 105); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.text(label, x + 4, 68);
      doc.setTextColor(...ink); doc.setFontSize(14); doc.text(String(value), x + 4, 77);
    });

    // Priority findings table
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Priority Findings (Pathogenic & VUS)", margin, 96);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
    doc.text(
      flaggedVariants.length
        ? `${flaggedVariants.length} variant${flaggedVariants.length === 1 ? "" : "s"} identified for targeted clinical evaluation.`
        : "No pathogenic or uncertain-significance variants identified in this cohort.",
      margin,
      102
    );

    const rows = flaggedVariants.map((v) => [
      `chr${v.chrom}`,
      Number(v.pos || 0).toLocaleString(),
      `${v.ref || "—"} → ${v.alt || "—"}`,
      safeScore(v.evidence?.ml_score),
      classification(v.status),
      getDisease(v.evidence, v),
    ]);

    autoTable(doc, {
      startY: 108,
      head: [["CHROMOSOME", "POSITION", "CHANGE", "ML SCORE", "CLASSIFICATION", "CONDITION"]],
      body: rows.length ? rows : [["—", "—", "—", "—", "—", "No priority findings"]],
      margin: { left: margin, right: margin, bottom: 23 },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.8, textColor: ink, lineColor: [226, 232, 240], lineWidth: 0.15 },
      headStyles: { fillColor: ink, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.2 },
      alternateRowStyles: { fillColor: paper },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 26 },
        2: { cellWidth: 24 },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 35 },
        5: { cellWidth: 51 },
      },
    });

    let finalY = (doc.lastAutoTable?.finalY || 130) + 12;
    if (finalY > 258) { doc.addPage(); finalY = 25; }
    doc.setFillColor(241, 245, 249); doc.roundedRect(margin, finalY, width - margin * 2, 22, 2, 2, "F");
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text("Clinical Bioinformatics Note", margin + 4, finalY + 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(51, 65, 85);
    const note = "Model scores and annotations prioritize variants for clinical correlation. Confirm findings against patient phenotype, family pedigree, and molecular assays before making final clinical determinations.";
    doc.text(doc.splitTextToSize(note, width - margin * 2 - 8), margin + 4, finalY + 13);

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      footer();
    }
    doc.save(`Genomix_Variant_Report_${patientId}.pdf`);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!canExport}
      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-white/[0.12] text-xs font-semibold text-slate-200 hover:text-white hover:border-cyan-500/40 hover:bg-slate-800 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed font-sans"
      title="Export priority findings to PDF"
    >
      <FileDown size={14} className="text-cyan-400" />
      <span>Export PDF Report</span>
    </button>
  );
}
