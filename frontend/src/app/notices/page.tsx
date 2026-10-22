'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, formatDate, type Notice, type NoticeStatus } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { DemoBadge, EmptyState, ErrorNote, Icon, NOTICE_META, PageHeader, Pill, SkeletonRows } from '@/components/ui';

const TABS: (NoticeStatus | '')[] = ['', 'draft', 'approved', 'issued', 'replied', 'closed'];

export default function NoticesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<NoticeStatus | ''>('');

  useEffect(() => {
    api.notices().then(setNotices).catch((e) => setError(e.message));
  }, []);

  const shown = notices?.filter((n) => !tab || n.status === tab) ?? [];
  const count = (s: NoticeStatus | '') => notices?.filter((n) => !s || n.status === s).length ?? 0;
  const overdue = notices?.filter((n) => n.overdue).length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Enforcement"
        title="Show-cause Notices"
        hindi="कारण बताओ नोटिस"
        description="Draft notices from non-compliant inspections, approve and issue them, and track replies through to closure."
      />

      {overdue > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-maroon/25 bg-maroon-50 px-4 py-3 text-sm text-maroon">
          <Icon name="alert" className="h-4 w-4" /> {overdue} issued notice(s) are past their reply date.
        </div>
      )}

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
            {s ? t(NOTICE_META[s].label) : t('All')} {notices && <span className="opacity-60">({count(s)})</span>}
          </button>
        ))}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="card overflow-hidden">
        {notices === null && !error ? (
          <SkeletonRows rows={8} />
        ) : !shown.length ? (
          <EmptyState title="No notices">
            Open a non-compliant inspection and choose <b>Raise show-cause notice</b>.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/70 text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">Notice</th>
                  <th className="px-4 py-3 font-semibold">Addressee / product</th>
                  <th className="px-4 py-3 text-right font-semibold">Contraventions</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reply due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {shown.map((n) => (
                  <tr key={n.id} className="cursor-pointer hover:bg-ivory" onClick={() => router.push(`/notices/${n.id}`)}>
                    <td className="px-4 py-3">
                      <Link href={`/notices/${n.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-indigo hover:underline">
                        {n.number || `Draft #${n.id}`}
                      </Link>
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        {formatDate(n.created_at, false)} {n.is_demo && <DemoBadge />}
                      </p>
                    </td>
                    <td className="max-w-[22rem] px-4 py-3">
                      <p className="truncate font-semibold text-ink">{n.addressee.split(',')[0]}</p>
                      <p className="truncate text-xs text-muted">
                        {n.product_name} · {n.scan_ref}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{n.violations.length}</td>
                    <td className="px-4 py-3">
                      <Pill tone={NOTICE_META[n.status].tone}>{t(NOTICE_META[n.status].label)}</Pill>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {n.reply_due ? (
                        <span className={n.overdue ? 'font-semibold text-maroon' : 'text-ink-soft'}>
                          {formatDate(n.reply_due, false)} {n.overdue && `· ${t('Overdue')}`}
                        </span>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
