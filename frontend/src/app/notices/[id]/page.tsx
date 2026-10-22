'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, downloadNotice, formatDate, type Notice } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import { FramedCorners } from '@/components/ornaments';
import {
  DemoBadge,
  ErrorNote,
  FieldLabel,
  Icon,
  Modal,
  NOTICE_META,
  PageHeader,
  PageSkeleton,
  Pill,
  SectionTitle,
  Spinner,
} from '@/components/ui';

const STEPS = ['draft', 'approved', 'issued', 'replied', 'closed'] as const;

export default function NoticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { can } = useAuth();
  const [n, setN] = useState<Notice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'edit' | 'reply' | 'close' | null>(null);
  const [text, setText] = useState('');
  const [addressee, setAddressee] = useState('');
  const [days, setDays] = useState(15);

  useEffect(() => {
    api.notice(id).then(setN).catch((e) => setError(e.message));
  }, [id]);

  if (!n) return error ? <ErrorNote>{error}</ErrorNote> : <PageSkeleton />;

  const act = async (fn: () => Promise<Notice>) => {
    setBusy(true);
    setError(null);
    try {
      setN(await fn());
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = STEPS.indexOf(n.status);
  const timeline = [
    { label: 'Drafted', who: n.created_by, at: n.created_at },
    n.approved_at && { label: 'Approved', who: n.approved_by, at: n.approved_at },
    n.issued_at && { label: `Issued as ${n.number}`, who: n.approved_by, at: n.issued_at },
    n.reply_text && { label: 'Reply received', who: null, at: null },
    n.closed_at && { label: 'Closed', who: null, at: n.closed_at },
  ].filter(Boolean) as { label: string; who: string | null; at: string | null }[];

  return (
    <div>
      <PageHeader
        eyebrow={n.scan_ref ?? 'Notice'}
        title={n.number ? `Notice ${n.number}` : `Draft notice #${n.id}`}
        hindi="कारण बताओ नोटिस"
        actions={
          <>
            <Link href="/notices" className="btn btn-ghost">
              <Icon name="arrowLeft" className="h-4 w-4" /> {t('Notices')}
            </Link>
            <button className="btn btn-primary" onClick={() => downloadNotice(n).catch((e) => setError(e.message))}>
              <Icon name="download" className="h-4 w-4" /> PDF
            </button>
          </>
        }
      />

      {/* Progress */}
      <ol className="mb-6 grid grid-cols-5 gap-1">
        {STEPS.map((s, i) => (
          <li key={s} className="text-center">
            <div className={`h-1.5 rounded-full ${i <= stepIndex ? 'bg-saffron' : 'bg-sand'}`} />
            <p className={`mt-1.5 text-xs font-semibold ${i <= stepIndex ? 'text-indigo' : 'text-muted'}`}>{t(NOTICE_META[s].label)}</p>
          </li>
        ))}
      </ol>

      {error && (
        <div className="mb-5">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card card-framed p-6">
          <FramedCorners />
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={NOTICE_META[n.status].tone}>{t(NOTICE_META[n.status].label)}</Pill>
            {n.overdue && <Pill tone="bg-maroon text-white border-maroon">{t('Overdue')}</Pill>}
            {n.is_demo && <DemoBadge />}
          </div>
          <p className="eyebrow mt-5">To</p>
          <p className="whitespace-pre-wrap text-ink">{n.addressee}</p>
          <p className="eyebrow mt-5">In respect of</p>
          <p className="text-ink">
            <Link href={`/scans/${n.scan_id}`} className="font-semibold text-indigo hover:underline">
              {n.product_name}
            </Link>{' '}
            ({n.scan_ref})
          </p>

          <p className="eyebrow mt-5">Contraventions</p>
          <ol className="mt-2 space-y-2">
            {n.violations.map((v, i) => (
              <li key={v.id} className="rounded-lg border border-sand bg-ivory/60 p-3 text-sm">
                <span className="mr-2 font-semibold text-muted">{i + 1}.</span>
                <span className="mr-2 rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo">{v.rule}</span>
                <span className="font-semibold text-ink">{v.title}</span>
                <p className="mt-1 text-ink-soft">{v.evidence}</p>
              </li>
            ))}
          </ol>

          <p className="eyebrow mt-5">Penal provisions</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
            {n.sections.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-soft">
            Reply within <b>{n.reply_days} days</b>
            {n.reply_due && (
              <>
                {' '}
                - due by <b className={n.overdue ? 'text-maroon' : ''}>{formatDate(n.reply_due, false)}</b>
              </>
            )}
            . {n.remarks && <>Remarks: {n.remarks}</>}
          </p>

          {n.reply_text && (
            <div className="mt-5 rounded-lg border-l-4 border-indigo bg-indigo-50 p-4 text-sm">
              <p className="eyebrow">Reply from the manufacturer</p>
              <p className="mt-1 whitespace-pre-wrap text-ink">{n.reply_text}</p>
            </div>
          )}
          {n.outcome && (
            <div className="mt-3 rounded-lg border-l-4 border-green bg-green-50 p-4 text-sm">
              <p className="eyebrow">Outcome</p>
              <p className="mt-1 whitespace-pre-wrap text-ink">{n.outcome}</p>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="card p-5">
            <SectionTitle>Next step</SectionTitle>
            <div className="flex flex-col gap-2">
              {n.status === 'draft' && (
                <>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setAddressee(n.addressee);
                      setText(n.remarks ?? '');
                      setDays(n.reply_days);
                      setModal('edit');
                    }}
                  >
                    <Icon name="doc" className="h-4 w-4" /> Edit draft
                  </button>
                  {can('controller') ? (
                    <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.noticeAction(n.id, 'approve'))}>
                      {busy ? <Spinner className="h-4 w-4" /> : <Icon name="check" className="h-4 w-4" />} {t('Approve')}
                    </button>
                  ) : (
                    <p className="text-sm text-muted">Awaiting approval by a controller.</p>
                  )}
                  <button
                    className="btn text-maroon hover:bg-maroon-50"
                    onClick={async () => {
                      if (!confirm('Delete this draft notice?')) return;
                      await api.deleteNotice(n.id);
                      router.push('/notices');
                    }}
                  >
                    <Icon name="trash" className="h-4 w-4" /> {t('Delete')}
                  </button>
                </>
              )}
              {n.status === 'approved' &&
                (can('controller') ? (
                  <button className="btn btn-saffron" disabled={busy} onClick={() => act(() => api.noticeAction(n.id, 'issue'))}>
                    {busy ? <Spinner className="h-4 w-4" /> : <Icon name="stamp" className="h-4 w-4" />} {t('Issue')} - allot number
                  </button>
                ) : (
                  <p className="text-sm text-muted">Approved - awaiting issue by a controller.</p>
                ))}
              {n.status === 'issued' && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setText('');
                    setModal('reply');
                  }}
                >
                  <Icon name="mail" className="h-4 w-4" /> {t('Record reply')}
                </button>
              )}
              {(n.status === 'issued' || n.status === 'replied') && can('controller') && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setText('');
                    setModal('close');
                  }}
                >
                  <Icon name="check" className="h-4 w-4" /> {t('Close')} with outcome
                </button>
              )}
              {n.status === 'closed' && <p className="text-sm text-green">This notice is closed.</p>}
            </div>
          </section>

          <section className="card p-5">
            <SectionTitle>History</SectionTitle>
            <ol className="relative space-y-4 border-l border-sand pl-5">
              {timeline.map((e) => (
                <li key={e.label} className="relative">
                  <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-paper bg-saffron" />
                  <p className="text-sm font-semibold text-ink">{e.label}</p>
                  <p className="text-xs text-muted">{[e.who, e.at && formatDate(e.at)].filter(Boolean).join(' · ')}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {modal === 'edit' && (
        <Modal title="Edit draft notice" onClose={() => setModal(null)}>
          <FieldLabel htmlFor="addr">Addressee</FieldLabel>
          <textarea id="addr" rows={3} className="field" value={addressee} onChange={(e) => setAddressee(e.target.value)} />
          <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
            <div>
              <FieldLabel htmlFor="d">Reply days</FieldLabel>
              <input id="d" type="number" min={1} max={90} className="field" value={days} onChange={(e) => setDays(Number(e.target.value))} />
            </div>
            <div>
              <FieldLabel htmlFor="r">Remarks</FieldLabel>
              <input id="r" className="field" value={text} onChange={(e) => setText(e.target.value)} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>
              {t('Cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.updateNotice(n.id, { addressee, remarks: text, reply_days: days }))}>
              {t('Save')}
            </button>
          </div>
        </Modal>
      )}
      {(modal === 'reply' || modal === 'close') && (
        <Modal title={modal === 'reply' ? t('Record reply') : 'Close notice'} onClose={() => setModal(null)}>
          <FieldLabel htmlFor="txt">{modal === 'reply' ? 'Reply received from the manufacturer' : 'Outcome (e.g. compounded, prosecution, warning)'}</FieldLabel>
          <textarea id="txt" rows={5} className="field" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setModal(null)}>
              {t('Cancel')}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || !text.trim()}
              onClick={() => act(() => (modal === 'reply' ? api.noticeReply(n.id, text) : api.noticeClose(n.id, text)))}
            >
              {t('Save')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
