'use client';

import { ImportError } from '@/lib/types';

interface ImportErrorsProps {
  errors: ImportError[];
}

export default function ImportErrors({ errors }: ImportErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <div className="bg-red-50 rounded-xl p-4">
      <h3 className="font-medium text-red-800 mb-3">
        Erreurs ({errors.length})
      </h3>
      <ul className="space-y-2">
        {errors.map((error, index) => (
          <li key={index} className="text-sm text-red-700">
            <span className="font-medium">Ligne {error.row}</span>
            {error.field && (
              <span className="text-red-600"> - {error.field}</span>
            )}
            : {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
