'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { api, type CheckStatus, type ComplaintStatus, type NoticeStatus, type Source, type Verdict } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Divider } from './ornaments';

/* ---------------------------------------------------------------- icons */

const paths = {
  check: 'M5 13l4 4L19 7',
  cross: 'M6 18L18 6M6 6l12 12',
  question: 'M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01',
  dash: 'M6 12h12',
  upload: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4-4 4M12 4v12',
  camera:
    'M3 9a2 2 0 012-2h.93a2 2 0 001.66-.89l.82-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.66.89l.82 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM15 13a3 3 0 11-6 0 3 3 0 016 0z',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  search: 'M21 21l-5.2-5.2M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3',
  arrowLeft: 'M10 19l-7-7 7-7M3 12h18',
  arrowRight: 'M14 5l7 7-7 7M21 12H3',
  doc: 'M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z',
  book: 'M12 6.5C10.5 5.5 8.5 5 6 5H4v13h2c2.5 0 4.5.5 6 1.5m0-13c1.5-1 3.5-1.5 6-1.5h2v13h-2c-2.5 0-4.5.5-6 1.5m0-13v13',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  logout: 'M15 16l4-4-4-4M19 12H9M12 20H6a2 2 0 01-2-2V6a2 2 0 012-2h6',
  plus: 'M12 5v14M5 12h14',
  print: 'M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z',
  refresh: 'M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0011.9 2.6L20 14M4 10l2.6-3.6A7 7 0 0118.5 9',
  shield:
    'M9 12l2 2 4-4m5.6-4A12 12 0 0112 2.9 12 12 0 013.4 6 12 12 0 003 9c0 5.6 3.8 10.3 9 11.6 5.2-1.3 9-6 9-11.6 0-1-.1-2-.4-3z',
  image: 'M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2zM14 8h.01',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  users: 'M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a4 4 0 100-8 4 4 0 000 8zM21 20v-2a4 4 0 00-3-3.9M16 2.1a4 4 0 010 7.8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  stamp: 'M5 21h14M6 17h12v-3a2 2 0 00-2-2h-2.5l.5-4a2 2 0 10-4 0l.5 4H8a2 2 0 00-2 2v3z',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12h.01',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 017 0M5 12.9a10 10 0 015.2-2.8M19 12.9a10 10 0 00-2-1.5M12 20h.01M1.4 8.8a15 15 0 014.2-2.6M22.6 8.8A15 15 0 0011 6',
  key: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.7 5.7L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.6a1 1 0 01.3-.7l6-6A6 6 0 1121 9z',
  scale: 'M12 3v18M7 21h10M5 7h14M7 7l-3 6a3 3 0 006 0L7 7zm10 0l-3 6a3 3 0 006 0l-3-6z',
  eye: 'M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  language: 'M3 5h12M9 3v2m1.05 9.5A18 18 0 016.4 9m6.5 9h7M11 21l5-10 5 10M12.75 5C11.8 10.8 8 15.4 3 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  sun: 'M12 3v1.5M12 19.5V21M4.6 4.6l1.1 1.1M18.3 18.3l1.1 1.1M3 12h1.5M19.5 12H21M4.6 19.4l1.1-1.1M18.3 5.7l1.1-1.1M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  moon: 'M20.4 14.5A8.5 8.5 0 019.5 3.6a8.5 8.5 0 1010.9 10.9z',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d={paths[name]} />
    </svg>
  );
}

/* ---------------------------------------------------------------- verdict & status */

export const VERDICT_META: Record<Verdict, { label: string; hindi: string; tone: string; dot: string; icon: IconName }> = {
  compliant: { label: 'Compliant', hindi: 'अनुपालित', tone: 'bg-green-50 text-green border-green/25', dot: 'bg-green', icon: 'check' },
  non_compliant: {
    label: 'Non-compliant',
    hindi: 'अननुपालित',
    tone: 'bg-maroon-50 text-maroon border-maroon/25',
    dot: 'bg-maroon',
    icon: 'cross',
  },
  needs_review: {
    label: 'Needs review',
    hindi: 'समीक्षा आवश्यक',
    tone: 'bg-saffron-50 text-saffron-600 border-saffron/30',
    dot: 'bg-saffron',
    icon: 'question',
  },
};

export function VerdictBadge({ verdict, size = 'sm' }: { verdict: Verdict; size?: 'sm' | 'lg' }) {
  const { t } = useI18n();
  const m = VERDICT_META[verdict] ?? VERDICT_META.needs_review;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold ${m.tone} ${
        size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <Icon name={m.icon} className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={2.4} />
      {t(m.label)}
    </span>
  );
}

export const STATUS_META: Record<CheckStatus, { label: string; tone: string; icon: IconName; ring: string }> = {
  pass: { label: 'Pass', tone: 'bg-green-50 text-green', icon: 'check', ring: 'border-l-green' },
  fail: { label: 'Fail', tone: 'bg-maroon-50 text-maroon', icon: 'cross', ring: 'border-l-maroon' },
  unclear: { label: 'Unclear', tone: 'bg-saffron-50 text-saffron-600', icon: 'question', ring: 'border-l-saffron' },
  not_applicable: { label: 'N/A', tone: 'bg-parchment text-muted', icon: 'dash', ring: 'border-l-sand-strong' },
};

export function StatusPill({ status }: { status: CheckStatus }) {
  const { t } = useI18n();
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${m.tone}`}>
      <Icon name={m.icon} className="h-3.5 w-3.5" strokeWidth={2.6} />
      {t(m.label)}
    </span>
  );
}

export const NOTICE_META: Record<NoticeStatus, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'bg-parchment text-ink-soft border-sand-strong' },
  approved: { label: 'Approved', tone: 'bg-indigo-50 text-indigo border-indigo/20' },
  issued: { label: 'Issued', tone: 'bg-saffron-50 text-saffron-600 border-saffron/30' },
  replied: { label: 'Replied', tone: 'bg-indigo-50 text-indigo-600 border-indigo/20' },
  closed: { label: 'Closed', tone: 'bg-green-50 text-green border-green/25' },
};

export const COMPLAINT_META: Record<ComplaintStatus, { label: string; tone: string }> = {
  received: { label: 'Received', tone: 'bg-saffron-50 text-saffron-600 border-saffron/30' },
  under_review: { label: 'Under review', tone: 'bg-indigo-50 text-indigo border-indigo/20' },
  action_taken: { label: 'Action taken', tone: 'bg-maroon-50 text-maroon border-maroon/25' },
  closed: { label: 'Closed', tone: 'bg-green-50 text-green border-green/25' },
};

export const RISK_META = {
  high: { label: 'High risk', tone: 'bg-maroon text-white' },
  medium: { label: 'Medium risk', tone: 'bg-saffron text-white' },
  low: { label: 'Low risk', tone: 'bg-green-50 text-green' },
} as const;

export function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {children}
    </span>
  );
}

export function DemoBadge({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      title="Demonstration record - not an actual inspection"
      className={`inline-flex items-center rounded border border-dashed border-gold px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-gold ${className}`}
    >
      {t('Demo')}
    </span>
  );
}

const SOURCE_META: Record<Source, { label: string; icon: IconName }> = {
  label: { label: 'Label', icon: 'camera' },
  ecommerce: { label: 'E-commerce', icon: 'globe' },
  complaint: { label: 'Complaint', icon: 'mail' },
};

export function SourceTag({ source }: { source: Source }) {
  const { t } = useI18n();
  const m = SOURCE_META[source] ?? SOURCE_META.label;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Icon name={m.icon} className="h-3.5 w-3.5" /> {t(m.label)}
    </span>
  );
}

/** Circular score meter. Colour follows the verdict (status colour + label, never colour alone). */
export function ScoreRing({ score, verdict, size = 112 }: { score: number; verdict: Verdict; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const colour = verdict === 'compliant' ? 'var(--green)' : verdict === 'non_compliant' ? 'var(--maroon)' : 'var(--saffron)';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--parchment)" strokeWidth="8" />
        <circle cx="50" cy="50" r="49" fill="none" stroke="var(--gold-soft)" strokeWidth="0.6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(c * Math.max(0, Math.min(100, score))) / 100} ${c}`}
          style={{ transition: 'stroke-dasharray 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="heading-serif text-3xl font-bold leading-none text-ink">{Math.round(score)}%</span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted">score</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- layout bits */

export function PageHeader({
  eyebrow,
  title,
  hindi,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  hindi?: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { lang } = useI18n();
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className={`heading-serif text-3xl font-bold text-indigo sm:text-4xl ${lang === 'hi' && hindi ? 'text-deva' : ''}`}>
            {lang === 'hi' && hindi ? hindi : title}
          </h1>
          {hindi && <p className="text-deva mt-0.5 text-lg text-saffron-600">{lang === 'hi' ? title : hindi}</p>}
          {description && <p className="mt-2 max-w-2xl text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <Divider className="mt-5" />
    </div>
  );
}

export function SectionTitle({ children, hindi, right }: { children: ReactNode; hindi?: string; right?: ReactNode }) {
  const { lang } = useI18n();
  // In Hindi mode the Hindi title leads and the English one becomes the subtitle
  const hi = lang === 'hi' && !!hindi;
  const sub = hi ? (children !== hindi ? children : null) : hindi;
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className={`heading-serif text-xl font-bold text-indigo ${hi ? 'text-deva' : ''}`}>{hi ? hindi : children}</h2>
        {sub && <p className={`text-sm text-muted ${hi ? '' : 'text-deva'}`}>{sub}</p>}
        <span className="mt-1.5 block h-0.5 w-10 rounded bg-saffron" />
      </div>
      {right}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Square thumbnail of an uploaded photo. next/image serves a small resized WebP/AVIF copy instead
 *  of the full camera photo (often several MB) that the thumbnail used to download. */
export function Thumb({ src, size, alt = '', className = '' }: { src: string; size: number; alt?: string; className?: string }) {
  return <Image src={src} alt={alt} width={size} height={size} sizes={`${size}px`} className={`object-cover ${className}`} />;
}

/* ---------------------------------------------------------------- loading skeletons
   Grey placeholders in the shape of the content, so the page does not jump when data arrives. */

const LINE_WIDTHS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-2/3', 'w-1/3', 'w-3/4'];

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-sand/70 motion-reduce:animate-none ${className}`} />;
}

/** Placeholder rows for a list or table that sits inside a card. */
export function SkeletonRows({ rows = 6, thumb = false }: { rows?: number; thumb?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="divide-y divide-sand" role="status" aria-label={t('Loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          {thumb && <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={`h-3.5 ${LINE_WIDTHS[i % LINE_WIDTHS.length]}`} />
            <Skeleton className={`h-3 opacity-70 ${LINE_WIDTHS[(i + 3) % LINE_WIDTHS.length]}`} />
          </div>
          <Skeleton className="hidden h-6 w-20 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder cards (photo + text), e.g. the complaint desk. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label={t('Loading')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card flex gap-4 p-5">
          <Skeleton className="h-20 w-20 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className={`h-4 ${LINE_WIDTHS[i % LINE_WIDTHS.length]}`} />
            <Skeleton className="h-3 w-1/2 opacity-70" />
            <Skeleton className="mt-4 h-12 w-full rounded-lg opacity-60" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Whole-page placeholder: page heading, then stat tiles + panels, a table, or main + side panels. */
export function PageSkeleton({ layout = 'detail' }: { layout?: 'detail' | 'dashboard' | 'list' }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-6" role="status" aria-label={t('Loading')}>
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-40 opacity-70" />
      </div>
      {layout === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card space-y-3 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-3/4 opacity-70" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-[14px] opacity-60" />
            <Skeleton className="h-72 rounded-[14px] opacity-60" />
          </div>
        </>
      )}
      {layout === 'list' && (
        <div className="card overflow-hidden">
          <SkeletonRows thumb />
        </div>
      )}
      {layout === 'detail' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="card space-y-3 p-6">
            <Skeleton className="mb-5 h-56 w-full rounded-xl" />
            {LINE_WIDTHS.map((w) => (
              <Skeleton key={w} className={`h-3.5 ${w}`} />
            ))}
          </div>
          <div className="card space-y-4 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20 opacity-70" />
                <Skeleton className={`h-3.5 ${LINE_WIDTHS[i]}`} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ErrorNote({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-maroon/25 bg-maroon-50 p-4 text-sm text-maroon">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
      <div className="flex-1">{children}</div>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold underline underline-offset-2">
          {t('Retry')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="p-14 text-center">
      <p className="heading-serif text-xl font-bold text-indigo">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`card card-framed max-h-[92vh] w-full overflow-y-auto rounded-b-none p-6 animate-rise sm:rounded-b-[14px] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="heading-serif text-2xl font-bold text-indigo">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:bg-parchment hover:text-ink" aria-label="Close">
            <Icon name="cross" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
      {children}
    </label>
  );
}

let statesCache: { code: string; name: string }[] | null = null;

export function useStates() {
  const [states, setStates] = useState(statesCache ?? []);
  useEffect(() => {
    if (statesCache) return;
    // api.meta() shares one request between every picker on the page
    api
      .meta()
      .then((m) => {
        statesCache = m.states;
        setStates(m.states);
      })
      .catch(() => {});
  }, []);
  return states;
}

export function StateSelect({
  id,
  value,
  onChange,
  placeholder,
  className = 'field',
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const states = useStates();
  return (
    <select id={id} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder ?? t('Select state')}</option>
      {states.map((s) => (
        <option key={s.code} value={s.code}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export function useStateName() {
  const states = useStates();
  return (code: string | null | undefined) => (code ? (states.find((s) => s.code === code)?.name ?? code) : null);
}
