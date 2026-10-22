'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Emblem, Wordmark } from './ornaments';
import { LanguageToggle } from './AppShell';
import ThemeToggle from './ThemeToggle';

/** Shell for the public consumer pages (no sign-in). */
export default function PublicShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <div className="tricolour" />
      <header className="bg-buti border-b border-sand bg-paper">
        {/* Phones: logo on one row, controls on the next */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-4">
          <Link href="/complaint" className="flex min-w-0 items-center gap-3">
            <Emblem className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
            <div className="min-w-0 leading-tight">
              <Wordmark />
              <p className="mt-1 truncate text-xs text-muted">
                Consumer Complaint Portal · <span className="text-deva">उपभोक्ता शिकायत पोर्टल</span>
              </p>
            </div>
          </Link>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <ThemeToggle />
            <LanguageToggle />
            <Link href="/complaint/track" className="btn btn-ghost ml-auto px-3 py-2 text-sm sm:ml-0">
              {t('Track complaint')}
            </Link>
          </div>
        </div>
      </header>
      <main id="content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="mt-10">
        <div className="band-temple" />
        <div className="bg-jaali-light bg-navy px-4 py-6 text-center text-sm text-white/75">
          National Consumer Helpline <b className="text-white">1915</b> · Toll-free <b className="text-white">1800-11-4000</b>
          <p className="mt-1 text-xs text-white/50">
            Prototype built for Smart India Hackathon. <Link href="/" className="underline">Officer sign-in</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
