#!/usr/bin/env node
/**
 * Briše PRIMJERE (sve sa slugom koji počinje s "primjer-").
 *
 * Ne dira ništa drugo. Njezini radovi nemaju taj prefiks, pa ih ova skripta
 * ne može ni dotaknuti — ali svejedno ide kroz arhivu, ne kroz brisanje.
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arhivirajRad, DIR_RADOVI } from '../src/core/datoteke.mjs';

const PREFIKS = 'primjer-';
const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const datoteke = (await readdir(DIR_RADOVI))
  .filter((d) => d.endsWith('.md') && d.startsWith(PREFIKS));

if (!datoteke.length) {
  console.log('\n  Nema primjera za brisanje — stranica već sadrži samo prave radove.\n');
  process.exit(0);
}

console.log('');
for (const d of datoteke) {
  const slug = d.replace(/\.md$/, '');
  const odrediste = await arhivirajRad(slug);
  console.log(`  − ${slug}  →  ${path.relative(KORIJEN, odrediste)}`);
}

console.log(`\n  ${datoteke.length} primjera maknuto sa stranice.`);
console.log('  Ništa nije izbrisano — sve je u atelier/arhiva/ i može se vratiti.\n');
