#!/usr/bin/env node
/**
 * Stvara PRIMJERE radova da se stranica može vidjeti i testirati prije nego
 * stignu prave fotografije.
 *
 * Namjerno NE koristi tuđe slike — ni javno dostupne reprodukcije. Generira
 * pergamentne panele s ispisanim naslovom, pa ne postoji nijedan način da se
 * primjer zamijeni za njezin rad. Naslovi počinju s "PRIMJER —".
 *
 * Sve briše `npm run ocisti-primjere`.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RADOVI = path.join(KORIJEN, 'src', 'content', 'radovi');
const SLIKE = path.join(RADOVI, 'slike');

export const OZNAKA_PRIMJERA = 'primjer-';

const PRIMJERI = [
  {
    slug: 'primjer-gospa-od-utjehe',
    id: 'r-2026-001',
    naslov: 'PRIMJER — Gospa od utjehe',
    tehnika: 'ulje na platnu',
    podloga: 'platno',
    godina: 2025,
    dimenzije: { visina_cm: 70, sirina_cm: 50 },
    px: [1500, 2100],
    status: 'dostupno',
    cijena: 980,
    kategorija: 'sakralno',
    teme: ['gospa'],
    namjena: ['dom', 'molitveni-kutak'],
    istaknuto: true,
    naslov_en: 'EXAMPLE — Our Lady of Consolation',
    slug_en: 'example-our-lady-of-consolation',
    ikonografija:
      'Plašt Bogorodice tradicionalno je ultramarin — boja koja se stoljećima dobivala mrvljenjem lapis lazulija i bila skuplja od zlata. Time se plaćala čast, ne ukras: najskuplji pigment išao je na Majku Božju. Tri zvijezde na plaštu (na čelu i oba ramena) znak su djevičanstva prije, za vrijeme i nakon rođenja Kristova.',
    opis: `Rad nastaje iz jednostavne namjere: lice koje se gleda kad se više nema što reći. Kompozicija je namjerno tijesna — ramena jedva stanu u format, pogled je blizu, bez pozadine koja bi odvlačila.

Slikano je u tankim slojevima ulja, s podslikom u toploj zemljanoj boji koja mjestimice ostaje vidljiva kroz plašt. Ta podloga daje koži onaj ton koji se čistim miješanjem ne dobije.

Platno je napeto na drveni podokvir i bočno oslikano, pa rad može visjeti i bez okvira.`,
  },
  {
    slug: 'primjer-sveti-josip-radnik',
    id: 'r-2026-002',
    naslov: 'PRIMJER — Sveti Josip radnik',
    tehnika: 'tempera na dasci',
    podloga: 'lipova daska',
    godina: 2025,
    dimenzije: { visina_cm: 40, sirina_cm: 30 },
    px: [1400, 1850],
    status: 'prodano',
    datum_prodaje: '2026-03-14',
    zbirka_vlasnik: 'Privatna zbirka',
    kategorija: 'sakralno',
    teme: ['sveci'],
    namjena: ['dom', 'dar-za-imendan'],
    ikonografija:
      'Sveti Josip se prepoznaje po alatu — najčešće stolarskom kutomjeru ili pili — i po procvjetalom štapu, znaku po kojem je prema predaji izabran za Marijina zaručnika. Blagdan sv. Josipa Radnika je 1. svibnja.',
    opis: `Josip je gotovo uvijek naslikan sa strane, u drugom planu, kao netko tko pridržava tuđi prizor. Ovdje je sam, i to mijenja sve: nema koga čuvati, pa se vidi čovjek.

Tempera na lipovoj dasci znači da se radi brzo i bez ispravljanja — boja se veže za gesso i ne oprašta drugi pokušaj. Zato je crtež pod bojom razrađen do kraja prije nego što je prva boja dotakla dasku.

Daska je pripremljena klasično: platno preko drveta, pa sedam slojeva gessa brušenih do glatkoće.`,
  },
  {
    slug: 'primjer-kristov-lik',
    id: 'r-2026-003',
    naslov: 'PRIMJER — Kristov lik',
    tehnika: 'zlatni list i tempera',
    podloga: 'drvena ploča',
    godina: 2026,
    dimenzije: { visina_cm: 35, sirina_cm: 28 },
    px: [1500, 1900],
    status: 'dostupno',
    cijena_na_upit: true,
    kategorija: 'sakralno',
    teme: ['isus-krist', 'ikone'],
    namjena: ['molitveni-kutak', 'kapela'],
    istaknuto: true,
    ikonografija:
      'Zlatna pozadina ikone nije krajolik ni nebo — ona je odsutnost prostora. Zlato ne prikazuje svjetlo nego ga stvarno reflektira, pa se lik mijenja kako se gledatelj pomiče. Križni nimb s tri vidljiva kraka nosi samo Krist.',
    opis: `Zlatna podloga položena je na bole — crvenkastu glinenu podlogu koja se nazire ispod lista i daje zlatu toplinu. Na mjestima gdje se list preklapa vide se šavovi; to se ne skriva, to je trag ruke.

Lice je građeno od tamnog prema svijetlom, u slojevima koji se ne miješaju nego se ostavljaju da prosijavaju jedan kroz drugi. Zadnji potezi su najsvjetliji i najtanji.

Rad je pisan prema starijem predlošku, ali nije kopija — proporcije su prilagođene formatu.`,
  },
  {
    slug: 'primjer-studija-ruku',
    id: 'r-2026-004',
    naslov: 'PRIMJER — Studija ruku',
    tehnika: 'crtež',
    podloga: 'papir',
    godina: 2024,
    dimenzije: { visina_cm: 30, sirina_cm: 42 },
    px: [2100, 1500],
    status: 'nije_na_prodaju',
    kategorija: 'ostalo',
    teme: ['studija'],
    opis: `Ruke su najteži dio svake figure i jedini koji se ne da nagovoriti. Lice se može spasiti pogledom, draperija se može pojednostaviti, ali ruka koja ne drži težinu vidi se odmah i svakome. Ova stranica je jedna od mnogih iz bilježnice koja stoji uz štafelaj.

Crtano je ugljenom i bijelom kredom na toniranom papiru, koji već sam po sebi daje srednji ton pa se svjetlo mora samo dodati, a ne izmisliti. Nekoliko položaja precrtano je po dva-tri puta jer prvi pokušaj nije držao težinu — tragovi tih pokušaja namjerno nisu obrisani.

Studije se ne prodaju, ali stoje na stranici jer objašnjavaju ono što se poslije vidi kao gotov rad. Blagoslivljajuća ruka na ikoni ili ruka koja pridržava Dijete ne nastaju na dasci nego ovdje, na papiru, mjesecima ranije.`,
  },
];

/** Pergamentni panel s naslovom — jasno kao mjesto za pravu fotografiju. */
async function napraviPanel(naslov, sirina, visina, izlaz) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const margina = Math.round(Math.min(sirina, visina) * 0.06);
  const velicina = Math.round(Math.min(sirina, visina) * 0.052);

  const rijeci = naslov.replace('PRIMJER — ', '').split(' ');
  const redci = [];
  let red = '';
  for (const r of rijeci) {
    if ((red + ' ' + r).trim().length > 18) { redci.push(red.trim()); red = r; }
    else red += ' ' + r;
  }
  if (red.trim()) redci.push(red.trim());

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sirina}" height="${visina}">
  <rect width="100%" height="100%" fill="#EDE2CD"/>
  <rect x="${margina}" y="${margina}" width="${sirina - margina * 2}" height="${visina - margina * 2}"
        fill="none" stroke="#96761C" stroke-width="2"/>
  <text x="50%" y="${visina * 0.44}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(velicina * 0.62)}"
        fill="#8B7752" letter-spacing="${velicina * 0.14}">PRIMJER</text>
  ${redci.map((r, i) => `<text x="50%" y="${visina * 0.52 + i * velicina * 1.25}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${velicina}"
        fill="#241F17">${esc(r)}</text>`).join('\n  ')}
  <text x="50%" y="${visina - margina * 1.6}" text-anchor="middle"
        font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(velicina * 0.5)}"
        fill="#8B7752">ovdje dolazi fotografija djela</text>
</svg>`;

  await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toFile(izlaz);
}

function frontmatter(p, datoteka) {
  const red = [
    `id: ${p.id}`,
    `stanje_objave: objavljeno`,
    `naslov_hr: ${JSON.stringify(p.naslov)}`,
    `slug: ${p.slug}`,
    `godina: ${p.godina}`,
    `tehnika: ${JSON.stringify(p.tehnika)}`,
    p.podloga ? `podloga: ${JSON.stringify(p.podloga)}` : null,
    `dimenzije:`,
    `  visina_cm: ${p.dimenzije.visina_cm}`,
    `  sirina_cm: ${p.dimenzije.sirina_cm}`,
    `status: ${p.status}`,
    p.cijena != null ? `cijena: ${p.cijena}` : null,
    p.cijena_na_upit ? `cijena_na_upit: true` : null,
    p.datum_prodaje ? `datum_prodaje: ${p.datum_prodaje}` : null,
    p.zbirka_vlasnik ? `zbirka_vlasnik: ${JSON.stringify(p.zbirka_vlasnik)}` : null,
    `kategorija: ${p.kategorija}`,
    p.teme?.length ? `teme:\n${p.teme.map((t) => `  - ${t}`).join('\n')}` : null,
    p.namjena?.length ? `namjena:\n${p.namjena.map((t) => `  - ${t}`).join('\n')}` : null,
    p.istaknuto ? `istaknuto: true` : null,
    p.naslov_en ? `naslov_en: ${JSON.stringify(p.naslov_en)}` : null,
    p.slug_en ? `slug_en: ${p.slug_en}` : null,
    p.naslov_en ? `opis_en: ${JSON.stringify(p.opis.split('\n\n')[0])}` : null,
    p.ikonografija ? `ikonografska_biljeska: ${JSON.stringify(p.ikonografija)}` : null,
    `slike:`,
    `  - datoteka: ./slike/${datoteka}`,
    `    uloga: glavna`,
    `    alt_hr: ${JSON.stringify(`${p.naslov.replace('PRIMJER — ', '')} — ${p.tehnika}, ${p.godina}.`)}`,
    `datum_objave: ${new Date().toISOString().slice(0, 10)}`,
    `datum_izmjene: ${new Date().toISOString().slice(0, 10)}`,
  ].filter(Boolean);

  return `---\n${red.join('\n')}\n---\n\n${p.opis}\n`;
}

async function main() {
  await mkdir(SLIKE, { recursive: true });

  for (const p of PRIMJERI) {
    const datoteka = `${p.slug}.jpg`;
    await napraviPanel(p.naslov, p.px[0], p.px[1], path.join(SLIKE, datoteka));
    await writeFile(path.join(RADOVI, `${p.slug}.md`), frontmatter(p, datoteka), 'utf8');
    console.log(`  + ${p.slug}  (${p.px[0]}×${p.px[1]}px, ${p.status})`);
  }

  // Registar se DOPUNJUJE, ne prepisuje. Prepisivanje bi izbrisalo zapise
  // pravih radova i oslobodilo njihove adrese za ponovnu upotrebu — a upravo
  // to registar mora spriječiti.
  const putRegistar = path.join(RADOVI, '_slugovi.json');
  let registar = [];
  try { registar = JSON.parse(await readFile(putRegistar, 'utf8')); } catch { /* prvi put */ }
  for (const p of PRIMJERI) {
    if (registar.some((z) => z.slug === p.slug)) continue;
    registar.push({ slug: p.slug, id: p.id, stanje: 'aktivan', od: new Date().toISOString().slice(0, 10) });
  }
  await writeFile(putRegistar, JSON.stringify(registar, null, 2), 'utf8');

  console.log(`\n  ${PRIMJERI.length} primjera stvoreno. Briše se s: npm run ocisti-primjere\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
