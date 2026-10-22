'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, formatDate, referenceNo, type Offender, type ScanSummary } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  DemoBadge,
  ErrorNote,
  Icon,
  PageHeader,
  PageSkeleton,
  RISK_META,
  SectionTitle,
  SourceTag,
  Thumb,
  useStateName,
  VerdictBadge,
} from '@/components/ui';

export default function OffenderPage() {
  const { key } = useParams<{ key: string }>();
  const { t } = useI18n();
  const stateName = useStateName();
  const [data, setData] = useState<(Offender & { scans: ScanSummary[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.offender(decodeURIComponent(key)).then(setData).catch((e) => setError(e.message));
  }, [key]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PageSkeleton />;
  const maxV = Math.max(1, ...data.top_violations.map((v) => v.count));

  return (
    <div>
      <PageHeader
        eyebrow="Manufacturer profile"
        title={data.name}
        hindi="निर्माता प्रोफ़ाइल"
        description={data.brands.length ? `Brands: ${data.brands.join(', ')}` : undefined}
        actions={
          <Link href="/insights#offenders" className="btn btn-ghost">
            <Icon name="arrowLeft" className="h-4 w-4" /> {t('Insights')}
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="eyebrow">Risk level</p>
          <span className={`mt-3 inline-block whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ${RISK_META[data.risk].tone}`}>{RISK_META[data.risk].label}</span>
          {data.is_demo && <DemoBadge className="ml-2" />}
        </div>
        <div className="card p-5">
          <p className="eyebrow">Inspections</p>
          <p className="heading-serif mt-2 text-4xl font-bold text-ink">{data.inspections}</p>
          <p className="text-xs text-muted">Last seen {formatDate(data.last_seen, false)}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Non-compliant</p>
          <p className="heading-serif mt-2 text-4xl font-bold text-maroon">{data.non_compliant}</p>
          <p className="text-xs text-muted">{Math.round(data.rate)}% of inspections</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Notices issued</p>
          <p className="heading-serif mt-2 text-4xl font-bold text-ink">{data.notices}</p>
          <p className="text-xs text-muted">Active in {data.states.map((s) => stateName(s)).join(', ') || '–'}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="card p-6">
          <SectionTitle hindi="बार-बार होने वाले उल्लंघन">Recurring violations</SectionTitle>
          {data.top_violations.length ? (
            <ul className="space-y-3">
              {data.top_violations.map((v) => (
                <li key={v.id}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">{v.title}</span>
                    <span className="font-semibold">{v.count}×</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-parchment">
                    <div className="h-full rounded-full bg-[var(--chart-b)]" style={{ width: `${(100 * v.count) / maxV}%` }} />
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-muted">{v.rule}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No violations recorded.</p>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="p-6 pb-2">
            <SectionTitle hindi="निरीक्षण इतिहास">Inspection history</SectionTitle>
          </div>
          <ul className="divide-y divide-sand">
            {data.scans.map((s) => (
              <li key={s.id}>
                <Link href={`/scans/${s.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-ivory">
                  {s.image_url ? (
                    <Thumb src={s.image_url} size={44} className="h-11 w-11 rounded-lg border border-sand" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-parchment text-muted">
                      <Icon name="globe" className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{s.product_name}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-mono">{referenceNo(s.id, s.created_at)}</span> {formatDate(s.created_at, false)} ·{' '}
                      {stateName(s.state) || '–'} <SourceTag source={s.source} />
                    </p>
                  </div>
                  <VerdictBadge verdict={s.verdict} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
