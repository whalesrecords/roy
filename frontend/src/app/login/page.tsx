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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-col gap-1 items-center pb-0 pt-6">
            <h1 className="text-2xl font-bold">Connexion</h1>
            <p className="text-sm text-default-500">Accès administration label</p>
          </CardHeader>
          <CardBody className="gap-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-danger-50 text-danger-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                type="email"
                label="Email"
                labelPlacement="outside"
                value={email}
                onValueChange={setEmail}
                placeholder="admin@label.com"
                isRequired
                variant="bordered"
              />

              <Input
                type="password"
                label="Mot de passe"
                labelPlacement="outside"
                value={password}
                onValueChange={setPassword}
                placeholder="••••••••"
                isRequired
                variant="bordered"
              />

              <Button
                type="submit"
                color="primary"
                isLoading={loading}
                isDisabled={!email || !password}
                className="w-full"
              >
                Se connecter
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="text-center text-xs text-neutral-400 mt-4">
          Royalties Admin
        </p>
      </div>
    </div>
  );
}
