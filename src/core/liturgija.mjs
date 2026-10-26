/**
 * Liturgijsko vrijeme prema datumu.
 *
 * Autorica je izričito zatražila da zaglavlje prati liturgijski kalendar.
 *
 * Audit je na ovome postavio jedan uvjet: naziv vremena MORA biti ispisan
 * riječima, ne samo nagoviješten bojom. Ljubičasta i marijansko plavo imaju
 * omjer luminancije 1.02:1 i pod deuteranopijom su ista boja — tko ne razlikuje
 * te tonove, bez teksta ne dobiva nikakvu informaciju.
 *
 * Datumi se računaju iz Uskrsa (Gaussov algoritam za gregorijanski kalendar).
 * Ovo je pojednostavljen opći kalendar — ne pokriva svetkovine pojedinih župa.
 */

/** Uskrsna nedjelja za danu godinu. */
export function uskrs(godina) {
  const a = godina % 19;
  const b = Math.floor(godina / 100);
  const c = godina % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mjesec = Math.floor((h + l - 7 * m + 114) / 31);
  const dan = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(godina, mjesec - 1, dan));
}

const DAN = 86400000;
const pomak = (d, dana) => new Date(d.getTime() + dana * DAN);

/**
 * @returns {{ id: string, naziv: string, naziv_en: string, boja: string }}
 *   `boja` je naziv CSS varijable — vrijednosti su u tokens.css i sve su
 *   prošle kontrastnu provjeru.
 */
export function liturgijskoVrijeme(datum = new Date()) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const g = d.getUTCFullYear();

  const u = uskrs(g);
  const pepelnica = pomak(u, -46);
  const veliki_tjedan = pomak(u, -7);
  const duhovi = pomak(u, 49);

  // Došašće: četvrta nedjelja prije Božića.
  const bozic = new Date(Date.UTC(g, 11, 25));
  const dosasce = pomak(bozic, -(bozic.getUTCDay() === 0 ? 7 : bozic.getUTCDay()) - 21);

  // Božićno vrijeme traje do Krštenja Gospodinova (nedjelja nakon 6. siječnja).
  const bogojavljenje = new Date(Date.UTC(g, 0, 6));
  const krstenje = pomak(bogojavljenje, bogojavljenje.getUTCDay() === 0 ? 7 : 7 - bogojavljenje.getUTCDay());

  if (d >= dosasce && d < new Date(Date.UTC(g, 11, 25))) {
    return { id: 'dosasce', naziv: 'Došašće', naziv_en: 'Advent', boja: '--color-violet' };
  }
  if (d >= new Date(Date.UTC(g, 11, 25)) || d <= krstenje) {
    return { id: 'bozic', naziv: 'Božićno vrijeme', naziv_en: 'Christmas', boja: '--color-gold-rule' };
  }
  if (d >= veliki_tjedan && d < u) {
    return { id: 'veliki-tjedan', naziv: 'Veliki tjedan', naziv_en: 'Holy Week', boja: '--color-oxblood' };
  }
  if (d >= pepelnica && d < u) {
    return { id: 'korizma', naziv: 'Korizma', naziv_en: 'Lent', boja: '--color-violet' };
  }
  if (d >= u && d <= duhovi) {
    return { id: 'uskrs', naziv: 'Uskrsno vrijeme', naziv_en: 'Eastertide', boja: '--color-gold-rule' };
  }
  return { id: 'kroz-godinu', naziv: 'Vrijeme kroz godinu', naziv_en: 'Ordinary Time', boja: '--color-success-border' };
}
