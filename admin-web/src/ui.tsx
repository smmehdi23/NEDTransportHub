import type { ReactNode } from 'react';
import * as L from 'lucide-react';

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ');
export type IconName = keyof typeof L;

export function Icon({
  n,
  size = 18,
  className,
}: {
  n: IconName;
  size?: number;
  className?: string;
}) {
  const C = L[n] as L.LucideIcon;
  return <C size={size} strokeWidth={1.8} className={className} />;
}

export function BrandMark({ size = 36, onDark = true }: { size?: number; onDark?: boolean }) {
  const bg = onDark ? '#FFFFFF' : '#091D48';
  const stroke = onDark ? '#142C5C' : '#FFFFFF';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path
        d="M47.3486 0H16.6514C7.4551 0 0 7.4551 0 16.6514V47.3486C0 56.5449 7.4551 64 16.6514 64H47.3486C56.5449 64 64 56.5449 64 47.3486V16.6514C64 7.4551 56.5449 0 47.3486 0Z"
        fill={bg}
      />
      <path
        d="M16.429 38.5144V24.8069C16.4289 23.7435 16.7631 22.7071 17.3841 21.844C18.0051 20.9808 18.8817 20.3347 19.8899 19.9968C20.8981 19.6589 21.987 19.6463 23.0027 19.9609C24.0184 20.2755 24.9096 20.9013 25.5504 21.7498L41.9317 43.4476C42.2407 43.857 42.6706 44.159 43.1606 44.3108C43.6506 44.4626 44.1759 44.4566 44.6623 44.2936C45.1486 44.1306 45.5715 43.8189 45.871 43.4025C46.1706 42.9861 46.3317 42.486 46.3316 41.9731V19.0348"
        stroke={stroke}
        strokeWidth="5.91063"
        strokeLinejoin="round"
      />
      <path
        d="M20.6237 43.2493C20.6237 45.5659 18.7456 47.4439 16.429 47.4439C14.1124 47.4439 12.2344 45.5659 12.2344 43.2493C12.2344 40.9326 14.1124 39.0546 16.429 39.0546C18.7456 39.0546 20.6237 40.9326 20.6237 43.2493Z"
        stroke={stroke}
        strokeWidth="3.36842"
      />
      <path
        d="M46.3317 24.1827C49.1748 24.1827 51.4796 21.8779 51.4796 19.0348C51.4796 16.1916 49.1748 13.8868 46.3317 13.8868C43.4885 13.8868 41.1837 16.1916 41.1837 19.0348C41.1837 21.8779 43.4885 24.1827 46.3317 24.1827Z"
        fill="#9CBDF2"
      />
    </svg>
  );
}

const tones = {
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-brand-subtle text-brand',
  neutral: 'bg-canvas text-ink2',
};

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap capitalize',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const ini =
    name
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-subtle font-bold text-brand"
    >
      {ini}
    </span>
  );
}

export function Button({
  children,
  onClick,
  v = 'primary',
  icon,
  small,
  disabled,
  className,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  v?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-strong shadow-sm',
    secondary: 'bg-white text-brand border border-line hover:bg-brand-subtle',
    ghost: 'bg-transparent text-brand hover:bg-brand-subtle',
    danger: 'bg-danger text-white hover:opacity-90',
  }[v];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-40',
        small ? 'h-9 px-3.5 text-sm' : 'h-11 px-5 text-sm',
        styles,
        className,
      )}
    >
      {icon && <Icon n={icon} size={16} />}
      {children}
    </button>
  );
}

export function Panel({
  title,
  right,
  children,
  className,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('rounded-3xl border border-line bg-white p-5 shadow-xs', className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-bold text-ink">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
