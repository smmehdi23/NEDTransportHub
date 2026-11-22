import { useCallback, useEffect, useState } from 'react';
import { adminApi, tokenStore, type AdminUser } from './api';
import { Avatar, BrandMark, Icon, cx, type IconName } from './ui';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { VerificationPage } from './pages/VerificationPage';
import { UsersPage } from './pages/UsersPage';
import { RidesPage } from './pages/RidesPage';
import { IncidentsPage } from './pages/IncidentsPage';

const NAV: { key: string; label: string; icon: IconName; title: string; sub: string }[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    title: 'Admin Dashboard',
    sub: 'Live overview of NED Transport Hub operations',
  },
  {
    key: 'verification',
    label: 'Driver verification',
    icon: 'ShieldCheck',
    title: 'Driver Verification',
    sub: 'Review submitted licences, vehicle registrations, and NED IDs',
  },
  {
    key: 'users',
    label: 'Users',
    icon: 'Users',
    title: 'Users',
    sub: 'Verified NED students, staff, and drivers',
  },
  {
    key: 'rides',
    label: 'Rides',
    icon: 'Car',
    title: 'Rides',
    sub: 'Monitor active, scheduled, and completed campus rides',
  },
  {
    key: 'incidents',
    label: 'Incidents & SOS',
    icon: 'TriangleAlert',
    title: 'Incidents & SOS',
    sub: 'Respond to live emergency SOS alerts and rider reports',
  },
];

export default function App() {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [detailVehicleId, setDetailVehicleId] = useState<number | undefined>();
  const [pendingCount, setPendingCount] = useState(0);
  const [sosCount, setSosCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadBadges = useCallback(async () => {
    try {
      const [ver, sos] = await Promise.all([
        adminApi.listVerifications('pending'),
        adminApi.listSos('active'),
      ]);
      setPendingCount(ver.total);
      setSosCount(sos.length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setChecking(false);
      return;
    }
    adminApi
      .getMe()
      .then((me) => {
        if (me.role === 'admin') {
          setAdmin(me);
          loadBadges();
        } else {
          tokenStore.clear();
        }
      })
      .catch(() => tokenStore.clear())
      .finally(() => setChecking(false));
  }, [loadBadges]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink2">
        Checking session...
      </div>
    );
  }

  if (!admin) {
    return (
      <LoginPage
        onSuccess={(u) => {
          setAdmin(u);
          loadBadges();
        }}
      />
    );
  }

  const currentNav = NAV.find((n) => n.key === tab) ?? NAV[0];

  return (
    <div className="flex min-h-screen flex-col bg-canvas md:flex-row">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-brand-strong px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2.5">
          <BrandMark size={30} onDark />
          <b className="text-sm">NED Admin</b>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-xl bg-white/15 p-2 text-white"
          aria-label="Toggle Menu"
        >
          <Icon n={menuOpen ? 'X' : 'Menu'} size={20} />
        </button>
      </div>

      <aside
        className={cx(
          'w-full shrink-0 flex-col bg-brand-strong p-4 text-white md:flex md:w-64',
          menuOpen ? 'flex' : 'hidden',
        )}
      >
        <div className="mb-8 hidden items-center gap-2.5 px-2 pt-2 md:flex">
          <BrandMark size={36} onDark />
          <b>NED Transport Hub</b>
        </div>
        <div className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-white/50">
          MENU
        </div>
        {NAV.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setDetailVehicleId(undefined);
              setTab(item.key);
              setMenuOpen(false);
            }}
            className={cx(
              'mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              tab === item.key ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10',
            )}
          >
            <Icon n={item.icon} size={18} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.key === 'verification' && pendingCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">
                {pendingCount}
              </span>
            )}
            {item.key === 'incidents' && sosCount > 0 && (
              <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold text-white">
                {sosCount}
              </span>
            )}
          </button>
        ))}

        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
            <Avatar name={admin.name} size={36} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="truncate font-bold">{admin.name}</div>
              <div className="text-xs text-white/60">Transport admin</div>
            </div>
          </div>
          <button
            onClick={async () => {
              await adminApi.logout();
              setAdmin(null);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-white/75 hover:bg-white/10 hover:text-white"
          >
            <Icon n="LogOut" size={14} /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{currentNav.title}</h1>
            <p className="text-sm text-ink2">{currentNav.sub}</p>
          </div>
          <div className="rounded-full bg-success-subtle px-3.5 py-1.5 text-xs font-semibold text-success">
            Live · ned-transport-hub.vercel.app
          </div>
        </div>

        {tab === 'dashboard' && (
          <DashboardPage
            onNavigate={(target, id) => {
              setDetailVehicleId(id);
              setTab(target);
            }}
          />
        )}
        {tab === 'verification' && (
          <VerificationPage initialVehicleId={detailVehicleId} onCountChange={loadBadges} />
        )}
        {tab === 'users' && <UsersPage />}
        {tab === 'rides' && <RidesPage />}
        {tab === 'incidents' && <IncidentsPage onCountChange={loadBadges} />}
      </main>
    </div>
  );
}
