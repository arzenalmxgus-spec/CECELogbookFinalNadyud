import { format } from "date-fns";
import { recordAudit } from "@/lib/audit";
import { formatDate, formatDuration, formatTime, summarize } from "@/lib/log-utils";
import type { VisitorLogWithVisitor } from "@/lib/types";

const HEADERS = [
  "Visitor Name",
  "RFID UID",
  "Program",
  "Contact Number",
  "Office Visited",
  "Purpose",
  "Date",
  "Time In",
  "Time Out",
  "Duration",
  "Status",
  "Remarks",
];

function toRow(log: VisitorLogWithVisitor) {
  return [
    log.visitor?.full_name ?? "Unknown",
    log.visitor?.rfid_uid ?? "—",
    log.visitor?.company ?? "—",
    log.visitor?.contact_number ?? "—",
    log.office_to_visit,
    log.purpose,
    formatDate(log.visit_date),
    formatTime(log.time_in),
    formatTime(log.time_out),
    formatDuration(log.duration_minutes),
    log.status === "inside" ? "Inside" : "Checked Out",
    log.remarks ?? "—",
  ];
}

function stamp() {
  return format(new Date(), "yyyy-MM-dd");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function exportExcel(logs: VisitorLogWithVisitor[], period: string) {
  const XLSX = await import("xlsx");
  const stats = summarize(logs);

  const aoa: (string | number)[][] = [
    ["Office Visitor Logbook — Visitor Report"],
    [`Report period: ${period}`],
    [`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`],
    [],
    HEADERS,
    ...logs.map(toRow),
    [],
    ["Summary"],
    ["Total Visits", stats.total],
    ["Currently Inside", stats.inside],
    ["Average Visit Duration", formatDuration(stats.avgDuration)],
    ["Most Common Purpose", stats.topPurpose],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = HEADERS.map((header, index) => ({
    wch: Math.max(
      header.length + 2,
      ...logs.map((log) => String(toRow(log)[index] ?? "").length + 2),
      14,
    ),
  }));
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADERS.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: HEADERS.length - 1 } },
  ];

  const headerRow = 4;
  HEADERS.forEach((_, col) => {
    const ref = XLSX.utils.encode_cell({ r: headerRow, c: col });
    const cell = sheet[ref];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1F4E5F" } },
        alignment: { horizontal: "center" },
      };
    }
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Visitor Report");
  XLSX.writeFile(book, `Visitor_Report_${stamp()}.xlsx`);
  await recordAudit("export_excel", `Exported ${logs.length} visit records to Excel (${period})`);
}

export async function exportCsv(logs: VisitorLogWithVisitor[], period: string) {
  const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [HEADERS.map(escape).join(","), ...logs.map((log) => toRow(log).map(escape).join(","))];
  download(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }), `Visitor_Report_${stamp()}.csv`);
  await recordAudit("export_csv", `Exported ${logs.length} visit records to CSV (${period})`);
}

export async function exportPdf(logs: VisitorLogWithVisitor[], period: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const stats = summarize(logs);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text("Office Visitor Logbook — Visitor Report", 40, 40);
  doc.setFontSize(10);
  doc.text(`Report period: ${period}`, 40, 58);
  doc.text(`Generated: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, 40, 72);

  autoTable(doc, {
    head: [HEADERS],
    body: logs.map(toRow),
    startY: 88,
    styles: { fontSize: 7, cellPadding: 4 },
    headStyles: { fillColor: [31, 78, 95], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 249] },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 88;
  autoTable(doc, {
    head: [["Summary", ""]],
    body: [
      ["Total Visits", String(stats.total)],
      ["Currently Inside", String(stats.inside)],
      ["Average Visit Duration", formatDuration(stats.avgDuration)],
      ["Most Common Purpose", stats.topPurpose],
    ],
    startY: finalY + 20,
    tableWidth: 280,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [31, 78, 95], textColor: 255 },
  });

  doc.save(`Visitor_Report_${stamp()}.pdf`);
  await recordAudit("export_pdf", `Exported ${logs.length} visit records to PDF (${period})`);
}
