'use client';
import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { useI18n } from '@/lib/i18n';
import { applyTheme, hasSavedTheme, resolveTheme, saveTheme } from '@/lib/theme';
import { Icon } from './ui';

// Watch data-theme on <html> so every toggle on the page stays in step
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.dataset.theme === 'dark';

/** True while the dark theme is on (false during server render). */
export function useIsDark() {
  return useSyncExternalStore(subscribe, isDark, () => false);
}

/** Sun / moon button that switches between the light and dark themes. */
export default function ThemeToggle({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n();
  const on = useIsDark();

  // The head script sets the theme before paint; re-apply after React's dev remount clears it
  useLayoutEffect(() => {
    applyTheme(resolveTheme());
  }, []);

  // Until the officer picks a theme, follow the OS setting live
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      if (!hasSavedTheme()) applyTheme(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);

  const label = t(on ? 'Switch to light mode' : 'Switch to dark mode');
  return (
    <button
      type="button"
      onClick={() => saveTheme(isDark() ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
        dark ? 'border-white/20 text-white/80 hover:text-white' : 'border-sand-strong bg-paper text-ink-soft hover:bg-parchment hover:text-indigo'
      }`}
    >
      {/* Icons switch in CSS so the server render never mismatches the theme */}
      <Icon name="moon" className="h-[18px] w-[18px] dark:hidden" />
      <Icon name="sun" className="hidden h-[18px] w-[18px] dark:block" />
    </button>
  );
}
