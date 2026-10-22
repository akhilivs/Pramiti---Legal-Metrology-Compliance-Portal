'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, formatDate, type Complaint, type ComplaintStatus } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  COMPLAINT_META,
  DemoBadge,
  EmptyState,
  ErrorNote,
  FieldLabel,
  Icon,
  Modal,
  PageHeader,
  Pill,
  SkeletonCards,
  Thumb,
  useStateName,
  VerdictBadge,
} from '@/components/ui';

const TABS: (ComplaintStatus | '')[] = ['', 'received', 'under_review', 'action_taken', 'closed'];

export default function ComplaintsDesk() {
  const { t } = useI18n();
  const stateName = useStateName();
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ComplaintStatus | ''>('');
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [status, setStatus] = useState<ComplaintStatus>('under_review');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.complaints().then(setItems).catch((e) => setError(e.message));
  }, []);

  const save = async (c: Complaint, data: Parameters<typeof api.updateComplaint>[1]) => {
    setBusy(true);
    try {
      const updated = await api.updateComplaint(c.id, data);
      setItems((prev) => prev?.map((x) => (x.id === c.id ? updated : x)) ?? null);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const shown = items?.filter((c) => !tab || c.status === tab) ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Citizen reports"
        title="Complaint Desk"
        hindi="शिकायत डेस्क"
        description="Complaints from consumers through the public portal. Each one is pre-screened by the AI so officers can prioritise."
        actions={
          <Link href="/complaint" target="_blank" className="btn btn-ghost">
            <Icon name="globe" className="h-4 w-4" /> Open public portal
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setTab(s)}
            aria-pressed={tab === s}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              tab === s ? 'border-navy bg-navy text-white' : 'border-sand-strong bg-paper text-ink-soft hover:bg-parchment'
            }`}
          >
            {s ? t(COMPLAINT_META[s].label) : t('All')}{' '}
            {items && <span className="opacity-60">({items.filter((c) => !s || c.status === s).length})</span>}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {items === null && !error ? (
        <SkeletonCards />
      ) : !shown.length ? (
        <div className="card">
          <EmptyState title="No complaints">Complaints submitted at /complaint appear here.</EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {shown.map((c) => (
            <li key={c.id} className="card flex min-w-0 flex-col p-4 sm:p-5">
              <div className="flex items-start gap-4">
                {c.scan?.image_url ? (
                  <Thumb src={c.scan.image_url} size={80} className="h-20 w-20 shrink-0 rounded-lg border border-sand" />
                ) : (
                  <span className="h-20 w-20 shrink-0 rounded-lg bg-parchment" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-indigo">{c.code}</span>
                    <Pill tone={COMPLAINT_META[c.status].tone}>{t(COMPLAINT_META[c.status].label)}</Pill>
                    {c.is_demo && <DemoBadge />}
                  </div>
                  <p className="mt-1 truncate font-semibold text-ink">{c.scan?.product_name || 'Product not identified'}</p>
                  <p className="text-xs text-muted">
                    {formatDate(c.created_at)} · {[c.place, stateName(c.state)].filter(Boolean).join(', ') || 'Place not given'}
                    {c.purchased_online && ' · bought online'}
                  </p>
                </div>
              </div>
              <p className="mt-3 rounded-lg bg-parchment/60 p-3 text-sm italic text-ink-soft">&ldquo;{c.description}&rdquo;</p>
              {c.scan && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">AI pre-screen:</span>
                  <VerdictBadge verdict={c.scan.ai_verdict ?? c.scan.verdict} />
                  <span className="text-xs text-muted">{c.scan.fail_count} failed checks</span>
                  <Link href={`/scans/${c.scan.id}`} className="ml-auto break-all font-semibold text-indigo hover:underline">
                    {c.scan.reference} →
                  </Link>
                </div>
              )}
              {c.officer_note && (
                <p className="mt-3 border-l-4 border-indigo pl-3 text-sm text-ink-soft">
                  <b>Officer:</b> {c.officer_note}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand pt-3 text-xs text-muted">
                {c.name && <span>From {c.name}</span>}
                {c.contact && <span>· {c.contact}</span>}
                {c.assigned_to && <span>· Assigned to {c.assigned_to}</span>}
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  {!c.assigned_to && (
                    <button className="btn btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => save(c, { assign_to_me: true, status: 'under_review' })}>
                      {t('Assign to me')}
                    </button>
                  )}
                  <button
                    className="btn btn-primary px-2.5 py-1 text-xs"
                    onClick={() => {
                      setEditing(c);
                      setStatus(c.status === 'received' ? 'under_review' : c.status);
                      setNote(c.officer_note ?? '');
                    }}
                  >
                    Update status
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal title={`Complaint ${editing.code}`} onClose={() => setEditing(null)}>
          <FieldLabel htmlFor="st">Status</FieldLabel>
          <select id="st" className="field" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
            {TABS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {COMPLAINT_META[s as ComplaintStatus].label}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <FieldLabel htmlFor="note">Note shown to the consumer</FieldLabel>
            <textarea id="note" rows={4} className="field" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              {t('Cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => save(editing, { status, officer_note: note })}>
              {t('Save')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
