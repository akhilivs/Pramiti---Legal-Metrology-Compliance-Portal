'use client';
import { useEffect, useState } from 'react';
import { api, formatDate, type Accuracy } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import { DemoBadge, EmptyState, ErrorNote, PageHeader, PageSkeleton, SectionTitle } from '@/components/ui';

function Meter({ value, label, sub }: { value: number | null; label: string; sub: string }) {
  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      <p className="heading-serif mt-2 text-4xl font-bold text-ink">{value == null ? '–' : `${value}%`}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-parchment">
        <div className="h-full rounded-full bg-indigo" style={{ width: `${value ?? 0}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </div>
  );
}

const pct = (v: number | null) => (v == null ? '–' : `${v}%`);

export default function AccuracyPage() {
  const { can } = useAuth();
  const { t } = useI18n();
  const [includeDemo, setIncludeDemo] = useState(true);
  const [data, setData] = useState<Accuracy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.accuracy(includeDemo).then(setData).catch((e) => setError(e.message));
  }, [includeDemo]);

  if (!can('controller')) return <ErrorNote>This page is available to controllers and administrators.</ErrorNote>;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PageSkeleton layout="dashboard" />;

  return (
    <div>
      <PageHeader
        eyebrow="Human oversight"
        title={t('AI Accuracy')}
        hindi="एआई सटीकता"
        description="Every officer review is a ground-truth label. This page measures how often officers agreed with the AI, rule by rule, so you know where the AI can be trusted and where it needs a closer look."
        actions={
          <label className="flex items-center gap-2 rounded-full border border-sand-strong bg-paper px-3 py-1.5 text-sm text-ink-soft">
            <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} className="accent-[var(--indigo)]" />
            Include demo data
          </label>
        }
      />

      {includeDemo && data.demo_scans > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-dashed border-gold bg-parchment/60 px-4 py-3 text-sm text-ink-soft">
          <DemoBadge /> {data.demo_scans} of {data.reviewed_scans} reviewed inspections are demonstration records with simulated reviews.
          Untick &ldquo;Include demo data&rdquo; to see figures from real reviews only.
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="eyebrow">Reviewed inspections</p>
          <p className="heading-serif mt-2 text-4xl font-bold text-ink">{data.reviewed_scans}</p>
          <p className="mt-2 text-xs text-muted">Inspections where an officer confirmed or overrode the AI findings.</p>
        </div>
        <Meter value={data.check_agreement} label="Check-level agreement" sub="Share of individual AI findings officers kept unchanged." />
        <Meter value={data.verdict_agreement} label="Verdict agreement" sub="Inspections whose final verdict matched the AI's verdict." />
      </div>

      <section className="card overflow-hidden">
        <div className="p-6 pb-2">
          <SectionTitle hindi="नियमवार सटीकता">Accuracy by check</SectionTitle>
          <p className="-mt-2 mb-2 text-sm text-muted">
            <b>Precision</b>: when the AI said &ldquo;fail&rdquo;, how often the officer agreed. <b>Recall</b>: of the real failures, how
            many the AI caught.
          </p>
        </div>
        {!data.checks.length ? (
          <EmptyState title="No reviews yet">Review inspections from the register to build the accuracy record.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-y border-sand bg-parchment/70 text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-semibold">Check</th>
                  <th className="px-4 py-3 text-right font-semibold">Reviewed</th>
                  <th className="px-4 py-3 font-semibold">Agreement</th>
                  <th className="px-4 py-3 text-right font-semibold">Precision</th>
                  <th className="px-4 py-3 text-right font-semibold">Recall</th>
                  <th className="px-4 py-3 text-right font-semibold">Missed / false alarms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {data.checks.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-ink">{r.title}</p>
                      <p className="font-mono text-[11px] text-muted">{r.rule}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{r.reviewed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-parchment">
                          <div
                            className={`h-full rounded-full ${(r.agreement ?? 0) >= 90 ? 'bg-green' : (r.agreement ?? 0) >= 75 ? 'bg-saffron' : 'bg-maroon'}`}
                            style={{ width: `${r.agreement ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-ink">{pct(r.agreement)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{pct(r.precision)}</td>
                    <td className="px-4 py-3 text-right">{pct(r.recall)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted">
                      {r.fn} / {r.fp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card mt-6 p-6">
        <SectionTitle hindi="बेंचमार्क">Offline benchmark</SectionTitle>
        {data.benchmark ? (
          <>
            <p className="text-sm text-ink-soft">
              Last run {formatDate(data.benchmark.run_at)} on {data.benchmark.images} labelled photos with {data.benchmark.model}.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-sand text-xs uppercase tracking-wider text-muted">
                    <th className="py-2 font-semibold">Check</th>
                    <th className="py-2 text-right font-semibold">Photos</th>
                    <th className="py-2 text-right font-semibold">Accuracy</th>
                    <th className="py-2 text-right font-semibold">Precision</th>
                    <th className="py-2 text-right font-semibold">Recall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {data.benchmark.checks.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 text-ink">{c.title}</td>
                      <td className="py-2 text-right">{c.n}</td>
                      <td className="py-2 text-right font-semibold">{pct(c.accuracy)}</td>
                      <td className="py-2 text-right">{pct(c.precision)}</td>
                      <td className="py-2 text-right">{pct(c.recall)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-soft">
            No benchmark has been run yet. Put labelled photos in <code className="rounded bg-sand/60 px-1">backend/benchmark/</code> with a{' '}
            <code className="rounded bg-sand/60 px-1">labels.json</code> and run <code className="rounded bg-sand/60 px-1">python benchmark.py</code>{' '}
            - the results appear here.
          </p>
        )}
      </section>
    </div>
  );
}
