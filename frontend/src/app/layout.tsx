import type { Metadata, Viewport } from 'next';
import { Baloo_2, Cinzel, Mukta, Tiro_Devanagari_Hindi } from 'next/font/google';
import AuthProvider from '@/components/AuthProvider';
import { LanguageProvider } from '@/lib/i18n';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

// Only the main text fonts (Mukta body, Cinzel headings) are preloaded, and only their Latin files.
// `subsets` lists what is preloaded; the Devanagari files still load on demand when Hindi appears.

// Brand wordmark - Baloo 2 (Ek Type, an Indian foundry; supports Devanagari too)
const baloo = Baloo_2({
  variable: '--font-baloo',
  weight: '800',
  preload: false,
});

// Headings
const cinzel = Cinzel({
  variable: '--font-cinzel',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Body text - Mukta (Ek Type; matching Devanagari, so Hindi body text uses it too)
const mukta = Mukta({
  variable: '--font-mukta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Devanagari text (Cinzel is Latin-only)
const tiro = Tiro_Devanagari_Hindi({
  variable: '--font-tiro',
  weight: '400',
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: 'Pramiti · Legal Metrology Compliance Portal',
    template: '%s · Pramiti',
  },
  description:
    'AI-assisted compliance checking of pre-packaged commodity labels under the Legal Metrology (Packaged Commodities) Rules, 2011.',
};

export const viewport: Viewport = {
  themeColor: '#22305e',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script sets data-theme before React hydrates, hence suppressHydrationWarning
    <html lang="en" className={`${baloo.variable} ${cinzel.variable} ${mukta.variable} ${tiro.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
