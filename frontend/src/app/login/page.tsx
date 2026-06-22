'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { Card, Eyebrow, AccentButton } from '@/components/roy/ui';
import { IconMusic, IconLogout } from '@/components/roy/icons';

export default function LoginPage() {
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo / Header */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-accent text-accent-ink rounded-[14px] mx-auto mb-5 flex items-center justify-center shadow-roy">
            <IconMusic size={26} />
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">Royalties Admin</h1>
          <p className="text-[12.5px] text-ink-faint mt-1.5">Gestion des royalties artistes</p>
        </div>

        {/* Login Card */}
        <Card className="!p-7">
          <div className="text-center mb-6">
            <h2 className="text-[16px] font-bold text-ink">Connexion</h2>
            <p className="text-[12px] text-ink-faint mt-1">Accès administration label</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-surface-2 border border-line rounded-[12px] text-neg px-4 py-3 text-[12.5px] flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <div>
              <Eyebrow className="mb-1.5 block">Email</Eyebrow>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@label.com"
                required
                className="w-full h-12 px-4 rounded-[10px] border border-line bg-surface text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
              />
            </div>

            <div>
              <Eyebrow className="mb-1.5 block">Mot de passe</Eyebrow>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-12 px-4 rounded-[10px] border border-line bg-surface text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
              />
            </div>

            <AccentButton
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-12"
            >
              {loading ? (
                <Spinner size="sm" color="white" />
              ) : (
                <>
                  <IconLogout size={18} />
                  Se connecter
                </>
              )}
            </AccentButton>
          </form>
        </Card>

        <p className="text-center text-[11px] text-ink-faint mt-7">
          Royalties Admin v1.0
        </p>
      </div>
    </div>
  );
}
