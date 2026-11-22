import { useEffect, useState } from 'react';
import { adminApi, fetchDocumentBlob, type VehicleReview } from '../api';
import { Avatar, Badge, Button, Icon, Panel, cx, formatDateTime } from '../ui';

const CHECKLIST = [
  'Photo matches NED student/staff ID',
  'Name matches official NED record',
  'Driving licence is clear and valid',
  'Vehicle registration matches plate number',
  'Seat capacity matches vehicle type',
];

export function VerificationPage({
  initialVehicleId,
  onCountChange,
}: {
  initialVehicleId?: number;
  onCountChange?: () => void;
}) {
  const [tab, setTab] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [rows, setRows] = useState<VehicleReview[]>([]);
  const [selected, setSelected] = useState<VehicleReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal/detail state
  const [docTab, setDocTab] = useState<'licence' | 'registration' | 'university_id'>('licence');
  const [docPreview, setDocPreview] = useState<{ url: string; mime: string } | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false, false]);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const loadList = async (status: 'pending' | 'verified' | 'rejected') => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listVerifications(status);
      setRows(res.items);
      if (initialVehicleId) {
        const match = res.items.find((v) => v.id === initialVehicleId);
        if (match) setSelected(match);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList(tab);
  }, [tab]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    let objUrl: string | null = null;
    setDocPreview(null);
    setDocError(null);
    fetchDocumentBlob(selected.documents[docTab])
      .then((res) => {
        if (!active) {
          URL.revokeObjectURL(res.url);
          return;
        }
        objUrl = res.url;
        setDocPreview(res);
      })
      .catch((err) => {
        if (active) setDocError(err instanceof Error ? err.message : 'Document not available');
      });
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [selected, docTab]);

  const handleApprove = async () => {
    if (!selected) return;
    setActing(true);
    setError(null);
    try {
      await adminApi.approveDriver(selected.id);
      setSelected(null);
      await loadList(tab);
      onCountChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (reason.trim().length < 5) {
      setError('Please enter a rejection reason (at least 5 characters).');
      return;
    }
    setActing(true);
    setError(null);
    try {
      await adminApi.rejectDriver(selected.id, reason.trim());
      setSelected(null);
      setReason('');
      await loadList(tab);
      onCountChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActing(false);
    }
  };

  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button small v="secondary" icon="ChevronLeft" onClick={() => setSelected(null)}>
              Back to queue
            </Button>
            <div>
              <h2 className="text-lg font-bold">Review: {selected.owner.name}</h2>
              <p className="text-xs text-ink2">
                Vehicle #{selected.id} · {selected.model} ({selected.plate_number})
              </p>
            </div>
          </div>
          {selected.verification_status === 'pending' ? (
            <div className="flex gap-2">
              <Button small v="danger" disabled={acting} onClick={handleReject}>
                Reject
              </Button>
              <Button small disabled={acting} onClick={handleApprove}>
                {acting ? 'Saving...' : 'Approve driver'}
              </Button>
            </div>
          ) : (
            <Badge tone={selected.verification_status === 'verified' ? 'success' : 'danger'}>
              {selected.verification_status}
            </Badge>
          )}
        </div>

        {error && (
          <div className="rounded-2xl bg-danger-subtle p-3 text-sm text-danger">{error}</div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel className="!bg-ink/95 text-white lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {(
                  [
                    ['licence', 'Driving Licence'],
                    ['registration', 'Vehicle Registration'],
                    ['university_id', 'NED ID'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDocTab(key)}
                    className={cx(
                      'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                      docTab === key ? 'bg-white text-brand' : 'bg-white/15 text-white/80',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {docPreview && (
                <a
                  href={docPreview.url}
                  download={`${selected.plate_number}_${docTab}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
                >
                  <Icon n="Download" size={14} /> Download
                </a>
              )}
            </div>

            <div className="flex min-h-[340px] items-center justify-center rounded-2xl bg-black/25 p-4">
              {docError ? (
                <div className="text-center text-sm text-white/70">
                  <p>{docError}</p>
                  <p className="mt-1 text-xs text-white/50">
                    Older uploads submitted before persistent database storage are no longer available. New uploads are stored permanently in Neon PostgreSQL.
                  </p>
                </div>
              ) : !docPreview ? (
                <span className="text-sm text-white/70">Loading document...</span>
              ) : docPreview.mime.includes('pdf') ? (
                <iframe
                  src={docPreview.url}
                  title="Document PDF"
                  className="h-[420px] w-full rounded-xl bg-white"
                />
              ) : (
                <img
                  src={docPreview.url}
                  alt={docTab}
                  className="max-h-[420px] rounded-xl object-contain"
                />
              )}
            </div>
          </Panel>

          <div className="space-y-5">
            <Panel title="Applicant">
              <div className="space-y-2 text-sm">
                <div className="font-bold">{selected.owner.name}</div>
                <div className="text-ink2">{selected.owner.email}</div>
                <div className="text-ink2">{selected.owner.phone || 'No phone provided'}</div>
                <div className="border-t border-line pt-2 text-ink2">
                  <b>{selected.model}</b> · Plate <b>{selected.plate_number}</b> ·{' '}
                  {selected.seat_capacity} seats
                </div>
                <div className="text-xs text-ink3">
                  Submitted {formatDateTime(selected.created_at)}
                </div>
              </div>
            </Panel>

            <Panel title="Review checklist">
              <div className="space-y-2.5">
                {CHECKLIST.map((item, idx) => (
                  <label key={item} className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={checks[idx]}
                      onChange={() =>
                        setChecks(checks.map((c, i) => (i === idx ? !c : c)))
                      }
                      className="h-4 w-4 accent-[#142c5c]"
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </Panel>

            <Panel title="Rejection reason / note">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required if rejecting (min 5 characters)..."
                className="h-24 w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-brand"
              />
              {selected.rejection_reason && (
                <p className="mt-2 text-xs text-danger">
                  Previous reason: {selected.rejection_reason}
                </p>
              )}
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit gap-1 rounded-xl bg-canvas p-1 text-sm font-semibold">
          {(['pending', 'verified', 'rejected'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                'rounded-lg px-3.5 py-1.5 capitalize',
                tab === t ? 'bg-white text-brand shadow-xs' : 'text-ink2',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Button small v="secondary" icon="RefreshCw" onClick={() => loadList(tab)}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl bg-danger-subtle p-3 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <p className="py-10 text-center text-ink2">Loading applications...</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-ink2">No {tab} driver verifications.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-ink3">
              <tr>
                <th className="pb-3">Applicant</th>
                <th>Vehicle</th>
                <th>Plate</th>
                <th>Seats</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={v.owner.name} size={34} />
                      <div>
                        <b>{v.owner.name}</b>
                        <div className="text-xs text-ink2">{v.owner.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-ink2">{v.model}</td>
                  <td className="font-semibold">{v.plate_number}</td>
                  <td>{v.seat_capacity}</td>
                  <td className="text-ink2">{formatDateTime(v.created_at)}</td>
                  <td className="text-right">
                    <Button
                      small
                      v="secondary"
                      onClick={() => {
                        setChecks([false, false, false, false, false]);
                        setReason(v.rejection_reason ?? '');
                        setDocTab('licence');
                        setSelected(v);
                      }}
                    >
                      Review
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
