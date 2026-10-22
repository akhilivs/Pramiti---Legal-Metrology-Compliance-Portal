'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, formatDate, type AuditRow } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import { EmptyState, ErrorNote, Icon, PageHeader, SkeletonRows } from '@/components/ui';

const ACTIONS = ['', 'auth', 'scan', 'notice', 'complaint', 'user', 'batch', 'demo'];

function targetLink(target: string | null) {
  if (!target) return null;
  const [kind, id] = target.split(':');
  if (kind === 'scan') return `/scans/${id}`;
  if (kind === 'notice') return `/notices/${id}`;
  if (kind === 'batch') return `/batch/${id}`;
  return null;
}

export default function AuditPage() {
  const { can } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');

  // depend on the role, not on `can` itself, which changes whenever the profile is refreshed
  const isAdmin = can('admin');
  useEffect(() => {
    if (!isAdmin) return;
    const timer = setTimeout(() => {
      api
        .audit({ actor, action })
        .then(setRows)
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(timer);
  }, [actor, action, isAdmin]);

  if (!isAdmin) return <ErrorNote>This page is available to administrators only.</ErrorNote>;

  return (
    <div>
      <PageHeader
        eyebrow="Accountability"
        title={t('Audit log')}
        hindi="लेखा परीक्षा लॉग"
        description="Every sign-in, inspection, review override, notice action and user change, with who did it and when."
        actions={
          <Link href="/admin" className="btn btn-ghost">
            <Icon name="arrowLeft" className="h-4 w-4" /> {t('Admin')}
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Filter by user e-mail" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="User" />
        <select className="field max-w-[12rem]" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Action type">
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a ? a : 'All actions'}
            </option>
          ))}
        </select>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="card overflow-hidden">
        {rows === null && !error ? (
          <SkeletonRows rows={10} />
        ) : !rows?.length ? (
          <EmptyState title="No entries" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-sand bg-parchment/70 text-xs uppercase tracking-wider text-muted">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Who</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Record</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand">
                {rows.map((r) => {
                  const href = targetLink(r.target);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">{formatDate(r.at)}</td>
                      <td className="px-4 py-2.5 text-ink">{r.actor}</td>
                      <td className="px-4 py-2.5">
                        <code className={`rounded px-1.5 py-0.5 text-xs ${r.action.includes('failed') ? 'bg-maroon-50 text-maroon' : 'bg-indigo-50 text-indigo'}`}>
                          {r.action}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {href ? (
                          <Link href={href} className="font-mono text-indigo hover:underline">
                            {r.target}
                          </Link>
                        ) : (
                          <span className="font-mono text-muted">{r.target ?? '–'}</span>
                        )}
                      </td>
                      <td className="max-w-[24rem] truncate px-4 py-2.5 text-xs text-ink-soft" title={r.details ?? ''}>
                        {r.details ?? ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
