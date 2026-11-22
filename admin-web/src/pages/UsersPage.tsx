import { useEffect, useState } from 'react';
import { adminApi, type AdminUser, type RatingSummary } from '../api';
import { Avatar, Badge, Button, Icon, Panel, cx, formatDateTime } from '../ui';

export function UsersPage() {
  const [filter, setFilter] = useState<'All' | 'Riders' | 'Drivers' | 'Suspended'>('All');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUsers({
        role: filter === 'Riders' ? 'rider' : filter === 'Drivers' ? 'driver' : undefined,
        status: filter === 'Suspended' ? 'suspended' : undefined,
        search: search.trim() || undefined,
      });
      setUsers(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [filter, search]);

  useEffect(() => {
    if (!selected) {
      setRating(null);
      return;
    }
    adminApi
      .getUserRating(selected.id)
      .then(setRating)
      .catch(() => setRating(null));
  }, [selected?.id]);

  const handleToggleStatus = async (u: AdminUser) => {
    if (u.account_status === 'active') {
      setSuspendReason('');
      setSuspendTarget(u);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.updateUserStatus(u.id, 'active');
      setSelected(updated);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reinstate user');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) {
      setError('Please enter a reason for suspending this account.');
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await adminApi.updateUserStatus(
        suspendTarget.id,
        'suspended',
        suspendReason.trim(),
      );
      setSelected(updated);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSuspendTarget(null);
      setSuspendReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not suspend user');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = 'ID,Name,Email,Phone,Department,Role,DriverVerified,Status\n';
    const body = users
      .map((u) =>
        [
          u.id,
          `"${u.name.replace(/"/g, '""')}"`,
          u.email,
          u.phone ?? '',
          `"${(u.department ?? '').replace(/"/g, '""')}"`,
          u.role,
          u.is_driver_verified,
          u.account_status,
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ned-transport-users.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button small v="secondary" icon="ChevronLeft" onClick={() => setSelected(null)}>
            Back to users
          </Button>
          {selected.role !== 'admin' && (
            <Button
              small
              v={selected.account_status === 'active' ? 'danger' : 'primary'}
              icon={selected.account_status === 'active' ? 'Ban' : 'Check'}
              disabled={busy}
              onClick={() => handleToggleStatus(selected)}
            >
              {selected.account_status === 'active' ? 'Suspend user' : 'Reinstate user'}
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-danger-subtle p-3 text-sm text-danger">{error}</div>
        )}

        <Panel>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={selected.name} size={64} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 text-lg font-bold">
                {selected.name}
                <Badge tone={selected.account_status === 'active' ? 'success' : 'danger'}>
                  {selected.account_status}
                </Badge>
                <Badge tone={selected.role === 'driver' ? 'info' : 'neutral'}>{selected.role}</Badge>
              </div>
              <div className="text-sm text-ink2">{selected.email}</div>
              <div className="text-sm text-ink2">
                {selected.department || 'No department'} · {selected.phone || 'No phone'} · Joined{' '}
                {formatDateTime(selected.created_at)}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-canvas p-3">
              <div className="text-xl font-bold">
                {selected.is_email_verified ? 'Verified' : 'Pending'}
              </div>
              <div className="text-xs text-ink2">NED Email Status</div>
            </div>
            <div className="rounded-2xl bg-canvas p-3">
              <div className="text-xl font-bold">
                {selected.is_driver_verified ? 'Approved' : 'Rider Only'}
              </div>
              <div className="text-xs text-ink2">Driver Verification</div>
            </div>
            <div className="rounded-2xl bg-canvas p-3">
              <div className="text-xl font-bold">
                {rating?.average ? `${rating.average.toFixed(1)} (${rating.count})` : 'No ratings'}
              </div>
              <div className="text-xs text-ink2">Average Rating</div>
            </div>
          </div>

          {selected.status_reason && (
            <div className="mt-4 rounded-2xl bg-danger-subtle p-3 text-sm text-danger">
              <b>Suspension reason:</b> {selected.status_reason}
            </div>
          )}
        </Panel>

        {suspendTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-ink">Suspend {suspendTarget.name}?</h3>
                <button
                  type="button"
                  onClick={() => setSuspendTarget(null)}
                  className="rounded-full p-1.5 text-ink3 hover:bg-canvas"
                >
                  <Icon n="X" size={18} />
                </button>
              </div>
              <p className="text-sm text-ink2">
                This will immediately end all active sessions and log the user out of the mobile
                app.
              </p>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter reason for suspension..."
                className="h-24 w-full resize-none rounded-2xl border border-line bg-canvas/50 p-3 text-sm outline-none focus:border-brand focus:bg-white"
              />
              <div className="flex justify-end gap-2">
                <Button small v="secondary" onClick={() => setSuspendTarget(null)}>
                  Cancel
                </Button>
                <Button
                  small
                  v="danger"
                  disabled={busy || !suspendReason.trim()}
                  onClick={handleConfirmSuspend}
                >
                  {busy ? 'Suspending...' : 'Confirm Suspend'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex h-10 w-72 items-center gap-2 rounded-xl border border-line px-3">
          <Icon n="Search" size={16} className="text-ink3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="flex-1 text-sm outline-none"
          />
        </label>
        <div className="flex rounded-xl bg-canvas p-1 text-sm font-semibold">
          {(['All', 'Riders', 'Drivers', 'Suspended'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cx(
                'rounded-lg px-3 py-1.5',
                filter === t ? 'bg-white text-brand shadow-xs' : 'text-ink2',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink3">{total} users</span>
        <Button small v="secondary" icon="Download" className="ml-auto" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-danger-subtle p-3 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <p className="py-10 text-center text-ink2">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="py-10 text-center text-ink2">No users match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ink3">
              <tr>
                <th className="pb-3">User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size={34} />
                      <div>
                        <b>{u.name}</b>
                        <div className="text-xs text-ink2">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={u.role === 'driver' ? 'info' : 'neutral'}>{u.role}</Badge>
                  </td>
                  <td className="text-ink2">{u.department || '—'}</td>
                  <td>
                    <Badge tone={u.account_status === 'active' ? 'success' : 'danger'}>
                      {u.account_status}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Button small v="ghost" onClick={() => setSelected(u)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
