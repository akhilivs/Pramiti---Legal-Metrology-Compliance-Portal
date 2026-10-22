'use client';
import { useEffect, useState } from 'react';
import { api, type CheckRef, type RuleRef } from '@/lib/api';
import { FramedCorners } from '@/components/ornaments';
import { ErrorNote, PageHeader, SectionTitle, Spinner } from '@/components/ui';

// Rule 7(2), as notified in the 2011 Gazette (bundled sih_eng.pdf)
const RULE7_TABLES = [
  {
    title: 'Table I · net quantity by weight / volume',
    head: 'Net quantity',
    rows: [
      ['Up to 200 g / ml', '1 mm', '2 mm'],
      ['Above 200 up to 500 g / ml', '2 mm', '4 mm'],
      ['Above 500 g / ml', '4 mm', '6 mm'],
    ],
  },
  {
    title: 'Table II · by length, area or number',
    head: 'Display panel area',
    rows: [
      ['Up to 100 cm²', '1 mm', '2 mm'],
      ['Above 100 up to 500 cm²', '2 mm', '4 mm'],
      ['Above 500 up to 2500 cm²', '4 mm', '6 mm'],
      ['Above 2500 cm²', '6 mm', '6 mm'],
    ],
  },
];

export default function RulesPage() {
  const [data, setData] = useState<{ rules: RuleRef[]; checks: CheckRef[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.rules().then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Reference"
        title="Rules Reference"
        hindi="विधिक माप विज्ञान (पैकेजबंद वस्तुएँ) नियम, 2011"
        description="Summary of the provisions every label is checked against. Always refer to the notified Gazette text for enforcement."
      />

      {error && <ErrorNote>{error}</ErrorNote>}
      {!data && !error && (
        <div className="flex items-center justify-center gap-3 py-20 text-muted">
          <Spinner /> Loading…
        </div>
      )}

      {data && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-4">
            {data.rules.map((r) => (
              <article key={r.id} id={r.id} className="card p-6">
                <div className="flex items-baseline gap-3">
                  <span className="heading-serif shrink-0 text-lg font-bold text-saffron-600">{r.rule}</span>
                  <h2 className="heading-serif text-xl font-bold text-indigo">{r.title}</h2>
                </div>
                <p className="mt-2 leading-relaxed text-ink-soft">{r.text}</p>
              </article>
            ))}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <section className="card card-framed p-6">
              <FramedCorners />
              <SectionTitle hindi="न्यूनतम अंक ऊँचाई">Rule 7 · Minimum numeral height</SectionTitle>
              {RULE7_TABLES.map((t) => (
                <div key={t.title} className="mb-4 last:mb-0">
                  <p className="mb-1 text-xs font-semibold text-indigo">{t.title}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-sand text-left text-xs uppercase tracking-wide text-muted">
                        <th className="py-2 font-semibold">{t.head}</th>
                        <th className="py-2 text-right font-semibold">Printed</th>
                        <th className="py-2 text-right font-semibold">Embossed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand">
                      {t.rows.map(([a, n, e]) => (
                        <tr key={a}>
                          <td className="py-2 text-ink">{a}</td>
                          <td className="py-2 text-right font-semibold text-ink">{n}</td>
                          <td className="py-2 text-right text-ink-soft">{e}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              <p className="mt-3 text-xs text-muted">
                &ldquo;Embossed&rdquo; covers declarations blown, formed, moulded, embossed or perforated on the container.
                As notified in 2011; the 2017 amendment applies the display-panel-area table to all declarations.
              </p>
            </section>

            <section className="card p-6">
              <SectionTitle hindi="जाँच सूची">What Pramiti checks</SectionTitle>
              <ol className="space-y-3">
                {data.checks.map((c, i) => (
                  <li key={c.id} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-ink">
                        {c.title} <span className="font-mono text-[11px] font-normal text-muted">{c.rule}</span>
                      </p>
                      <p className="text-sm text-ink-soft">{c.requirement}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
