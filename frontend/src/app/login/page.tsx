'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardBody, CardHeader, Input, Button, Spinner } from '@heroui/react';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Royalties Admin</h1>
          <p className="text-gray-500 mt-1">Gestion des royalties artistes</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border border-gray-100">
          <CardHeader className="flex flex-col gap-1 items-center pb-0 pt-8 px-8">
            <h2 className="text-xl font-semibold text-gray-900">Connexion</h2>
            <p className="text-sm text-gray-500">Accès administration label</p>
          </CardHeader>
          <CardBody className="gap-4 px-8 pb-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  value={email}
                  onValueChange={setEmail}
                  placeholder="admin@label.com"
                  isRequired
                  variant="bordered"
                  size="lg"
                  classNames={{
                    input: "text-gray-900",
                    inputWrapper: "border-gray-300 hover:border-gray-400 focus-within:!border-blue-500"
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                <Input
                  type="password"
                  value={password}
                  onValueChange={setPassword}
                  placeholder="••••••••"
                  isRequired
                  variant="bordered"
                  size="lg"
                  classNames={{
                    input: "text-gray-900",
                    inputWrapper: "border-gray-300 hover:border-gray-400 focus-within:!border-blue-500"
                  }}
                />
              </div>

              <Button
                type="submit"
                isLoading={loading}
                isDisabled={!email || !password}
                className="w-full bg-gray-900 text-white hover:bg-gray-800"
                size="lg"
              >
                Se connecter
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-8">
          Royalties Admin v1.0
        </p>
      </div>
    </div>
  );
}
