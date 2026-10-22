'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, formatDate, type PublicComplaint } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { COMPLAINT_META, ErrorNote, Icon, PageSkeleton, Spinner, VerdictBadge } from '@/components/ui';

const STEPS = ['received', 'under_review', 'action_taken', 'closed'] as const;

export default function TrackPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Track />
    </Suspense>
  );
}

function Track() {
  const params = useSearchParams();
  const { t, lang } = useI18n();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [data, setData] = useState<PublicComplaint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setData(await api.trackComplaint(c));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Not found.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const initial = params.get('code');
    if (initial) queueMicrotask(() => lookup(initial));
  }, [params, lookup]);

  const step = data ? STEPS.indexOf(data.status) : -1;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="heading-serif text-center text-4xl font-bold text-indigo">{t('Track complaint')}</h1>
      <p className="text-deva text-center text-lg text-saffron-600">शिकायत की स्थिति</p>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code);
        }}
      >
        <input
          className="field font-mono uppercase tracking-widest"
          placeholder="LM-XXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Tracking number"
        />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Icon name="search" className="h-4 w-4" />} {t('Search')}
        </button>
      </form>

      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {data && (
        <div className="card mt-6 p-6 animate-rise">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xl font-bold text-ink">{data.code}</span>
            <span className="text-sm text-muted">Filed {formatDate(data.submitted_at)}</span>
          </div>
          {data.product_name && <p className="mt-1 text-ink-soft">{data.product_name}</p>}

          <ol className="mt-6 grid grid-cols-4 gap-1">
            {STEPS.map((s, i) => (
              <li key={s} className="text-center">
                <div className={`h-1.5 rounded-full ${i <= step ? 'bg-saffron' : 'bg-sand'}`} />
                <p className={`mt-1.5 text-xs font-semibold ${i <= step ? 'text-indigo' : 'text-muted'}`}>{t(COMPLAINT_META[s].label)}</p>
              </li>
            ))}
          </ol>

          {data.officer_note && (
            <div className="mt-5 rounded-lg border-l-4 border-indigo bg-indigo-50 p-4 text-sm text-ink">
              <p className="eyebrow">Update from the department</p>
              <p className="mt-1">{data.officer_note}</p>
              <p className="mt-1 text-xs text-muted">{formatDate(data.updated_at)}</p>
            </div>
          )}
          {data.preliminary && (
            <div className="mt-5 rounded-lg border border-sand bg-ivory p-4">
              <p className="eyebrow">Automatic preliminary check</p>
              <div className="mt-2">
                <VerdictBadge verdict={data.preliminary.verdict} />
              </div>
              <p className={`mt-2 text-sm text-ink-soft ${lang === 'hi' ? 'text-deva' : ''}`}>
                {lang === 'hi' ? data.preliminary.summary_hi : data.preliminary.summary}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
