'use client';

import { ImportError } from '@/lib/types';

interface ImportErrorsProps {
  errors: ImportError[];
}

export default function ImportErrors({ errors }: ImportErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <div className="rounded-[12px] border border-line bg-surface-2 p-4">
      <h3 className="text-[13.5px] font-semibold text-neg mb-3">
        Erreurs ({errors.length})
      </h3>
      <ul className="space-y-2">
        {errors.map((error, index) => (
          <li key={index} className="text-[12.5px] text-ink-muted">
            <span className="font-semibold text-ink">Ligne {error.row}</span>
            {error.field && (
              <span className="text-ink-faint"> · {error.field}</span>
            )}
            : {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
