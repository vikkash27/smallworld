'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/ui/discovery/primitives';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/platform/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? 'Sign in failed.');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center p-8">
      <h1 className="text-2xl font-semibold">Small World</h1>
      <p className="mt-2 text-sm text-gray-600">Organizer sign in</p>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-[#4334F5] focus:outline-none"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
