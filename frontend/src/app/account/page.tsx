'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import { FramedCorners } from '@/components/ornaments';
import { ErrorNote, FieldLabel, Icon, PageHeader, Pill, SectionTitle, Spinner } from '@/components/ui';

export default function AccountPage() {
  const { officer } = useAuth();
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    setDone(false);
    if (next !== confirmPw) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirmPw('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={officer.email} title={t('Account')} hindi="खाता" />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card card-framed p-6">
          <FramedCorners />
          <SectionTitle>Profile</SectionTitle>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd className="font-semibold text-ink">{officer.name}</dd>
            </div>
            <div>
              <dt className="text-muted">Designation</dt>
              <dd className="text-ink">{officer.designation || '–'}</dd>
            </div>
            <div>
              <dt className="text-muted">Role</dt>
              <dd>
                <Pill tone="bg-indigo-50 text-indigo border-indigo/20">{t(officer.role)}</Pill>
              </dd>
            </div>
          </dl>
        </section>
        <section className="card p-6">
          <SectionTitle>Change password</SectionTitle>
          <div className="grid gap-3">
            <div>
              <FieldLabel htmlFor="cur">Current password</FieldLabel>
              <input id="cur" type="password" autoComplete="current-password" className="field" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="new">New password (8+ characters)</FieldLabel>
              <input id="new" type="password" autoComplete="new-password" className="field" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="conf">Confirm new password</FieldLabel>
              <input id="conf" type="password" autoComplete="new-password" className="field" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
          </div>
          {error && (
            <div className="mt-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          {done && <p className="mt-3 text-sm font-semibold text-green">Password changed.</p>}
          <button className="btn btn-primary mt-4 w-full" disabled={busy || !current || next.length < 8} onClick={submit}>
            {busy ? <Spinner className="h-4 w-4" /> : <Icon name="key" className="h-4 w-4" />} Update password
          </button>
        </section>
      </div>
    </div>
  );
}
