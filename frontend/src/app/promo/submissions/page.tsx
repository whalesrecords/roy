'use client';

import { useState, useEffect } from 'react';
import { Spinner, Badge } from '@heroui/react';
import { getPromoSubmissions, PromoSubmission } from '@/lib/api';
import Link from 'next/link';

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  submithub: { label: 'SubmitHub', color: 'bg-blue-100 text-blue-800' },
  groover: { label: 'Groover', color: 'bg-purple-100 text-purple-800' },
  manual: { label: 'Manuel', color: 'bg-gray-100 text-gray-800' },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  listen: { label: 'Écouté', color: 'bg-blue-100 text-blue-800' },
  declined: { label: 'Refusé', color: 'bg-red-100 text-red-800' },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800' },
  shared: { label: 'Partagé', color: 'bg-purple-100 text-purple-800' },
};

export default function PromoSubmissionsPage() {
  const [submissions, setSubmissions] = useState<PromoSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const result = await getPromoSubmissions({ limit: 100 });
      setSubmissions(result.submissions);
    } catch (err: any) {
      console.error('Error loading promo submissions:', err);
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Submissions Promo</h1>
          <p className="text-gray-600">
            {submissions.length} submission{submissions.length > 1 ? 's' : ''}
          </p>
        </div>

        <Link
          href="/promo/import"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Importer CSV
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">Aucune submission promo</p>
          <Link
            href="/promo/import"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Importer maintenant
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Song
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Outlet / Influencer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {submissions.map((sub) => {
                const sourceInfo = SOURCE_LABELS[sub.source] || { label: sub.source, color: 'bg-gray-100 text-gray-800' };
                const status = sub.action || sub.decision || '-';
                const statusInfo = ACTION_LABELS[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
                const outlet = sub.outlet_name || sub.influencer_name || '-';

                return (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{sub.song_title}</div>
                      {sub.feedback && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {sub.feedback.substring(0, 60)}
                          {sub.feedback.length > 60 && '...'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{outlet}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${sourceInfo.color}`}>
                        {sourceInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('fr-FR') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
