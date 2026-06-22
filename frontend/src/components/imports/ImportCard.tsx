'use client';

import { ImportRecord, SOURCES } from '@/lib/types';
import { Pill } from '@/components/roy/ui';
import { IconContract, IconChevronRight, IconCheck } from '@/components/roy/icons';

interface ImportCardProps {
  import_: ImportRecord;
  onClick?: () => void;
}

export default function ImportCard({ import_, onClick }: ImportCardProps) {
  const sourceLabel =
    SOURCES.find((s) => s.value === import_.source)?.label || import_.source;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isDone = import_.status === 'completed';

  const getStatusLabel = () => {
    switch (import_.status) {
      case 'completed':
        return 'Terminé';
      case 'failed':
        return 'Erreur';
      case 'pending':
        return 'En attente';
      case 'processing':
        return 'En cours';
      default:
        return import_.status;
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3 bg-surface hover:bg-surface-2 border border-line rounded-[12px] transition-colors hover:border-line-strong text-left my-1"
    >
      {/* File icon */}
      <div className="w-8 h-8 rounded-[9px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
        <IconContract size={16} />
      </div>

      {/* Date */}
      <span className="text-[12.5px] text-ink-faint w-24 shrink-0">
        {formatDate(import_.created_at)}
      </span>

      {/* Source */}
      <span className="text-[12.5px] font-semibold text-ink w-28 shrink-0 truncate">
        {sourceLabel}
      </span>

      {/* Status badge */}
      <Pill tone={isDone ? 'accent' : 'neutral'}>
        {isDone && <IconCheck size={11} />}
        {getStatusLabel()}
      </Pill>

      {/* Row count */}
      <span className="text-[12.5px] text-ink-muted ml-auto flex items-center gap-2">
        <span className="roy-num font-semibold text-ink">{import_.success_rows.toLocaleString('fr-FR')}</span>
        <span className="text-ink-faint">lignes</span>
        {import_.error_rows > 0 && (
          <span className="text-neg font-semibold">
            ({import_.error_rows} erreur{import_.error_rows > 1 ? 's' : ''})
          </span>
        )}
      </span>

      {/* Chevron */}
      <IconChevronRight size={16} className="text-ink-faint shrink-0" />
    </button>
  );
}
