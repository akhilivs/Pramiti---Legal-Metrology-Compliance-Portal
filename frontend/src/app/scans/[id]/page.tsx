'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, formatDate, referenceNo, type ScanDetail } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/components/AuthProvider';
import ScanReport from '@/components/ScanReport';
import { ErrorNote, Icon, PageHeader, PageSkeleton, useStateName } from '@/components/ui';

export default function ScanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { can } = useAuth();
  const stateName = useStateName();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.scan(id).then(setScan).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <ErrorNote>{error}</ErrorNote>
        <Link href="/history" className="btn btn-ghost mt-4">
          <Icon name="arrowLeft" className="h-4 w-4" /> {t('Back')}
        </Link>
      </div>
    );
  }
  if (!scan) return <PageSkeleton />;

  const remove = async () => {
    if (!confirm(`Delete inspection ${referenceNo(scan.id, scan.created_at)}? This cannot be undone.`)) return;
    try {
      await api.deleteScan(scan.id);
      router.push('/history');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={referenceNo(scan.id, scan.created_at)}
        title="Inspection Record"
        hindi="निरीक्षण अभिलेख"
        actions={
          <>
            <Link href="/history" className="btn btn-ghost">
              <Icon name="arrowLeft" className="h-4 w-4" /> {t('Register')}
            </Link>
            <button onClick={() => window.print()} className="btn btn-ghost">
              <Icon name="print" className="h-4 w-4" /> {t('Print')}
            </button>
            {can('controller') && (
              <button onClick={remove} className="btn btn-ghost text-maroon">
                <Icon name="trash" className="h-4 w-4" /> {t('Delete')}
              </button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,3fr)]">
        <ScanReport scan={scan} onChange={setScan} />
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <dl className="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 p-5 text-sm">
            <dt className="text-muted">Officer</dt>
            <dd className="truncate text-ink">{scan.inspector === 'public' ? 'Consumer (public portal)' : scan.inspector || '–'}</dd>
            <dt className="text-muted">{t('State')}</dt>
            <dd className="text-ink">{stateName(scan.state) || '–'}</dd>
            <dt className="text-muted">{t('District')}</dt>
            <dd className="text-ink">{scan.district || '–'}</dd>
            <dt className="text-muted">Place</dt>
            <dd className="text-ink">{scan.location || '–'}</dd>
            <dt className="text-muted">Recorded</dt>
            <dd className="text-ink">{formatDate(scan.created_at)}</dd>
            {scan.reviewed_at && (
              <>
                <dt className="text-muted">{t('Reviewed')}</dt>
                <dd className="text-ink">{formatDate(scan.reviewed_at)}</dd>
              </>
            )}
            <dt className="text-muted">Source</dt>
            <dd className="truncate text-ink" title={scan.original_filename}>
              {scan.original_filename}
            </dd>
          </dl>
          {scan.manufacturer_key && (
            <Link href={`/offenders/${encodeURIComponent(scan.manufacturer_key)}`} className="card flex items-center gap-3 p-4 text-sm hover:border-gold-soft">
              <Icon name="users" className="h-5 w-5 text-saffron" />
              <span className="flex-1">
                <span className="block font-semibold text-ink">{scan.manufacturer_name || scan.brand}</span>
                <span className="text-xs text-muted">See this manufacturer&apos;s inspection history</span>
              </span>
              <Icon name="arrowRight" className="h-4 w-4 text-muted" />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
