/**
 * Zatvoreni rječnici.
 *
 * Slobodan tekst u ovim poljima razbija filtre i naslove: "ulje na platnu",
 * "Ulje na platnu" i "ulje/platno" postaju tri različite tehnike i tri
 * poluprazne stranice. Zato enum, a ne string.
 */

export const STANJA_OBJAVE = ['skica', 'objavljeno', 'arhivirano'];

export const STATUSI = ['dostupno', 'rezervirano', 'prodano', 'nije_na_prodaju', 'po_narudzbi'];

export const STATUS_OPIS = {
  dostupno: 'Rad je na prodaju i prikazuje se u „Dostupni radovi".',
  rezervirano: 'Netko se javio i dogovara kupnju. Još je vidljiv među dostupnima, s oznakom.',
  prodano: 'Rad je prodan. Stranica ostaje na istoj adresi, cijena se skriva.',
  nije_na_prodaju: 'Rad se prikazuje u arhivi, ali nije i nikad nije bio na prodaju.',
  po_narudzbi: 'Primjer onoga što radite po narudžbi — nije konkretan komad na prodaju.',
};

export const KATEGORIJE = ['sakralno', 'ostalo'];

/**
 * Autorica radi ZAPADNU DEVOCIJSKU SLIKU (potvrdila u upitniku), prvenstveno
 * akril na platnu. Ikonopisne tehnike (jajčana tempera, zlatni list, ikonopis)
 * namjerno NISU na popisu: to je drugi zanat koji ona ne radi, a njihovo
 * postojanje u izborniku vodi prema tvrdnjama koje ne može podržati.
 * Ako se jednom počne baviti i time, dodaju se ovdje u jednom retku.
 */
export const TEHNIKE = [
  'akril na platnu',
  'ulje na platnu',
  'akvarel',
  'kombinirana tehnika',
  'pastel',
  'crtež',
];

export const PODLOGE = ['platno', 'papir', 'drvena ploča', 'karton'];

/**
 * Teme su hijerarhijske: `sakralno` i `ostalo` su uvijek žive, ostale
 * dobivaju vlastiti URL tek kad prijeđu prag (vidi PRAG_TEME).
 *
 * `gospa`, a ne `bogorodica`: "Gospa" je termin s kupovnom namjerom u
 * hrvatsko-katoličkom pretraživanju, dok "Bogorodica" vuče pravoslavne,
 * ikonopisne i povijesno-umjetničke rezultate. Jedan čvor, oba naziva u tekstu.
 */
export const TEME = [
  { slug: 'isus-krist', naziv: 'Isus Krist', naziv_en: 'Jesus Christ', nadtema: 'sakralno' },
  { slug: 'gospa', naziv: 'Gospa i Majka Božja', naziv_en: 'The Virgin Mary', nadtema: 'sakralno' },
  { slug: 'sveci', naziv: 'Sveci i zaštitnici', naziv_en: 'Saints', nadtema: 'sakralno' },
  { slug: 'kriz-i-raspelo', naziv: 'Križ i raspelo', naziv_en: 'The Cross', nadtema: 'sakralno' },
  { slug: 'andjeli', naziv: 'Anđeli', naziv_en: 'Angels', nadtema: 'sakralno' },
  { slug: 'sveta-obitelj', naziv: 'Sveta Obitelj', naziv_en: 'The Holy Family', nadtema: 'sakralno' },
  { slug: 'biblijski-prizori', naziv: 'Biblijski prizori', naziv_en: 'Biblical Scenes', nadtema: 'sakralno' },
  // Nesakralni radovi — cvijeće i ptice su ono što stvarno ima naslikano.
  { slug: 'cvijece', naziv: 'Cvijeće i mrtva priroda', naziv_en: 'Flowers and Still Life', nadtema: 'ostalo' },
  { slug: 'ptice', naziv: 'Ptice i priroda', naziv_en: 'Birds and Nature', nadtema: 'ostalo' },
  { slug: 'portret', naziv: 'Portret', naziv_en: 'Portraits', nadtema: 'ostalo' },
  { slug: 'pejzaz', naziv: 'Pejzaž', naziv_en: 'Landscapes', nadtema: 'ostalo' },
];

export const TEME_SLUGOVI = TEME.map((t) => t.slug);

/**
 * Tema dobiva vlastiti URL tek s 3+ objavljena rada I 200+ riječi uvoda.
 * Ispod praga je samo filter-čip bez URL-a — prazne kategorijske stranice
 * su SEO teret, a stranica kreće s malo radova.
 */
export const PRAG_TEME = { radova: 3, rijeci: 200 };

/** Namjena ne stvara nijedan URL — spaja rad s ručno pisanim darovnim stranicama. */
export const NAMJENE = [
  'dom', 'molitveni-kutak', 'dnevni-boravak', 'djecja-soba',
  'kapela', 'zupna-crkva', 'samostan',
  'dar-za-krstenje', 'dar-za-prvu-pricest', 'dar-za-krizmu',
  'dar-za-vjencanje', 'dar-za-svecenika', 'dar-za-imendan',
];

export const ULOGE_SLIKE = ['glavna', 'detalj', 'u-prostoru', 'uokvireno', 'potpis', 'proces'];

export const ULOGA_OPIS = {
  glavna: 'Glavna fotografija — cijelo djelo, ravno, dobro osvijetljeno.',
  detalj: 'Izrez izbliza — potez kistom, tekstura boje, lice.',
  'u-prostoru': 'Djelo na zidu u prostoru. Ovo najviše pomaže kupcu da se odluči.',
  uokvireno: 'Okvir i rub.',
  potpis: 'Vaš potpis na djelu.',
  proces: 'Rad u nastanku.',
};

export const VALUTE = ['EUR'];

export function temaPoSlugu(slug) {
  return TEME.find((t) => t.slug === slug) ?? null;
}
