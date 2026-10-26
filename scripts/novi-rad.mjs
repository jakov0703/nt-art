#!/usr/bin/env node
/**
 * REZERVNI PUT — dodavanje rada iz terminala.
 *
 * Ovo nije alternativa Atelieru nego alat za popravak: ako se Atelier ne
 * digne, ovime se rad svejedno može dodati. Dijeli ISTI core modul (shema,
 * slugovi, obrada slika, zapis), pa ne postoji način da napravi datoteku
 * koju Atelier ili build ne razumiju.
 *
 * Bez ijedne vanjske ovisnosti — koristi samo node:readline. Rezervni put
 * koji ovisi o npm paketu nije rezervni put.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';

import { shemaRada, provjeriPravila, sljedeciId } from '../src/core/shema.mjs';
import { TEHNIKE, PODLOGE, STATUSI, STATUS_OPIS, KATEGORIJE, TEME } from '../src/core/taxonomije.mjs';
import { predloziSlobodan } from '../src/core/slug.mjs';
import { obradiSliku } from '../src/core/slike.mjs';
import {
  DIR_SLIKE, osiguraj, citajRegistar, popisRadova, spremiRad, zapisiAtomski, zabiljezi,
} from '../src/core/datoteke.mjs';

const SHEMA = shemaRada({ z, image: () => z.string().min(1) });
const rl = createInterface({ input: stdin, output: stdout });

const pitaj = async (tekst, zadano = '') => {
  const o = (await rl.question(zadano ? `${tekst} [${zadano}]: ` : `${tekst}: `)).trim();
  return o || zadano;
};

async function izbor(tekst, opcije, opisi = {}) {
  console.log(`\n  ${tekst}`);
  opcije.forEach((o, i) => {
    console.log(`    ${String(i + 1).padStart(2)}) ${o}${opisi[o] ? `  — ${opisi[o]}` : ''}`);
  });
  while (true) {
    const o = Number(await pitaj('  Broj'));
    if (Number.isInteger(o) && o >= 1 && o <= opcije.length) return opcije[o - 1];
    console.log('  Upišite broj s popisa.');
  }
}

async function broj(tekst, zadano) {
  while (true) {
    const o = await pitaj(tekst, zadano);
    const n = Number(String(o).replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
    console.log('  Samo brojke, npr. 70. Bez "cm", bez € i bez riječi.');
  }
}

console.log('\n  ── Novi rad ─────────────────────────────────────────');
console.log('  Rezervni način unosa. Uobičajeno se koristi Atelier');
console.log('  (dvoklik na Atelier.cmd).\n');

await osiguraj();

const naslov_hr = await pitaj('  Naziv djela');
if (!naslov_hr) { console.log('\n  Bez naziva ne može dalje.\n'); rl.close(); process.exit(1); }

const godina = Number(await pitaj('  Godina', String(new Date().getFullYear())));
const tehnika = await izbor('Tehnika:', TEHNIKE);
const podloga = await izbor('Podloga:', ['(preskoči)', ...PODLOGE]);
const visina_cm = await broj('  Visina u cm');
const sirina_cm = await broj('  Širina u cm');
const status = await izbor('Stanje djela:', STATUSI, STATUS_OPIS);

let cijena, cijena_na_upit = false;
if (['dostupno', 'rezervirano'].includes(status)) {
  const c = await pitaj('  Cijena u eurima (prazno = "na upit")');
  if (c) cijena = Number(c.replace(/[^\d.,]/g, '').replace(',', '.'));
  else cijena_na_upit = true;
}

const kategorija = await izbor('Vrsta rada:', KATEGORIJE);
let teme = [];
if (kategorija === 'sakralno') {
  const moguce = TEME.filter((t) => t.nadtema === 'sakralno');
  const t = await izbor('Glavna tema:', moguce.map((x) => x.naziv));
  teme = [moguce.find((x) => x.naziv === t).slug];
}

console.log('\n  Putanja do fotografije djela.');
console.log('  Najlakše: povucite datoteku u ovaj prozor i pritisnite Enter.');
let slika = null;
while (!slika) {
  const p = (await pitaj('  Fotografija')).replace(/^["']|["']$/g, '');
  if (!p) { console.log('  Djelo treba barem jednu fotografiju.'); continue; }
  if (!existsSync(p)) { console.log(`  Nema datoteke na toj putanji: ${p}`); continue; }
  try {
    const obradena = await obradiSliku(await readFile(p), path.basename(p), { osnovaImena: `${naslov_hr}-1` });
    await zapisiAtomski(path.join(DIR_SLIKE, obradena.ime), obradena.buffer);
    for (const u of obradena.upozorenja) console.log(`\n  ⚠ ${u}\n`);
    slika = {
      datoteka: `./slike/${obradena.ime}`, uloga: 'glavna',
      alt_hr: `${naslov_hr} — ${tehnika}, ${godina}.`,
      sirina_px: obradena.sirina, visina_px: obradena.visina,
    };
  } catch (e) {
    console.log(`  ${e.message}`);
  }
}

console.log('\n  Opis djela — što je prikazano, čime je slikano, zašto vam je važno.');
console.log('  Za objavu treba barem 400 znakova. Završite praznim redom.\n');
const redci = [];
while (true) {
  const r = await rl.question('  ');
  if (!r.trim() && redci.length) break;
  redci.push(r);
}
const opis_hr = redci.join('\n').trim();

const objavi = (await pitaj('\n  Objaviti odmah? (da/ne)', 'ne')).toLowerCase().startsWith('d');

const postojeci = (await popisRadova()).map((r) => r.podaci?.id).filter(Boolean);
const registar = await citajRegistar();

const podaci = {
  id: sljedeciId(postojeci),
  stanje_objave: objavi ? 'objavljeno' : 'skica',
  naslov_hr,
  slug: predloziSlobodan(registar, naslov_hr, { godina }),
  godina, tehnika, status, kategorija, teme,
  dimenzije: { visina_cm, sirina_cm },
  ...(podloga !== '(preskoči)' ? { podloga } : {}),
  ...(cijena != null ? { cijena } : {}),
  cijena_na_upit,
  slike: [slika],
  datum_objave: new Date(),
  datum_izmjene: new Date(),
};

const rez = SHEMA.safeParse(podaci);
if (!rez.success) {
  console.log('\n  Nešto nije u redu:\n');
  for (const i of rez.error.issues) console.log(`    ✗ ${i.path.join('.')}: ${i.message}`);
  console.log('');
  rl.close();
  process.exit(1);
}

const pravila = provjeriPravila(rez.data, opis_hr);
if (pravila.length) {
  console.log('');
  for (const p of pravila) console.log(`  ⚠ ${p.poruka}`);
  if (objavi) {
    console.log('\n  Spremam kao SKICU dok se ovo ne dopuni — ništa nije izgubljeno.\n');
    rez.data.stanje_objave = 'skica';
  }
}

await spremiRad(rez.data.slug, rez.data, opis_hr);
await zabiljezi(`Atelier (CLI): novo djelo „${naslov_hr}"`);

console.log(`\n  ✓ Spremljeno: src/content/radovi/${rez.data.slug}.md`);
console.log(`    Adresa na stranici: /radovi/${rez.data.slug}/`);
console.log(`    Stanje: ${rez.data.stanje_objave}\n`);
rl.close();
