'use client';

import { Chip } from '@heroui/react';
import { ImportStatus, STATUS_LABELS } from '@/lib/types';

interface StatusBadgeProps {
  status: ImportStatus;
}

const statusColorMap: Record<ImportStatus, 'success' | 'warning' | 'danger' | 'default' | 'primary'> = {
  completed: 'success',
  pending: 'warning',
  processing: 'primary',
  failed: 'danger',
  partial: 'warning',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Chip
      size="sm"
      color={statusColorMap[status] || 'default'}
      variant="flat"
    >
      {STATUS_LABELS[status]}
    </Chip>
  );
}
