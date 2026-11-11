"use client";

import { useEffect, useState } from "react";
import TimeChart from "./TimeChart";
import { compare } from "./decision";
import { monthLabel, num, pct, tl } from "./format";
import { Legend, NumberField, Segmented } from "./parts";

const STORE = "konut:hesap:v1";
const roundTo = (v, step) => Math.round(v / step) * step;

// Varsayilanlar verinin kendisinden geliyor; kullanici degistirmedikce
// bolge degisince fiyat ve kira da bolgenin ortalamasina gecer.
function defaultsFor(view, common) {
  const [, unitPrice] = view.unit.unitPrice;
  const [, unitRent] = view.unit.unitRent;
  const deposit = common.deposit.value * 100;
  const fall = (common.inflation.value - common.expectation.value) * 100;
  return {
    price: roundTo(unitPrice * 100, 50000),
    rent: roundTo(unitRent * 100, 500),
    deposit: +deposit.toFixed(1),
    deposit12: +Math.max(0, deposit - Math.max(0, fall)).toFixed(1),
    rentGrowth: Math.round(common.inflation.value * 100),
    mortgage: +(common.mortgage.value * 100).toFixed(1),
  };
}

const BASE = {
  mode: "cash",
  price: null,
  rent: null,
  rentRenewIn: 6,
  rentGrowth: null,
  deposit: null,
  deposit12: null,
  tax: 17.5,
  loanShare: 50,
  mortgage: null,
  term: 120,
  costs: 4,
};

function verdictFor(p) {
  if (p >= 0.65) return { tone: "wait", title: "Beklemek öne çıkıyor" };
  if (p <= 0.35) return { tone: "buy", title: "Şimdi almak öne çıkıyor" };
  return { tone: "even", title: "Belirgin bir fark yok" };
}

export default function Decision({ view, common }) {
  const defaults = defaultsFor(view, common);
  const [inputs, setInputs] = useState(BASE);

  // Kayitli girdiler yalnizca bu tarayicida; sayfa onlarsiz da calisiyor.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved && typeof saved === "object") setInputs((s) => ({ ...s, ...saved }));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(inputs));
    } catch {}
  }, [inputs]);

  const v = (k) => inputs[k] ?? defaults[k];
  const set = (k) => (val) => setInputs((s) => ({ ...s, [k]: val }));

  const price = v("price");
  const loan = inputs.mode === "loan" ? (price * inputs.loanShare) / 100 : 0;

  const { result, depositThreshold } = (() => {
    const tax = inputs.tax / 100;
    const path = (d0, d12) =>
      Array.from({ length: 24 }, (_, i) => {
        const gross = d0 + ((d12 - d0) * Math.min(i + 1, 12)) / 12;
        return (gross * (1 - tax)) / 12;
      });
    const qs = common.quantiles;
    const forecast = view.forecast.steps.map((s) => ({
      h: s.h,
      q: s.nominal.map((val, i) => ({ q: qs[i], v: val })),
      median: s.nominal[qs.indexOf(0.5)],
      cpi: s.cpi,
    }));
    const run = (depositPath) =>
      compare({
        price,
        rent: v("rent"),
        rentRenewIn: inputs.rentRenewIn,
        rentGrowth: v("rentGrowth") / 100,
        loan,
        loanRate: v("mortgage") / 100 / 12,
        loanTerm: inputs.term,
        depositPath,
        costs: inputs.costs / 100,
        forecast,
      });

    // Mevduat faizi 12 ay boyunca sabit kalsa hangi seviyede iki secenek
    // esitlenir? Fark faize gore tekduze artiyor, ikiye bolme yetiyor.
    const diff12 = (x) => run(path(x, x)).rows[11].diffMedian;
    let lo = 0;
    let hi = 2;
    let threshold = null;
    if (diff12(lo) < 0 && diff12(hi) > 0) {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (diff12(mid) > 0) hi = mid;
        else lo = mid;
      }
      threshold = (lo + hi) / 2;
    }
    return { result: run(path(v("deposit") / 100, v("deposit12") / 100)), depositThreshold: threshold };
  })();

  const r12 = result.rows[11];
  const verdict = verdictFor(r12.pWait);
  const best = result.best;
  const months = view.forecast.steps.map((s) => s.month);
  const growth12 = r12.breakEven - 1;
  const model12 = view.forecast.median12;

  const chartSeries = [
    {
      id: "diff",
      label: "Beklemenin kazancı (orta)",
      color: "var(--color-fg)",
      points: result.rows.map((r) => [months[r.h - 1], Math.round(r.diffReal)]),
    },
  ];
  const chartBands = [
    {
      id: "diffBand",
      label: "%80 aralık",
      color: "var(--color-fg)",
      opacity: 0.1,
      points: result.rows.map((r) => [months[r.h - 1], Math.round(r.diffLowReal), Math.round(r.diffHighReal)]),
    },
  ];

  const bestText =
    best.h === 0
      ? "Modele göre beklemenin hiçbir ayda beklenen bir kazancı yok: bugün almak en az maliyetli seçenek."
      : best.h >= 24
        ? verdict.tone === "wait"
          ? "Beklemenin avantajı önümüzdeki 24 ay boyunca artmaya devam ediyor. Koşullar değişmedikçe acele etmek için bir sebep görünmüyor."
          : "Orta senaryoda beklemek önde ve fark zamanla büyüyor. Ama olasılık belirgin bir üstünlük için yetmiyor: fiyatlar beklenenden hızlı artarsa beklemek kaybettiriyor."
        : `Beklemenin avantajı ${monthLabel(months[best.h - 1])} civarında en yüksek seviyeye çıkıyor (${best.h} ay sonra), sonra azalıyor. Model en uygun alım zamanı olarak bu dönemi gösteriyor.`;

  return (
    <div>
      <div className="rounded-2xl border border-line p-6 max-md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-meta text-faint">12 ay beklersen</div>
          <div className="text-meta text-faint">{view.label === view.place ? view.place : `${view.place}, ${view.label} endeksi`}</div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <VerdictIcon tone={verdict.tone} />
          <div className="text-2xl font-semibold tracking-tight text-fg">{verdict.title}</div>
        </div>
        <p className="mt-3 max-w-reading text-body text-prose">
          {growth12 >= 0 ? (
            <>
              Bu koşullarda beklemenin kazandırması için ev fiyatlarının önümüzdeki 12 ayda en fazla{" "}
              <strong className="font-semibold text-fg">{pct(growth12, 1)}</strong> artması gerekiyor.
            </>
          ) : (
            <>
              Bu koşullarda beklemenin kazandırması için ev fiyatlarının önümüzdeki 12 ayda en az{" "}
              <strong className="font-semibold text-fg">{pct(-growth12, 1)}</strong> düşmesi gerekiyor.
            </>
          )}{" "}
          Modelin beklediği değişim <strong className="font-semibold text-fg">{pct(model12, 1, true)}</strong>. Bu
          tahmine göre beklemenin kazandırma olasılığı{" "}
          <strong className="font-semibold text-fg">{pct(r12.pWait, 0)}</strong>.
        </p>
        <p className="mt-3 max-w-reading text-body text-muted">{bestText}</p>
        {depositThreshold != null && (
          <p className="mt-3 max-w-reading text-body text-muted">
            {depositThreshold < v("deposit") / 100 ? (
              <>
                Neyi izlemeli: 3 aylık mevduat faizi yıllık{" "}
                <strong className="font-semibold text-fg">{pct(depositThreshold, 0)}</strong> seviyesine inerse, bugünkü
                fiyat tahminiyle bugün almak öne geçer. Şu an {pct(v("deposit") / 100, 1)}.
              </>
            ) : (
              <>
                Neyi izlemeli: bugünkü fiyat tahminiyle beklemenin öne geçmesi için 3 aylık mevduat faizinin yıllık{" "}
                <strong className="font-semibold text-fg">{pct(depositThreshold, 0)}</strong> seviyesine çıkması
                gerekir. Şu an {pct(v("deposit") / 100, 1)}.
              </>
            )}
          </p>
        )}
        <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4 max-md:grid-cols-1 max-md:gap-3">
          <div>
            <dt className="text-meta text-faint">12 ay sonra beklemenin kazancı</dt>
            <dd className="mt-0.5 text-ui text-fg tabular-nums">{signedTl(r12.diffReal)}</dd>
            <dd className="text-label text-faint">bugünün parasıyla, orta senaryo</dd>
          </div>
          <div>
            <dt className="text-meta text-faint">Kötü senaryoda</dt>
            <dd className="mt-0.5 text-ui text-fg tabular-nums">{signedTl(r12.diffLowReal)}</dd>
            <dd className="text-label text-faint">fiyatlar beklenenden hızlı artarsa</dd>
          </div>
          <div>
            <dt className="text-meta text-faint">{inputs.mode === "loan" ? "Aylık kredi taksiti" : "Bugün ödenen"}</dt>
            <dd className="mt-0.5 text-ui text-fg tabular-nums">
              {inputs.mode === "loan" ? tl(result.payment) : tl(price * (1 + inputs.costs / 100))}
            </dd>
            <dd className="text-label text-faint">
              {inputs.mode === "loan" ? `${tl(loan, true)} kredi, ${inputs.term} ay` : "fiyat ve alım masrafları"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-10 max-lg:grid-cols-1">
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()} aria-label="Hesap girdileri">
          <Segmented
            label="Finansman"
            value={inputs.mode}
            onChange={set("mode")}
            options={[
              { value: "cash", label: "Peşin" },
              { value: "loan", label: "Kredili" },
            ]}
          />
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <NumberField
              id="k-price"
              label="Evin bugünkü fiyatı"
              value={price}
              onChange={set("price")}
              suffix="TL"
              min={0}
              hint={inputs.price == null ? `${view.unitPlace} ortalamasıyla 100 m²` : undefined}
            />
            <NumberField
              id="k-rent"
              label="Ödediğin aylık kira"
              value={v("rent")}
              onChange={set("rent")}
              suffix="TL"
              min={0}
              hint={inputs.rent == null ? `${view.unitPlace} ortalamasıyla 100 m²` : undefined}
            />
          </div>
          {inputs.mode === "loan" && (
            <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
              <NumberField
                id="k-loan"
                label="Kredi payı"
                value={inputs.loanShare}
                onChange={set("loanShare")}
                suffix="%"
                min={0}
                max={100}
                hint="Fiyatın ne kadarı kredi"
              />
              <NumberField id="k-rate" label="Yıllık faiz" value={v("mortgage")} onChange={set("mortgage")} suffix="%" decimals={2} min={0} />
              <NumberField id="k-term" label="Vade" value={inputs.term} onChange={set("term")} suffix="ay" min={12} max={240} />
            </div>
          )}

          <details className="group rounded-xl border border-line px-4 py-3">
            <summary className="cursor-pointer list-none text-ui text-muted marker:hidden hover:text-fg">
              <span className="inline-block w-4 transition group-open:rotate-90">›</span>Varsayımlar
            </summary>
            <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <NumberField
                id="k-dep"
                label="Mevduat faizi bugün"
                value={v("deposit")}
                onChange={set("deposit")}
                suffix="%"
                decimals={2}
                min={0}
                hint="3 aya kadar vadeli, brüt, TCMB"
              />
              <NumberField
                id="k-dep12"
                label="Mevduat faizi 12 ay sonra"
                value={v("deposit12")}
                onChange={set("deposit12")}
                suffix="%"
                decimals={2}
                min={0}
                hint="Varsayılan: enflasyon beklentisi kadar düşer"
              />
              <NumberField id="k-tax" label="Stopaj" value={inputs.tax} onChange={set("tax")} suffix="%" decimals={1} min={0} max={50} />
              <NumberField
                id="k-costs"
                label="Alım masrafı"
                value={inputs.costs}
                onChange={set("costs")}
                suffix="%"
                decimals={1}
                min={0}
                max={20}
                hint="Tapu harcı, emlakçı"
              />
              <NumberField
                id="k-rentg"
                label="Yıllık kira artışı"
                value={v("rentGrowth")}
                onChange={set("rentGrowth")}
                suffix="%"
                decimals={1}
                min={0}
                hint="Varsayılan: bugünkü yıllık enflasyon"
              />
              <NumberField
                id="k-renew"
                label="Kira artışına kalan"
                value={inputs.rentRenewIn}
                onChange={set("rentRenewIn")}
                suffix="ay"
                min={1}
                max={12}
              />
            </div>
            <button
              type="button"
              onClick={() => setInputs(BASE)}
              className="mt-4 text-meta text-faint underline decoration-line underline-offset-4 hover:text-fg"
            >
              Tümünü varsayılana döndür
            </button>
          </details>
        </form>

        <div className="min-w-0">
          <div className="text-ui text-fg">Beklemenin kazancı, bekleme süresine göre</div>
          <p className="mt-1 text-meta text-muted">
            Sıfırın üstü beklemenin, altı bugün almanın daha iyi olduğu anlamına geliyor. Tutarlar bugünün parasıyla.
          </p>
          <div className="mt-3">
            <Legend
              items={[
                { label: "Orta senaryo", color: "var(--color-fg)" },
                { label: "%80 olasılık aralığı", color: "var(--color-fg)", kind: "band", opacity: 0.15 },
              ]}
            />
          </div>
          <div className="mt-2">
            <TimeChart
              series={chartSeries}
              bands={chartBands}
              zero
              height={260}
              yFormat={(x) => compactTl(x)}
              valueFormat={(x) => signedTl(x)}
              ariaLabel="Bekleme süresine göre beklemenin kazancı"
            />
          </div>
          <table className="mt-6 w-full text-meta tabular-nums">
            <caption className="sr-only">Bekleme süresine göre sonuçlar</caption>
            <thead className="text-faint">
              <tr className="border-b border-line text-left">
                <th className="py-2 font-normal">Bekleme</th>
                <th className="py-2 text-right font-normal">Kâra geçiş eşiği</th>
                <th className="py-2 text-right font-normal">Model</th>
                <th className="py-2 text-right font-normal">Olasılık</th>
                <th className="py-2 text-right font-normal max-sm:hidden">Kazanç</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              {[3, 6, 12, 18, 24].map((h) => {
                const row = result.rows[h - 1];
                const step = view.forecast.steps[h - 1];
                const med = step.nominal[common.quantiles.indexOf(0.5)];
                return (
                  <tr key={h} className="border-b border-line-soft">
                    <td className="py-2 text-fg">{h} ay</td>
                    <td className="py-2 text-right">{pct(row.breakEven - 1, 1, true)}</td>
                    <td className="py-2 text-right">{pct(med - 1, 1, true)}</td>
                    <td className="py-2 text-right text-fg">{pct(row.pWait, 0)}</td>
                    <td className="py-2 text-right max-sm:hidden">{signedTl(row.diffReal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-label text-faint">
            Kâra geçiş eşiği: beklemenin kazandırması için fiyatların en fazla bu kadar artması gerekiyor. Olasılık:
            modelin fiyat dağılımına göre beklemenin kazandırma ihtimali.
          </p>
        </div>
      </div>
    </div>
  );
}

function signedTl(v) {
  const s = tl(Math.abs(v), true);
  if (Math.abs(v) < 1000) return "0 TL";
  return v > 0 ? `+${s}` : `-${s}`;
}

function compactTl(v) {
  const a = Math.abs(v);
  if (a >= 1e6) return `${num(v / 1e6, a >= 1e7 ? 0 : 1)} mn`;
  if (a >= 1e3) return `${num(v / 1e3, 0)} bin`;
  return num(v, 0);
}

function VerdictIcon({ tone }) {
  // Yon simgesi: renk tek basina anlam tasimasin diye sekil + metin.
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "shrink-0 text-fg" };
  if (tone === "wait")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  if (tone === "buy")
    return (
      <svg {...common}>
        <path d="M4 11l8-7 8 7v9H4z" />
        <path d="M10 20v-6h4v6" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M5 9h14M5 15h14" />
    </svg>
  );
}
