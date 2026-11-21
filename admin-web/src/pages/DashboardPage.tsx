import { useEffect, useState } from 'react';
import {
  adminApi,
  type AdminStats,
  type RideItem,
  type SOSItem,
  type VehicleReview,
} from '../api';
import { Avatar, Badge, Button, Icon, Panel, formatDateTime, type IconName } from '../ui';

export function DashboardPage({
  onNavigate,
}: {
  onNavigate: (tab: string, detailId?: number) => void;
}) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rides, setRides] = useState<RideItem[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<VehicleReview[]>([]);
  const [activeSos, setActiveSos] = useState<SOSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r, v, sos] = await Promise.all([
        adminApi.getStats(7),
        adminApi.listRides(),
        adminApi.listVerifications('pending'),
        adminApi.listSos('active'),
      ]);
      setStats(s);
      setRides(r.items.slice(0, 6));
      setPendingDrivers(v.items);
      setActiveSos(sos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="py-12 text-center text-ink2">Loading live metrics...</div>;
  if (error) {
    return (
      <Panel>
        <p className="text-danger">{error}</p>
        <Button small className="mt-3" onClick={load}>
          Retry
        </Button>
      </Panel>
    );
  }

  const kpis: [string, string, string, IconName, string][] = [
    [
      'Total users',
      String(stats?.users.total ?? 0),
      `${stats?.users.verified_drivers ?? 0} verified drivers`,
      'Users',
      'text-brand',
    ],
    [
      'Total rides',
      String(stats?.rides.total ?? 0),
      `${stats?.rides.by_status?.in_progress ?? 0} live now`,
      'Car',
      'text-brand',
    ],
    [
      'Pending verifications',
      String(pendingDrivers.length),
      pendingDrivers.length ? 'Needs admin review' : 'All caught up',
      'ShieldCheck',
      'text-warning',
    ],
    [
      'Safety alerts',
      String((stats?.safety.active_sos ?? 0) + (stats?.safety.open_reports ?? 0)),
      `${stats?.safety.active_sos ?? 0} active SOS · ${stats?.safety.open_reports ?? 0} reports`,
      'TriangleAlert',
      'text-danger',
    ],
  ];

  // Build 7-day chart bars
  const days: { label: string; iso: string; rides: number; bookings: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      label: d.toLocaleDateString([], { weekday: 'short' }),
      rides: stats?.activity.rides_created?.[iso] ?? 0,
      bookings: stats?.activity.bookings_made?.[iso] ?? 0,
    });
  }
  const maxVal = Math.max(1, ...days.map((d) => Math.max(d.rides, d.bookings)));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, sub, icon, cls]) => (
          <Panel key={label}>
            <div className="flex items-center justify-between text-sm text-ink2">
              {label}
              <Icon n={icon} size={18} className={cls} />
            </div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
            <div className="mt-1 text-xs text-ink3">{sub}</div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Activity (Last 7 days)"
          right={
            <span className="text-xs text-ink3">
              PKR {(stats?.payments.total_paid_pkr ?? 0).toLocaleString()} settled
            </span>
          }
          className="lg:col-span-2"
        >
          <div className="flex h-48 items-end gap-3 pt-4">
            {days.map((d) => {
              const hRides = Math.max(6, Math.round((d.rides / maxVal) * 145));
              const hBookings = Math.max(6, Math.round((d.bookings / maxVal) * 145));
              return (
                <div key={d.iso} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full items-end justify-center gap-1">
                    <div
                      className="w-4 rounded-t-lg bg-brand transition hover:bg-brand-strong"
                      style={{ height: `${hRides}px` }}
                      title={`${d.rides} rides on ${d.iso}`}
                    />
                    <div
                      className="w-4 rounded-t-lg bg-accent"
                      style={{ height: `${hBookings}px` }}
                      title={`${d.bookings} bookings on ${d.iso}`}
                    />
                  </div>
                  <span className="text-xs text-ink2">{d.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-ink2">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded bg-brand" /> Rides created
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded bg-accent" /> Bookings made
            </span>
          </div>
        </Panel>

        <Panel title="Needs attention">
          <div className="space-y-3">
            {activeSos.map((s) => (
              <button
                key={`sos-${s.id}`}
                onClick={() => onNavigate('incidents')}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-canvas"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold text-danger">
                    SOS Alert #{s.id} · Ride #{s.ride_id}
                  </div>
                  <div className="text-xs text-ink2">{formatDateTime(s.created_at)}</div>
                </div>
                <Badge tone="danger">SOS</Badge>
              </button>
            ))}

            {pendingDrivers.slice(0, 4).map((v) => (
              <button
                key={`veh-${v.id}`}
                onClick={() => onNavigate('verification', v.id)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-canvas"
              >
                <div className="flex-1">
                  <div className="text-sm font-semibold">Driver: {v.owner.name}</div>
                  <div className="text-xs text-ink2">
                    {v.model} ({v.plate_number})
                  </div>
                </div>
                <Badge tone="warning">Pending</Badge>
              </button>
            ))}

            {activeSos.length === 0 && pendingDrivers.length === 0 && (
              <p className="py-6 text-center text-sm text-ink2">No urgent items right now.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Recent rides"
        right={
          <button
            onClick={() => onNavigate('rides')}
            className="text-sm font-semibold text-brand hover:underline"
          >
            View all
          </button>
        }
      >
        {rides.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink2">No rides created yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {rides.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Avatar name={r.driver.name} size={34} />
                <b className="w-36">{r.driver.name}</b>
                <span className="flex-1 text-ink2">
                  {r.origin_name} → {r.destination_name}
                </span>
                <span className="text-ink2">
                  {r.total_seats - r.available_seats}/{r.total_seats} seats
                </span>
                <span className="font-semibold text-brand">PKR {r.estimated_fare}</span>
                <Badge
                  tone={
                    r.status === 'in_progress'
                      ? 'success'
                      : r.status === 'cancelled'
                      ? 'danger'
                      : 'info'
                  }
                >
                  {r.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
