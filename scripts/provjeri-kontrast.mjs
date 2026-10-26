#!/usr/bin/env node
/**
 * Preračunava SVAKI kontrastni par iz src/styles/tokens.css i pada ako
 * neki padne ispod WCAG 2.1 AA praga.
 *
 * Zašto ovo postoji: dizajner palete priložio je "izvod" računa koji se ne
 * reproducira — njegova vlastita navedena luminancija za #241F17 daje 14.51,
 * a tvrdi 14.30. Konačni brojevi su bili točni, ali izvod je bio izmišljen.
 * Trag revizije koji se tvrdi ne vrijedi ništa; ovaj se izvršava.
 *
 * Formula (WCAG 2.1, relativna luminancija):
 *   cs = c/255
 *   cl = cs <= 0.03928 ? cs/12.92 : ((cs+0.055)/1.055)^2.4
 *   L  = 0.2126*Rl + 0.7152*Gl + 0.0722*Bl
 *   omjer = (Lsvjetlija + 0.05) / (Ltamnija + 0.05)
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENI = path.join(KORIJEN, 'src', 'styles', 'tokens.css');

const AA_TEKST = 4.5;   // 1.4.3 — tekst normalne veličine
const AA_UI = 3.0;      // 1.4.11 — komponente sučelja i obrubi
const MARGINA = 0.15;   // 1px antialiasirana linija ne renderira se na nominalnoj vrijednosti

function kanal(c) {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : ((cs + 0.055) / 1.055) ** 2.4;
}

function luminancija(hex) {
  const h = hex.replace('#', '');
  const pun = h.length === 3 ? h.split('').map((z) => z + z).join('') : h;
  const r = parseInt(pun.slice(0, 2), 16);
  const g = parseInt(pun.slice(2, 4), 16);
  const b = parseInt(pun.slice(4, 6), 16);
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function omjer(a, b) {
  const la = luminancija(a);
  const lb = luminancija(b);
  const [svjetlija, tamnija] = la > lb ? [la, lb] : [lb, la];
  return (svjetlija + 0.05) / (tamnija + 0.05);
}

/** Izvlači --token: #hex; iz jednog bloka. */
function parsirajBlok(css, selektor) {
  const pocetak = css.indexOf(selektor);
  if (pocetak === -1) throw new Error(`Nema bloka ${selektor} u tokens.css`);
  const otvorena = css.indexOf('{', pocetak);
  let dubina = 0, i = otvorena;
  for (; i < css.length; i++) {
    if (css[i] === '{') dubina++;
    else if (css[i] === '}') { dubina--; if (dubina === 0) break; }
  }
  const tijelo = css.slice(otvorena + 1, i);
  const tokeni = {};
  for (const m of tijelo.matchAll(/(--[\w-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/g)) {
    tokeni[m[1]] = m[2];
  }
  return tokeni;
}

/** Prednji planovi i prag koji moraju zadovoljiti na SVAKOJ plohi. */
const PREDNJI = [
  ['--color-text', AA_TEKST],
  ['--color-text-2', AA_TEKST],
  ['--color-muted', AA_TEKST],
  ['--color-gold', AA_TEKST],
  ['--color-gold-hover', AA_TEKST],
  ['--color-link', AA_TEKST],
  ['--color-link-hover', AA_TEKST],
  ['--color-violet', AA_TEKST],
  ['--color-oxblood', AA_TEKST],
  ['--color-rose', AA_TEKST],
  ['--color-border', AA_UI],
  ['--color-muted-border', AA_UI],
  ['--color-success-border', AA_UI],
  ['--color-gold-rule', AA_UI],
  ['--color-focus', AA_UI],
];

const PLOHE = ['--color-bg', '--color-surface', '--color-surface-sunk'];

/** Parovi koji nisu "prednji plan na plohi" nego imaju vlastitu ispunu. */
const POSEBNI = [
  ['--color-success', '--color-success-bg', AA_TEKST, 'natpis „Dostupno" na svojoj ispuni'],
  ['--color-muted', '--color-muted-bg', AA_TEKST, 'natpis „Prodano" na svojoj ispuni'],
  ['--color-btn-ink', '--color-btn-fill', AA_TEKST, 'natpis na glavnom gumbu'],
  ['--color-on-marian', '--color-link', AA_TEKST, 'natpis na plavom gumbu'],
  ['--color-text', '--color-selection', AA_TEKST, 'tekst preko označenog teksta'],

  // --- TAMNA PLOHA (hero, pločice djela) -------------------------
  // Bez ovih redaka novi tamni dio stranice ne bi bio provjeren uopće,
  // a upravo je on uveden naknadno — tada se greške i potkradu.
  ['--color-on-ink', '--color-ink', AA_TEKST, 'tekst na tinti (hero)'],
  ['--color-on-ink-muted', '--color-ink', AA_TEKST, 'prigušeni tekst na tinti'],
  ['--color-gold-on-ink', '--color-ink', AA_TEKST, 'zlatni nadnaslov na tinti'],
  ['--color-on-ink', '--color-ink-2', AA_TEKST, 'tekst na svjetlijoj tinti'],
  ['--color-on-ink-muted', '--color-ink-2', AA_TEKST, 'prigušeni tekst na svjetlijoj tinti'],
  ['--color-gold-on-ink', '--color-ink-2', AA_TEKST, 'zlato na svjetlijoj tinti'],
  ['--color-ink', '--color-on-ink', AA_TEKST, 'natpis na svijetlom gumbu (hero)'],
  ['--color-ink', '--color-gold-on-ink', AA_TEKST, 'natpis na zlatnom gumbu pri prijelazu'],
  ['--color-gold-rule', '--color-ink', AA_UI, 'zlatna linija na tinti'],
];

async function main() {
  const css = await readFile(TOKENI, 'utf8');
  const modovi = [
    ['svijetli', parsirajBlok(css, ':root')],
    ['tamni', parsirajBlok(css, "[data-theme='dark']")],
  ];

  const pali = [];
  const tijesni = [];
  let provjereno = 0;

  for (const [imeModa, sviTokeni] of modovi) {
    // Tamni mod nasljeđuje sve što nije redefinirano.
    const t = imeModa === 'tamni'
      ? { ...modovi[0][1], ...sviTokeni }
      : sviTokeni;

    for (const [prednji, prag] of PREDNJI) {
      if (!t[prednji]) continue;
      for (const ploha of PLOHE) {
        if (!t[ploha]) continue;
        const r = omjer(t[prednji], t[ploha]);
        provjereno++;
        const opis = `[${imeModa}] ${prednji} ${t[prednji]} na ${ploha} ${t[ploha]}`;
        if (r < prag) pali.push({ opis, r, prag });
        else if (r < prag + MARGINA) tijesni.push({ opis, r, prag });
      }
    }

    for (const [a, b, prag, opisPara] of POSEBNI) {
      if (!t[a] || !t[b]) continue;
      const r = omjer(t[a], t[b]);
      provjereno++;
      const opis = `[${imeModa}] ${opisPara} (${t[a]} / ${t[b]})`;
      if (r < prag) pali.push({ opis, r, prag });
      else if (r < prag + MARGINA) tijesni.push({ opis, r, prag });
    }

    // Razlikovnost dostupno/prodano. Audit je pokazao da je boja ovdje
    // beskorisna (ispune 1.05:1) — zato oznaka nosi i točkicu i riječ.
    // Ovo mjeri koliko je boja UOPĆE od pomoći, i ne pada build.
    if (t['--color-success-border'] && t['--color-muted-border']) {
      const r = omjer(t['--color-success-border'], t['--color-muted-border']);
      console.log(
        `  ℹ [${imeModa}] razlika obruba dostupno/prodano: ${r.toFixed(2)}:1 ` +
        `${r < 1.7 ? '— preslaba da bi boja sama išta značila (zato točkica + riječ)' : ''}`
      );
    }
  }

  console.log(`\n  Provjereno parova: ${provjereno}`);

  if (tijesni.length) {
    console.log(`\n  Tijesno (prolazi, ali s manje od ${MARGINA} margine):`);
    for (const x of tijesni) console.log(`    ~ ${x.opis} = ${x.r.toFixed(3)}:1 (prag ${x.prag})`);
  }

  if (pali.length) {
    console.error(`\n  ✗ PALO ${pali.length} parova:\n`);
    for (const x of pali) {
      console.error(`    ${x.opis}\n      ${x.r.toFixed(3)}:1, a treba ${x.prag}:1\n`);
    }
    process.exit(1);
  }

  console.log('\n  ✓ Svi parovi prolaze WCAG 2.1 AA.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
