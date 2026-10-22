'use client';
import { useEffect, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, formatDate, type Batch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { FramedCorners } from '@/components/ornaments';
import { ErrorNote, FieldLabel, Icon, PageHeader, Pill, SectionTitle, Spinner, StateSelect } from '@/components/ui';

export default function BatchPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [batches, setBatches] = useState<Batch[] | null>(null);

  useEffect(() => {
    api.batches().then(setBatches).catch(() => setBatches([]));
  }, []);

  const add = (list: File[]) =>
    setFiles((f) => [...f, ...list.filter((x) => x.type.startsWith('image/') || x.name.toLowerCase().endsWith('.zip'))]);
  const urlCount = urls.split('\n').filter((l) => /^https?:\/\//.test(l.trim())).length;
  const zipCount = files.filter((f) => f.name.toLowerCase().endsWith('.zip')).length;
  const imgCount = files.length - zipCount;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const b = await api.createBatch({ name, urls, state, location }, files);
      router.push(`/batch/${b.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the batch.');
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Market sweeps"
        title="Bulk scan"
        hindi="थोक जाँच"
        description="Inspect a whole shelf, a seized consignment or a list of online listings at once. Items are analysed one by one in the background - you can leave this page and come back."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="card card-framed p-6">
          <FramedCorners />
          <SectionTitle hindi="नई थोक जाँच">New batch</SectionTitle>

          <label
            htmlFor="batch-files"
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragging(false);
              add(Array.from(e.dataTransfer.files));
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragging ? 'border-saffron bg-saffron-50' : 'border-sand-strong bg-parchment/40 hover:bg-parchment'
            }`}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-soft bg-paper text-saffron">
              <Icon name="layers" className="h-6 w-6" />
            </span>
            <span className="font-semibold text-ink">Drop product photos or ZIP files</span>
            <span className="max-w-md text-sm text-muted">
              Each photo is treated as one product. In a ZIP, photos inside the same folder are combined as different faces of
              one product (e.g. <code className="rounded bg-sand/60 px-1">shop12/front.jpg</code>,{' '}
              <code className="rounded bg-sand/60 px-1">shop12/back.jpg</code>).
            </span>
            <input
              id="batch-files"
              type="file"
              multiple
              accept="image/*,.zip"
              className="hidden"
              onChange={(e) => {
                add(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </label>
          {files.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              {imgCount > 0 && <Pill tone="bg-indigo-50 text-indigo border-indigo/20">{imgCount} photos</Pill>}
              {zipCount > 0 && <Pill tone="bg-saffron-50 text-saffron-600 border-saffron/30">{zipCount} ZIP</Pill>}
              <button onClick={() => setFiles([])} className="text-xs font-semibold text-maroon underline">
                Clear
              </button>
            </div>
          )}

          <div className="mt-5">
            <FieldLabel htmlFor="urls">E-commerce listing URLs (one per line)</FieldLabel>
            <textarea
              id="urls"
              rows={4}
              className="field resize-y font-mono text-xs"
              placeholder={'https://www.example-marketplace.in/product/123\nhttps://www.example-marketplace.in/product/456'}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
            />
            {urlCount > 0 && <p className="mt-1 text-xs text-muted">{urlCount} listing URL(s)</p>}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor="bname">Batch name</FieldLabel>
              <input id="bname" className="field" placeholder="e.g. Aminabad sweep" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor="bstate">{t('State')}</FieldLabel>
              <StateSelect id="bstate" value={state} onChange={setState} />
            </div>
            <div>
              <FieldLabel htmlFor="bloc">{t('Place of inspection')}</FieldLabel>
              <input id="bloc" className="field" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="mt-4">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          <button
            onClick={submit}
            disabled={busy || (!files.length && !urlCount)}
            className="btn btn-saffron mt-5 w-full py-3.5 text-base"
          >
            {busy ? <Spinner /> : <Icon name="layers" />}
            Start bulk inspection
          </button>
          <p className="mt-2 text-center text-xs text-muted">Up to 200 products per batch. Each item takes 10-40 seconds.</p>
        </section>

        <section className="card p-6">
          <SectionTitle hindi="पिछली थोक जाँचें">Recent batches</SectionTitle>
          {batches === null ? (
            <div className="flex justify-center py-10 text-muted">
              <Spinner />
            </div>
          ) : !batches.length ? (
            <p className="text-sm text-muted">No batches yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {batches.map((b) => (
                <li key={b.id}>
                  <Link href={`/batch/${b.id}`} className="block rounded-xl border border-sand p-3 transition hover:border-gold-soft hover:bg-ivory">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-ink">{b.name}</span>
                      <Pill
                        tone={
                          b.status === 'done'
                            ? 'bg-green-50 text-green border-green/25'
                            : 'bg-saffron-50 text-saffron-600 border-saffron/30'
                        }
                      >
                        {b.status === 'done' ? 'Done' : `${b.done + b.failed}/${b.total}`}
                      </Pill>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(b.created_at)} · {b.total} items · {b.failed} failed
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
