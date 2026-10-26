/**
 * Pomoćne funkcije nad jednim radom.
 *
 * Ključno pravilo: vidljivi tekst na stranici i JSON-LD izvode se iz ISTIH
 * polja. Ako se razdvoje, jednog dana će tablica specifikacije i strukturirani
 * podaci tvrditi različite stvari, a to Google kažnjava.
 */

import { STATUSI } from './taxonomije.mjs';
import { site, apsolutno, formatirajCijenu } from '../site.config.mjs';

export const DOSTUPNI_STATUSI = ['dostupno', 'rezervirano'];

export const STATUS_NAZIV = {
  hr: {
    dostupno: 'Dostupno',
    rezervirano: 'Rezervirano',
    prodano: 'Prodano',
    nije_na_prodaju: 'Nije na prodaju',
    po_narudzbi: 'Po narudžbi',
  },
  en: {
    dostupno: 'Available',
    rezervirano: 'Reserved',
    prodano: 'Sold',
    nije_na_prodaju: 'Not for sale',
    po_narudzbi: 'Commission example',
  },
};

export const jeObjavljen = (r) => r.data.stanje_objave === 'objavljeno';
export const jeDostupan = (r) => jeObjavljen(r) && DOSTUPNI_STATUSI.includes(r.data.status);
export const jeProdan = (r) => jeObjavljen(r) && r.data.status === 'prodano';

/** Engleska stranica postoji SAMO ako je stvarno prevedena. */
export const imaEngleski = (r) =>
  Boolean(r.data.naslov_en?.trim() && r.data.opis_en?.trim() && r.data.slug_en);

/**
 * Ručni `redoslijed` prvo (da najjači rad može voditi bez lažiranja datuma),
 * pa novije. Redoslijed kolekcije je inače ovisan o platformi — uvijek sortiraj.
 */
export function sortiraj(radovi) {
  return [...radovi].sort((a, b) => {
    if (b.data.redoslijed !== a.data.redoslijed) return b.data.redoslijed - a.data.redoslijed;
    const da = new Date(a.data.datum_objave).getTime();
    const db = new Date(b.data.datum_objave).getTime();
    if (db !== da) return db - da;
    return b.data.godina - a.data.godina;
  });
}

export function glavnaSlika(rad) {
  return rad.data.slike.find((s) => s.uloga === 'glavna') ?? rad.data.slike[0];
}

export function ostaleSlike(rad) {
  const glavna = glavnaSlika(rad);
  return rad.data.slike.filter((s) => s !== glavna);
}

/** "70 × 50 cm" — s pravim znakom množenja, ne slovom x. */
export function dimenzijeTekst(d) {
  const osnova = `${broj(d.visina_cm)} × ${broj(d.sirina_cm)} cm`;
  return d.dubina_cm ? `${osnova} (dubina ${broj(d.dubina_cm)} cm)` : osnova;
}

const broj = (n) => String(n).replace('.', ',');

/** Muzejski redak: "Ulje na platnu, 2024. · 70 × 50 cm" */
export function specRedak(rad, jezik = 'hr') {
  const d = rad.data;
  const godina = d.godina_priblizna ? `oko ${d.godina}.` : `${d.godina}.`;
  const tehnika = jezik === 'hr'
    ? d.tehnika.charAt(0).toUpperCase() + d.tehnika.slice(1)
    : d.tehnika;
  return `${tehnika}, ${godina} · ${dimenzijeTekst(d.dimenzije)}`;
}

export function naslovRada(rad, jezik = 'hr') {
  return (jezik === 'en' ? rad.data.naslov_en : null) ?? rad.data.naslov_hr;
}

/** <title> — ručni override ako postoji, inače obrazac, obrezano na 60. */
export function titleTag(rad, jezik = 'hr') {
  if (rad.data.meta_naslov) return rad.data.meta_naslov;
  const naslov = naslovRada(rad, jezik);
  const puni = `${naslov} — ${rad.data.tehnika}, ${rad.data.godina}. | ${site.naziv}`;
  return puni.length <= 60 ? puni : `${naslov} | ${site.naziv}`.slice(0, 60);
}

export function metaOpis(rad, opisTijelo = '', jezik = 'hr') {
  if (rad.data.meta_opis) return rad.data.meta_opis;
  const izvor = jezik === 'en' ? (rad.data.opis_en ?? '') : opisTijelo;
  const cist = String(izvor).replace(/[#*_>\[\]]/g, '').replace(/\s+/g, ' ').trim();
  return cist.length > 155 ? `${cist.slice(0, 152).trimEnd()}…` : cist;
}

/**
 * Alt tekst se gradi iz polja, ne prepisuje ručno — tako nikad ne ostane
 * prazan i nikad se ne raziđe s onim što je na stranici.
 */
export function altTekst(rad, slika, jezik = 'hr') {
  if (slika.alt_hr && jezik === 'hr') return slika.alt_hr;
  if (slika.alt_en && jezik === 'en') return slika.alt_en;
  return `${naslovRada(rad, jezik)} — ${rad.data.tehnika}, ${rad.data.godina}.`;
}

export function cijenaTekst(rad, jezik = 'hr') {
  const d = rad.data;
  if (d.status === 'prodano') return null;
  if (d.cijena_na_upit || d.cijena == null) {
    return jezik === 'hr' ? 'Cijena na upit' : 'Price on request';
  }
  return formatirajCijenu(d.cijena, d.valuta, jezik);
}

export function putanjaRada(rad, jezik = 'hr') {
  return jezik === 'en' ? `/en/works/${rad.data.slug_en}/` : `/radovi/${rad.data.slug}/`;
}

/**
 * VisualArtwork (+ Product kad je na prodaju).
 *
 * Prodano -> availability SoldOut, a `price` se UKLANJA. Nikad OutOfStock:
 * to implicira da će robe opet biti, a original ne može biti ponovno na
 * skladištu.
 */
export function jsonLdRada(rad, { url, slikaUrl, jezik = 'hr', opis = '' }) {
  const d = rad.data;
  const naProdaju = ['dostupno', 'rezervirano', 'prodano'].includes(d.status);

  const cvor = {
    '@context': 'https://schema.org',
    '@type': naProdaju ? ['VisualArtwork', 'Product'] : 'VisualArtwork',
    '@id': `${url}#rad`,
    name: naslovRada(rad, jezik),
    url,
    inLanguage: jezik,
    image: slikaUrl,
    dateCreated: String(d.godina),
    artform: d.kategorija === 'sakralno' ? 'Sacred art' : 'Painting',
    artMedium: d.tehnika,
    creator: { '@id': `${site.url}/#artist` },
    height: { '@type': 'QuantitativeValue', value: d.dimenzije.visina_cm, unitCode: 'CMT' },
    width: { '@type': 'QuantitativeValue', value: d.dimenzije.sirina_cm, unitCode: 'CMT' },
  };

  if (opis) cvor.description = opis;
  if (d.podloga) cvor.artworkSurface = d.podloga;
  if (d.id) cvor.sku = d.id;
  if (d.naslov_en && jezik === 'hr') cvor.alternateName = d.naslov_en;
  if (d.teme?.length) cvor.keywords = d.teme.join(', ');

  if (naProdaju) {
    const ponuda = {
      '@type': 'Offer',
      url,
      availability: d.status === 'prodano'
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${site.url}/#artist` },
    };
    // Cijena se emitira samo kad stvarno postoji i kad nije prodano.
    if (d.status !== 'prodano' && !d.cijena_na_upit && d.cijena != null) {
      ponuda.price = d.cijena;
      ponuda.priceCurrency = d.valuta;
    }
    cvor.offers = ponuda;
  }

  return cvor;
}

/** Person + WebSite. Ništa nepotvrđeno ne izlazi odavde. */
export function jsonLdOsnovni() {
  const osoba = {
    '@type': 'Person',
    '@id': `${site.url}/#artist`,
    name: site.naziv,
  };
  // sameAs je najjači signal identiteta za samostalnog umjetnika — ali samo
  // ako je profil potvrđeno živ i javan. Neprovjeren URL je gore od nijednog.
  const profili = [site.instagram, site.facebook].filter(Boolean);
  if (profili.length) osoba.sameAs = profili;
  if (site.grad) {
    osoba.address = { '@type': 'PostalAddress', addressLocality: site.grad, addressCountry: site.drzava };
  }
  if (site.email) osoba.email = site.email;
  // NIKAD jobTitle "akademska slikarica" ni alumniOf bez dokumenta.

  return {
    '@context': 'https://schema.org',
    '@graph': [
      osoba,
      {
        '@type': 'WebSite',
        '@id': `${site.url}/#website`,
        url: `${site.url}/`,
        name: site.naziv,
        inLanguage: 'hr-HR',
        publisher: { '@id': `${site.url}/#artist` },
      },
    ],
  };
}

/**
 * Mrvice jednog rada. Koriste ih i vidljiva navigacija i JSON-LD — iz iste
 * funkcije, da se ne mogu razići.
 */
export function mrviceRada(rad, jezik = 'hr') {
  return jezik === 'en'
    ? [
        { naziv: 'Home', putanja: '/en/' },
        { naziv: 'Works', putanja: '/en/works/' },
        { naziv: naslovRada(rad, 'en'), putanja: putanjaRada(rad, 'en') },
      ]
    : [
        { naziv: 'Početna', putanja: '/' },
        { naziv: 'Radovi', putanja: '/radovi/' },
        { naziv: naslovRada(rad, 'hr'), putanja: putanjaRada(rad, 'hr') },
      ];
}

export function jsonLdMrvice(stavke) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: stavke.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.naziv,
      // Zadnja mrvica namjerno NEMA `item` — to je trenutna stranica.
      ...(i < stavke.length - 1 ? { item: apsolutno(s.putanja) } : {}),
    })),
  };
}

export { STATUSI };
