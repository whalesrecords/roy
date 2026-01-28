'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import { Spinner } from '@heroui/react';
import { getArtistPromoSubmissions, PromoSubmission } from '@/lib/api';

const SOURCE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  submithub: { label: 'SubmitHub', emoji: '📊', color: 'from-blue-500 to-blue-600' },
  groover: { label: 'Groover', emoji: '🎵', color: 'from-purple-500 to-purple-600' },
  manual: { label: 'Manuel', emoji: '✍️', color: 'from-gray-500 to-gray-600' },
};

const getBadgeColor = (status: string): string => {
  const lower = status.toLowerCase();
  if (lower.includes('approved') || lower.includes('accepted') || lower.includes('added')) return 'bg-success/20 text-success';
  if (lower.includes('declined') || lower.includes('rejected')) return 'bg-danger/20 text-danger';
  if (lower.includes('listen')) return 'bg-primary/20 text-primary';
  if (lower.includes('playlist')) return 'bg-purple-500/20 text-purple-600';
  return 'bg-content2 text-foreground';
};

export default function MediaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { artist, loading: authLoading } = useAuth();
  const [submission, setSubmission] = useState<PromoSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (artist && params.id) {
      loadSubmission();
    }
  }, [artist, params.id]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      const submissions = await getArtistPromoSubmissions();
      const found = submissions.find(s => s.id === params.id);
      if (found) {
        setSubmission(found);
      } else {
        setError('Submission not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist || !submission) {
    return (
      <div className="min-h-screen bg-background safe-top safe-bottom">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => router.back()} className="text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-foreground">Media Details</h1>
          </div>
        </header>
        <main className="px-4 py-6">
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error || 'Not found'}</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const sourceInfo = SOURCE_LABELS[submission.source];
  const outlet = submission.outlet_name || submission.influencer_name || 'Unknown';
  const status = submission.action || submission.decision || 'Pending';

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-primary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground truncate">{submission.song_title}</h1>
            <p className="text-sm text-secondary-500 truncate">{outlet}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 pb-24 space-y-6">
        {/* Source Badge */}
        <div className="bg-background border border-divider rounded-2xl p-6">
          <p className="text-xs text-secondary-500 uppercase mb-3">Source</p>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${sourceInfo?.color || 'from-gray-400 to-gray-500'} text-white font-medium`}>
            <span className="text-xl">{sourceInfo?.emoji}</span>
            <span>{sourceInfo?.label}</span>
          </div>
        </div>

        {/* Status */}
        <div className="bg-background border border-divider rounded-2xl p-6">
          <p className="text-xs text-secondary-500 uppercase mb-3">Status</p>
          <span className={`inline-block px-4 py-2 rounded-full font-medium ${getBadgeColor(status)}`}>
            {status}
          </span>
        </div>

        {/* Outlet/Influencer */}
        <div className="bg-background border border-divider rounded-2xl p-6">
          <p className="text-xs text-secondary-500 uppercase mb-3">
            {submission.source === 'groover' ? 'Influencer' : 'Outlet'}
          </p>
          <p className="text-foreground font-medium">{outlet}</p>
          {submission.outlet_type && (
            <p className="text-sm text-secondary-500 mt-1">{submission.outlet_type}</p>
          )}
          {submission.influencer_type && (
            <p className="text-sm text-secondary-500 mt-1">{submission.influencer_type}</p>
          )}
        </div>

        {/* Dates */}
        {(submission.submitted_at || submission.responded_at) && (
          <div className="bg-background border border-divider rounded-2xl p-6">
            <p className="text-xs text-secondary-500 uppercase mb-3">Timeline</p>
            <div className="space-y-3">
              {submission.submitted_at && (
                <div>
                  <p className="text-xs text-secondary-500">Submitted</p>
                  <p className="text-foreground">
                    {new Date(submission.submitted_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
              {submission.responded_at && (
                <div>
                  <p className="text-xs text-secondary-500">Responded</p>
                  <p className="text-foreground">
                    {new Date(submission.responded_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        {submission.feedback && (
          <div className="bg-background border border-divider rounded-2xl p-6">
            <p className="text-xs text-secondary-500 uppercase mb-3">Feedback</p>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">{submission.feedback}</p>
          </div>
        )}

        {/* Links */}
        {(submission.campaign_url || submission.sharing_link) && (
          <div className="bg-background border border-divider rounded-2xl p-6">
            <p className="text-xs text-secondary-500 uppercase mb-3">Links</p>
            <div className="space-y-3">
              {submission.campaign_url && (
                <a
                  href={submission.campaign_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
                >
                  <span className="text-primary font-medium">Campaign URL</span>
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              {submission.sharing_link && (
                <a
                  href={submission.sharing_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-purple-500/10 rounded-xl hover:bg-purple-500/20 transition-colors"
                >
                  <span className="text-purple-600 font-medium">Sharing Link</span>
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Listen Time (SubmitHub only) */}
        {submission.listen_time && (
          <div className="bg-background border border-divider rounded-2xl p-6">
            <p className="text-xs text-secondary-500 uppercase mb-3">Listen Time</p>
            <p className="text-2xl font-bold text-foreground">
              {Math.floor(submission.listen_time / 60)}:{(submission.listen_time % 60).toString().padStart(2, '0')}
            </p>
            <p className="text-sm text-secondary-500 mt-1">minutes</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
