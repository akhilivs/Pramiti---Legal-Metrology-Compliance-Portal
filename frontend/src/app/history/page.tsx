'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, formatDate, referenceNo, type ScanSummary, type Verdict } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import { DownloadButton } from '@/components/DownloadButton';
import {
  DemoBadge,
  EmptyState,
  ErrorNote,
  Icon,
  PageHeader,
  PageSkeleton,
  SkeletonRows,
  SourceTag,
  StateSelect,
  Thumb,
  useStateName,
  VerdictBadge,
} from '@/components/ui';

const FILTERS: { key: Verdict | ''; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'non_compliant', label: 'Non-compliant' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'compliant', label: 'Compliant' },
];

export default function HistoryPage() {
  return (
    <Suspense fallback={<PageSkeleton layout="list" />}>
      <Register />
    </Suspense>
  );
}

function Register() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const { can } = useAuth();
  const stateName = useStateName();
  const [scans, setScans] = useState<ScanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [verdict, setVerdict] = useState<Verdict | ''>((params.get('verdict') as Verdict) || '');
  const [source, setSource] = useState(params.get('source') || '');
  const [state, setState] = useState(params.get('state') || '');
  const [review, setReview] = useState(params.get('review') || '');

  const load = useCallback(() => {
    api
      .scans({ q: q.trim(), verdict, source, state, review })
      .then((s) => {
        setError(null);
        setScans(s);
      })
      .catch((e) => setError(e.message));
  }, [q, verdict, source, state, review]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async (s: ScanSummary) => {
    if (!confirm(`Delete inspection ${referenceNo(s.id, s.created_at)}? This cannot be undone.`)) return;
    try {
      await api.deleteScan(s.id);
      setScans((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const exportCsv = () => {
    if (!scans?.length) return;
    const rows = [
      ['Reference', 'Date', 'Product', 'Brand', 'Manufacturer', 'Source', 'State', 'District', 'Place', 'Verdict', 'AI verdict', 'Score', 'Failed checks', 'Review'],
      ...scans.map((s) => [
        referenceNo(s.id, s.created_at),
        s.created_at,
        s.product_name ?? '',
        s.brand ?? '',
        s.manufacturer_name ?? '',
        s.source,
        stateName(s.state) ?? '',
        s.district ?? '',
        s.location ?? '',
        s.verdict,
        s.ai_verdict ?? '',
        String(s.score),
        String(s.fail_count),
        s.review_status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pramiti_register_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Inspection Register"
        hindi="निरीक्षण पंजी"
        description="Every inspection with its verdict, officer review status and downloadable report."
        actions={
          <>
            <button onClick={exportCsv} className="btn btn-ghost" disabled={!scans?.length}>
              <Icon name="download" className="h-4 w-4" /> CSV
            </button>
            <Link href="/" className="btn btn-saffron">
              <Icon name="plus" className="h-4 w-4" /> {t('New inspection')}
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            className="field pl-10"
            placeholder="Search product, brand, manufacturer, place or ID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t('Search')}
          />
        </div>
        <select className="field" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
          <option value="">{t('All sources')}</option>
          <option value="label">{t('Product label')}</option>
          <option value="ecommerce">{t('E-commerce')}</option>
          <option value="complaint">{t('Complaint')}</option>
        </select>
        <StateSelect value={state} onChange={setState} placeholder={t('All states')} />
        <select className="field" value={review} onChange={(e) => setReview(e.target.value)} aria-label="Review status">
          <option value="">Any review status</option>
          <option value="pending">{t('Review pending')}</option>
          <option value="reviewed">{t('Reviewed')}</option>
        </select>
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Filter by verdict">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setVerdict(f.key)}
            aria-pressed={verdict === f.key}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              verdict === f.key ? 'border-navy bg-navy text-white' : 'border-sand-strong bg-paper text-ink-soft hover:bg-parchment'
            }`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5">
          <ErrorNote onRetry={load}>{error}</ErrorNote>
        </div>
      )}

      <div className="card overflow-hidden">
        {scans === null && !error ? (
          <SkeletonRows rows={8} thumb />
        ) : !scans?.length ? (
          <EmptyState title="No inspections found">
            {q || verdict || source || state || review ? 'Try a different search or filter.' : 'Inspections you record will appear here.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/70 text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Reference & date</th>
                  <th className="px-4 py-3 font-semibold">Place</th>
                  <th className="px-4 py-3 font-semibold">Verdict</th>
                  <th className="px-4 py-3 text-right font-semibold">Score</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {scans.map((s) => (
                  <tr key={s.id} className="cursor-pointer transition-colors hover:bg-ivory" onClick={() => router.push(`/scans/${s.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.image_url ? (
                          <Thumb src={s.image_url} size={44} className="h-11 w-11 rounded-lg border border-sand" />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-parchment text-muted">
                            <Icon name="globe" className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/scans/${s.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block max-w-[16rem] truncate font-semibold text-ink hover:text-indigo"
                          >
                            {s.product_name || 'Unnamed product'}
                          </Link>
                          <p className="flex max-w-[16rem] items-center gap-2 truncate text-xs text-muted">
                            <SourceTag source={s.source} />
                            {s.is_demo && <DemoBadge />}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-ink-soft">{referenceNo(s.id, s.created_at)}</p>
                      <p className="text-xs text-muted">{formatDate(s.created_at)}</p>
                    </td>
                    <td className="max-w-[12rem] px-4 py-3 text-ink-soft">
                      <p className="truncate">{s.location || s.district || <span className="text-muted">–</span>}</p>
                      <p className="truncate text-xs text-muted">{stateName(s.state)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <VerdictBadge verdict={s.verdict} />
                      <p className="mt-1 text-xs">
                        {s.review_status === 'reviewed' ? (
                          <span className="text-green">✓ {t('Reviewed')}</span>
                        ) : (
                          <span className="text-saffron-600">{t('Review pending')}</span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="heading-serif text-lg font-bold text-ink">{Math.round(s.score)}%</span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1.5">
                        <DownloadButton id={s.id} className="btn btn-ghost px-2.5 py-1.5 text-xs" />
                        {can('controller') && (
                          <button
                            onClick={() => remove(s)}
                            className="btn px-2 py-1.5 text-muted hover:bg-maroon-50 hover:text-maroon"
                            title="Delete inspection"
                            aria-label="Delete inspection"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!!scans?.length && <p className="mt-3 text-right text-xs text-muted">{scans.length} inspections</p>}
    </div>
  );
}
