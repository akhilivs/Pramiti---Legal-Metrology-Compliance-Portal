'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api,
  effectiveStatus,
  formatDate,
  referenceNo,
  type Check,
  type CheckStatus,
  type ScanDetail,
} from '@/lib/api';
import { useI18n, useCheckTitle } from '@/lib/i18n';
import { DownloadButton } from './DownloadButton';
import { FramedCorners } from './ornaments';
import PhotoViewer, { CHECK_FIELD } from './PhotoViewer';
import {
  DemoBadge,
  ErrorNote,
  FieldLabel,
  Icon,
  Modal,
  NOTICE_META,
  Pill,
  ScoreRing,
  SourceTag,
  STATUS_META,
  StatusPill,
  Spinner,
  useStateName,
  VERDICT_META,
  VerdictBadge,
} from './ui';

const FIELD_ROWS: { key: keyof ScanDetail['fields']; label: string }[] = [
  { key: 'generic_name', label: 'Generic name' },
  { key: 'manufacturer', label: 'Manufacturer / Packer' },
  { key: 'net_quantity', label: 'Net quantity' },
  { key: 'mrp', label: 'MRP' },
  { key: 'unit_sale_price', label: 'Unit sale price' },
  { key: 'date', label: 'Mfg / Pkd date' },
  { key: 'best_before', label: 'Best before' },
  { key: 'consumer_care', label: 'Consumer care' },
  { key: 'country_of_origin', label: 'Country of origin' },
  { key: 'batch_no', label: 'Batch no.' },
  { key: 'fssai_license', label: 'FSSAI licence' },
  { key: 'seller', label: 'Seller' },
];

const ORDER: CheckStatus[] = ['fail', 'unclear', 'pass', 'not_applicable'];

/** Declared vs measured quantity against the First Schedule tolerance. */
function QuantityGauge({ d }: { d: NonNullable<Check['detail']> }) {
  const min = d.declared - d.mpe;
  const lo = Math.min(d.measured, min) - d.mpe * 0.5;
  const hi = d.declared + d.mpe * 0.5;
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  const ok = d.declared - d.measured <= d.mpe;
  return (
    <div className="mt-3 rounded-lg border border-sand bg-ivory/70 p-3">
      <div className="relative h-3 rounded-full bg-maroon-50">
        <div className="absolute inset-y-0 rounded-full bg-green-50 ring-1 ring-green/30" style={{ left: pos(min), right: `calc(100% - ${pos(d.declared)})` }} />
        <div className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: pos(d.declared) }} title="Declared" />
        <div
          className={`absolute -top-1.5 h-6 w-1.5 -translate-x-1/2 rounded ${ok ? 'bg-green' : 'bg-maroon'}`}
          style={{ left: pos(d.measured) }}
          title="Measured"
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
        <span>
          Measured <b className={ok ? 'text-green' : 'text-maroon'}>{d.measured} {d.unit}</b>
        </span>
        <span>
          Allowed minimum <b>{(d.declared - d.mpe).toFixed(1)} {d.unit}</b> (MPE {d.mpe} {d.unit})
        </span>
        <span>
          Declared <b>{d.declared} {d.unit}</b>
        </span>
      </div>
    </div>
  );
}

function NoticeButton({ scan }: { scan: ScanDetail }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(15);
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failed = scan.checks.filter((c) => effectiveStatus(c) === 'fail');
  if (!failed.length) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-saffron px-3 py-2 text-sm">
        <Icon name="stamp" className="h-4 w-4" /> {t('Raise show-cause notice')}
      </button>
      {open && (
        <Modal title={t('Raise show-cause notice')} onClose={() => setOpen(false)}>
          <p className="text-sm text-ink-soft">
            A draft notice will cite these {failed.length} contravention(s) and the penalty provisions of Section 36 of the
            Legal Metrology Act, 2009. A controller must approve it before it is issued.
          </p>
          <ul className="mt-3 space-y-1.5 rounded-lg bg-parchment/60 p-3 text-sm">
            {failed.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className="font-mono text-xs font-semibold text-indigo">{c.rule}</span> {c.title}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-[8rem_1fr]">
            <div>
              <FieldLabel htmlFor="days">Reply within (days)</FieldLabel>
              <input id="days" type="number" min={1} max={90} className="field" value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
            <div>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <input id="remarks" className="field" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          {error && (
            <div className="mt-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>
              {t('Cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const n = await api.createNotice(scan.id, days, remarks);
                  router.push(`/notices/${n.id}`);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not create the notice.');
                  setBusy(false);
                }
              }}
            >
              {busy ? <Spinner className="h-4 w-4" /> : <Icon name="stamp" className="h-4 w-4" />} Create draft notice
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

type Draft = Record<string, { status: CheckStatus | null; note: string }>;

export default function ScanReport({
  scan,
  compact = false,
  onChange,
}: {
  scan: ScanDetail;
  compact?: boolean;
  onChange?: (s: ScanDetail) => void;
}) {
  const { t, lang } = useI18n();
  const checkTitle = useCheckTitle();
  const stateName = useStateName();
  const [focus, setFocus] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const meta = VERDICT_META[scan.verdict];
  const counts = ORDER.map((s) => ({ status: s, n: scan.checks.filter((c) => effectiveStatus(c) === s).length }));
  const sorted = [...scan.checks].sort((a, b) => ORDER.indexOf(effectiveStatus(a)) - ORDER.indexOf(effectiveStatus(b)));
  const failedFields = scan.checks.filter((c) => effectiveStatus(c) === 'fail').map((c) => CHECK_FIELD[c.id]).filter(Boolean);
  const f = scan.fields;
  const summary = lang === 'hi' && scan.summary_hi ? scan.summary_hi : scan.summary;
  const place = [scan.location, scan.district, stateName(scan.state)].filter(Boolean).join(', ');

  const startReview = () => {
    const d: Draft = {};
    scan.checks.forEach((c) => (d[c.id] = { status: c.officer_status ?? null, note: c.officer_note ?? '' }));
    setDraft(d);
    setReviewError(null);
    setReviewing(true);
  };

  const saveReview = async () => {
    setSaving(true);
    setReviewError(null);
    try {
      const updated = await api.review(
        scan.id,
        scan.checks.map((c) => ({ id: c.id, officer_status: draft[c.id]?.status ?? null, officer_note: draft[c.id]?.note || null })),
      );
      onChange?.(updated);
      setReviewing(false);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'Could not save the review.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-rise">
      {/* Verdict header */}
      <div className="card card-framed overflow-hidden p-6">
        <FramedCorners />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ScoreRing score={scan.score} verdict={scan.verdict} size={compact ? 100 : 120} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={scan.verdict} size="lg" />
              <span className="text-deva text-sm text-muted">{meta.hindi}</span>
              {scan.is_demo && <DemoBadge />}
            </div>
            <h3 className="heading-serif mt-2 break-words text-xl sm:truncate sm:text-2xl font-bold text-ink" title={scan.product_name ?? undefined}>
              {scan.product_name || f.generic_name || 'Unnamed product'}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {[scan.manufacturer_name || scan.brand, scan.category].filter(Boolean).join(' · ') || 'Manufacturer not identified'}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="font-semibold text-ink-soft">{referenceNo(scan.id, scan.created_at)}</span>
              <span>· {formatDate(scan.created_at)}</span>
              {place && <span>· {place}</span>}
              <span>·</span> <SourceTag source={scan.source} />
            </p>
            {scan.source_url && (
              <a href={scan.source_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-indigo underline">
                {scan.source_url}
              </a>
            )}
          </div>
        </div>

        {summary && <p className={`mt-5 border-t border-sand pt-4 leading-relaxed text-ink-soft ${lang === 'hi' ? 'text-deva' : ''}`}>{summary}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {counts.map(({ status, n }) => (
            <span key={status} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_META[status].tone}`}>
              {n} {t(STATUS_META[status].label)}
            </span>
          ))}
          <span className="ml-1 text-xs text-muted">
            {scan.review_status === 'reviewed' ? (
              <span className="inline-flex items-center gap-1 font-semibold text-green">
                <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} /> {t('Reviewed')} · {scan.reviewed_by}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-saffron-600">
                <Icon name="question" className="h-3.5 w-3.5" /> {t('Review pending')}
              </span>
            )}
            {scan.ai_verdict && scan.ai_verdict !== scan.verdict && (
              <>
                {' '}
                · {t('AI verdict')}: {t(VERDICT_META[scan.ai_verdict].label)}
              </>
            )}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-sand pt-4">
          {compact && (
            <Link href={`/scans/${scan.id}`} className="btn btn-ghost px-3 py-2 text-sm">
              <Icon name="eye" className="h-4 w-4" /> {t('Review findings')}
            </Link>
          )}
          {!compact && !reviewing && (
            <button onClick={startReview} className="btn btn-ghost px-3 py-2 text-sm">
              <Icon name="check" className="h-4 w-4" /> {t('Review findings')}
            </button>
          )}
          {!compact && <NoticeButton scan={scan} />}
          <DownloadButton id={scan.id} className="btn btn-primary px-3 py-2 text-sm" />
        </div>
        {!compact && (scan.notices.length > 0 || scan.complaint) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {scan.notices.map((n) => (
              <Link key={n.id} href={`/notices/${n.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-2 py-1 hover:bg-parchment">
                <Icon name="stamp" className="h-3.5 w-3.5" /> {n.number || `Draft notice #${n.id}`}
                <Pill tone={NOTICE_META[n.status].tone}>{t(NOTICE_META[n.status].label)}</Pill>
              </Link>
            ))}
            {scan.complaint && (
              <Link href="/complaints" className="inline-flex items-center gap-1.5 rounded-lg border border-sand px-2 py-1 hover:bg-parchment">
                <Icon name="mail" className="h-3.5 w-3.5" /> Complaint {scan.complaint.code}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Photos with AI highlights */}
      <section className="card p-4">
        <PhotoViewer images={scan.image_urls} regions={scan.regions} focus={focus} failedFields={failedFields} height={compact ? 'max-h-80' : 'max-h-[30rem]'} />
        {scan.regions.length > 0 && (
          <p className="mt-2 text-xs text-muted">Hover a finding to see where the AI read it on the pack.</p>
        )}
      </section>

      {/* Rule-wise findings */}
      <section className="card p-0">
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <div>
            <h4 className="heading-serif text-lg font-bold text-indigo">{t('Rule-wise findings')}</h4>
            <p className="text-deva text-xs text-muted">नियमवार निष्कर्ष</p>
          </div>
          <span className="text-xs text-muted">{scan.checks.length} checks</span>
        </div>
        {reviewing && (
          <p className="border-b border-sand bg-indigo-50 px-5 py-3 text-sm text-indigo">
            <b>{t('Officer review')}:</b> confirm each AI finding, or override it with a reason. The verdict is recomputed from your
            decisions and every change is recorded in the audit log.
          </p>
        )}
        <ul className="divide-y divide-sand">
          {sorted.map((c) => {
            const eff = effectiveStatus(c);
            const overridden = !!c.officer_status && c.officer_status !== c.status;
            const d = draft[c.id];
            return (
              <li
                key={c.id}
                className={`border-l-4 px-5 py-3.5 transition-colors ${STATUS_META[eff].ring} ${focus === CHECK_FIELD[c.id] ? 'bg-saffron-50/60' : ''}`}
                onMouseEnter={() => setFocus(CHECK_FIELD[c.id] ?? null)}
                onMouseLeave={() => setFocus(null)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="mr-2 rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo">{c.rule}</span>
                    <span className={`font-semibold text-ink ${lang === 'hi' ? 'text-deva' : ''}`}>{checkTitle(c)}</span>
                    {c.source === 'rule' && (
                      <span className="ml-2 rounded border border-indigo/20 px-1 text-[10px] font-bold uppercase tracking-wide text-indigo" title="Computed by Pramiti, not the AI">
                        computed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {overridden && <span className="text-[11px] text-muted line-through">{t(STATUS_META[c.status].label)}</span>}
                    <StatusPill status={eff} />
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-ink-soft">{c.evidence}</p>
                {c.detail && <QuantityGauge d={c.detail} />}
                {overridden && (
                  <p className="mt-1.5 flex gap-1.5 text-sm text-saffron-600">
                    <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{t('Officer override')}: </span>
                      {c.officer_note}
                    </span>
                  </p>
                )}
                {c.recommendation && eff !== 'pass' && eff !== 'not_applicable' && (
                  <p className="mt-1.5 flex gap-1.5 text-sm text-indigo">
                    <Icon name="arrowRight" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-semibold">{t('Action')}: </span>
                      {c.recommendation}
                    </span>
                  </p>
                )}
                {reviewing && d && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border border-sand bg-ivory p-2.5 sm:flex-row sm:items-center">
                    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Decision for ${c.title}`}>
                      {([null, 'pass', 'fail', 'unclear', 'not_applicable'] as (CheckStatus | null)[]).map((s) => {
                        if (s === c.status) return null; // "Agree" already covers the AI's own status
                        const selected = d.status === s;
                        const label = s === null ? `${t('Agree')} (${t(STATUS_META[c.status].label)})` : t(STATUS_META[s].label);
                        return (
                          <button
                            key={s ?? 'agree'}
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setDraft((p) => ({ ...p, [c.id]: { ...p[c.id], status: s } }))}
                            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                              selected ? 'border-navy bg-navy text-white' : 'border-sand-strong bg-paper text-ink-soft hover:bg-parchment'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {d.status && (
                      <input
                        className="field flex-1 py-1.5 text-sm"
                        placeholder={t('Reason for override')}
                        value={d.note}
                        onChange={(e) => setDraft((p) => ({ ...p, [c.id]: { ...p[c.id], note: e.target.value } }))}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {reviewing && (
          <div className="flex flex-col gap-3 border-t border-sand bg-parchment/50 px-5 py-4">
            {reviewError && <ErrorNote>{reviewError}</ErrorNote>}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setReviewing(false)}>
                {t('Cancel')}
              </button>
              <button className="btn btn-primary" onClick={saveReview} disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />} {t('Confirm review')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Declarations */}
      <section className="card p-5">
        <h4 className="heading-serif text-lg font-bold text-indigo">{t('Declarations read from the label')}</h4>
        <p className="text-deva mb-4 text-xs text-muted">लेबल पर घोषणाएँ</p>
        <dl className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {FIELD_ROWS.filter((r) => r.key !== 'seller' || f.seller).map(({ key, label }) => {
            const val = f[key] as string | null | undefined;
            return (
              <div
                key={key}
                className="rounded-lg border border-sand bg-ivory/60 px-3 py-2.5"
                onMouseEnter={() => setFocus(key)}
                onMouseLeave={() => setFocus(null)}
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t(label)}</dt>
                <dd className={`mt-0.5 break-words text-sm ${val ? 'font-medium text-ink' : 'italic text-maroon/80'}`}>{val || t('Not found')}</dd>
              </div>
            );
          })}
        </dl>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          {f.image_quality && (
            <span>
              Photo quality: <b className="text-ink-soft">{f.image_quality}</b>
            </span>
          )}
          {!!f.languages?.length && (
            <span>
              Languages: <b className="text-ink-soft">{f.languages.join(', ')}</b>
            </span>
          )}
          {f.estimated_pdp_area_cm2 != null && (
            <span>
              Est. display panel: <b className="text-ink-soft">{Math.round(f.estimated_pdp_area_cm2)} cm²</b>
            </span>
          )}
          {f.estimated_numeral_height_mm != null && (
            <span>
              Est. numeral height: <b className="text-ink-soft">{f.estimated_numeral_height_mm} mm</b>
            </span>
          )}
          {scan.measured_quantity && (
            <span>
              Measured: <b className="text-ink-soft">{scan.measured_quantity}</b>
            </span>
          )}
          {f.is_imported && <span className="font-semibold text-saffron-600">Imported product</span>}
        </div>
      </section>

      {!compact && (
        <>
          {scan.notes && (
            <section className="card p-5">
              <h4 className="heading-serif text-lg font-bold text-indigo">{t("Officer's notes")}</h4>
              <p className="mt-2 whitespace-pre-wrap text-ink-soft">{scan.notes}</p>
            </section>
          )}
          <details className="card group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <span className="heading-serif text-lg font-bold text-indigo">{t('Full text transcribed from label')}</span>
              <span className="text-muted transition group-open:rotate-90">›</span>
            </summary>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-parchment/60 p-4 font-mono text-xs leading-relaxed text-ink-soft">
              {scan.raw_text || 'No text detected.'}
            </p>
            {scan.model && <p className="mt-2 text-right text-[11px] text-muted">Analysed by {scan.model}</p>}
          </details>
        </>
      )}
    </div>
  );
}
