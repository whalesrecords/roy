'use client';

import { useState, useEffect } from 'react';
import { AccentButton, OutlineButton } from '@/components/roy/ui';
import {
  PreviewResponse,
  ColumnMapping,
  NormalizedField,
  NORMALIZED_FIELDS,
} from '@/lib/types';
import { getImportPreview, saveMapping } from '@/lib/api';

interface MappingStepProps {
  importId: string;
  filename: string;
  onBack: () => void;
  onComplete: () => void;
}

const guessMapping = (column: string): NormalizedField | null => {
  const lower = column.toLowerCase().replace(/[_\s-]/g, '');

  if (lower.includes('artist') || lower.includes('artiste')) return 'artist_name';
  if (lower.includes('track') || lower.includes('song') || lower.includes('titre') || lower.includes('morceau')) return 'track_title';
  if (lower.includes('release') || lower.includes('album')) return 'release_title';
  if (lower.includes('isrc')) return 'isrc';
  if (lower.includes('upc') || lower.includes('ean')) return 'upc';
  if (lower.includes('country') || lower.includes('territory') || lower.includes('pays')) return 'territory';
  if (lower.includes('store') || lower.includes('platform') || lower.includes('plateforme')) return 'store';
  if (lower.includes('saletype') || lower.includes('type')) return 'sale_type';
  if (lower.includes('quantity') || lower.includes('units') || lower.includes('quantite')) return 'quantity';
  if (lower.includes('amount') || lower.includes('earned') || lower.includes('revenue') || lower.includes('montant')) return 'gross_amount';
  if (lower.includes('currency') || lower.includes('devise')) return 'currency';
  if (lower.includes('periodstart') || lower.includes('startdate')) return 'period_start';
  if (lower.includes('periodend') || lower.includes('enddate')) return 'period_end';

  return null;
};

export default function MappingStep({
  importId,
  filename,
  onBack,
  onComplete,
}: MappingStepProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, [importId]);

  const loadPreview = async () => {
    try {
      const data = await getImportPreview(importId);
      setPreview(data);

      const initialMappings: ColumnMapping[] = data.columns.map((col) => ({
        source_column: col,
        target_field: guessMapping(col),
      }));
      setMappings(initialMappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (sourceColumn: string, targetField: NormalizedField | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.source_column === sourceColumn
          ? { ...m, target_field: targetField }
          : m
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      await saveMapping(importId, mappings);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const getPreviewValues = (column: string): string[] => {
    if (!preview) return [];
    return preview.rows
      .slice(0, 3)
      .map((row) => row[column])
      .filter(Boolean);
  };

  const getMappedCount = () => {
    return mappings.filter((m) => m.target_field !== null).length;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface border border-line rounded-[16px] shadow-roy p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-[13px] text-ink-muted">Chargement de l'aperçu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-surface border border-line w-full sm:max-w-lg sm:rounded-[16px] rounded-t-[16px] shadow-roy max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-surface border-b border-line px-4 py-4 sm:px-6 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold text-ink">
              Mapping des colonnes
            </h2>
            <button
              onClick={onBack}
              className="p-2 -mr-2 text-ink-faint hover:text-ink transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-2 text-ink-faint text-[11px] font-semibold">
              1
            </div>
            <span className="text-[13px] text-ink-faint">Fichier</span>
            <div className="flex-1 h-px bg-line mx-2" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-accent-ink text-[11px] font-semibold">
              2
            </div>
            <span className="text-[13px] font-semibold text-ink">Mapping</span>
          </div>
          <p className="text-[12.5px] text-ink-faint mt-3">
            {filename} - <span className="roy-num">{preview?.total_rows.toLocaleString('fr-FR')}</span> lignes
          </p>
          <p className="text-[12.5px] text-ink-muted mt-1">
            {getMappedCount()} / {mappings.length} colonnes mappées
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <p className="text-[13px] text-neg bg-surface-2 border border-line rounded-[10px] px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="space-y-3">
            {mappings.map((mapping) => {
              const previewValues = getPreviewValues(mapping.source_column);
              const isExpanded = expandedColumn === mapping.source_column;

              return (
                <div
                  key={mapping.source_column}
                  className="bg-surface-2 border border-line rounded-[12px] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() =>
                          setExpandedColumn(
                            isExpanded ? null : mapping.source_column
                          )
                        }
                        className="text-left w-full"
                      >
                        <p className="text-[13.5px] font-semibold text-ink truncate">
                          {mapping.source_column}
                        </p>
                        {!isExpanded && previewValues.length > 0 && (
                          <p className="text-[11px] text-ink-faint truncate mt-0.5">
                            ex: {previewValues[0]}
                          </p>
                        )}
                      </button>
                    </div>
                    <div className="w-40 shrink-0">
                      <select
                        value={mapping.target_field || ''}
                        onChange={(e) =>
                          updateMapping(
                            mapping.source_column,
                            (e.target.value as NormalizedField) || null
                          )
                        }
                        className="w-full h-10 px-3 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                      >
                        <option value="">— Ignorer —</option>
                        {NORMALIZED_FIELDS.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isExpanded && previewValues.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-line">
                      <p className="text-[11px] text-ink-faint mb-2">
                        Aperçu des valeurs :
                      </p>
                      <ul className="space-y-1">
                        {previewValues.map((val, i) => (
                          <li
                            key={i}
                            className="text-[13px] text-ink-muted bg-surface border border-line rounded-[8px] px-2 py-1"
                          >
                            {val}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-line p-4 sm:p-6 flex gap-3">
          <OutlineButton onClick={onBack} className="flex-1 justify-center">
            Retour
          </OutlineButton>
          <AccentButton onClick={handleSave} disabled={saving} className="flex-1">
            Valider le mapping
          </AccentButton>
        </div>
      </div>
    </div>
  );
}
