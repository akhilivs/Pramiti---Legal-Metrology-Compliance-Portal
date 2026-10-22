'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, formatDate, type Insights } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import IndiaTileMap from '@/components/IndiaTileMap';
import { DemoBadge, EmptyState, ErrorNote, Icon, PageHeader, PageSkeleton, RISK_META, SectionTitle } from '@/components/ui';

export default function InsightsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<'all' | 'high'>('all');

  useEffect(() => {
    api.insights().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PageSkeleton layout="dashboard" />;

  const offenders = data.offenders.filter((o) => riskFilter === 'all' || o.risk === 'high');
  const maxRule = Math.max(1, ...data.rules.map((r) => r.count));
  const maxCat = Math.max(1, ...data.categories.map((c) => c.count));
  const highRisk = data.offenders.filter((o) => o.risk === 'high').length;

  return (
    <div>
      <PageHeader
        eyebrow="Enforcement intelligence"
        title="Insights"
        hindi="प्रवर्तन विश्लेषण"
        description="Where violations are concentrated, which manufacturers repeatedly break the rules, and which declarations are most often wrong."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <section className="card p-6">
          <SectionTitle hindi="राज्यवार अनुपालन">State-wise compliance</SectionTitle>
          <IndiaTileMap states={data.states} />
          {data.unlocated > 0 && <p className="mt-2 text-center text-xs text-muted">{data.unlocated} inspections have no state recorded.</p>}
        </section>

        <div className="flex flex-col gap-6">
          <section className="card p-6">
            <SectionTitle hindi="नियमवार उल्लंघन">Violations by rule</SectionTitle>
            {data.rules.length ? (
              <ul className="space-y-2.5">
                {data.rules.slice(0, 9).map((r) => (
                  <li key={r.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-ink">{r.title}</span>
                      <span className="font-semibold text-ink">{r.count}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-parchment">
                        <div className="h-full rounded-full bg-[var(--chart-b)]" style={{ width: `${(100 * r.count) / maxRule}%` }} />
                      </div>
                      <span className="w-28 whitespace-nowrap text-right font-mono text-[10px] text-muted">{r.rule}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No violations recorded yet.</p>
            )}
          </section>

          <section className="card p-6">
            <SectionTitle hindi="श्रेणीवार अननुपालन">Non-compliance by category</SectionTitle>
            {data.categories.length ? (
              <ul className="space-y-2">
                {data.categories.map((c) => (
                  <li key={c.name} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate text-ink-soft">{c.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-parchment">
                      <div className="h-full rounded-full bg-[var(--chart-a)]" style={{ width: `${(100 * c.count) / maxCat}%` }} />
                    </div>
                    <span className="w-6 text-right font-semibold text-ink">{c.count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No data yet.</p>
            )}
            <p className="mt-4 flex flex-wrap gap-3 border-t border-sand pt-3 text-xs text-muted">
              {Object.entries(data.sources).map(([k, v]) => (
                <span key={k}>
                  {k === 'ecommerce' ? 'E-commerce' : k === 'complaint' ? 'Complaints' : 'Field labels'}: <b className="text-ink">{v}</b>
                </span>
              ))}
            </p>
          </section>
        </div>
      </div>

      <section className="card mt-6 overflow-hidden" id="offenders">
        <div className="flex flex-wrap items-end justify-between gap-3 p-6 pb-4">
          <SectionTitle hindi="बार-बार उल्लंघन करने वाले निर्माता">Repeat offenders</SectionTitle>
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-soft">
              <b className="text-maroon">{highRisk}</b> high-risk manufacturers
            </span>
            <div className="flex rounded-full border border-sand-strong p-0.5 text-xs font-semibold">
              {(['all', 'high'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r)}
                  className={`rounded-full px-3 py-1 ${riskFilter === r ? 'bg-navy text-white' : 'text-ink-soft'}`}
                >
                  {r === 'all' ? t('All') : 'High risk'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {!offenders.length ? (
          <EmptyState title="No manufacturers yet">Manufacturers are grouped automatically as inspections are recorded.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-y border-sand bg-parchment/70 text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-semibold">Manufacturer</th>
                  <th className="px-4 py-3 font-semibold">Risk</th>
                  <th className="px-4 py-3 text-right font-semibold">Inspections</th>
                  <th className="px-4 py-3 font-semibold">Non-compliance</th>
                  <th className="px-4 py-3 font-semibold">Recurring violations</th>
                  <th className="px-4 py-3 font-semibold">States</th>
                  <th className="px-4 py-3 text-right font-semibold">Notices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {offenders.map((o) => (
                  <tr key={o.key} className="cursor-pointer hover:bg-ivory" onClick={() => router.push(`/offenders/${encodeURIComponent(o.key)}`)}>
                    <td className="px-5 py-3">
                      <Link
                        href={`/offenders/${encodeURIComponent(o.key)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-ink hover:text-indigo"
                      >
                        {o.name}
                      </Link>
                      <p className="flex items-center gap-2 text-xs text-muted">
                        {o.brands.join(', ') || '–'} {o.is_demo && <DemoBadge />}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${RISK_META[o.risk].tone}`}>{RISK_META[o.risk].label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{o.inspections}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-parchment">
                          <div className="h-full rounded-full bg-[var(--chart-b)]" style={{ width: `${o.rate}%` }} />
                        </div>
                        <span className="text-xs text-ink-soft">
                          {o.non_compliant}/{o.inspections} · {Math.round(o.rate)}%
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3 text-xs text-ink-soft">
                      {o.top_violations
                        .slice(0, 2)
                        .map((v) => `${v.title} (${v.count})`)
                        .join('; ') || '–'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{o.states.join(', ') || '–'}</td>
                    <td className="px-4 py-3 text-right text-ink">{o.notices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-sand px-5 py-3 text-xs text-muted">
          Risk: <b>high</b> = 3+ non-compliant inspections, or 2+ with a non-compliance rate of 60% or more. Manufacturer names are
          normalised (e.g. &ldquo;M/s ABC Foods Pvt. Ltd.&rdquo; = &ldquo;ABC Foods&rdquo;) so repeat violations are grouped.
          <span className="ml-1">Last updated {formatDate(new Date().toISOString())}.</span>
        </p>
      </section>
      <p className="mt-4 text-right">
        <Link href="/history?verdict=non_compliant" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo hover:text-saffron-600">
          All non-compliant inspections <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </p>
    </div>
  );
}
