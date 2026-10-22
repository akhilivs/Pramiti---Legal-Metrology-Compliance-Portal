'use client';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { api, ApiError, type ScanDetail } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { queueScan } from '@/lib/offline';
import LiveCamera, { type LiveCameraHandle } from './LiveCamera';
import StarWave from './StarWave';
import { ErrorNote, FieldLabel, Icon, Spinner, StateSelect } from './ui';

const MAX_PHOTOS = 4;
const FACE_LABELS = ['Front', 'Back', 'Side', 'Detail'];
const STAGES = [
  'Reading every word on the label…',
  'Checking Rule 6 mandatory declarations…',
  'Looking for MRP over-stickers and tampering…',
  'Assessing Rule 7 numeral height on the display panel…',
  'Verifying unit price arithmetic…',
  'Preparing the inspection record…',
];
const LISTING_STAGES = [
  'Opening the product listing…',
  'Reading the listing and specification table…',
  'Checking Rule 6(10) e-commerce declarations…',
  'Preparing the inspection record…',
];
const LAST_STATE_KEY = 'pramiti.lastState';

interface Photo {
  file: File;
  url: string;
}

function useStages(loading: boolean, stages: string[]) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, stages.length - 1)), 4500);
    return () => clearInterval(t);
  }, [loading, stages.length]);
  return [stages[stage], () => setStage(0)] as const;
}

function useDropzone(addFiles: (f: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    props: {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      },
    },
  };
}

export default function Scanner({ onResult }: { onResult: (scan: ScanDetail) => void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<'label' | 'listing'>('label');
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Inspection type">
        {(
          [
            ['label', 'Product label', 'camera', 'Photos of the pack'],
            ['listing', 'Online listing', 'globe', 'Rule 6(10) e-commerce'],
          ] as const
        ).map(([key, label, icon, sub]) => (
          <button
            key={key}
            role="tab"
            aria-selected={kind === key}
            onClick={() => setKind(key)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
              kind === key ? 'border-navy bg-navy text-white shadow-sm' : 'border-sand bg-paper text-ink hover:border-gold-soft'
            }`}
          >
            <Icon name={icon} className="h-5 w-5 shrink-0" />
            <span>
              <span className="block text-sm font-semibold">{t(label)}</span>
              <span className={`block text-xs ${kind === key ? 'text-white/70' : 'text-muted'}`}>{sub}</span>
            </span>
          </button>
        ))}
      </div>
      {kind === 'label' ? <LabelScanner onResult={onResult} /> : <ListingScanner onResult={onResult} />}
    </div>
  );
}

/* ---------------------------------------------------------------- product label */

function LabelScanner({ onResult }: { onResult: (scan: ScanDetail) => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [active, setActive] = useState(0);
  const [state, setState] = useState(() => {
    try {
      return localStorage.getItem(LAST_STATE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [district, setDistrict] = useState('');
  const [location, setLocation] = useState('');
  const [measured, setMeasured] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraRef = useRef<LiveCameraHandle>(null);
  const onCameraError = useCallback(() => setCameraError('Camera not available. Allow camera access in the browser, or upload photos instead.'), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stageText, resetStage] = useStages(loading, STAGES);

  const addFiles = useCallback((files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      setError('Please choose an image file (JPG, PNG or WEBP).');
      return;
    }
    setError(null);
    setInfo(null);
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      if (room <= 0) return prev;
      const next = [...prev, ...images.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))];
      setActive(next.length - 1);
      return next;
    });
  }, []);
  const drop = useDropzone(addFiles);

  const removePhoto = (i: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[i].url);
      const next = prev.filter((_, j) => j !== i);
      setActive((a) => Math.max(0, Math.min(a, next.length - 1)));
      return next;
    });
  };

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setActive(0);
    setNotes('');
    setMeasured('');
    setError(null);
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (loading) return;
      const files = Array.from(e.clipboardData?.items ?? [])
        .filter((it) => it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length) addFiles(files);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [addFiles, loading]);

  const capture = async () => {
    const file = await cameraRef.current?.capture();
    if (file) addFiles([file]);
  };

  const analyse = async () => {
    if (!photos.length) return;
    const meta = { state, district, location, measured_quantity: measured, notes };
    try {
      localStorage.setItem(LAST_STATE_KEY, state);
    } catch {}
    const files = photos.map((p) => p.file);
    if (!navigator.onLine) {
      await queueScan(files, meta);
      reset();
      setInfo('No connection - the inspection was saved on this device and will be analysed automatically when you are back online.');
      return;
    }
    resetStage();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      onResult(await api.analyse(files, meta));
      reset();
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        await queueScan(files, meta);
        reset();
        setInfo('The server could not be reached - the inspection was saved offline and will upload automatically.');
      } else {
        setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const full = photos.length >= MAX_PHOTOS;
  const current = photos[active];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 rounded-xl border border-sand bg-parchment/70 p-1" role="tablist" aria-label="Capture method">
        {(
          [
            ['upload', 'Upload photos', 'upload'],
            ['camera', 'Live camera', 'camera'],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            disabled={loading}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-all ${
              mode === key ? 'bg-paper text-indigo shadow-sm ring-1 ring-sand' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon name={icon} className="h-4 w-4" />
            {t(label)}
          </button>
        ))}
      </div>

      {current && (mode === 'upload' || loading) ? (
        <div className="relative overflow-hidden rounded-xl border border-sand bg-[#1d1a16]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={`Package photo ${active + 1}`} className="mx-auto h-72 w-full object-contain" />
          {loading && (
            <div className="absolute inset-0 bg-navy/35">
              <StarWave />
            </div>
          )}
          {!loading && (
            <button
              onClick={() => removePhoto(active)}
              className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white backdrop-blur hover:bg-maroon"
              title="Remove this photo"
            >
              <Icon name="cross" className="h-4 w-4" strokeWidth={2.4} />
            </button>
          )}
          <span className="absolute bottom-2 left-2 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
            {FACE_LABELS[active] ?? `Photo ${active + 1}`}
          </span>
        </div>
      ) : mode === 'camera' ? (
        <div className="relative overflow-hidden rounded-xl border border-sand bg-[#1d1a16]">
          {cameraError ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/80">
              <Icon name="camera" className="h-8 w-8 text-white/50" />
              {cameraError}
            </div>
          ) : (
            <LiveCamera ref={cameraRef} onError={onCameraError} className="h-72 w-full object-cover" />
          )}
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-white/35" />
        </div>
      ) : (
        <label
          htmlFor="scan-files"
          {...drop.props}
          className={`flex h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            drop.dragging ? 'border-saffron bg-saffron-50' : 'border-sand-strong bg-parchment/40 hover:bg-parchment'
          }`}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold-soft bg-paper text-saffron shadow-sm">
            <Icon name="upload" className="h-7 w-7" />
          </span>
          <span className="font-semibold text-ink">{drop.dragging ? 'Drop the photos here' : 'Click, drag & drop, or paste label photos'}</span>
          <span className="max-w-xs text-sm text-muted">
            Add up to {MAX_PHOTOS} photos of the same pack (front, back, sides) so every declaration is visible.
          </span>
        </label>
      )}
      <input
        ref={inputRef}
        id="scan-files"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />

      <div className="flex items-center gap-2.5">
        {photos.map((p, i) => (
          <button
            key={p.url}
            onClick={() => setActive(i)}
            disabled={loading}
            className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 transition ${
              i === active ? 'border-saffron' : 'border-sand hover:border-gold-soft'
            }`}
            title={FACE_LABELS[i]}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/55 text-[10px] font-medium text-white">{FACE_LABELS[i]}</span>
          </button>
        ))}
        {!full && (
          <button
            onClick={() => (mode === 'camera' && !cameraError ? capture() : inputRef.current?.click())}
            disabled={loading}
            className={`flex h-16 items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-sand-strong text-sm font-semibold text-indigo hover:border-saffron hover:bg-saffron-50 ${
              photos.length ? 'w-16' : 'flex-1'
            }`}
            title={mode === 'camera' ? 'Capture photo' : 'Add photo'}
          >
            <Icon name={mode === 'camera' && !cameraError ? 'camera' : 'plus'} className="h-5 w-5" />
            {!photos.length && (mode === 'camera' && !cameraError ? 'Capture label' : 'Add photos')}
          </button>
        )}
        {photos.length > 0 && (
          <span className="ml-auto text-xs text-muted">
            {photos.length}/{MAX_PHOTOS}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="state">{t('State')}</FieldLabel>
          <StateSelect id="state" value={state} onChange={setState} />
        </div>
        <div>
          <FieldLabel htmlFor="district">{t('District')}</FieldLabel>
          <input id="district" className="field" placeholder="e.g. Lucknow" value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
      </div>

      <details className="group rounded-xl border border-sand bg-paper">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink-soft">
          <span className="flex items-center gap-2">
            <Icon name="scale" className="h-4 w-4 text-saffron" />
            {t('Inspection details')} <span className="font-normal text-muted">({t('optional')})</span>
          </span>
          <span className="text-muted transition group-open:rotate-90">›</span>
        </summary>
        <div className="grid gap-3 border-t border-sand px-4 py-4">
          <div>
            <FieldLabel htmlFor="loc">{t('Place of inspection')}</FieldLabel>
            <input id="loc" className="field" placeholder="e.g. Aminabad market, shop no. 12" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor="measured">{t('Measured net quantity')}</FieldLabel>
            <input
              id="measured"
              className="field"
              placeholder="Weighed on a verified scale, e.g. 482 g"
              value={measured}
              onChange={(e) => setMeasured(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">Checked against the First Schedule maximum permissible error.</p>
          </div>
          <div>
            <FieldLabel htmlFor="notes">{t("Officer's notes")}</FieldLabel>
            <textarea
              id="notes"
              rows={2}
              className="field resize-y"
              placeholder="Batch seized, shop details, observations…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </details>

      <button onClick={analyse} disabled={!photos.length || loading} className="btn btn-saffron w-full py-3.5 text-base">
        {loading ? <Spinner /> : <Icon name="shield" />}
        {loading ? stageText : t('Analyse compliance')}
      </button>

      {info && (
        <p className="flex items-start gap-2 rounded-xl border border-indigo/20 bg-indigo-50 p-3 text-sm text-indigo" role="status">
          <Icon name="wifiOff" className="mt-0.5 h-4 w-4 shrink-0" /> {info}
        </p>
      )}
      {error && <ErrorNote onRetry={photos.length ? analyse : undefined}>{error}</ErrorNote>}
    </div>
  );
}

/* ---------------------------------------------------------------- e-commerce listing */

function ListingScanner({ onResult }: { onResult: (scan: ScanDetail) => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [shots, setShots] = useState<File[]>([]);
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsManual, setNeedsManual] = useState(false);
  const [stageText, resetStage] = useStages(loading, LISTING_STAGES);
  const addShots = (files: File[]) => setShots((s) => [...s, ...files.filter((f) => f.type.startsWith('image/'))].slice(0, 4));
  const drop = useDropzone(addShots);

  const run = async () => {
    resetStage();
    setLoading(true);
    setError(null);
    try {
      const scan = await api.analyseListing({ url: url.trim(), listing_text: text.trim(), state }, shots);
      onResult(scan);
      setUrl('');
      setText('');
      setShots([]);
      setNeedsManual(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Analysis failed.';
      setError(msg);
      if (/blocked|refused|Could not open|Paste/i.test(msg)) setNeedsManual(true);
    } finally {
      setLoading(false);
    }
  };

  const canRun = !!(url.trim() || text.trim() || shots.length) && !loading;

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-gold-soft/60 bg-parchment/60 px-4 py-3 text-sm text-ink-soft">
        Rule 6(10) requires e-commerce platforms to display every mandatory declaration on the listing. Paste a product URL;
        if the marketplace blocks automated access, paste the listing text or upload screenshots instead.
      </p>
      <div>
        <FieldLabel htmlFor="url">{t('Listing URL')}</FieldLabel>
        <div className="relative">
          <Icon name="globe" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="url"
            type="url"
            className="field pl-9"
            placeholder="https://www.example-marketplace.in/product/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      </div>

      <details className="group rounded-xl border border-sand bg-paper" open={needsManual || undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink-soft">
          <span className="flex items-center gap-2">
            <Icon name="list" className="h-4 w-4 text-saffron" />
            {t('Listing text')} / {t('Screenshots')} <span className="font-normal text-muted">({t('optional')})</span>
          </span>
          <span className="text-muted transition group-open:rotate-90">›</span>
        </summary>
        <div className="grid gap-3 border-t border-sand px-4 py-4">
          <textarea
            rows={5}
            className="field resize-y font-mono text-xs"
            placeholder="Copy the product title, price, 'Product details' / specification table and seller information from the listing page…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={t('Listing text')}
          />
          <label
            {...drop.props}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm ${
              drop.dragging ? 'border-saffron bg-saffron-50' : 'border-sand-strong text-ink-soft hover:bg-parchment'
            }`}
          >
            <Icon name="image" className="h-5 w-5 text-saffron" />
            {shots.length ? `${shots.length} screenshot(s) added - click to add more` : 'Add up to 4 screenshots of the listing'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addShots(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </label>
          {shots.length > 0 && (
            <button onClick={() => setShots([])} className="justify-self-start text-xs font-semibold text-maroon underline">
              Remove screenshots
            </button>
          )}
        </div>
      </details>

      <div>
        <FieldLabel htmlFor="lstate">{t('State')}</FieldLabel>
        <StateSelect id="lstate" value={state} onChange={setState} placeholder="State of the seller (optional)" />
      </div>

      <button onClick={run} disabled={!canRun} className="btn btn-saffron w-full py-3.5 text-base">
        {loading ? <Spinner /> : <Icon name="globe" />}
        {loading ? stageText : t('Check listing')}
      </button>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
