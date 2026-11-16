import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal';
}

export function StatCard({ label, value, icon, trend, color = 'blue' }: StatCardProps) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {trend && (
            <p className={`mt-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value}
            </p>
          )}
        </div>
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
