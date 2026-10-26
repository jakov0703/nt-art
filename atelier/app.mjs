import { Hono } from 'hono';
import path from 'node:path';
import { z } from 'astro/zod';

import { shemaRada, provjeriPravila, sljedeciId } from '../src/core/shema.mjs';
import {
  TEHNIKE, PODLOGE, TEME, NAMJENE, STATUSI, STATUS_OPIS,
  ULOGE_SLIKE, ULOGA_OPIS, KATEGORIJE,
} from '../src/core/taxonomije.mjs';
import { slugify, predloziSlobodan, jeSlobodan } from '../src/core/slug.mjs';
import { obradiSliku, napraviSlicicu, GreskaSlike } from '../src/core/slike.mjs';
// Ista shema kao u src/content.config.ts. `image()` tamo daje Astrov tip;
// ovdje je slika običan string (relativna putanja) jer Astro ovdje ne postoji.
const SHEMA = shemaRada({ z, image: () => z.string().min(1) });



// -------------------------------------------------- pomoćno

const greska = (c, poruka, status = 400) => c.json({ ok: false, poruka }, status);

/**
 * Zod greške u hrvatske rečenice.
 *
 * Ovo je najvažnija površina u cijelom Atelieru. „Too small: expected string
 * to have >=2 characters" osobi koja nije tehnička ne govori NIŠTA — ne zna
 * ni koje je polje, ni što da učini. Svaka poruka mora reći dvoje: gdje je
 * problem i što konkretno napisati.
 *
 * Nema oslanjanja na Zodove tekstove ni heuristike nad njima: prevodi se po
 * kodu greške i imenu polja, pa nijedna engleska rečenica ne može procuriti.
 */
const POLJA = {
  naslov_hr: 'Naziv djela',
  opis_hr: 'Opis djela',
  slug: 'Web adresa',
  godina: 'Godina',
  tehnika: 'Tehnika',
  podloga: 'Podloga',
  status: 'Stanje djela',
  cijena: 'Cijena',
  valuta: 'Valuta',
  kategorija: 'Vrsta rada',
  teme: 'Teme',
  namjena: 'Namjena',
  slike: 'Fotografije',
  id: 'Oznaka djela',
  stanje_objave: 'Stanje objave',
  naslov_en: 'Naziv na engleskom',
  opis_en: 'Opis na engleskom',
  slug_en: 'Engleska web adresa',
  datum_prodaje: 'Datum prodaje',
  datum_objave: 'Datum objave',
  datum_izmjene: 'Datum izmjene',
  ciklus: 'Ciklus',
  zbirka_vlasnik: 'Vlasnik / zbirka',
  'dimenzije.visina_cm': 'Visina',
  'dimenzije.sirina_cm': 'Širina',
  'dimenzije.dubina_cm': 'Dubina',
};

/** Polja u kojima se bira s popisa — tu se nudi i što je dopušteno. */
const POPISI = {
  tehnika: TEHNIKE,
  podloga: PODLOGE,
  status: STATUSI,
  kategorija: KATEGORIJE,
};

function nazivPolja(putanja) {
  if (POLJA[putanja]) return POLJA[putanja];
  // slike.0.alt_hr -> "Opis 1. fotografije"
  const m = putanja.match(/^slike\.(\d+)\.(\w+)$/);
  if (m) {
    const broj = Number(m[1]) + 1;
    if (m[2] === 'alt_hr') return `Opis ${broj}. fotografije`;
    if (m[2] === 'uloga') return `Vrsta ${broj}. fotografije`;
    return `${broj}. fotografija`;
  }
  return putanja;
}

/**
 * Zod 4 NE nosi upisanu vrijednost u greški — issue ima samo
 * { expected, code, path, message }. Zato se ono što je stvarno upisano
 * dohvaća iz poslanih podataka po putanji; bez toga se „prazno polje" i
 * „50x70" ne mogu razlikovati i obje bi greške glasile „nedostaje podatak".
 */
function vrijednostNaPutanji(podaci, putanja) {
  return putanja.reduce((v, k) => (v == null ? undefined : v[k]), podaci);
}

function prevediZod(rezultat, poslano = {}) {
  return rezultat.error.issues.map((i) => {
    const putanja = i.path.join('.');
    const naziv = nazivPolja(putanja);
    const upisanaVrijednost = vrijednostNaPutanji(poslano, i.path);

    // Shema već nosi hrvatsku poruku za najvažnija polja — nju poštujemo.
    if (i.message && /[čćšžđČĆŠŽĐ]/.test(i.message) && !/^Invalid|^Too |^Expected/.test(i.message)) {
      return { polje: putanja, poruka: i.message };
    }

    if (i.code === 'invalid_type' && (upisanaVrijednost === undefined || upisanaVrijednost === '')) {
      return { polje: putanja, poruka: `Nedostaje podatak: ${naziv}.` };
    }
    if (i.code === 'invalid_type' && i.expected === 'number') {
      const upisano = String(upisanaVrijednost ?? '');

      // Najčešća greška uopće: obje mjere u jedno polje.
      if (/^\s*\d+([.,]\d+)?\s*[x×*]\s*\d+/i.test(upisano)) {
        return {
          polje: putanja,
          poruka: 'Visina i širina upisuju se u dva odvojena polja, samo brojke. ' +
            `Za djelo 50 × 70 cm upišite 50 u polje „Visina" i 70 u polje „Širina". „cm" ne treba pisati.`,
        };
      }
      // Druga najčešća: cijena s valutom ili riječima.
      if (putanja === 'cijena') {
        return {
          polje: putanja,
          poruka: `Cijena se upisuje samo brojkama, bez znaka € i bez riječi. ` +
            `Umjesto „${upisano}" upišite npr. 1200. ` +
            'Ako cijenu ne želite objaviti, označite „Cijena na upit".',
        };
      }
      return {
        polje: putanja,
        poruka: `„${naziv}" se upisuje samo brojkama — bez slova, znakova i razmaka.` +
          (upisano ? ` Upisano je: „${upisano}".` : ''),
      };
    }
    if (i.code === 'invalid_type') {
      return { polje: putanja, poruka: `„${naziv}" nije ispravno upisano.` };
    }
    if (i.code === 'too_small') {
      if (i.origin === 'array') {
        return { polje: putanja, poruka: `Treba dodati barem ${i.minimum} — ${naziv.toLowerCase()}.` };
      }
      if (i.origin === 'string') {
        return { polje: putanja, poruka: `„${naziv}" je prekratko — treba imati barem ${i.minimum} znaka.` };
      }
      return { polje: putanja, poruka: `„${naziv}" mora biti barem ${i.minimum}.` };
    }
    if (i.code === 'too_big') {
      if (i.origin === 'string') {
        return { polje: putanja, poruka: `„${naziv}" je predugačko — najviše ${i.maximum} znakova.` };
      }
      if (i.origin === 'array') {
        return { polje: putanja, poruka: `Previše odabrano u „${naziv}" — najviše ${i.maximum}.` };
      }
      return { polje: putanja, poruka: `„${naziv}" ne može biti veće od ${i.maximum}.` };
    }
    if (i.code === 'invalid_value' || i.code === 'invalid_enum_value') {
      const popis = POPISI[putanja];
      return {
        polje: putanja,
        poruka: popis
          ? `Odaberite „${naziv}" s popisa. Ponuđeno je: ${popis.join(', ')}.`
          : `Vrijednost u polju „${naziv}" nije s ponuđenog popisa.`,
      };
    }
    if (i.code === 'invalid_format') {
      return { polje: putanja, poruka: `„${naziv}" je upisano u obliku koji nije dopušten.` };
    }
    return { polje: putanja, poruka: `„${naziv}" nije ispravno upisano.` };
  });
}

/**
 * Iz obrasca stižu svi podaci kao tekst — ovdje se pretvaraju u prave tipove.
 *
 * Neupotrebljiv broj („50x70", „1.200 eura") se NAMJERNO propušta dalje kao
 * tekst, a ne pretvara u NaN. Zod tada javi „očekivan broj, upisan tekst" i
 * ona dobije poruku koja objašnjava grešku — dok NaN izgleda kao prazno polje
 * i proizvede beskorisno „nedostaje podatak".
 */
function normaliziraj(ulaz) {
  const broj = (v) => {
    if (v === '' || v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  };
  const bool = (v) => v === true || v === 'true' || v === 'on' || v === '1';
  const niz = (v) => (Array.isArray(v) ? v : v ? [v] : []);

  const d = {
    ...ulaz,
    godina: broj(ulaz.godina),
    godina_priblizna: bool(ulaz.godina_priblizna),
    uokvireno: bool(ulaz.uokvireno),
    istaknuto: bool(ulaz.istaknuto),
    cijena_na_upit: bool(ulaz.cijena_na_upit),
    cijena: broj(ulaz.cijena),
    redoslijed: broj(ulaz.redoslijed) ?? 0,
    teme: niz(ulaz.teme),
    namjena: niz(ulaz.namjena),
    oznake: niz(ulaz.oznake).filter(Boolean),
    povezani_radovi: niz(ulaz.povezani_radovi).filter(Boolean),
    dimenzije: {
      visina_cm: broj(ulaz.visina_cm ?? ulaz.dimenzije?.visina_cm),
      sirina_cm: broj(ulaz.sirina_cm ?? ulaz.dimenzije?.sirina_cm),
      dubina_cm: broj(ulaz.dubina_cm ?? ulaz.dimenzije?.dubina_cm),
    },
    slike: niz(ulaz.slike).map((s, i) => ({
      datoteka: s.datoteka,
      uloga: s.uloga || (i === 0 ? 'glavna' : 'detalj'),
      alt_hr: s.alt_hr || '',
      potpis: s.potpis || undefined,
      sirina_px: broj(s.sirina_px),
      visina_px: broj(s.visina_px),
    })),
  };

  // Prazan tekst je „nije upisano", ne prazan string — inače djelomičan
  // engleski prolazi provjeru koja bi ga trebala uhvatiti.
  for (const k of ['naslov_en', 'slug_en', 'opis_en', 'meta_naslov', 'meta_opis',
                   'ikonografska_biljeska', 'ciklus', 'zbirka_vlasnik', 'opis_okvira', 'podloga']) {
    if (d[k] === '' || d[k] == null) delete d[k];
  }
  if (!d.datum_prodaje) delete d.datum_prodaje;
  if (d.cijena === undefined) delete d.cijena;

  delete d.visina_cm; delete d.sirina_cm; delete d.dubina_cm; delete d.opis_hr;
  return d;
}

/** Redoslijed kojim greške izlaze — isti kao redoslijed polja u obrascu. */
const REDOSLIJED = [
  'slike', 'naslov_hr', 'opis_hr', 'tehnika', 'godina',
  'dimenzije.visina_cm', 'dimenzije.sirina_cm', 'status', 'cijena',
  'datum_prodaje', 'kategorija', 'teme', 'podloga', 'opis_okvira',
  'naslov_en', 'opis_en', 'slug_en', 'slug',
];
const poredak = (p) => {
  const i = REDOSLIJED.indexOf(p);
  return i === -1 ? REDOSLIJED.length : i;
};

async function validiraj(podaci, tijelo) {
  const rez = SHEMA.safeParse(podaci);

  if (!rez.success) {
    const zodGreske = prevediZod(rez, podaci);
    // Pravila se provjeravaju i kad Zod padne. Inače ona ispravi sedam stvari,
    // spremi, pa TEK TADA sazna da je opis prekratak — i tako u krug.
    let pravila = [];
    try { pravila = provjeriPravila(podaci, tijelo); } catch { /* nepotpuni podaci, preskačemo */ }
    const vecPrijavljeno = new Set(zodGreske.map((g) => g.polje));
    const sve = [...zodGreske, ...pravila.filter((p) => !vecPrijavljeno.has(p.polje))];
    return { ok: false, greske: sve.sort((a, b) => poredak(a.polje) - poredak(b.polje)) };
  }

  const pravila = provjeriPravila(rez.data, tijelo);
  if (pravila.length) {
    return {
      ok: false,
      greske: pravila.sort((a, b) => poredak(a.polje) - poredak(b.polje)),
      podaci: rez.data,
    };
  }
  return { ok: true, podaci: rez.data };
}

export function createAtelier(storage, { online = false, siteUrl = '' } = {}) {
  const { citajRegistar, popisRadova, citajRad, spremiRad, arhivirajRad, zabiljezi, jeGitRepo } = storage;
  const app = new Hono();
  app.onError((error, c) => {
    if (!error.status) console.error('Atelier request failed:', error.name);
    return c.json({ ok: false, poruka: error.status ? error.message : 'Spremanje nije uspjelo. Pokušajte ponovno; uneseni podaci ostaju u obrascu.' }, error.status || 500);
  });

  app.get('/slicica/:ime', async (c) => {
    const ime = path.basename(c.req.param('ime'));
    try {
      const buffer = await storage.citajSliku(ime);
      if (!buffer) return c.notFound();
      return c.body(await napraviSlicicu(buffer), 200, {
        'content-type': 'image/jpeg',
        'cache-control': 'no-store',
      });
    } catch {
      return c.notFound();
    }
  });

  // -------------------------------------------------- API

  app.get('/api/zdravlje', (c) => c.json({ ok: true, atelier: true }));

  app.get('/api/sifrarnici', async (c) => {
    const radovi = await popisRadova();
    const postojeciCiklusi = [...new Set(radovi.map((r) => r.podaci?.ciklus).filter(Boolean))];
    return c.json({
      tehnike: TEHNIKE, podloge: PODLOGE, teme: TEME, namjene: NAMJENE,
      statusi: STATUSI.map((s) => ({ id: s, opis: STATUS_OPIS[s] })),
      uloge: ULOGE_SLIKE.map((u) => ({ id: u, opis: ULOGA_OPIS[u] })),
      kategorije: KATEGORIJE,
      ciklusi: postojeciCiklusi,
      git: await jeGitRepo(),
      stranicaUrl: siteUrl,
      online,
    });
  });

  app.get('/api/djela', async (c) => {
    const radovi = await popisRadova();
    return c.json(radovi.map((r) => ({
      slug: r.slug,
      greska: r.greska ?? null,
      id: r.podaci?.id ?? null,
      naslov: r.podaci?.naslov_hr ?? '(bez naslova)',
      stanje: r.podaci?.stanje_objave ?? 'skica',
      status: r.podaci?.status ?? null,
      godina: r.podaci?.godina ?? null,
      cijena: r.podaci?.cijena ?? null,
      istaknuto: Boolean(r.podaci?.istaknuto),
      imaEngleski: Boolean(r.podaci?.naslov_en && r.podaci?.opis_en),
      slika: r.podaci?.slike?.[0]?.datoteka
        ? path.basename(String(r.podaci.slike[0].datoteka)) : null,
    })));
  });

  app.get('/api/djela/:slug', async (c) => {
    const rad = await citajRad(c.req.param('slug'));
    if (!rad) return greska(c, 'Taj rad ne postoji.', 404);
    return c.json({ ok: true, podaci: rad.podaci, opis_hr: rad.tijelo, revision: rad.revision });
  });

  app.get('/api/slug/provjera', async (c) => {
    const zeljeni = slugify(c.req.query('naslov') ?? '');
    const zaId = c.req.query('id') || null;
    const godina = c.req.query('godina') || null;
    const registar = await citajRegistar();
    if (!zeljeni) return c.json({ slug: '', slobodan: false });
    const slobodan = jeSlobodan(registar, zeljeni, zaId);
    return c.json({
      slug: zeljeni,
      slobodan,
      prijedlog: slobodan ? zeljeni : predloziSlobodan(registar, zeljeni, { godina, zaId }),
    });
  });

  /** Provjera bez pisanja — pokreće je obrazac prije spremanja. */
  app.post('/api/provjera', async (c) => {
    const t = await c.req.json();
    const rez = await validiraj(normaliziraj(t.podaci ?? {}), t.opis_hr ?? '');
    return c.json({ ok: rez.ok, greske: rez.greske ?? [] });
  });

  app.post('/api/slike', async (c) => {
    try {
      const forma = await c.req.formData();
      const datoteke = forma.getAll('slike').filter((f) => typeof f === 'object');
      const osnova = String(forma.get('osnova') ?? '') || 'slika';
      if (!datoteke.length) return greska(c, 'Nijedna fotografija nije primljena.');

      const rezultat = [];
      let redni = Number(forma.get('pocetniBroj') ?? 1);

      // Namjerno sekvencijalno: sharp koristi libuv thread pool, a paralelno
      // po 20 fotografija od 30 MP zna pojesti gigabajte i izgledati kao da
      // se program zamrznuo.
      for (const f of datoteke) {
        try {
          const ulaz = Buffer.from(await f.arrayBuffer());
          const obradena = await obradiSliku(ulaz, f.name, {
            osnovaImena: `${osnova}-${redni}-${crypto.randomUUID().slice(0, 8)}`,
          });
          await storage.spremiSliku(obradena.ime, obradena.buffer);
          rezultat.push({
            ok: true,
            datoteka: `./slike/${obradena.ime}`,
            ime: obradena.ime,
            sirina_px: obradena.sirina,
            visina_px: obradena.visina,
            upozorenja: obradena.upozorenja,
            izvorno: obradena.izvorno,
          });
          redni++;
        } catch (e) {
          rezultat.push({
            ok: false,
            ime: f.name,
            poruka: e instanceof GreskaSlike ? e.message
              : `Fotografiju „${f.name}" nije bilo moguće obraditi.`,
          });
        }
      }
      if (rezultat.some((s) => s.ok)) await zabiljezi('Atelier: fotografije');
      return c.json({ ok: true, slike: rezultat });
    } catch (e) {
      return greska(c, e.status ? e.message : 'Slanje fotografija nije uspjelo. Pokušajte ponovno.', e.status || 500);
    }
  });

  app.post('/api/djela', async (c) => {
    const t = await c.req.json();
    const postojeci = (await popisRadova()).map((r) => r.podaci?.id).filter(Boolean);
    const registar = await citajRegistar();

    const ulaz = normaliziraj(t.podaci ?? {});
    ulaz.id = sljedeciId([...postojeci, ...registar.map((r) => r.id)]);
    ulaz.slug = ulaz.slug || predloziSlobodan(registar, ulaz.naslov_hr ?? '', { godina: ulaz.godina });
    if (!jeSlobodan(registar, ulaz.slug) || await citajRad(ulaz.slug)) return greska(c, 'Ta web adresa već postoji. Odaberite drugi naziv.', 409);
    ulaz.datum_objave = ulaz.datum_objave || new Date();
    ulaz.datum_izmjene = new Date();

    const rez = await validiraj(ulaz, t.opis_hr ?? '');
    if (!rez.ok) return c.json({ ok: false, greske: rez.greske }, 422);

    await spremiRad(rez.podaci.slug, rez.podaci, t.opis_hr ?? '');
    const g = await zabiljezi(`Atelier: novo djelo „${rez.podaci.naslov_hr}"`);
    return c.json({ ok: true, slug: rez.podaci.slug, id: rez.podaci.id, git: g });
  });

  app.put('/api/djela/:slug', async (c) => {
    const slug = c.req.param('slug');
    const stari = await citajRad(slug);
    if (!stari) return greska(c, 'Taj rad ne postoji.', 404);

    const t = await c.req.json();
    if (online && t.revision !== stari.revision) return greska(c, 'Rad je u međuvremenu promijenjen. Kopirajte svoje izmjene pa ponovno otvorite rad.', 409);
    const ulaz = normaliziraj({ ...stari.podaci, ...t.podaci });

    // Adresa objavljenog rada je zamrznuta: promjena bi pokvarila svaku vezu
    // koju je nekome poslala i svaki link koji je stranica skupila.
    if (stari.podaci.stanje_objave === 'objavljeno' && ulaz.slug && ulaz.slug !== slug) {
      return c.json({
        ok: false,
        greske: [{
          polje: 'slug',
          poruka: 'Djelo je već objavljeno na ovoj web adresi. Promjena bi pokvarila sve veze koje ste nekome poslali. ' +
                  'Ako je adresa stvarno pogrešna, arhivirajte djelo i dodajte ga ponovno.',
        }],
      }, 422);
    }

    ulaz.slug = slug;
    ulaz.id = stari.podaci.id;
    ulaz.datum_objave = ulaz.datum_objave || stari.podaci.datum_objave || new Date();
    ulaz.datum_izmjene = new Date();

    const rez = await validiraj(ulaz, t.opis_hr ?? '');
    if (!rez.ok) return c.json({ ok: false, greske: rez.greske }, 422);

    await spremiRad(slug, rez.podaci, t.opis_hr ?? '');
    const g = await zabiljezi(`Atelier: izmjena „${rez.podaci.naslov_hr}"`);
    return c.json({ ok: true, slug, git: g });
  });

  /** Označi prodano — jedan klik, bez otvaranja cijelog obrasca. */
  app.post('/api/djela/:slug/prodano', async (c) => {
    const slug = c.req.param('slug');
    const rad = await citajRad(slug);
    if (!rad) return greska(c, 'Taj rad ne postoji.', 404);

    const tijelo = await c.req.json().catch(() => ({}));
    if (online && tijelo.revision !== rad.revision) return greska(c, 'Rad je promijenjen. Ponovno ga otvorite prije spremanja.', 409);
    const podaci = { ...rad.podaci };
    podaci.status = 'prodano';
    podaci.datum_prodaje = tijelo.datum || new Date().toISOString().slice(0, 10);
    podaci.datum_izmjene = new Date();
    // Cijena se ne briše iz datoteke (podatak je njoj koristan), ali je
    // stranica i JSON-LD više ne prikazuju jer je status prodano.

    const rez = await validiraj(normaliziraj(podaci), rad.tijelo);
    if (!rez.ok) return c.json({ ok: false, greske: rez.greske }, 422);

    await spremiRad(slug, rez.podaci, rad.tijelo);
    await zabiljezi(`Atelier: prodano „${rez.podaci.naslov_hr}"`);
    return c.json({ ok: true });
  });

  app.post('/api/djela/:slug/stanje', async (c) => {
    const slug = c.req.param('slug');
    const rad = await citajRad(slug);
    if (!rad) return greska(c, 'Taj rad ne postoji.', 404);

    const { stanje, revision } = await c.req.json();
    if (online && revision !== rad.revision) return greska(c, 'Rad je promijenjen. Ponovno ga otvorite prije spremanja.', 409);
    const podaci = { ...rad.podaci, stanje_objave: stanje, datum_izmjene: new Date() };

    const rez = await validiraj(normaliziraj(podaci), rad.tijelo);
    if (!rez.ok) return c.json({ ok: false, greske: rez.greske }, 422);

    await spremiRad(slug, rez.podaci, rad.tijelo);
    await zabiljezi(`Atelier: ${stanje} „${rez.podaci.naslov_hr}"`);
    return c.json({ ok: true });
  });

  app.post('/api/djela/:slug/arhiviraj', async (c) => {
    const slug = c.req.param('slug');
    const rad = await citajRad(slug);
    if (!rad) return greska(c, 'Taj rad ne postoji.', 404);
    const t = await c.req.json();
    if (online && t.revision !== rad.revision) return greska(c, 'Rad je promijenjen. Ponovno ga otvorite prije arhiviranja.', 409);
    await arhivirajRad(slug);
    await zabiljezi(`Atelier: arhivirano „${slug}"`);
    return c.json({ ok: true });
  });


  return app;
}
