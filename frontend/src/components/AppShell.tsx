'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, DATA_CHANGED_EVENT, type Role } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { listPending, QUEUE_EVENT, syncPending } from '@/lib/offline';
import { useAuth } from './AuthProvider';
import { Emblem, Wordmark } from './ornaments';
import ThemeToggle from './ThemeToggle';
import { Icon, type IconName } from './ui';

const NAV: { href: string; label: string; icon: IconName; min?: Role; badge?: 'notices' | 'complaints' | 'review' }[] = [
  { href: '/', label: 'Inspect', icon: 'camera' },
  { href: '/history', label: 'Register', icon: 'doc', badge: 'review' },
  { href: '/batch', label: 'Bulk scan', icon: 'layers' },
  { href: '/insights', label: 'Insights', icon: 'map' },
  { href: '/notices', label: 'Notices', icon: 'stamp', badge: 'notices' },
  { href: '/complaints', label: 'Complaints', icon: 'mail', badge: 'complaints' },
  { href: '/accuracy', label: 'Accuracy', icon: 'target', min: 'controller' },
  { href: '/rules', label: 'Rules', icon: 'book' },
  { href: '/admin', label: 'Admin', icon: 'users', min: 'admin' },
];

const FONT_SCALES = [93.75, 100, 112.5];
const FONT_KEY = 'pramiti.fontScale';

export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <div
      className={`flex items-center rounded-full border p-0.5 text-xs font-semibold ${dark ? 'border-white/20' : 'border-sand-strong bg-paper'}`}
      role="group"
      aria-label="Language"
    >
      {(['en', 'hi'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2.5 py-1 transition ${lang === l ? 'bg-navy text-white' : dark ? 'text-white/70' : 'text-ink-soft hover:text-indigo'}`}
        >
          {l === 'en' ? 'English' : <span className="text-deva">हिंदी</span>}
        </button>
      ))}
    </div>
  );
}

function OfflineBar() {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listPending().then((p) => setPending(p.length));
  }, []);

  const sync = useCallback(async () => {
    const r = await syncPending();
    if (r.uploaded) setMessage(`${r.uploaded} offline inspection(s) uploaded.`);
    if (r.failed.length) setMessage(`Some offline inspections could not be analysed: ${r.failed[0]}`);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const goOnline = () => {
      update();
      sync();
    };
    queueMicrotask(() => {
      update();
      refresh();
      if (navigator.onLine) sync(); // upload anything captured while offline
    });
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', update);
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', update);
      window.removeEventListener(QUEUE_EVENT, refresh);
    };
  }, [refresh, sync]);

  if (online && !pending && !message) return null;
  return (
    <div className={`no-print text-sm ${online ? 'bg-indigo-50 text-indigo' : 'bg-saffron text-white'}`} role="status">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        {!online && <Icon name="wifiOff" className="h-4 w-4" />}
        <span className="flex-1">
          {!online && <b>{t('You are offline')}. </b>}
          {pending > 0 && (
            <>
              {pending} {t('waiting to upload')}.{' '}
            </>
          )}
          {online && message}
        </span>
        {online && pending > 0 && (
          <button onClick={sync} className="font-semibold underline underline-offset-2">
            {t('Sync now')}
          </button>
        )}
        {online && message && !pending && (
          <button onClick={() => setMessage(null)} aria-label="Dismiss">
            <Icon name="cross" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { officer, logout, can } = useAuth();
  const { t, lang } = useI18n();
  const pathname = usePathname();
  // Phone menu: remembers the page it was opened on, so navigating closes it
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === pathname;
  const [badges, setBadges] = useState<{ notices: number; complaints: number; review: number }>({ notices: 0, complaints: 0, review: 0 });
  // AppShell renders only after AuthProvider has hydrated, so reading storage here is safe
  const [scale, setScale] = useState(() => {
    try {
      const saved = localStorage.getItem(FONT_KEY);
      const n = saved === null ? 1 : Number(saved);
      return n >= 0 && n < FONT_SCALES.length ? n : 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SCALES[scale]}%`;
    try {
      localStorage.setItem(FONT_KEY, String(scale));
    } catch {}
  }, [scale]);

  const loadBadges = useCallback(() => {
    api
      .stats()
      .then((s) => setBadges({ notices: s.notices_pending, complaints: s.open_complaints, review: s.pending_review }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBadges();
  }, [pathname, loadBadges]);

  // Keep the counts current after a change on this page, and when the officer comes back to the tab
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadBadges();
    };
    window.addEventListener(DATA_CHANGED_EVENT, loadBadges);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, loadBadges);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadBadges]);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const today = new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const nav = NAV.filter((n) => !n.min || can(n.min));
  const initials = officer.name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>

      {/* Utility strip */}
      <div className="tricolour" />
      <div className="no-print border-b border-sand bg-parchment/70 text-xs text-ink-soft">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 sm:px-6 lg:px-8">
          <p className="truncate">
            <span className="text-deva">विधिक माप विज्ञान</span>
            <span className="mx-2 text-gold">|</span>
            <span className="hidden sm:inline">Legal Metrology · Packaged Commodities Enforcement</span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden md:inline">{today}</span>
            <span className="hidden text-gold md:inline">|</span>
            <div className="flex items-center gap-0.5" role="group" aria-label={t('Text size')}>
              {['A-', 'A', 'A+'].map((label, i) => (
                <button
                  key={label}
                  onClick={() => setScale(i)}
                  aria-pressed={scale === i}
                  aria-label={['Decrease text size', 'Default text size', 'Increase text size'][i]}
                  className={`rounded px-1.5 py-0.5 font-semibold ${scale === i ? 'bg-navy text-white' : 'hover:bg-sand'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Masthead */}
      <header className="bg-buti border-b border-sand bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 md:py-4 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
            <Emblem className="h-10 w-10 shrink-0 sm:h-14 sm:w-14" />
            <div className="min-w-0 leading-tight">
              <Wordmark />
              <p className="mt-1 hidden text-xs text-muted sm:block">
                Legal Metrology Compliance Portal · <span className="text-deva">विधिक माप अनुपालन पोर्टल</span>
              </p>
            </div>
          </Link>

          {/* Phones: theme + menu button; everything else moves into the menu */}
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={t(menuOpen ? 'Close menu' : 'Open menu')}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-sand-strong bg-paper text-ink-soft hover:bg-parchment hover:text-indigo"
            >
              <Icon name={menuOpen ? 'cross' : 'menu'} className="h-[18px] w-[18px]" />
              {!menuOpen && badges.notices + badges.complaints + badges.review > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper bg-saffron" />
              )}
            </button>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <LanguageToggle />
            <Link href="/account" className="flex items-center gap-3 rounded-xl px-2 py-1 hover:bg-parchment" title={t('Account')}>
              <div className="hidden text-right lg:block">
                <p className="text-sm font-semibold text-ink">{officer.name}</p>
                <p className="text-xs text-muted">
                  <span className="capitalize">{t(officer.role)}</span> · {officer.email}
                </p>
              </div>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-gold-soft bg-indigo-50 font-bold text-indigo"
                aria-hidden="true"
              >
                {initials}
              </span>
            </Link>
            <button onClick={logout} className="btn btn-ghost px-3 py-2 text-sm" title={t('Sign out')}>
              <Icon name="logout" className="h-4 w-4" />
              <span className="hidden lg:inline">{t('Sign out')}</span>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="no-print hidden bg-navy md:block" aria-label="Main">
          <div className="mx-auto flex max-w-7xl gap-0.5 overflow-x-auto px-2 sm:px-4 lg:px-6">
            {nav.map((item) => {
              const active = isActive(item.href);
              const count = item.badge ? badges[item.badge] : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors ${
                    active ? 'text-white' : 'text-white/70 hover:text-white'
                  } ${lang === 'hi' ? 'text-deva' : ''}`}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                  {t(item.label)}
                  {count > 0 && (
                    <span className="rounded-full bg-saffron px-1.5 text-[10px] font-bold leading-4 text-white">{count > 99 ? '99+' : count}</span>
                  )}
                  {active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-saffron" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {menuOpen && (
          <div id="mobile-menu" className="no-print animate-rise border-t border-sand bg-paper md:hidden">
            <nav aria-label="Main" className="grid grid-cols-2 gap-1.5 px-4 pt-3">
              {nav.map((item) => {
                const active = isActive(item.href);
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      active ? 'bg-navy text-white' : 'text-ink-soft hover:bg-parchment'
                    } ${lang === 'hi' ? 'text-deva' : ''}`}
                  >
                    <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(item.label)}</span>
                    {count > 0 && (
                      <span className="ml-auto rounded-full bg-saffron px-1.5 text-[10px] font-bold leading-4 text-white">{count > 99 ? '99+' : count}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="mx-4 mt-3 flex items-center gap-3 border-t border-sand py-3">
              <Link href="/account" className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-gold-soft bg-indigo-50 font-bold text-indigo" aria-hidden="true">
                  {initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{officer.name}</span>
                  <span className="block truncate text-xs text-muted">{officer.email}</span>
                </span>
              </Link>
              <button onClick={logout} className="btn btn-ghost shrink-0 px-3 py-2 text-sm">
                <Icon name="logout" className="h-4 w-4" />
                {t('Sign out')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-sand px-4 py-3 text-sm text-ink-soft">
              {t('Language')}
              <LanguageToggle />
            </div>
          </div>
        )}
      </header>

      <OfflineBar />

      <main id="content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="no-print mt-12">
        <div className="band-temple" />
        <div className="bg-jaali-light bg-navy text-white/80">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
            <div>
              <div className="flex items-center gap-3">
                <Emblem className="h-10 w-10" />
                <div>
                  <Wordmark size="sm" light />
                  <p className="text-deva mt-1 text-sm text-gold-soft">सही माप, सही दाम</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed">
                Automated compliance checking of pre-packaged commodity labels and e-commerce listings under the Legal
                Metrology Act, 2009 and the Packaged Commodities Rules, 2011.
              </p>
            </div>
            <div>
              <p className="eyebrow !text-gold-soft">{t('Quick links')}</p>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {nav.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="hover:text-white hover:underline">
                      {t(n.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow !text-gold-soft">{t('Consumer grievances')}</p>
              <p className="mt-3 text-sm leading-relaxed">
                National Consumer Helpline: <span className="font-semibold text-white">1915</span>
                <br />
                Toll-free: <span className="font-semibold text-white">1800-11-4000</span>
              </p>
              <Link href="/complaint" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-soft hover:text-white">
                <Icon name="mail" className="h-4 w-4" /> Public complaint portal
              </Link>
            </div>
          </div>
          <div className="border-t border-white/10">
            <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/55 sm:px-6 lg:px-8">
              Prototype built for Smart India Hackathon. AI-generated findings are advisory and must be verified by the
              inspecting officer before any enforcement action.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
