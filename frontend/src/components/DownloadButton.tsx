'use client';
import { useState } from 'react';
import { downloadReport } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Icon, Spinner } from './ui';

/** Downloads the PDF inspection report. Kept apart from ScanReport so list pages stay light. */
export function DownloadButton({ id, className = 'btn btn-primary' }: { id: number; className?: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        setFailed(false);
        try {
          await downloadReport(id);
        } catch {
          setFailed(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Spinner className="h-4 w-4" /> : <Icon name="download" className="h-4 w-4" />}
      {failed ? t('Retry') : t('PDF report')}
    </button>
  );
}
