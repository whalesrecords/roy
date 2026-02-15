'use client';

export default function EmptyState() {
  return (
    <div className="bg-background border border-divider rounded-2xl shadow-sm py-16 px-6">
      <div className="text-center max-w-sm mx-auto">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">
          Aucun import
        </h3>
        <p className="text-secondary-500 mb-6">
          Commencez par uploader un fichier CSV de vos ventes pour voir apparaitre vos imports ici.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-secondary-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Formats supportés: CSV, TSV
        </div>
      </div>
    </div>
  );
}
