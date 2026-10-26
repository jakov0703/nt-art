/**
 * Sigurno pisanje na disk + registar slugova + git kao povijest.
 *
 * Tri pravila koja se ne krše:
 *  1. Atomski zapis (privremena datoteka + rename). Nestanak struje usred
 *     spremanja ne smije ostaviti pola datoteke — jer polovična YAML datoteka
 *     ruši build, a ona to ne zna popraviti.
 *  2. Brisanja nema. Sve ide u atelier/arhiva/ i može se vratiti.
 *  3. Slug se nikad ne reciklira. Registar pamti i povučene.
 */

import { readFile, writeFile, rename, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { serijaliziraj } from './yaml.mjs';

const izvrsi = promisify(execFile);

export const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_RADOVI = path.join(KORIJEN, 'src', 'content', 'radovi');
export const DIR_SLIKE = path.join(DIR_RADOVI, 'slike');
export const DIR_ARHIVA = path.join(KORIJEN, 'atelier', 'arhiva');
export const PUT_REGISTAR = path.join(DIR_RADOVI, '_slugovi.json');

export async function osiguraj() {
  await mkdir(DIR_RADOVI, { recursive: true });
  await mkdir(DIR_SLIKE, { recursive: true });
  await mkdir(DIR_ARHIVA, { recursive: true });
}

/**
 * Atomski zapis. Privremena datoteka mora biti na ISTOM disku kao odredište,
 * inače rename nije atomski nego kopija — zato ide u isti direktorij.
 */
export async function zapisiAtomski(putanja, sadrzaj) {
  await mkdir(path.dirname(putanja), { recursive: true });
  const privremena = `${putanja}.tmp-${process.pid}`;
  await writeFile(privremena, sadrzaj);
  await rename(privremena, putanja);
}

// ---------- registar slugova ----------

export async function citajRegistar() {
  if (!existsSync(PUT_REGISTAR)) return [];
  try {
    return JSON.parse(await readFile(PUT_REGISTAR, 'utf8'));
  } catch {
    return [];
  }
}

export async function upisiURegistar(slug, id) {
  const registar = await citajRegistar();
  if (registar.some((z) => z.slug === slug)) return registar;
  registar.push({ slug, id, stanje: 'aktivan', od: new Date().toISOString().slice(0, 10) });
  await zapisiAtomski(PUT_REGISTAR, JSON.stringify(registar, null, 2));
  return registar;
}

/** Arhiviranje ne oslobađa slug — adresa koju je nekome poslala ne smije oživjeti na tuđem radu. */
export async function povuciSlug(slug) {
  const registar = await citajRegistar();
  const z = registar.find((x) => x.slug === slug);
  if (z) {
    z.stanje = 'povucen';
    await zapisiAtomski(PUT_REGISTAR, JSON.stringify(registar, null, 2));
  }
}

// ---------- markdown ----------

/**
 * YAML serijalizacija.
 *
 * Datumi se zapisuju kao goli YYYY-MM-DD, ne kao ISO s vremenom: kad ih
 * js-yaml zapiše s vremenskom zonom, `z.coerce.date()` ih pročita, ali
 * datoteka postaje neugodna za ručno čitanje i mijenja se pri svakom
 * spremanju iako se ništa nije promijenilo.
 */
export { serijaliziraj } from './yaml.mjs';

export async function citajRad(slug) {
  const putanja = path.join(DIR_RADOVI, `${slug}.md`);
  if (!existsSync(putanja)) return null;
  const { data, content } = matter(await readFile(putanja, 'utf8'));
  return { podaci: data, tijelo: content.trim(), putanja };
}

export async function popisRadova() {
  await osiguraj();
  const datoteke = (await readdir(DIR_RADOVI)).filter((d) => d.endsWith('.md'));
  const out = [];
  for (const d of datoteke) {
    try {
      const { data, content } = matter(await readFile(path.join(DIR_RADOVI, d), 'utf8'));
      out.push({ slug: d.replace(/\.md$/, ''), podaci: data, tijelo: content.trim() });
    } catch (e) {
      out.push({ slug: d.replace(/\.md$/, ''), greska: e.message });
    }
  }
  return out;
}

export async function spremiRad(slug, podaci, tijelo) {
  await osiguraj();
  await zapisiAtomski(path.join(DIR_RADOVI, `${slug}.md`), serijaliziraj(podaci, tijelo));
  await upisiURegistar(slug, podaci.id);
}

/** Meko brisanje: .md i pripadne slike sele u arhivu. Ništa se ne uništava. */
export async function arhivirajRad(slug) {
  const oznaka = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const odrediste = path.join(DIR_ARHIVA, `${oznaka}-${slug}`);
  await mkdir(odrediste, { recursive: true });

  const md = path.join(DIR_RADOVI, `${slug}.md`);
  if (existsSync(md)) {
    const rad = await citajRad(slug);
    await rename(md, path.join(odrediste, `${slug}.md`));
    for (const s of rad?.podaci?.slike ?? []) {
      const ime = path.basename(String(s.datoteka ?? ''));
      const izvor = path.join(DIR_SLIKE, ime);
      if (ime && existsSync(izvor)) await rename(izvor, path.join(odrediste, ime));
    }
  }
  await povuciSlug(slug);
  return odrediste;
}

// ---------- git: povijest koju ona ne mora razumjeti ----------

async function git(...args) {
  return izvrsi('git', args, { cwd: KORIJEN, windowsHide: true });
}

export async function jeGitRepo() {
  try {
    await git('rev-parse', '--git-dir');
    return true;
  } catch {
    return false;
  }
}

/**
 * Tihi commit nakon svakog uspješnog spremanja. Ona za git ne zna niti treba —
 * ovo je samo "vrati na prije" koji uvijek postoji.
 * Nikad ne puca: neuspjeh gita ne smije srušiti spremanje rada.
 */
export async function zabiljezi(poruka) {
  try {
    if (!(await jeGitRepo())) return { ok: false, razlog: 'nije git repozitorij' };
    await git('add', '--', 'src/content/radovi');
    const { stdout } = await git('status', '--porcelain', '--', 'src/content/radovi');
    if (!stdout.trim()) return { ok: true, promjena: false };
    await git('-c', 'user.name=Atelier', '-c', 'user.email=atelier@localhost',
      'commit', '-m', poruka, '--', 'src/content/radovi');
    return { ok: true, promjena: true };
  } catch (e) {
    return { ok: false, razlog: e.message };
  }
}

export async function citajSliku(ime) {
  try { return await readFile(path.join(DIR_SLIKE, path.basename(ime))); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export async function spremiSliku(ime, buffer) {
  await zapisiAtomski(path.join(DIR_SLIKE, path.basename(ime)), buffer);
}
