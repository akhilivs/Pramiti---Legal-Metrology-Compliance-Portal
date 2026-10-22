'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, formatDate, type Role, type UserRow } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import { ErrorNote, FieldLabel, Icon, Modal, PageHeader, Pill, SectionTitle, SkeletonRows, Spinner } from '@/components/ui';

const ROLE_TONE: Record<Role, string> = {
  admin: 'bg-navy text-white border-navy',
  controller: 'bg-saffron-50 text-saffron-600 border-saffron/30',
  inspector: 'bg-parchment text-ink-soft border-sand-strong',
};

const ROLE_HELP: Record<Role, string> = {
  inspector: 'Inspect, review AI findings, draft notices, handle complaints',
  controller: 'Everything an inspector can do, plus approve and issue notices, delete records, view AI accuracy',
  admin: 'Everything, plus manage users, audit log and demo data',
};

export default function AdminPage() {
  const { can, officer } = useAuth();
  const { t } = useI18n();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<UserRow> & { password?: string; isNew?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoMsg, setDemoMsg] = useState<string | null>(null);

  // depend on the role, not on `can` itself, which changes whenever the profile is refreshed
  const isAdmin = can('admin');
  useEffect(() => {
    if (isAdmin) api.users().then(setUsers).catch((e) => setError(e.message));
  }, [isAdmin]);

  if (!isAdmin) return <ErrorNote>This page is available to administrators only.</ErrorNote>;

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      if (editing.isNew) {
        const u = await api.createUser({
          email: editing.email ?? '',
          name: editing.name ?? '',
          designation: editing.designation ?? '',
          role: (editing.role ?? 'inspector') as Role,
          password: editing.password ?? '',
        });
        setUsers((p) => [...(p ?? []), u]);
      } else {
        const u = await api.updateUser(editing.id!, {
          name: editing.name,
          designation: editing.designation ?? '',
          role: editing.role as Role,
          ...(editing.password ? { password: editing.password } : {}),
        });
        setUsers((p) => p?.map((x) => (x.id === u.id ? u : x)) ?? null);
      }
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: UserRow) => {
    try {
      const updated = await api.updateUser(u.id, { active: !u.active });
      setUsers((p) => p?.map((x) => (x.id === u.id ? updated : x)) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    }
  };

  const demo = async (load: boolean) => {
    if (!load && !confirm('Remove all demonstration records? Real inspections are not affected.')) return;
    setBusy(true);
    setDemoMsg(null);
    try {
      const r = load ? await api.loadDemo() : await api.clearDemo();
      setDemoMsg(`${load ? 'Loaded' : 'Removed'} ${r.scans} inspections, ${r.notices} notices and ${r.complaints} complaints.`);
    } catch (e) {
      setDemoMsg(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Administration"
        hindi="प्रशासन"
        actions={
          <Link href="/admin/audit" className="btn btn-ghost">
            <Icon name="list" className="h-4 w-4" /> {t('Audit log')}
          </Link>
        }
      />
      {error && (
        <div className="mb-5">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card overflow-hidden">
          <div className="flex items-end justify-between p-6 pb-2">
            <SectionTitle hindi="उपयोगकर्ता">{t('Users')}</SectionTitle>
            <button className="btn btn-primary px-3 py-2 text-sm" onClick={() => setEditing({ isNew: true, role: 'inspector' })}>
              <Icon name="plus" className="h-4 w-4" /> Add officer
            </button>
          </div>
          {!users ? (
            <SkeletonRows rows={4} thumb />
          ) : (
            <ul className="divide-y divide-sand">
              {users.map((u) => (
                <li key={u.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 ${u.active ? '' : 'opacity-50'}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gold-soft bg-indigo-50 text-sm font-bold text-indigo">
                    {u.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="font-semibold text-ink">
                      {u.name} {u.id === officer.id && <span className="text-xs font-normal text-muted">(you)</span>}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {u.email} · {u.designation || '–'}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Pill tone={ROLE_TONE[u.role]}>{t(u.role)}</Pill>
                    <button className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => setEditing({ ...u })}>
                      Edit
                    </button>
                    {u.id !== officer.id && (
                      <button className="btn px-2.5 py-1 text-xs text-ink-soft hover:bg-parchment" onClick={() => toggleActive(u)}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-sand bg-parchment/40 px-6 py-4 text-xs text-muted">
            {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
              <p key={r}>
                <b className="capitalize text-ink-soft">{r}</b>: {ROLE_HELP[r]}
              </p>
            ))}
          </div>
        </section>

        <section className="card p-6">
          <SectionTitle hindi="डेमो डेटा">Demonstration data</SectionTitle>
          <p className="text-sm text-ink-soft">
            Loads about 60 inspections of fictional manufacturers across 18 states, with drawn labels, officer reviews, notices at
            every stage and consumer complaints, so the dashboards and workflows can be demonstrated. Every demo record is marked{' '}
            <b>Demo</b> and can be removed without touching real data.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={() => demo(true)}>
              {busy ? <Spinner className="h-4 w-4" /> : <Icon name="refresh" className="h-4 w-4" />} Load / reset demo data
            </button>
            <button className="btn btn-ghost text-maroon" disabled={busy} onClick={() => demo(false)}>
              <Icon name="trash" className="h-4 w-4" /> Remove demo data
            </button>
          </div>
          {demoMsg && <p className="mt-3 text-sm text-green">{demoMsg}</p>}
          <p className="mt-6 text-xs text-muted">Signed in as {officer.email} · {formatDate(new Date().toISOString())}</p>
        </section>
      </div>

      {editing && (
        <Modal title={editing.isNew ? 'Add officer' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="grid gap-3">
            {editing.isNew && (
              <div>
                <FieldLabel htmlFor="ue">Official e-mail</FieldLabel>
                <input id="ue" type="email" className="field" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
            )}
            <div>
              <FieldLabel htmlFor="un">Name</FieldLabel>
              <input id="un" className="field" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="ud">Designation</FieldLabel>
              <input
                id="ud"
                className="field"
                placeholder="e.g. Inspector, Legal Metrology, Lucknow"
                value={editing.designation ?? ''}
                onChange={(e) => setEditing({ ...editing, designation: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="ur">Role</FieldLabel>
              <select id="ur" className="field" value={editing.role ?? 'inspector'} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}>
                <option value="inspector">Inspector</option>
                <option value="controller">Controller</option>
                <option value="admin">Administrator</option>
              </select>
              <p className="mt-1 text-xs text-muted">{ROLE_HELP[(editing.role ?? 'inspector') as Role]}</p>
            </div>
            <div>
              <FieldLabel htmlFor="up">{editing.isNew ? 'Password' : 'New password (leave blank to keep)'}</FieldLabel>
              <input id="up" type="password" className="field" value={editing.password ?? ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setEditing(null)}>
              {t('Cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={save}>
              {t('Save')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
