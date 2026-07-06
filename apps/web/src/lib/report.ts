/**
 * AgentRight PDF Report Generator
 * Produces a downloadable compliance report from a ScanResult.
 * Uses jsPDF for client-side PDF generation. No server calls.
 */

import type { ScanResult } from "@agentright/core";

// Dynamic import to avoid SSR issues
async function loadJsPDF() {
  const jsPDFModule = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
  return { jsPDF };
}

const GRADE_LABELS: Record<string, string> = {
  A: "Production-ready",
  B: "Mostly ready. Minor gaps.",
  C: "Needs work. Not production-ready.",
  D: "At risk. Quarantine recommended.",
  F: "Ungoverned. Should not be running.",
};

export async function generateReport(result: ScanResult): Promise<Blob> {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = W - margin * 2;
  let y = margin;

  // ── HEADER ──
  doc.setFillColor(10, 14, 23);
  doc.rect(0, 0, W, 45, "F");

  doc.setTextColor(241, 245, 249);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("AgentRight", margin, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text("Agent Governance Report", margin, 25);

  doc.setFontSize(8);
  doc.text(
    `Generated: ${new Date(result.scanned_at).toLocaleString()}`,
    margin,
    32
  );
  doc.text("Confidential", W - margin, 32, { align: "right" });

  y = 52;

  // ── EXECUTIVE SUMMARY ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", margin, y);
  y += 8;

  // Score box
  const gradeColor = getGradeRGB(result.grade);
  doc.setFillColor(gradeColor[0], gradeColor[1], gradeColor[2]);
  doc.roundedRect(margin, y, 30, 30, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(String(result.trust_score), margin + 15, y + 14, {
    align: "center",
  });
  doc.setFontSize(10);
  doc.text(`Grade ${result.grade}`, margin + 15, y + 22, {
    align: "center",
  });

  // Summary text
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summaryX = margin + 38;

  const criticalCount = result.gaps.filter(
    (g) => g.severity === "critical"
  ).length;
  const highCount = result.gaps.filter(
    (g) => g.severity === "high"
  ).length;
  const mediumCount = result.gaps.filter(
    (g) => g.severity === "medium"
  ).length;

  const summaryLines = [
    `Agent ID: ${result.agent_id}`,
    `Type: ${result.agent_type}  |  Risk Tier: ${result.risk_tier.replace(/_/g, " ")}`,
    `Fields Configured: ${result.field_count.present} / ${result.field_count.total}`,
    `Assessment: ${GRADE_LABELS[result.grade] || "Unknown"}`,
    `Gaps: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium`,
  ];

  summaryLines.forEach((line, i) => {
    doc.text(line, summaryX, y + 5 + i * 5.5);
  });

  y += 38;

  // ── DIMENSION SCORES ──
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Dimension Scores", margin, y);
  y += 3;

  const dimTableData = result.dimensions.map((d) => [
    d.name,
    `${Math.round(d.weight * 100)}%`,
    `${d.score}/100`,
    d.details.join("; "),
  ]);

  (doc as any).autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Dimension", "Weight", "Score", "Details"]],
    body: dimTableData,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [10, 14, 23],
      textColor: [241, 245, 249],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: "auto" },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── GAPS AND REMEDIATIONS ──
  if (y > 240) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Gaps and Remediations", margin, y);
  y += 3;

  if (result.gaps.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      "No gaps detected. This agent configuration is well-formed.",
      margin,
      y + 6
    );
    y += 12;
  } else {
    const gapTableData = result.gaps.map((g) => [
      g.severity.toUpperCase(),
      g.field,
      g.message,
      g.remediation,
    ]);

    (doc as any).autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Severity", "Field", "Issue", "Remediation"]],
      body: gapTableData,
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [10, 14, 23],
        textColor: [241, 245, 249],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 30 },
        2: { cellWidth: 50 },
        3: { cellWidth: "auto" },
      },
      didParseCell: (data: any) => {
        if (data.section === "body" && data.column.index === 0) {
          const sev = data.cell.raw?.toString().toLowerCase();
          if (sev === "critical") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          } else if (sev === "high") {
            data.cell.styles.textColor = [234, 88, 12];
            data.cell.styles.fontStyle = "bold";
          } else if (sev === "medium") {
            data.cell.styles.textColor = [161, 130, 0];
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── FOOTER on each page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      "AgentRight Governance Report | github.com/Ganesh-WeekendBuilds/agentright | All scoring is rule-based and deterministic",
      margin,
      pageH - 10
    );
    doc.text(`Page ${i} of ${pageCount}`, W - margin, pageH - 10, {
      align: "right",
    });
  }

  return doc.output("blob");
}

function getGradeRGB(grade: string): [number, number, number] {
  switch (grade) {
    case "A":
      return [22, 163, 74];
    case "B":
      return [101, 163, 13];
    case "C":
      return [202, 138, 4];
    case "D":
      return [234, 88, 12];
    case "F":
      return [220, 38, 38];
    default:
      return [100, 100, 100];
  }
}
