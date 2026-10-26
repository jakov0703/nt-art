/**
 * JEDINO mjesto s podacima o umjetnici i stranici.
 *
 * Podaci potvrđeni od autorice 15.09.2026. (ispunjen upitnik).
 * Ništa ovdje nije pretpostavljeno — svaka vrijednost dolazi iz njezinog
 * odgovora. Gdje odgovora nema, stoji null i stranica se ponaša kao da tog
 * podatka nema, umjesto da ga izmisli.
 */

export const POTVRDENO = true;

/**
 * Domena. Bez završne kose crte. Iz OVE vrijednosti generiraju se svi
 * apsolutni URL-ovi: kanonski, hreflang, JSON-LD @id, sitemap, robots.txt
 * i og:image.
 *
 * Može se zadati i pri buildu, bez diranja koda:
 *     SITE_URL=https://nikolineart.hr npm run build
 */
function domena() {
  const iz = (process.env.SITE_URL || process.env.DEPLOY_PRIME_URL || process.env.URL || '').trim().replace(/\/+$/, '');
  if (!iz) return 'https://nikolineart.hr';
  if (!/^https?:\/\//.test(iz)) {
    throw new Error(`SITE_URL mora počinjati s https:// — dobiveno: "${iz}"`);
  }
  if (iz.startsWith('http://')) {
    console.warn('  UPOZORENJE: SITE_URL je http://, ne https://.');
  }
  return iz;
}

export const site = {
  url: domena(),

  /**
   * Ime se koristi za autorstvo (JSON-LD, potpis uz radove, copyright), ali
   * NIJE logotip. Vidi `marka` — u zaglavlju stoji monogram NT, onaj kojim
   * se stvarno potpisuje na platnu.
   */
  naziv: 'Nikolina Tomić',
  naziv_kratki: 'Nikolina',

  /**
   * Robna marka.
   *
   * `monogram` je NT — preslikan s njezinog stvarnog potpisa u donjem desnom
   * uglu platna. `rijec` je nikoline.art, isti handle kao na Instagramu, pa
   * onaj tko dođe s profila odmah zna da je na pravom mjestu.
   *
   * Puno ime se u zaglavlju NE prikazuje: marka je kraća, pamtljivija i ne
   * izlaže joj puno ime na svakoj stranici.
   */
  marka: {
    monogram: 'NT',
    rijec: 'nikoline.art',
  },

  // Cilja kvalificirani rep, ne glavni termin: „sakralne slike" drže darovni
  // dućani i reprodukcije. „Ručno slikane" je i istinito i osvojivo.
  tagline_hr: 'Ručno slikane sakralne slike — po narudžbi',
  tagline_en: 'Hand-painted sacred art — commissions',

  opis_hr:
    'Ručno slikane sakralne slike — Presveto Srce Isusovo, Gospa i sveci. ' +
    'Akril na platnu, svaka slika je unikat. Narudžbe iz Zagreba.',
  opis_en:
    'Hand-painted sacred paintings — the Sacred Heart, the Virgin Mary and saints. ' +
    'Acrylic on canvas, each work one of a kind. Commissions from Zagreb, Croatia.',

  grad: 'Zagreb',
  regija: null,
  drzava: 'HR',

  email: 'tnikolina41@gmail.com',
  // Telefon nije upisala u upitniku — polje ostaje prazno i nigdje se ne
  // prikazuje. Viber/WhatsApp gumb se pojavi sam čim se ovdje upiše broj.
  telefon: null,
  whatsapp: null,
  viber: null,

  instagram: 'https://www.instagram.com/nikoline.art/',
  facebook: null,

  /**
   * Odredište obrasca za upit. Dok je null, obrazac se gracizno degradira na
   * predpopunjeni mailto: s njezinom adresom — što radi odmah, bez ijedne
   * vanjske usluge i bez ičijeg pristanka na obradu podataka.
   */
  form_endpoint: null,

  /**
   * Nije registrirana za djelatnost (potvrđeno u upitniku).
   * Posljedice u kodu:
   *  - NE emitira se Organization čvor ni OIB u strukturiranim podacima
   *  - NE prikazuju se „uvjeti poslovanja" ni podaci o tvrtki
   *  - prodaja ide kao privatni dogovor, ne kao trgovina
   */
  registrirana_djelatnost: false,
  oib: null,

  /** Zaglavlje mijenja boju po liturgijskom vremenu (potvrdila: da). */
  liturgijske_boje: true,
};

/**
 * Cjenovni rasponi, njezini, u eurima.
 * Prikazuju se na stranici narudžbi. Nisu fiksna cijena nego okvir —
 * konačna se dogovara, jer ovisi o motivu i složenosti.
 */
export const cjenik = [
  { format: '40 × 50 cm', od: 50, do: 100 },
  { format: '50 × 70 cm', od: 80, do: 150 },
  { format: '70 × 100 cm', od: 150, do: 300 },
];

/** Uvjeti narudžbe — njezini odgovori, doslovno. */
export const narudzba = {
  rok: 'od tjedan dana do nekoliko mjeseci, ovisno o formatu i motivu',
  predujam: false,
  izmjene_skice: 'po dogovoru',
  po_fotografiji: false,   // ne radi slike prema fotografiji
  za_crkve: false,         // ne prima narudžbe za crkve i kapele
  printovi: true,
};

/** Kupnja i dostava — njezini odgovori. */
export const dostava = {
  podrucje: 'Hrvatska',
  osobno_preuzimanje: true,
  uokvireno: false,
  placanje: ['uplata na račun', 'gotovina pri preuzimanju'],
};

export const jezici = {
  zadani: 'hr',
  svi: ['hr', 'en'],
  oznake: { hr: 'hr-HR', en: 'en-US' },   // hreflang: crtica
  og: { hr: 'hr_HR', en: 'en_US' },       // og:locale: podvlaka
  nazivi: { hr: 'Hrvatski', en: 'English' },
};

export const rute = {
  '/':                  { hr: '/',                  en: '/en/' },
  '/dostupni-radovi/':  { hr: '/dostupni-radovi/',  en: '/en/available/' },
  '/radovi/':           { hr: '/radovi/',           en: '/en/works/' },
  '/prodani-radovi/':   { hr: '/prodani-radovi/',   en: '/en/sold/' },
  '/narudzbe/':         { hr: '/narudzbe/',         en: '/en/commissions/' },
  '/o-meni/':           { hr: '/o-meni/',           en: '/en/about/' },
  '/kontakt/':          { hr: '/kontakt/',          en: '/en/contact/' },
  '/cesta-pitanja/':    { hr: '/cesta-pitanja/',    en: null },
  '/kupnja-i-dostava/': { hr: '/kupnja-i-dostava/', en: null },
  '/privatnost/':       { hr: '/privatnost/',       en: null },
};

/** Apsolutni URL iz relativne putanje. og:image i JSON-LD @id ne smiju biti relativni. */
export function apsolutno(putanja) {
  return new URL(putanja, site.url).href;
}

/** Prikaz cijene: hrvatski 1.200 €, engleski €1,200. */
export function formatirajCijenu(iznos, valuta = 'EUR', jezik = 'hr') {
  if (iznos == null) return null;
  return new Intl.NumberFormat(jezik === 'hr' ? 'hr-HR' : 'en-US', {
    style: 'currency',
    currency: valuta,
    maximumFractionDigits: 0,
  }).format(iznos);
}

/** Popis podataka koji još blokiraju objavu. */
export function neispunjeno() {
  const nedostaje = [];
  if (site.naziv.includes('[')) nedostaje.push('site.naziv — puno ime umjetnice');
  if (!site.email) nedostaje.push('site.email — adresa za upite');
  return nedostaje;
}
