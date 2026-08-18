import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ink = [24, 51, 52];
const teal = [13, 148, 136];
const paper = [247, 250, 247];

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
      doc.setDrawColor(213, 225, 219); doc.line(margin, 286, width - margin, 286);
      doc.setTextColor(95, 115, 113); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.text("Genomic review summary • For clinical review; not a standalone diagnostic determination.", margin, 291);
      doc.text(`Page ${page}`, width - margin, 291, { align: "right" });
    };

    doc.setFillColor(...ink); doc.rect(0, 0, width, 43, "F");
    doc.setFillColor(...teal); doc.rect(0, 40, width, 3, "F");
    doc.setTextColor(232, 255, 250); doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("CLINICAL GENOMICS / VARIANT REVIEW", margin, 14);
    doc.setFontSize(21); doc.text("Variant review report", margin, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Case ${patientId}`, margin, 34); doc.text(`Prepared ${createdOn}`, width - margin, 34, { align: "right" });

    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Review at a glance", margin, 57);
    const statCards = [["VARIANTS REVIEWED", variants.length, [232, 245, 242]], ["PATHOGENIC", summaryStats?.pathogenic ?? 0, [255, 237, 225]], ["UNCERTAIN", summaryStats?.vus ?? 0, [255, 247, 220]], ["BENIGN", summaryStats?.benign ?? 0, [232, 247, 238]]];
    statCards.forEach(([label, value, color], index) => {
      const x = margin + index * 45;
      doc.setFillColor(...color); doc.roundedRect(x, 62, 41, 20, 2, 2, "F");
      doc.setTextColor(80, 102, 100); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.text(label, x + 4, 68);
      doc.setTextColor(...ink); doc.setFontSize(15); doc.text(String(value), x + 4, 77);
    });

    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Priority findings", margin, 96);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(82, 102, 101);
    doc.text(flaggedVariants.length ? `${flaggedVariants.length} variant${flaggedVariants.length === 1 ? "" : "s"} retained for clinical follow-up.` : "No pathogenic or uncertain-significance variants were retained for follow-up.", margin, 102);
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
      head: [["CHROMOSOME", "POSITION", "CHANGE", "SCORE", "CLASSIFICATION", "TESTED CONDITION"]],
      body: rows.length ? rows : [["—", "—", "—", "—", "—", "No priority findings"]],
      margin: { left: margin, right: margin, bottom: 23 },
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.8, textColor: ink, lineColor: [219, 230, 225], lineWidth: 0.15 },
      headStyles: { fillColor: ink, textColor: [242, 249, 247], fontStyle: "bold", fontSize: 7.2 },
      alternateRowStyles: { fillColor: paper },
      columnStyles: {
        0: { cellWidth: 23 },
        1: { cellWidth: 26 },
        2: { cellWidth: 24 },
        3: { cellWidth: 18, halign: "right" },
        4: { cellWidth: 35 },
        5: { cellWidth: 54 },
      },
    });
    let finalY = (doc.lastAutoTable?.finalY || 130) + 13;
    if (finalY > 258) { doc.addPage(); finalY = 25; }
    doc.setFillColor(239, 247, 244); doc.roundedRect(margin, finalY, width - margin * 2, 23, 2, 2, "F");
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.text("Interpretation note", margin + 4, finalY + 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(67, 91, 89);
    const note = "Classifications and model scores support prioritisation. Confirm findings against patient phenotype, inheritance, assay quality, and current clinical evidence before making a clinical decision.";
    doc.text(doc.splitTextToSize(note, width - margin * 2 - 8), margin + 4, finalY + 13);
    const pages = doc.getNumberOfPages(); for (let page = 1; page <= pages; page += 1) { doc.setPage(page); footer(); }
    doc.save(`Variant_review_${patientId}.pdf`);
  };

  return <button onClick={handleExport} disabled={!canExport} className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${theme === "dark" ? "border-teal-900 bg-teal-950/60 hover:bg-teal-900/70 text-teal-50" : "border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900"}`} title="Export priority variants to PDF"><FileDown size={14} /> Export review PDF</button>;
}
