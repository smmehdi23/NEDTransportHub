export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === todayStr) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${formatDateShort(iso)}, ${formatTime(iso)}`;
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  return 'Good Evening,';
}

export function formatPkr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'PKR —';
  return `PKR ${amount.toLocaleString()}`;
}

export function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes() + Math.round(minutes));
  return formatTime(d.toISOString());
}
