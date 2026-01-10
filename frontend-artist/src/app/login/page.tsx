'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';

export default function LoginPage() {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    const success = await login(code.trim());
    if (!success) {
      setError('Code invalide. Vérifiez votre code d\'accès.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Logo/Icon */}
      <div className="mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/70 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/30">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground mb-2">Espace Artiste</h1>
      <p className="text-secondary-500 text-center mb-8 max-w-xs">
        Entrez votre code d'accès pour consulter vos revenus et statistiques
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="mb-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE D'ACCÈS"
            className="w-full h-14 px-5 bg-background border-2 border-default-200 rounded-2xl text-center text-lg font-mono tracking-widest placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl">
            <p className="text-danger text-sm text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full h-14 bg-primary text-white font-semibold rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <Spinner size="sm" color="white" />
          ) : (
            <>
              <span>Accéder</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Help text */}
      <p className="mt-8 text-xs text-secondary-400 text-center max-w-xs">
        Votre code d'accès vous a été envoyé par votre label. Contactez-les si vous ne l'avez pas reçu.
      </p>
    </div>
  );
}
