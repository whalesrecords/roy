'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { getArtistPromoSubmissions, PromoSubmission } from '@/lib/api';
import { Card, Eyebrow, Pill } from '@/components/roy/ui';
import { IconChevronLeft } from '@/components/roy/icons';

const SOURCE_LABELS: Record<string, { label: string; emoji: string }> = {
  submithub: { label: 'SubmitHub', emoji: '📊' },
  groover: { label: 'Groover', emoji: '🎵' },
  manual: { label: 'Manuel', emoji: '✍️' },
};

const getBadgeTone = (status: string): 'accent' | 'neutral' | 'neg' => {
  const lower = status.toLowerCase();
  if (lower.includes('approved') || lower.includes('accepted') || lower.includes('added')) return 'accent';
  if (lower.includes('declined') || lower.includes('rejected')) return 'neg';
  if (lower.includes('listen')) return 'accent';
  if (lower.includes('playlist')) return 'accent';
  return 'neutral';
};

function StatusBadge({ status }: { status: string }) {
  const tone = getBadgeTone(status);
  if (tone === 'neg') {
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold bg-neg/10 text-neg">{status}</span>;
  }
  return <Pill tone={tone}>{status}</Pill>;
}

const parseSharingLinks = (sharingLink: string): { url: string; platform: string; emoji: string }[] => {
  const urls = sharingLink.split(',').map(url => url.trim()).filter(url => url.length > 0);

  return urls.map(url => {
    if (url.includes('spotify.com')) {
      return { url, platform: 'Spotify', emoji: '🎵' };
    } else if (url.includes('apple.com') || url.includes('music.apple')) {
      return { url, platform: 'Apple Music', emoji: '🍎' };
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return { url, platform: 'YouTube', emoji: '📺' };
    } else if (url.includes('deezer.com')) {
      return { url, platform: 'Deezer', emoji: '🎧' };
    } else if (url.includes('soundcloud.com')) {
      return { url, platform: 'SoundCloud', emoji: '☁️' };
    } else if (url.includes('tidal.com')) {
      return { url, platform: 'Tidal', emoji: '🌊' };
    } else if (url.includes('instagram.com')) {
      return { url, platform: 'Instagram', emoji: '📸' };
    } else if (url.includes('tiktok.com')) {
      return { url, platform: 'TikTok', emoji: '🎬' };
    } else {
      return { url, platform: 'Link', emoji: '🔗' };
    }
  });
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
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!artist || !submission) {
    return (
      <div className="min-h-screen bg-app">
        {/* Desktop topbar */}
        <div className="hidden lg:flex items-center gap-3 px-7 py-[22px] border-b border-line">
          <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-full text-ink-muted hover:bg-surface-2 transition-colors">
            <IconChevronLeft size={20} />
          </button>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Media Details</div>
        </div>
        <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto">
          {/* Mobile back */}
          <button onClick={() => router.back()} className="lg:hidden inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent mb-4">
            <IconChevronLeft size={16} /> Back
          </button>
          <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm">{error || 'Not found'}</div>
        </main>
      </div>
    );
  }

  const sourceInfo = SOURCE_LABELS[submission.source];
  const outlet = submission.outlet_name || submission.influencer_name || 'Unknown';
  const status = submission.action || submission.decision || 'Pending';

  return (
    <div className="min-h-screen bg-app">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center gap-3 px-7 py-[22px] border-b border-line">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-full text-ink-muted hover:bg-surface-2 transition-colors">
          <IconChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink truncate">{submission.song_title}</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5 truncate">{outlet}</div>
        </div>
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-3 lg:space-y-4">
        {/* Mobile header */}
        <div className="lg:hidden">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent mb-3">
            <IconChevronLeft size={16} /> Back
          </button>
          <div className="text-[22px] font-bold tracking-[-0.01em] text-ink truncate">{submission.song_title}</div>
          <div className="text-[13px] text-ink-muted truncate">{outlet}</div>
        </div>

        {/* Source */}
        <Card>
          <Eyebrow>Source</Eyebrow>
          <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-surface-2 text-ink font-semibold text-[13px]">
            <span className="text-lg">{sourceInfo?.emoji}</span>
            <span>{sourceInfo?.label || submission.source}</span>
          </div>
        </Card>

        {/* Status */}
        <Card>
          <Eyebrow>Status</Eyebrow>
          <div className="mt-3"><StatusBadge status={status} /></div>
        </Card>

        {/* Outlet/Influencer */}
        <Card>
          <Eyebrow>{submission.source === 'groover' ? 'Influencer' : 'Outlet'}</Eyebrow>
          <p className="text-ink font-semibold mt-3">{outlet}</p>
          {submission.outlet_type && (
            <p className="text-[13px] text-ink-faint mt-1">{submission.outlet_type}</p>
          )}
          {submission.influencer_type && (
            <p className="text-[13px] text-ink-faint mt-1">{submission.influencer_type}</p>
          )}
        </Card>

        {/* Dates */}
        {(submission.submitted_at || submission.responded_at) && (
          <Card>
            <Eyebrow>Timeline</Eyebrow>
            <div className="space-y-3 mt-3">
              {submission.submitted_at && (
                <div>
                  <p className="text-[11.5px] text-ink-faint">Submitted</p>
                  <p className="text-ink text-[14px]">
                    {new Date(submission.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
              {submission.responded_at && (
                <div>
                  <p className="text-[11.5px] text-ink-faint">Responded</p>
                  <p className="text-ink text-[14px]">
                    {new Date(submission.responded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Feedback */}
        {submission.feedback && (
          <Card>
            <Eyebrow>Feedback</Eyebrow>
            <p className="text-ink text-[14px] whitespace-pre-wrap leading-relaxed mt-3">{submission.feedback}</p>
          </Card>
        )}

        {/* Sharing Links */}
        {submission.sharing_link && (() => {
          const links = parseSharingLinks(submission.sharing_link);
          return (
            <Card>
              <Eyebrow>{links.length > 1 ? 'Links' : 'Link'}</Eyebrow>
              <div className="space-y-3 mt-3">
                {links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3.5 bg-surface-2 rounded-[14px] hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-soft shrink-0">
                      <span className="text-lg">{link.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink font-semibold text-[14px]">{link.platform}</p>
                      <p className="text-[11.5px] text-ink-faint truncate">{link.url}</p>
                    </div>
                    <svg className="w-5 h-5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ))}
              </div>
            </Card>
          );
        })()}

        {/* Listen Time */}
        {submission.listen_time && (
          <Card>
            <Eyebrow>Listen Time</Eyebrow>
            <p className="roy-num text-[30px] font-bold text-ink leading-none mt-2.5">
              {Math.floor(submission.listen_time / 60)}:{(submission.listen_time % 60).toString().padStart(2, '0')}
            </p>
            <p className="text-[13px] text-ink-faint mt-1">minutes</p>
          </Card>
        )}
      </main>
    </div>
  );
}
