'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-background">
      {/* Icon */}
      <div className="mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-900/30">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-1">Portail Artiste</h1>
      <p className="text-default-500 text-sm text-center mb-8 max-w-xs">
        Consultez vos revenus et statistiques
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            className="w-full h-12 px-4 bg-content1 border border-divider rounded-2xl text-base placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors"
            autoComplete="email"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-12 px-4 bg-content1 border border-divider rounded-2xl text-base placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
            <p className="text-danger text-sm text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password.trim()}
          className="w-full h-12 bg-primary text-white font-semibold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <Spinner size="sm" color="white" />
          ) : (
            <>
              <span>Se connecter</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-xs text-default-400 text-center max-w-xs">
        Vos identifiants vous ont été envoyés par votre label. Contactez-les si vous ne les avez pas reçus.
      </p>
    </div>
  );
}
