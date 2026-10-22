'use client';
import { useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
export const GOOGLE_ENABLED = CLIENT_ID !== '';

// Minimal typing for Google Identity Services (https://accounts.google.com/gsi/client)
interface GoogleId {
  initialize(config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let gsi: Promise<GoogleId> | null = null;
// Google calls back to one handler per page; the mounted button points it at its own prop
let onToken: (credential: string) => void = () => {};

function loadGoogle(): Promise<GoogleId> {
  gsi ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const id = window.google!.accounts.id;
      id.initialize({ client_id: CLIENT_ID, callback: (r) => onToken(r.credential), ux_mode: 'popup', auto_select: false });
      resolve(id);
    };
    script.onerror = () => {
      gsi = null; // let a later mount retry
      reject(new Error('Could not load Google sign-in. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });
  return gsi;
}

/** Google's own "Sign in with Google" button; hands the ID token to onCredential. */
export default function GoogleSignIn({ onCredential, onError }: { onCredential: (credential: string) => void; onError: (message: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const { lang } = useI18n();

  useEffect(() => {
    onToken = onCredential;
  }, [onCredential]);

  // Re-draw when the language changes so the button text matches the page
  useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then((id) => {
        if (cancelled || !box.current) return;
        box.current.replaceChildren();
        id.renderButton(box.current, {
          type: 'standard',
          // outline keeps the plain "G" in both themes; filled_black boxes it in a white square
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, box.current.offsetWidth)),
          locale: lang === 'hi' ? 'hi' : 'en',
        });
      })
      .catch((e: Error) => !cancelled && onError(e.message));
    return () => {
      cancelled = true;
    };
  }, [lang, onError]);

  return <div ref={box} className="flex min-h-[44px] w-full justify-center" />;
}
