#!/usr/bin/env node
/**
 * Provjerava je li stranica spremna — prije builda i prije objave.
 *
 * Dvije razine:
 *   GREŠKE     ruše build ili objavljuju netočan podatak -> izlaz 1
 *   NEDOSTAJE  placeholderi koji čekaju njezin odgovor -> samo prijavljeno
 *
 * Druga razina postoji jer bi inače `[Ime Prezime]` završio u naslovu
 * stranice, a to nitko ne primijeti dok ne bude kasno.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'astro/zod';
import matter from 'gray-matter';

import { shemaRada, provjeriPravila } from '../src/core/shema.mjs';
import { site, neispunjeno } from '../src/site.config.mjs';
import { TEME, PRAG_TEME } from '../src/core/taxonomije.mjs';

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_RADOVI = path.join(KORIJEN, 'src', 'content', 'radovi');
const DIR_STRANICE = path.join(KORIJEN, 'src', 'pages');

const SHEMA = shemaRada({ z, image: () => z.string().min(1) });

const greske = [];
const nedostaje = [];
const napomene = [];

async function sveDatoteke(dir, nastavak, skup = []) {
  for (const s of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, s.name);
    if (s.isDirectory()) await sveDatoteke(p, nastavak, skup);
    else if (s.name.endsWith(nastavak)) skup.push(p);
  }
  return skup;
}

// ---------------------------------------------------------- radovi

const datoteke = (await readdir(DIR_RADOVI)).filter((d) => d.endsWith('.md'));
const radovi = [];

for (const d of datoteke) {
  const putanja = path.join(DIR_RADOVI, d);
  let parsirano;
  try {
    parsirano = matter(await readFile(putanja, 'utf8'));
  } catch (e) {
    greske.push(`${d}: datoteku nije moguće pročitati — ${e.message}`);
    continue;
  }

  const rez = SHEMA.safeParse(parsirano.data);
  if (!rez.success) {
    for (const i of rez.error.issues) {
      greske.push(`${d} → ${i.path.join('.') || '(korijen)'}: ${i.message}`);
    }
    continue;
  }

  for (const p of provjeriPravila(rez.data, parsirano.content)) {
    // Skice smiju biti nepotpune — to im je svrha.
    if (rez.data.stanje_objave === 'objavljeno') greske.push(`${d} → ${p.poruka}`);
    else napomene.push(`${d} (skica) → ${p.poruka}`);
  }
  radovi.push(rez.data);
}

// ---------------------------------------------------------- placeholderi

for (const p of neispunjeno()) nedostaje.push(`site.config.mjs → ${p}`);

for (const putanja of await sveDatoteke(DIR_STRANICE, '.astro')) {
  const sadrzaj = await readFile(putanja, 'utf8');
  const nadeno = [...sadrzaj.matchAll(/<Popuni[\s\S]*?sto="([^"]+)"/g)];
  for (const m of nadeno) {
    nedostaje.push(`${path.relative(KORIJEN, putanja)} → ${m[1]}`);
  }
}

// ---------------------------------------------------------- sadržaj

const objavljeni = radovi.filter((r) => r.stanje_objave === 'objavljeno');
const primjeri = objavljeni.filter((r) => r.slug.startsWith('primjer-'));
const dostupni = objavljeni.filter((r) => ['dostupno', 'rezervirano'].includes(r.status));
const sEngleskim = objavljeni.filter((r) => r.naslov_en && r.opis_en && r.slug_en);

if (primjeri.length) {
  nedostaje.push(
    `${primjeri.length} primjera još je na stranici — obrišite ih s "npm run ocisti-primjere" prije objave`
  );
}

for (const t of TEME) {
  const n = objavljeni.filter((r) => (r.teme ?? []).includes(t.slug)).length;
  if (n > 0 && n < PRAG_TEME.radova) {
    napomene.push(
      `tema „${t.naziv}" ima ${n} rad${n === 1 ? '' : 'a'} — stranica se upali sama na ${PRAG_TEME.radova}`
    );
  }
}

// ---------------------------------------------------------- ispis

const crta = '─'.repeat(58);
console.log('');
console.log(crta);
console.log(`  Radova: ${radovi.length}  ·  objavljeno: ${objavljeni.length}  ·  ` +
            `dostupno: ${dostupni.length}  ·  s engleskim: ${sEngleskim.length}`);
console.log(crta);

if (napomene.length) {
  console.log('\n  NAPOMENE (ništa se ne ruši)\n');
  for (const n of napomene) console.log(`    · ${n}`);
}

if (nedostaje.length) {
  console.log(`\n  ČEKA NJEZIN ODGOVOR — ${nedostaje.length} mjesta\n`);
  for (const n of nedostaje) console.log(`    ✎ ${n}`);
  console.log('\n    Stranica radi i s ovime, ali se NE SMIJE objaviti dok stoji.');
}

if (greske.length) {
  console.log(`\n  GREŠKE — ${greske.length}\n`);
  for (const g of greske) console.log(`    ✗ ${g}`);
  console.log('');
  process.exit(1);
}

console.log(`\n  ✓ Svi radovi prolaze provjeru.`);
console.log(nedostaje.length
  ? `  ✗ Nije spremno za objavu: ${nedostaje.length} mjesta čeka podatke.\n`
  : `  ✓ Spremno za objavu.\n`);
