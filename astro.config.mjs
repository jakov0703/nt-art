import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import matter from 'gray-matter';

import { site } from './src/site.config.mjs';
import drustveneKartice from './src/integrations/drustvene-kartice.mjs';

/** Čita objavljene radove izravno s diska — integracija se izvršava izvan Astrova konteksta. */
async function objavljeniRadovi() {
  const dir = path.resolve('./src/content/radovi');
  const out = [];
  for (const d of (await readdir(dir)).filter((x) => x.endsWith('.md'))) {
    const { data } = matter(await readFile(path.join(dir, d), 'utf8'));
    if (data.stanje_objave !== 'objavljeno') continue;
    const glavna = (data.slike ?? []).find((s) => s.uloga === 'glavna') ?? data.slike?.[0];
    if (!glavna) continue;
    out.push({
      slug: data.slug,
      naslov: data.naslov_hr,
      godina: data.godina,
      podnaslov: `${data.tehnika}, ${data.godina}. · ${data.dimenzije.visina_cm} × ${data.dimenzije.sirina_cm} cm`,
      slika: path.resolve(dir, String(glavna.datoteka)),
    });
  }
  return out;
}

export default defineConfig({
  site: site.url,

  // Astro 7 je promijenio default na 'jsx', što tiho pojede razmak između
  // elemenata: <span>zdravo</span><em>svijete</em> postane "zdravosvijete".
  // Na stranici punoj teksta to je neprihvatljivo.
  compressHTML: true,

  trailingSlash: 'always',
  build: { format: 'directory' },

  // Routing gradimo sami (src/pages = hrvatski, src/pages/en = engleski) jer
  // Astrov i18n ne zna mapirati /radovi/x <-> /en/works/y. Ovaj config je tu
  // zbog helpera i eksplicitnosti, ne zbog rutanja.
  i18n: {
    defaultLocale: 'hr',
    locales: ['hr', 'en'],
    routing: { prefixDefaultLocale: false },
  },

  image: {
    // sharp je default i jedini ugrađeni servis (squoosh je uklonjen).
    // limitInputPixels: false jer skenovi velikih platna znaju prijeći default.
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: { limitInputPixels: false },
    },
    // `layout` NAMJERNO nije postavljen globalno: od v6 zadavanje i width i
    // height REŽE sliku umjesto da je deformira, a na stranici sa slikama to
    // znači odrezane glave. Svaka slika djela ide kroz <Slika/> koji uvijek
    // koristi fit: 'contain' i nikad ne zadaje oba.
  },

  integrations: [
    drustveneKartice({
      radovi: objavljeniRadovi,
      autor: site.naziv,
      licencaUrl: `${site.url}/privatnost/`,
    }),
    sitemap({
      // Slikovni sitemap je vlastiti endpoint (samo dokumentirani API-ji),
      // pa se ovdje samo prijavi u sitemap-index.xml.
      customSitemaps: [`${site.url}/sitemap-slike.xml`],
      // Skice, arhiva i zahvala ne idu u sitemap.
      filter: (stranica) =>
        !stranica.includes('/hvala/') &&
        !stranica.includes('/404'),
      // i18n opcija NAMJERNO nije korištena: ona pretpostavlja zrcalne
      // putanje, a naši slugovi se razlikuju po jeziku. hreflang emitiramo
      // u <head>. Jedna metoda, ne obje.
      serialize(stavka) {
        if (stavka.url === site.url + '/') stavka.priority = 1.0;
        return stavka;
      },
    }),
  ],

  vite: {
    server: { fs: { strict: true } },
  },
});
