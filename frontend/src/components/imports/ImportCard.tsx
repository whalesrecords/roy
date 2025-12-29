'use client';

import { ImportRecord, SOURCES } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';

interface ImportCardProps {
  import_: ImportRecord;
  onClick?: () => void;
}

export default function ImportCard({ import_, onClick }: ImportCardProps) {
  const sourceLabel =
    SOURCES.find((s) => s.value === import_.source)?.label || import_.source;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-neutral-200 p-4 hover:border-neutral-300 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-neutral-900">{sourceLabel}</span>
            <StatusBadge status={import_.status} />
          </div>
          <p className="text-sm text-neutral-500 truncate">{import_.filename}</p>
          <p className="text-sm text-neutral-500 mt-1">
            {formatPeriod(import_.period_start, import_.period_end)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm text-neutral-500">
            {formatDate(import_.created_at)}
          </p>
          <p className="text-sm text-neutral-700 mt-1">
            {import_.success_rows.toLocaleString('fr-FR')} lignes
          </p>
        </div>
      </div>

      {import_.error_rows > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-100">
          <p className="text-sm text-red-600">
            {import_.error_rows} erreur{import_.error_rows > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </button>
  );
}
