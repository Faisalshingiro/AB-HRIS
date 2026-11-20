import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
  width?: number;
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportToExcel<T>(
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  meta?: { title?: string; subtitle?: string },
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AB Rwanda HRIS';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.header,
    width: col.width ?? Math.max(16, col.header.length + 4),
  }));

  let startRow = 1;
  if (meta?.title) {
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = meta.title;
    titleCell.font = { size: 14, bold: true };
    startRow = 2;
    if (meta.subtitle) {
      sheet.mergeCells(2, 1, 2, columns.length);
      const subCell = sheet.getCell(2, 1);
      subCell.value = meta.subtitle;
      subCell.font = { size: 10, color: { argb: 'FF666666' } };
      startRow = 3;
    }
    startRow += 1;
  }

  const headerRow = sheet.getRow(startRow);
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 20;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(startRow + 1 + rowIndex);
    columns.forEach((col, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      cell.value = col.accessor(row);
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (rowIndex % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });
  });

  sheet.views = [{ state: 'frozen', ySplit: startRow }];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `${filename}-${stamp()}.xlsx`);
}

export function exportToPdf<T>(
  filename: string,
  title: string,
  subtitle: string,
  columns: ExportColumn<T>[],
  rows: T[],
  options?: { orientation?: 'portrait' | 'landscape' },
): void {
  const doc = new jsPDF({ orientation: options?.orientation ?? 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 40, 46);

  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(subtitle, 40, 62);
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 40, 76);

  autoTable(doc, {
    startY: 92,
    head: [columns.map((col) => col.header)],
    body: rows.map((row) => columns.map((col) => String(col.accessor(row)))),
    styles: { fontSize: 8, cellPadding: 5, textColor: [30, 30, 30], lineColor: [225, 225, 225], lineWidth: 0.5 },
    headStyles: { fillColor: [26, 26, 26], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${filename}-${stamp()}.pdf`);
}

export function exportToCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[]): void {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    columns.map((col) => escape(col.header)).join(','),
    ...rows.map((row) => columns.map((col) => escape(col.accessor(row))).join(',')),
  ];
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}-${stamp()}.csv`);
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
