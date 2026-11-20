export type PersonLike = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
};

export function initials(
  firstOrPerson?: string | PersonLike | null,
  lastName?: string | null,
): string {
  if (!firstOrPerson) return 'AB';
  if (typeof firstOrPerson === 'object') {
    const f = (firstOrPerson.first_name ?? '').trim().charAt(0).toUpperCase();
    const l = (firstOrPerson.last_name ?? '').trim().charAt(0).toUpperCase();
    if (f || l) return (f + l) || 'AB';
    const fn = (firstOrPerson.full_name ?? firstOrPerson.name ?? '').trim();
    if (fn) {
      const parts = fn.split(/\s+/);
      return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
    }
    return 'AB';
  }
  const f = firstOrPerson.trim().charAt(0).toUpperCase();
  const l = (lastName ?? '').trim().charAt(0).toUpperCase();
  return (f + l) || 'AB';
}

export function fullName(
  firstOrPerson?: string | PersonLike | null,
  lastName?: string | null,
): string {
  if (!firstOrPerson) return '';
  if (typeof firstOrPerson === 'object') {
    if (firstOrPerson.first_name || firstOrPerson.last_name) {
      return [firstOrPerson.first_name, firstOrPerson.last_name].filter(Boolean).join(' ').trim() || '';
    }
    return firstOrPerson.full_name ?? firstOrPerson.name ?? '';
  }
  const parts = [firstOrPerson, lastName].filter(Boolean).map((s) => String(s).trim());
  return parts.join(' ') || '';
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return '';
  if (typeof value === 'string' && value.includes(':') && !value.includes('T')) {
    return value.slice(0, 5);
  }
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RWF(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 RWF';
  return `${Math.round(amount).toLocaleString('en-US')} RWF`;
}

export function compactRWF(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 RWF';
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M RWF`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}k RWF`;
  }
  return `${amount} RWF`;
}

export function percent(numeratorOrVal?: number | string | null, denominator?: number | null): string {
  if (numeratorOrVal === undefined || numeratorOrVal === null) {
    return '0%';
  }
  if (typeof numeratorOrVal === 'string') {
    const cleaned = numeratorOrVal.trim().replace(/%+$/, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return '0%';
    return `${Math.round(num)}%`;
  }
  if (isNaN(numeratorOrVal)) {
    return '0%';
  }
  if (denominator !== undefined && denominator !== null) {
    if (!denominator || isNaN(denominator)) return '0%';
    return `${Math.round((numeratorOrVal / denominator) * 100)}%`;
  }
  return `${Math.round(numeratorOrVal)}%`;
}

export function titleCase(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

export function toISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function daysBetween(from: string | Date, to: string | Date): number {
  const d1 = typeof from === 'string' ? new Date(from) : from;
  const d2 = typeof to === 'string' ? new Date(to) : to;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function monthLabel(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
