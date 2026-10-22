'use client';
import { useCallback, useState, type FormEvent } from 'react';
import GoogleSignIn, { GOOGLE_ENABLED } from './GoogleSignIn';
import { Emblem, FramedCorners, Rosette, Divider, Wordmark } from './ornaments';
import ThemeToggle from './ThemeToggle';
import { Icon, Spinner } from './ui';

const DEMO_EMAIL = 'official@metrology.gov.in';
const DEMO_PASSWORD = 'admin123';
// Hide the hint once real credentials are configured in backend/.env
const SHOW_DEMO = process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN !== 'false';

export default function LoginScreen({
  onLogin,
  onGoogleLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: (credential: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = useCallback(async (attempt: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await attempt();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn(() => onLogin(email, password));
  };

  const google = useCallback((credential: string) => signIn(() => onGoogleLogin(credential)), [signIn, onGoogleLogin]);

  return (
    <div className="flex min-h-screen flex-col bg-ivory">
      <div className="tricolour" />
      <div className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
        {/* Heritage panel */}
        <aside className="bg-jaali-light relative hidden overflow-hidden bg-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
          <Rosette className="animate-spin-slow pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] text-gold-soft/20" />
          <Rosette className="pointer-events-none absolute -bottom-52 -left-44 h-[30rem] w-[30rem] text-gold-soft/10" />

          <div className="relative flex items-center gap-4">
            <Emblem className="h-14 w-14" />
            <div>
              <Wordmark light />
              <p className="mt-1 text-sm text-white/70">Legal Metrology Compliance Portal</p>
            </div>
          </div>

          <div className="relative max-w-lg">
            <p className="text-deva text-2xl text-gold-soft">सही माप, सही दाम</p>
            <h1 className="heading-serif mt-3 text-5xl font-bold leading-[1.1]">
              Honest measure,
              <br />
              fair price.
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-white/75">
              AI-assisted inspection of pre-packaged commodity labels under the Legal Metrology (Packaged
              Commodities) Rules, 2011, for every declaration from MRP to consumer care.
            </p>
            <ul className="mt-8 grid gap-3 text-white/85">
              {[
                'Rule 6 mandatory declarations checked one by one',
                'Rule 7 numeral-height assessment for the display panel',
                'Signed-ready PDF inspection reports & searchable register',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-saffron">
                    <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-white/50">
            Prototype for Smart India Hackathon. AI findings are advisory and must be verified by the inspecting officer.
          </p>
        </aside>

        {/* Sign-in */}
        <main className="bg-buti relative flex items-center justify-center px-4 py-12 sm:px-8">
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <ThemeToggle />
          </div>
          <div className="w-full max-w-md animate-rise">
            <div className="mb-8 flex flex-col items-center text-center lg:hidden">
              <Emblem className="h-16 w-16" />
              <Wordmark size="lg" className="mt-3" />
              <p className="text-deva text-saffron-600">सही माप, सही दाम</p>
            </div>

            <div className="card card-framed arch-top overflow-hidden px-7 pb-8 pt-14 sm:px-10">
              <FramedCorners />
              <div className="text-center">
                <p className="eyebrow">Authorised officers only</p>
                <h2 className="heading-serif mt-1 text-3xl font-bold text-indigo">Officer Sign In</h2>
                <p className="text-deva text-muted">अधिकारी प्रवेश</p>
              </div>
              <Divider className="my-6" />

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink-soft">
                    Official e-mail ID
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="field"
                    placeholder="name@metrology.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-ink-soft">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    className="field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-maroon-50 px-3 py-2 text-sm text-maroon">
                    {error}
                  </p>
                )}

                <button type="submit" disabled={busy} className="btn btn-primary w-full py-3 text-base">
                  {busy ? <Spinner /> : <Icon name="shield" />}
                  {busy ? 'Verifying…' : 'Sign in securely'}
                </button>
              </form>

              {GOOGLE_ENABLED && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                    <span className="h-px flex-1 bg-sand" />
                    or
                    <span className="h-px flex-1 bg-sand" />
                  </div>
                  <GoogleSignIn onCredential={google} onError={setError} />
                </>
              )}

              {SHOW_DEMO && (
                <div className="mt-6 rounded-xl border border-dashed border-gold-soft bg-parchment/60 p-3 text-center text-sm text-ink-soft">
                  Demo account: <span className="font-semibold">{DEMO_EMAIL}</span> /{' '}
                  <span className="font-semibold">{DEMO_PASSWORD}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(DEMO_EMAIL);
                      setPassword(DEMO_PASSWORD);
                    }}
                    className="ml-2 font-semibold text-saffron-600 underline underline-offset-2"
                  >
                    Fill
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
