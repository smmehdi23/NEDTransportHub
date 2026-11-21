import { useEffect, useState } from 'react';
import { adminApi, type BookingItem, type RideItem } from '../api';
import { Badge, Button, Panel, cx, formatDateTime } from '../ui';

export function RidesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [rides, setRides] = useState<RideItem[]>([]);
  const [bookingsRide, setBookingsRide] = useState<RideItem | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listRides(statusFilter || undefined);
      setRides(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const openBookings = async (r: RideItem) => {
    setBookingsRide(r);
    try {
      const list = await adminApi.getRideBookings(r.id);
      setBookings(list);
    } catch {
      setBookings([]);
    }
  };

  const handleAdminCancel = async (r: RideItem) => {
    const reason = window.prompt(`Reason to cancel Ride #${r.id}?`, 'Cancelled by administrator');
    if (reason === null) return;
    try {
      await adminApi.cancelRide(r.id, reason);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel ride');
    }
  };

  const liveCount = rides.filter((r) => r.status === 'in_progress').length;
  const openCount = rides.filter((r) => r.status === 'open' || r.status === 'full').length;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <div className="text-sm text-ink2">Showing rides</div>
          <div className="mt-1 text-3xl font-bold">{rides.length}</div>
        </Panel>
        <Panel>
          <div className="text-sm text-ink2">Live in progress</div>
          <div className="mt-1 text-3xl font-bold text-success">{liveCount}</div>
        </Panel>
        <Panel>
          <div className="text-sm text-ink2">Upcoming (open/full)</div>
          <div className="mt-1 text-3xl font-bold text-brand">{openCount}</div>
        </Panel>
      </div>

      {error && (
        <div className="rounded-2xl bg-danger-subtle p-3 text-sm text-danger">{error}</div>
      )}

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-canvas p-1 text-sm font-semibold">
            {[
              ['', 'All'],
              ['in_progress', 'Live'],
              ['open', 'Open'],
              ['completed', 'Completed'],
              ['cancelled', 'Cancelled'],
            ].map(([val, label]) => (
              <button
                key={label}
                onClick={() => setStatusFilter(val)}
                className={cx(
                  'rounded-lg px-3 py-1.5',
                  statusFilter === val ? 'bg-white text-brand shadow-xs' : 'text-ink2',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button small v="secondary" icon="RefreshCw" onClick={load}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-ink2">Loading rides...</p>
        ) : rides.length === 0 ? (
          <p className="py-10 text-center text-ink2">No rides found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-ink3">
                <tr>
                  <th className="pb-3">Ride</th>
                  <th>Driver</th>
                  <th>Route</th>
                  <th>Departs</th>
                  <th>Seats</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rides.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 font-semibold">#{r.id}</td>
                    <td>{r.driver.name}</td>
                    <td className="text-ink2">
                      {r.origin_name} → {r.destination_name}
                    </td>
                    <td className="text-ink2">{formatDateTime(r.departure_time)}</td>
                    <td>
                      {r.total_seats - r.available_seats}/{r.total_seats}
                    </td>
                    <td>
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
                    </td>
                    <td className="space-x-2 text-right whitespace-nowrap">
                      <Button small v="ghost" onClick={() => openBookings(r)}>
                        Bookings
                      </Button>
                      {(r.status === 'open' || r.status === 'full' || r.status === 'in_progress') && (
                        <Button small v="danger" onClick={() => handleAdminCancel(r)}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {bookingsRide && (
        <Panel
          title={`Bookings for Ride #${bookingsRide.id} (${bookingsRide.origin_name} → ${bookingsRide.destination_name})`}
          right={
            <Button small v="ghost" onClick={() => setBookingsRide(null)}>
              Close
            </Button>
          }
        >
          {bookings.length === 0 ? (
            <p className="py-4 text-sm text-ink2">No bookings on this ride.</p>
          ) : (
            <div className="divide-y divide-line text-sm">
              {bookings.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <b>{b.passenger.name}</b>
                    <span className="ml-2 text-xs text-ink2">
                      Pickup: {b.pickup_name || 'Hidden'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-brand">
                      {b.proposed_fare ? `PKR ${b.proposed_fare}` : '—'}
                    </span>
                    <Badge tone={b.status === 'confirmed' ? 'success' : 'neutral'}>
                      {b.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
