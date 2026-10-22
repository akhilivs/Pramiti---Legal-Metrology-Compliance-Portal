'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, formatDate, type Batch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { ErrorNote, Icon, PageHeader, PageSkeleton, Pill, Spinner, useStateName, VerdictBadge } from '@/components/ui';

export default function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const stateName = useStateName();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = () =>
      api
        .batch(id)
        .then((b) => {
          if (stopped) return;
          setBatch(b);
          if (b.status !== 'done') timer = setTimeout(poll, 3000);
        })
        .catch((e) => setError(e.message));
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!batch) return <PageSkeleton layout="list" />;

  const finished = batch.done + batch.failed;
  const pct = batch.total ? Math.round((100 * finished) / batch.total) : 0;
  const compliant = batch.items?.filter((i) => i.verdict === 'compliant').length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow={`Batch #${batch.id} · ${formatDate(batch.created_at)}`}
        title={batch.name}
        hindi="थोक जाँच"
        description={[stateName(batch.state), batch.location].filter(Boolean).join(' · ') || undefined}
        actions={
          <Link href="/batch" className="btn btn-ghost">
            <Icon name="arrowLeft" className="h-4 w-4" /> {t('Bulk scan')}
          </Link>
        }
      />

      <div className="card mb-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Progress</p>
            <p className="heading-serif text-4xl font-bold text-ink">
              {finished}/{batch.total}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="bg-maroon-50 text-maroon border-maroon/25">{batch.non_compliant} non-compliant</Pill>
            <Pill tone="bg-green-50 text-green border-green/25">{compliant} compliant</Pill>
            {batch.failed > 0 && <Pill tone="bg-parchment text-ink-soft border-sand-strong">{batch.failed} could not be analysed</Pill>}
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-parchment" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-saffron to-indigo transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {batch.status !== 'done' && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Analysing in the background - this page updates automatically.
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-sand bg-parchment/70 text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 text-right font-semibold">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {batch.items?.map((it, i) => (
                <tr key={it.id} className="hover:bg-ivory">
                  <td className="px-4 py-3 text-muted">{i + 1}</td>
                  <td className="max-w-[16rem] px-4 py-3">
                    <span className="flex items-center gap-2 truncate text-ink-soft" title={it.label}>
                      <Icon name={it.kind === 'url' ? 'globe' : 'image'} className="h-4 w-4 shrink-0 text-muted" />
                      <span className="truncate">{it.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {it.scan_id ? (
                      <Link href={`/scans/${it.scan_id}`} className="font-semibold text-indigo hover:underline">
                        {it.product_name || 'View inspection'}
                      </Link>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {it.status === 'done' && it.verdict ? (
                      <VerdictBadge verdict={it.verdict} />
                    ) : it.status === 'failed' ? (
                      <span className="text-xs text-maroon" title={it.error ?? ''}>
                        ✕ {it.error?.slice(0, 80)}
                      </span>
                    ) : it.status === 'running' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-saffron-600">
                        <Spinner className="h-3.5 w-3.5" /> Analysing…
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Queued</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">{it.score != null ? `${Math.round(it.score)}%` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
