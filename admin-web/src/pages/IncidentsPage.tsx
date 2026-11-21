import { useEffect, useState } from 'react';
import { adminApi, type ReportItem, type SOSItem } from '../api';
import { Badge, Button, Icon, Panel, cx, formatDateTime } from '../ui';

export function IncidentsPage({ onCountChange }: { onCountChange?: () => void }) {
  const [sosList, setSosList] = useState<SOSItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([adminApi.listSos('active'), adminApi.listReports()]);
      setSosList(s);
      setReports(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleResolveSos = async (id: number) => {
    try {
      await adminApi.resolveSos(id);
      await load();
      onCountChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve SOS');
    }
  };

  const handleUpdateReport = async (status: 'in_review' | 'resolved') => {
    if (!selectedReport) return;
    try {
      const updated = await adminApi.updateReport(
        selectedReport.id,
        status,
        notes.trim() || undefined,
      );
      setSelectedReport(updated);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      onCountChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update report');
    }
  };

  if (loading) return <div className="py-12 text-center text-ink2">Loading safety alerts...</div>;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-2xl bg-danger-subtle p-3 text-sm text-danger">{error}</div>
      )}

      <Panel
        title={`Active SOS Alerts (${sosList.length})`}
        right={
          <Button small v="secondary" icon="RefreshCw" onClick={load}>
            Refresh
          </Button>
        }
      >
        {sosList.length === 0 ? (
          <p className="py-4 text-sm text-ink2">No active SOS emergencies.</p>
        ) : (
          <div className="space-y-3">
            {sosList.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-danger/20 bg-danger-subtle/50 p-4"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-danger text-white">
                  <Icon n="Siren" size={20} />
                </span>
                <div className="flex-1">
                  <b className="text-danger">
                    SOS #{s.id} · User #{s.user_id} · Ride #{s.ride_id}
                  </b>
                  <div className="text-sm text-ink2">
                    {s.message || 'Emergency triggered'} · {formatDateTime(s.created_at)}
                  </div>
                  {s.lat !== null && s.lng !== null && (
                    <a
                      href={`https://www.google.com/maps?q=${s.lat},${s.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-brand underline"
                    >
                      Open GPS Location ({s.lat.toFixed(4)}, {s.lng.toFixed(4)})
                    </a>
                  )}
                </div>
                <Button small v="danger" onClick={() => handleResolveSos(s.id)}>
                  Mark Resolved
                </Button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title={`Incident Reports (${reports.length})`} className="lg:col-span-2">
          {reports.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink2">No incident reports submitted.</p>
          ) : (
            <div className="space-y-2.5">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelectedReport(r);
                    setNotes(r.admin_notes ?? '');
                  }}
                  className={cx(
                    'flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition',
                    selectedReport?.id === r.id
                      ? 'border-brand bg-brand-subtle/40'
                      : 'border-line hover:bg-canvas',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                    <Icon n="Flag" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      Report #{r.id} · Ride #{r.ride_id}
                    </div>
                    <div className="truncate text-sm text-ink2">{r.description}</div>
                    <div className="text-xs text-ink3">{formatDateTime(r.created_at)}</div>
                  </div>
                  <Badge
                    tone={
                      r.status === 'resolved'
                        ? 'success'
                        : r.status === 'in_review'
                        ? 'warning'
                        : 'info'
                    }
                  >
                    {r.status.replace('_', ' ')}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Report detail">
          {!selectedReport ? (
            <p className="py-8 text-center text-sm text-ink2">
              Select a report on the left to review or resolve it.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <b>Report #{selectedReport.id}</b>
                <Badge tone={selectedReport.status === 'resolved' ? 'success' : 'warning'}>
                  {selectedReport.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="rounded-2xl bg-canvas p-3 text-ink2">
                {selectedReport.description}
              </div>
              <div className="text-xs text-ink3">
                Ride #{selectedReport.ride_id} · Reporter #{selectedReport.reporter_id}
                {selectedReport.reported_user_id
                  ? ` · Reported User #${selectedReport.reported_user_id}`
                  : ''}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink2">Admin notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record actions taken..."
                  className="h-24 w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-brand"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  small
                  v="secondary"
                  className="flex-1"
                  onClick={() => handleUpdateReport('in_review')}
                >
                  Mark In Review
                </Button>
                <Button
                  small
                  className="flex-1"
                  onClick={() => handleUpdateReport('resolved')}
                >
                  Resolve
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
