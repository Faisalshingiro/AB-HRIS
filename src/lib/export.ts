import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ExportColumn {
  header: string;
  key: string;
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

export function exportToExcel(
  filename: string,
  sheetName: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[]
): void {
  const data = rows.map((row) => {
    const obj: Record<string, string> = {};
    columns.forEach((col) => {
      const val = row[col.key];
      obj[col.header] = col.format ? col.format(val, row) : String(val ?? '');
    });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToPDF(
  filename: string,
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  subtitle?: string
): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 22);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, 14, 28);
    doc.setTextColor(0);
  }

  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, subtitle ? 33 : 28);

  const head = [columns.map((c) => c.header)];
  const body = rows.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      return col.format ? col.format(val, row) : String(val ?? '');
    })
  );

  autoTable(doc, {
    head,
    body,
    startY: subtitle ? 37 : 32,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

export function exportPayslipPDF(
  employeeName: string,
  employeeNumber: string,
  payPeriod: string,
  payslip: Record<string, unknown>,
  details: { label: string; amount: number }[]
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AB Rwanda PLC', 14, 14);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Payslip', 14, 21);

  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Pay Period: ${payPeriod}`, pageWidth - 14, 14, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 21, { align: 'right' });

  doc.setFontSize(11);
  doc.text(`Employee: ${employeeName}`, 14, 42);
  doc.text(`Employee No: ${employeeNumber}`, 14, 48);

  autoTable(doc, {
    head: [['Item', 'Amount (RWF)']],
    body: details.map((d) => [d.label, new Intl.NumberFormat('en-RW').format(d.amount)]),
    startY: 55,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: { 1: { halign: 'right' } },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Net Pay: ${new Intl.NumberFormat('en-RW').format(Number(payslip.net_pay ?? 0))} RWF`, 14, finalY + 15);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text('This is a computer-generated document. AB Rwanda PLC - HRIS.', pageWidth / 2, 285, { align: 'center' });

  doc.save(`payslip_${employeeNumber}_${payPeriod.replace(/\s/g, '_')}.pdf`);
}
