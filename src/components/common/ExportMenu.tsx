import { Download, FileSpreadsheet, FileText, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '@/lib/export';
import { toast } from 'sonner';

interface ExportMenuProps<T> {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  disabled?: boolean;
}

export function ExportMenu<T>({ filename, title, subtitle, columns, rows, disabled }: ExportMenuProps<T>) {
  const guard = () => {
    if (!rows.length) {
      toast.error('There is nothing to export yet');
      return false;
    }
    return true;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Download report</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            if (!guard()) return;
            try {
              await exportToExcel(filename, title.slice(0, 28), columns, rows, { title, subtitle });
              toast.success('Excel workbook downloaded');
            } catch {
              toast.error('Could not generate the Excel file');
            }
          }}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (!guard()) return;
            try {
              exportToPdf(filename, title, subtitle ?? `${rows.length} records`, columns, rows);
              toast.success('PDF report downloaded');
            } catch {
              toast.error('Could not generate the PDF file');
            }
          }}
        >
          <FileText className="mr-2 h-4 w-4" />
          PDF document
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (!guard()) return;
            exportToCsv(filename, columns, rows);
            toast.success('CSV file downloaded');
          }}
        >
          <FileDown className="mr-2 h-4 w-4" />
          CSV data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
