'use client';

import { ImportStatus, STATUS_LABELS } from '@/lib/types';

interface StatusBadgeProps {
  status: ImportStatus;
}

// Token-based pill styling. Positive/in-progress states use the accent-soft pill,
// failures use the negative tone, everything else falls back to a neutral pill.
const statusToneMap: Record<ImportStatus, string> = {
  completed: 'bg-accent-soft text-accent',
  pending: 'bg-surface-2 text-ink-muted',
  processing: 'bg-accent-soft text-accent',
  failed: 'bg-surface-2 text-neg',
  partial: 'bg-surface-2 text-ink-muted',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const tone = statusToneMap[status] || 'bg-surface-2 text-ink-muted';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold ${tone}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
