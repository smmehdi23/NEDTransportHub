import { useState, type FormEvent } from 'react';
import { adminApi, type AdminUser } from '../api';
import { Badge, BrandMark, Button, Icon } from '../ui';

export function LoginPage({ onSuccess }: { onSuccess: (admin: AdminUser) => void }) {
  const [email, setEmail] = useState('admin@neduet.edu.pk');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const admin = await adminApi.login(email, password);
      onSuccess(admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-brand to-brand-strong p-14 text-white lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark size={40} onDark />
          <b className="text-lg">NED Transport Hub</b>
        </div>
        <div>
          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Keep every campus ride safe and on time.
          </h1>
          <p className="mt-4 max-w-md text-white/75">
            Verify NED drivers, monitor live rides, manage user accounts, and respond to SOS alerts
            and incident reports from one place.
          </p>
        </div>
        <div className="flex gap-10">
          {[
            ['Live', 'Neon PostgreSQL'],
            ['24/7', 'SOS & Incident Ops'],
            ['1-Click', 'Driver Verification'],
          ].map(([a, b]) => (
            <div key={b}>
              <div className="text-2xl font-bold">{a}</div>
              <div className="text-sm text-white/60">{b}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center bg-white p-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <Badge tone="info">Admin portal</Badge>
          <div>
            <h2 className="text-3xl font-bold">Welcome back</h2>
            <p className="mt-1 text-sm text-ink2">
              Sign in with your NED transport administrator account.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-2xl bg-danger-subtle p-3 text-sm text-danger">
              <Icon n="CircleAlert" size={18} />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink2">Staff email</span>
            <span className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-canvas/50 px-4 focus-within:border-brand focus-within:bg-white">
              <Icon n="Mail" size={18} className="text-[#4a7de2]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                placeholder="admin@neduet.edu.pk"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink2">Password</span>
            <span className="flex h-12 items-center gap-3 rounded-2xl border border-line bg-canvas/50 px-4 focus-within:border-brand focus-within:bg-white">
              <Icon n="Lock" size={18} className="text-[#4a7de2]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                placeholder="Enter admin password"
              />
            </span>
          </label>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Signing in...' : 'Sign in to dashboard'}
          </Button>

          <p className="flex items-center gap-2 text-xs text-ink3">
            <Icon n="Lock" size={14} />
            Access is limited to NED transport staff. Connected to live API.
          </p>
        </form>
      </div>
    </div>
  );
}
