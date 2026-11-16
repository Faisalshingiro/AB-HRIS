import { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  actions?: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  emptyMessage = 'No records found',
  actions,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="table-wrapper">
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="table-wrapper">
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const allColumns = [...columns];
  if (actions) {
    allColumns.push({ key: 'actions', header: 'Actions', render: (row) => actions(row), className: 'text-right whitespace-nowrap' });
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            {allColumns.map((col) => (
              <th key={col.key} className={col.className}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {allColumns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
