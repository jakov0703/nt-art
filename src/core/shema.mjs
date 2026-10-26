/**
 * JEDINA definicija oblika jednog rada.
 *
 * Dijeli je troje: Astro build (src/content.config.ts), Atelier server
 * (atelier/server.mjs) i CLI (scripts/novi-rad.mjs). Ako bi svatko imao
 * svoju kopiju, prva bi se razišla onog dana kad se doda polje — a
 * razilaženje se primijeti tek kad njoj pukne build.
 *
 * Zod dolazi iz `astro/zod` (Zod 4) i u Astru i u Atelieru. Dvije različite
 * Zod instance daju dvije nekompatibilne sheme koje izgledaju identično.
 *
 * VAŽNO: hrvatski opis djela NIJE u frontmatteru — on je tijelo markdown
 * datoteke, da može imati odlomke i da radi `render()`. Minimalnu duljinu
 * opisa zato provjerava `provjeriPravila()`, ne Zod.
 */

import {
  STANJA_OBJAVE, STATUSI, KATEGORIJE, TEHNIKE, PODLOGE,
  TEME_SLUGOVI, NAMJENE, ULOGE_SLIKE, VALUTE,
} from './taxonomije.mjs';

export const MIN_OPIS = 400;
export const MIN_SIRINA_SLIKE = 1400;
export const PREPORUCENA_SIRINA = 2000;

/**
 * @param {object} ctx
 * @param {import('astro/zod').z} ctx.z
 * @param {() => any} ctx.image  Astro `image()` helper; u Atelieru `() => z.string()`.
 */
export function shemaRada({ z, image }) {
  const slikaShema = z.object({
    datoteka: image(),
    uloga: z.enum(ULOGE_SLIKE).default('detalj'),
    alt_hr: z.string().min(3, { error: 'Opis slike mora imati barem 3 znaka.' }),
    alt_en: z.string().optional(),
    potpis: z.string().optional(),
    sirina_px: z.number().int().positive().optional(),
    visina_px: z.number().int().positive().optional(),
  });

  return z.object({
    // --- obavezno ---
    id: z.string().regex(/^r-\d{4}-\d{3}$/, { error: 'Oznaka mora biti oblika r-2026-001.' }),
    stanje_objave: z.enum(STANJA_OBJAVE).default('skica'),
    naslov_hr: z.string().min(2).max(70, { error: 'Naslov je dulji od 70 znakova — skratite ga.' }),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      error: 'Web adresa smije sadržavati samo mala slova bez kvačica, brojke i crtice.',
    }),
    slike: z.array(slikaShema).min(1, { error: 'Djelo treba barem jednu fotografiju.' }),
    godina: z.number().int().min(1900).max(new Date().getFullYear() + 1),
    tehnika: z.enum(TEHNIKE),
    dimenzije: z.object({
      visina_cm: z.number().positive({ error: 'Visina mora biti broj veći od nule.' }),
      sirina_cm: z.number().positive({ error: 'Širina mora biti broj veći od nule.' }),
      dubina_cm: z.number().positive().optional(),
    }),
    status: z.enum(STATUSI),

    // --- opcionalno: djelo ---
    godina_priblizna: z.boolean().default(false),
    podloga: z.enum(PODLOGE).optional(),
    uokvireno: z.boolean().default(false),
    opis_okvira: z.string().optional(),
    kategorija: z.enum(KATEGORIJE).default('ostalo'),
    teme: z.array(z.enum(TEME_SLUGOVI)).max(3).default([]),
    ciklus: z.string().optional(),
    ikonografska_biljeska: z.string().optional(),
    namjena: z.array(z.enum(NAMJENE)).default([]),
    oznake: z.array(z.string()).default([]),

    // --- opcionalno: prodaja ---
    cijena: z.number().nonnegative().optional(),
    valuta: z.enum(VALUTE).default('EUR'),
    cijena_na_upit: z.boolean().default(false),
    datum_prodaje: z.coerce.date().optional(),
    zbirka_vlasnik: z.string().optional(),
    printovi: z.object({
      dostupno: z.boolean().default(false),
      cijena_od: z.number().nonnegative().optional(),
      url: z.string().optional(),
    }).optional(),

    // --- opcionalno: engleski (prazno je posve u redu) ---
    naslov_en: z.string().max(70).optional(),
    slug_en: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    opis_en: z.string().optional(),

    // --- opcionalno: SEO i redoslijed ---
    meta_naslov: z.string().max(60).optional(),
    meta_opis: z.string().max(160).optional(),
    istaknuto: z.boolean().default(false),
    redoslijed: z.number().int().default(0),

    // --- automatski ---
    datum_objave: z.coerce.date(),
    datum_izmjene: z.coerce.date(),
    povezani_radovi: z.array(z.string()).default([]),
  });
}

/**
 * Pravila koja Zod ne može izraziti po polju: ovise o DRUGIM poljima
 * ili o tijelu datoteke. Vraća listu grešaka na hrvatskom — iste poruke
 * vidi i ona u Atelieru i ti u terminalu.
 *
 * @param {object} podaci  frontmatter nakon Zod parsiranja
 * @param {string} opisHr  tijelo markdown datoteke
 * @returns {{polje: string, poruka: string}[]}
 */
export function provjeriPravila(podaci, opisHr = '') {
  const greske = [];
  const p = (polje, poruka) => greske.push({ polje, poruka });

  const objavljeno = podaci.stanje_objave === 'objavljeno';
  const opis = String(opisHr ?? '').trim();

  if (objavljeno && opis.length < MIN_OPIS) {
    p('opis_hr',
      `Opis ima ${opis.length} znakova, a za objavu treba barem ${MIN_OPIS}. ` +
      'Napišite što je prikazano, čime je slikano i zašto vam je to djelo važno — ' +
      'nekoliko rečenica je dovoljno. Djelo može ostati skica dok ne stignete.');
  }

  if (podaci.status === 'dostupno' && !podaci.cijena_na_upit && podaci.cijena == null) {
    p('cijena',
      'Djelo je označeno kao dostupno, ali nema cijenu. Upišite cijenu u eurima ' +
      'ili označite „Cijena na upit".');
  }

  if (podaci.cijena != null && podaci.cijena_na_upit) {
    p('cijena',
      'Označeno je „Cijena na upit", ali je cijena ipak upisana. ' +
      'Odaberite jedno — inače se cijena nigdje neće prikazati, a stajat će u datoteci.');
  }

  if (podaci.status === 'prodano' && !podaci.datum_prodaje) {
    p('datum_prodaje', 'Za prodano djelo upišite kad je prodano — makar samo godinu.');
  }

  if (podaci.status !== 'prodano' && podaci.datum_prodaje) {
    p('datum_prodaje', 'Upisan je datum prodaje, a status nije „prodano".');
  }

  // Djelomičan engleski je jedina stvarna zamka dvojezičnosti: pola prevedena
  // stranica je gora od nijedne. Zato ili oboje, ili ništa.
  const imaEnNaslov = Boolean(podaci.naslov_en?.trim());
  const imaEnOpis = Boolean(podaci.opis_en?.trim());
  if (imaEnNaslov !== imaEnOpis) {
    p('naslov_en',
      imaEnNaslov
        ? 'Engleski naslov je upisan, ali engleski opis nije. Dopunite opis ili obrišite engleski naslov — ' +
          'djelo će tada imati samo hrvatsku stranicu, što je posve u redu.'
        : 'Engleski opis je upisan, ali engleski naslov nije.');
  }
  if (imaEnNaslov && imaEnOpis && !podaci.slug_en) {
    p('slug_en', 'Engleska verzija treba i englesku web adresu.');
  }

  if (objavljeno && !podaci.slike?.some((s) => s.uloga === 'glavna')) {
    p('slike', 'Označite koja je fotografija glavna — ona se prikazuje na vrhu i u dijeljenju na mrežama.');
  }

  if (podaci.kategorija === 'sakralno' && podaci.teme?.length === 0 && objavljeno) {
    p('teme', 'Odaberite barem jednu temu (Gospa, Isus Krist, sveci…) da se djelo pojavi na tematskim stranicama.');
  }

  if (podaci.uokvireno === false && podaci.opis_okvira) {
    p('opis_okvira', 'Upisan je opis okvira, a djelo nije označeno kao uokvireno.');
  }

  return greske;
}

/** Sljedeća slobodna oznaka: r-2026-001, r-2026-002, ... */
export function sljedeciId(postojeci, godina = new Date().getFullYear()) {
  const prefiks = `r-${godina}-`;
  const brojevi = postojeci
    .filter((id) => typeof id === 'string' && id.startsWith(prefiks))
    .map((id) => Number.parseInt(id.slice(prefiks.length), 10))
    .filter(Number.isFinite);
  const sljedeci = (brojevi.length ? Math.max(...brojevi) : 0) + 1;
  return `${prefiks}${String(sljedeci).padStart(3, '0')}`;
}
