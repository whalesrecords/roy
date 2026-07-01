'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import { Card, Eyebrow, AccentButton } from '@/components/roy/ui';
import { IconMusic, IconArrowUp } from '@/components/roy/icons';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    const success = await login(email.trim(), password);
    if (!success) setError('Email ou mot de passe incorrect.');
    setLoading(false);
  };

  const inputClass =
    'w-full px-4 py-3 bg-surface border border-line rounded-[12px] text-ink text-[14px] placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center px-6 py-12">
      <Card className="w-full max-w-[380px] rounded-[20px] p-7">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-[16px] bg-accent text-accent-ink flex items-center justify-center shadow-roy">
            <IconMusic size={26} />
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink mt-4">Portail Artiste</h1>
          <p className="text-[12.5px] text-ink-faint mt-1 max-w-[260px]">
            Consultez vos revenus et statistiques
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Eyebrow>Email</Eyebrow>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className={inputClass}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Eyebrow>Mot de passe</Eyebrow>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div role="alert" aria-live="assertive" className="p-3 rounded-[12px] bg-neg/10 border border-neg/20">
              <p className="text-neg text-[13px] text-center">{error}</p>
            </div>
          )}

          <AccentButton
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full py-3"
          >
            {loading ? (
              <Spinner size="sm" color="white" />
            ) : (
              <>
                <span>Se connecter</span>
                <IconArrowUp size={15} className="rotate-90" />
              </>
            )}
          </AccentButton>
        </form>
      </Card>

      <p className="mt-6 text-[11.5px] text-ink-faint text-center max-w-[320px]">
        Vos identifiants vous ont été envoyés par votre label. Contactez-les si vous ne les avez pas reçus.
      </p>
    </div>
  );
}
