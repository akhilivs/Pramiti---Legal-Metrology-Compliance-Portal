'use client';
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api, formatDate, type ScanDetail, type ScanSummary, type Stats } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import Scanner from '@/components/Scanner';
import { FramedCorners, Rosette } from '@/components/ornaments';
import {
  DemoBadge,
  ErrorNote,
  Icon,
  type IconName,
  PageHeader,
  PageSkeleton,
  SectionTitle,
  Skeleton,
  SourceTag,
  Thumb,
  VerdictBadge,
} from '@/components/ui';

// Loaded on demand: the report appears only after an analysis, the chart sits below the fold
const ScanReport = dynamic(() => import('@/components/ScanReport'), { loading: () => <PageSkeleton /> });
const TrendChart = dynamic(() => import('@/components/TrendChart'), { loading: () => <Skeleton className="h-48 rounded-lg" /> });

function StatTile({
  label,
  hindi,
  value,
  sub,
  icon,
  accent,
  href,
}: {
  label: string;
  hindi: string;
  value: number | string | null; // null while loading
  sub?: string;
  icon: IconName;
  accent: string;
  href?: string;
}) {
  const { t, lang } = useI18n();
  const body = (
    <>
      <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{t(label)}</p>
          {lang === 'en' && <p className="text-deva text-xs text-muted">{hindi}</p>}
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sand bg-ivory text-indigo">
          <Icon name={icon} className="h-4.5 w-4.5" />
        </span>
      </div>
      {value === null ? <Skeleton className="mt-4 h-9 w-16" /> : <p className="heading-serif mt-3 text-4xl font-bold text-ink">{value}</p>}
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="card overflow-hidden p-5 transition hover:border-gold-soft hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="card overflow-hidden p-5">{body}</div>
  );
}

export default function Dashboard() {
  const { officer } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<ScanSummary[] | null>(null);
  const [result, setResult] = useState<ScanDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([api.stats(), api.scans({ limit: 6 })])
      .then(([s, r]) => {
        setLoadError(null);
        setStats(s);
        setRecent(r);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onResult = (scan: ScanDetail) => {
    setResult(scan);
    refresh();
  };

  const pct = (n: number) => (stats?.total ? `${Math.round((100 * n) / stats.total)}% of all inspections` : 'No inspections yet');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <PageHeader
        eyebrow={`${t(greeting)} · नमस्ते`}
        title={officer.name}
        description={`${officer.designation ?? ''}${officer.designation ? ' · ' : ''}Photograph a pre-packaged commodity or check an online listing against the Legal Metrology (Packaged Commodities) Rules, 2011.`}
      />

      {stats?.has_demo && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-gold bg-parchment/60 px-4 py-3 text-sm text-ink-soft">
          <DemoBadge />
          <span className="min-w-0 flex-1 basis-56">
            {t('Demo data loaded')}: records marked <b>Demo</b> are fictional manufacturers created to demonstrate the portal.
          </span>
          {officer.role === 'admin' && (
            <Link href="/admin" className="ml-auto font-semibold text-indigo underline">
              Manage demo data
            </Link>
          )}
        </div>
      )}

      {loadError && (
        <div className="mb-6">
          <ErrorNote onRetry={refresh}>{loadError}</ErrorNote>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Inspections"
          hindi="कुल निरीक्षण"
          value={stats ? stats.total : null}
          sub={stats?.average_score != null ? `Average score ${stats.average_score}% · ${stats.ecommerce} online` : undefined}
          icon="doc"
          accent="bg-indigo"
          href="/history"
        />
        <StatTile
          label="Non-compliant"
          hindi="अननुपालित"
          value={stats ? stats.non_compliant : null}
          sub={stats ? pct(stats.non_compliant) : undefined}
          icon="cross"
          accent="bg-maroon"
          href="/history?verdict=non_compliant"
        />
        <StatTile
          label="Pending review"
          hindi="समीक्षा लंबित"
          value={stats ? stats.pending_review : null}
          sub="AI findings awaiting an officer"
          icon="eye"
          accent="bg-saffron"
          href="/history?review=pending"
        />
        <StatTile
          label="Notices awaiting action"
          hindi="कार्रवाई हेतु नोटिस"
          value={stats ? stats.notices_pending : null}
          sub={stats ? `${stats.notices_issued} issued · ${stats.open_complaints} open complaints` : undefined}
          icon="stamp"
          accent="bg-green"
          href="/notices"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="card card-framed self-start p-6">
          <FramedCorners />
          <SectionTitle hindi="नया निरीक्षण">{t('New inspection')}</SectionTitle>
          <Scanner onResult={onResult} />
        </section>

        <section className="min-w-0">
          {result ? (
            <ScanReport scan={result} compact />
          ) : (
            <div className="card relative flex h-full min-h-[28rem] flex-col items-center justify-center overflow-hidden p-8 text-center">
              <Rosette className="pointer-events-none absolute h-[26rem] w-[26rem] text-gold/10" />
              <div className="relative max-w-sm">
                <p className="heading-serif text-2xl font-bold text-indigo">{t('The report will appear here')}</p>
                <p className="text-deva text-saffron-600">निरीक्षण रिपोर्ट</p>
                <ul className="mt-6 space-y-3 text-left text-sm text-ink-soft">
                  {(
                    [
                      ['image', 'Photograph the front and back so every declaration is visible.'],
                      ['scale', 'Weigh the pack and enter the measured quantity to check short-weight.'],
                      ['eye', 'See exactly where the AI read each declaration, then confirm or override.'],
                      ['stamp', 'Raise a show-cause notice in one click for non-compliant products.'],
                    ] as [IconName, string][]
                  ).map(([icon, text]) => (
                    <li key={text} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-saffron-50 text-saffron-600">
                        <Icon name={icon} className="h-4 w-4" />
                      </span>
                      <span className="pt-1">{text}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Link href="/batch" className="btn btn-ghost px-3 py-2 text-sm">
                    <Icon name="layers" className="h-4 w-4" /> {t('Bulk scan')}
                  </Link>
                  <Link href="/insights" className="btn btn-ghost px-3 py-2 text-sm">
                    <Icon name="map" className="h-4 w-4" /> {t('Insights')}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <section className="card p-6 lg:col-span-2">
          <SectionTitle hindi="पिछले 14 दिन">{t('Inspections, last 14 days')}</SectionTitle>
          {stats ? <TrendChart daily={stats.daily} /> : <Skeleton className="h-48 rounded-lg" />}
        </section>

        <section className="card p-6">
          <SectionTitle hindi="सबसे सामान्य उल्लंघन">{t('Most frequent violations')}</SectionTitle>
          {stats?.top_violations.length ? (
            <ol className="space-y-3.5">
              {stats.top_violations.map((v, i) => {
                const max = stats.top_violations[0].count;
                return (
                  <li key={v.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">
                        <span className="heading-serif mr-1.5 font-bold text-saffron-600">{i + 1}.</span>
                        {v.title}
                      </span>
                      <span className="font-semibold text-ink">{v.count}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-parchment">
                        <div className="h-full rounded-full bg-[var(--chart-b)]" style={{ width: `${(100 * v.count) / max}%` }} />
                      </div>
                      <span className="w-28 whitespace-nowrap text-right font-mono text-[10px] text-muted">{v.rule}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted">No violations recorded yet.</p>
          )}
        </section>
      </div>

      <section className="card mt-6 p-6">
        <SectionTitle
          hindi="हाल के निरीक्षण"
          right={
            <Link href="/history" className="flex items-center gap-1 text-sm font-semibold text-indigo hover:text-saffron-600">
              {t('Full register')} <Icon name="arrowRight" className="h-4 w-4" />
            </Link>
          }
        >
          {t('Recent inspections')}
        </SectionTitle>
        {recent === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label={t('Loading')}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-sand p-3">
                <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2 opacity-70" />
                  <Skeleton className="h-5 w-24 rounded-full opacity-60" />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((s) => (
              <li key={s.id} className="min-w-0">
                <Link
                  href={`/scans/${s.id}`}
                  className="flex items-center gap-3 rounded-xl border border-sand bg-ivory/50 p-3 transition hover:border-gold-soft hover:bg-paper hover:shadow-sm"
                >
                  {s.image_url ? (
                    <Thumb src={s.image_url} size={56} className="h-14 w-14 shrink-0 rounded-lg border border-sand" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-parchment text-muted">
                      <Icon name="globe" className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{s.product_name || 'Unnamed product'}</p>
                    <p className="flex items-center gap-2 text-xs text-muted">
                      {formatDate(s.created_at)} <SourceTag source={s.source} />
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <VerdictBadge verdict={s.verdict} />
                      {s.is_demo && <DemoBadge />}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Inspections you record will be listed here.</p>
        )}
      </section>
    </div>
  );
}
