'use client';

import { Card } from '@/components/roy/ui';
import { IconImport } from '@/components/roy/icons';

export default function EmptyState() {
  return (
    <Card className="py-16 px-6">
      <div className="text-center max-w-sm mx-auto">
        <div className="w-16 h-16 mx-auto mb-6 rounded-[16px] bg-accent-soft text-accent flex items-center justify-center">
          <IconImport size={28} />
        </div>
        <h3 className="text-[16px] font-bold text-ink mb-2">
          Aucun import
        </h3>
        <p className="text-[13px] text-ink-faint mb-6">
          Commencez par uploader un fichier CSV de vos ventes pour voir apparaitre vos imports ici.
        </p>
        <div className="flex items-center justify-center gap-2 text-[12px] text-ink-faint">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Formats supportés: CSV, TSV
        </div>
      </div>
    </Card>
  );
}
