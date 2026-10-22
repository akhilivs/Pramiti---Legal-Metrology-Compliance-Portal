'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, type PublicComplaint } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { FramedCorners, Rosette } from '@/components/ornaments';
import { ErrorNote, FieldLabel, Icon, Spinner, StateSelect, VerdictBadge } from '@/components/ui';

const ISSUES = [
  ['MRP sticker pasted over the printed price', 'एमआरपी पर स्टिकर चिपका है'],
  ['Charged more than MRP', 'एमआरपी से अधिक मूल्य लिया गया'],
  ['Pack weighs less than declared', 'पैक घोषित मात्रा से हल्का है'],
  ['No expiry / manufacturing date', 'निर्माण / समाप्ति तिथि नहीं है'],
  ['No manufacturer address or helpline', 'निर्माता का पता या हेल्पलाइन नहीं है'],
];

export default function ComplaintPortal() {
  const { t, lang } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState('');
  const [place, setPlace] = useState('');
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PublicComplaint | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const desc = [...issues, description.trim()].filter(Boolean).join('. ');
      setDone(await api.submitComplaint({ description: desc, name, contact, state, place, purchased_online: online }, files));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submission failed.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl animate-rise">
        <div className="card card-framed relative overflow-hidden p-8 text-center">
          <FramedCorners />
          <Rosette className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 text-gold/10" />
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green text-white">
            <Icon name="check" className="h-8 w-8" strokeWidth={2.5} />
          </span>
          <h1 className="heading-serif mt-4 text-3xl font-bold text-indigo">Complaint registered</h1>
          <p className="text-deva text-saffron-600">शिकायत दर्ज हो गई</p>
          <p className="mt-4 text-ink-soft">Your tracking number</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-ink">{done.code}</p>
          <p className="mt-2 text-sm text-muted">Please note it down. Use it to check the status of your complaint.</p>
          {done.preliminary && (
            <div className="mt-6 rounded-xl border border-sand bg-ivory p-4 text-left">
              <p className="eyebrow">Automatic preliminary check</p>
              <div className="mt-2">
                <VerdictBadge verdict={done.preliminary.verdict} />
              </div>
              <p className={`mt-2 text-sm text-ink-soft ${lang === 'hi' ? 'text-deva' : ''}`}>
                {lang === 'hi' ? done.preliminary.summary_hi : done.preliminary.summary}
              </p>
              {done.preliminary.issues.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-maroon">
                  {done.preliminary.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted">This is an automated screening. A Legal Metrology officer will review your complaint.</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/complaint/track?code=${done.code}`} className="btn btn-primary">
              {t('Track complaint')}
            </Link>
            <button className="btn btn-ghost" onClick={() => window.location.reload()}>
              File another complaint
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <p className="eyebrow">Legal Metrology · Consumer protection</p>
        <h1 className="heading-serif mt-1 text-4xl font-bold text-indigo">{lang === 'hi' ? 'उत्पाद की शिकायत करें' : 'Report a packaged product'}</h1>
        <p className="text-deva text-lg text-saffron-600">{lang === 'hi' ? 'Report a packaged product' : 'उत्पाद की शिकायत करें'}</p>
        <p className="mx-auto mt-3 max-w-2xl text-ink-soft">
          Found a pack with a tampered MRP, missing expiry date, or less quantity than declared? Upload a photo of the label. Our
          system checks it instantly and forwards it to the Legal Metrology department.
        </p>
      </div>

      <div className="card card-framed mx-auto max-w-3xl p-6 sm:p-8">
        <FramedCorners />
        <ol className="space-y-6">
          <li>
            <p className="heading-serif text-lg font-bold text-indigo">1. Photos of the product label</p>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sand-strong bg-parchment/40 p-6 text-center hover:bg-parchment">
              <Icon name="camera" className="h-8 w-8 text-saffron" />
              <span className="font-semibold text-ink">{files.length ? `${files.length} photo(s) selected` : 'Take or choose photos (up to 4)'}</span>
              <span className="text-sm text-muted">Show the MRP, quantity, dates and manufacturer details clearly.</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-2 flex gap-2">
                {files.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={f.name + f.size} src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-lg border border-sand object-cover" />
                ))}
              </div>
            )}
          </li>
          <li>
            <p className="heading-serif text-lg font-bold text-indigo">2. What is wrong?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ISSUES.map(([en, hi]) => {
                const on = issues.includes(en);
                return (
                  <button
                    key={en}
                    type="button"
                    onClick={() => setIssues((p) => (on ? p.filter((x) => x !== en) : [...p, en]))}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-navy bg-navy text-white' : 'border-sand-strong bg-paper text-ink-soft hover:bg-parchment'}`}
                  >
                    {lang === 'hi' ? hi : en}
                  </button>
                );
              })}
            </div>
            <textarea
              rows={3}
              className="field mt-3"
              placeholder="Describe the problem (optional if you selected above)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </li>
          <li>
            <p className="heading-serif text-lg font-bold text-indigo">3. Where did you buy it?</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="cstate">{t('State')}</FieldLabel>
                <StateSelect id="cstate" value={state} onChange={setState} />
              </div>
              <div>
                <FieldLabel htmlFor="cplace">Shop / market / city</FieldLabel>
                <input id="cplace" className="field" value={place} onChange={(e) => setPlace(e.target.value)} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="accent-[var(--indigo)]" />
              I bought it online
            </label>
          </li>
          <li>
            <p className="heading-serif text-lg font-bold text-indigo">
              4. Your details <span className="text-sm font-normal text-muted">(optional)</span>
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input className="field" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
              <input className="field" placeholder="Phone or e-mail" value={contact} onChange={(e) => setContact(e.target.value)} aria-label="Contact" />
            </div>
          </li>
        </ol>

        {error && (
          <div className="mt-5">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy || !files.length || (!issues.length && !description.trim())}
          className="btn btn-saffron mt-6 w-full py-3.5 text-base"
        >
          {busy ? <Spinner /> : <Icon name="mail" />}
          {busy ? 'Checking the label and registering…' : 'Submit complaint'}
        </button>
        <p className="mt-3 text-center text-xs text-muted">
          Your details are shared only with Legal Metrology officers. For urgent help call the National Consumer Helpline 1915.
        </p>
      </div>
    </div>
  );
}
