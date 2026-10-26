/**
 * Slugovi, transliteracija i registar.
 *
 * Dijakritike se uklanjaju SAMO ovdje — u slugovima i imenima datoteka.
 * U vidljivom tekstu nikad: Google normalizira "krscanske" u "kršćanske",
 * a tekst bez kvačica hrvatskom čitatelju izgleda aljkavo.
 */

/**
 * Đ/đ se NE rastavlja pod NFKD (to je samostalan znak, ne baza + kvačica),
 * pa mora ići ručno. Hrvati ga ionako najčešće tipkaju kao "dj"
 * (narudžba -> narudzba / narudjba, Đakovo -> Djakovo).
 */
const HR = {
  'č': 'c', 'Č': 'c',
  'ć': 'c', 'Ć': 'c',
  'š': 's', 'Š': 's',
  'ž': 'z', 'Ž': 'z',
  'đ': 'dj', 'Đ': 'dj',
};

/** Segmenti URL-a koje rad ne smije preuzeti — inače slug pregazi stranicu. */
export const REZERVIRANI_SLUGOVI = new Set([
  'radovi', 'rad', 'tema', 'teme', 'stranica', 'ciklus', 'ciklusi',
  'dostupni-radovi', 'prodani-radovi', 'narudzbe', 'o-meni', 'kontakt',
  'dnevnik', 'izlozbe', 'cesta-pitanja', 'kupnja-i-dostava', 'hvala',
  'privatnost', 'licenca', 'en', 'api', 'assets', '_astro', 'social',
  'sitemap', 'sitemap-index', 'robots', '404', '500', 'admin', 'atelier',
]);

export function translit(tekst) {
  return String(tekst ?? '').replace(/[čćšžđČĆŠŽĐ]/g, (z) => HR[z]);
}

/**
 * "Gospa Žalosna (II.)" -> "gospa-zalosna-ii"
 * Transliteracija ide PRIJE NFKD-a jer đ inače preživi normalizaciju.
 */
export function slugify(tekst) {
  return translit(tekst)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // preostale kombinirajuće kvačice (é, ü, ...)
    .toLowerCase()
    .replace(/['’‘"“”]/g, '')          // apostrofi se gutaju, ne postaju crtice
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** ASCII ime datoteke sa zadržanom ekstenzijom. */
export function slugifyDatoteku(ime, ekstenzija) {
  const tocka = ime.lastIndexOf('.');
  const osnova = tocka > 0 ? ime.slice(0, tocka) : ime;
  const ext = (ekstenzija ?? (tocka > 0 ? ime.slice(tocka + 1) : 'jpg')).toLowerCase();
  return `${slugify(osnova) || 'slika'}.${ext}`;
}

/**
 * Registar je append-only: bilježi SVAKI ikad korišten slug, uključujući
 * arhivirane. Slug se nikad ne reciklira — stara adresa koju je nekome
 * poslala ne smije jednog dana voditi na tuđi rad.
 *
 * @typedef {{ slug: string, id: string, stanje: 'aktivan'|'povucen', od: string }} Zapis
 */

export function jeSlobodan(registar, slug, zaId = null) {
  if (REZERVIRANI_SLUGOVI.has(slug)) return false;
  const zapis = registar.find((z) => z.slug === slug);
  if (!zapis) return true;
  return zaId !== null && zapis.id === zaId;
}

/** Ako je "gospa-zalosna" zauzet, predlaže "gospa-zalosna-2024" pa "-2", "-3"... */
export function predloziSlobodan(registar, zeljeni, { godina, zaId = null } = {}) {
  const osnova = slugify(zeljeni) || 'rad';
  if (jeSlobodan(registar, osnova, zaId)) return osnova;

  if (godina) {
    const sGodinom = `${osnova}-${godina}`;
    if (jeSlobodan(registar, sGodinom, zaId)) return sGodinom;
  }
  for (let i = 2; i < 200; i++) {
    const kandidat = `${osnova}-${i}`;
    if (jeSlobodan(registar, kandidat, zaId)) return kandidat;
  }
  throw new Error(`Ne mogu pronaći slobodnu adresu za "${zeljeni}".`);
}
