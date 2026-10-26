/**
 * Slikovni sitemap.
 *
 * Na stranici slikarice ovo je najvažniji pojedinačni SEO element: velik dio
 * ljudi do rada dolazi preko Google Images, a ne preko teksta. Bez ovoga Google
 * mora sam pogoditi koje su slike sadržaj, a koje ukras.
 *
 * Zašto zaseban endpoint, a ne `serialize()` u @astrojs/sitemap: ubacivanje
 * `img` kroz serialize RADI, ali kroz netipiziran prolaz koji nije dokumentiran
 * i koji održavatelji mogu zatvoriti u bilo kojoj verziji. Ovdje se koriste
 * samo dokumentirani API-ji, a datoteka se u sitemap-index dodaje preko
 * `customSitemaps`.
 *
 * Emitira se SAMO <image:loc> — caption, title, license i geo_location su
 * povučeni iz Googleove specifikacije.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';

import { site, apsolutno } from '../site.config.mjs';
import { jeObjavljen, imaEngleski, putanjaRada } from '../core/rad.mjs';

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const radovi = (await getCollection('radovi')).filter(jeObjavljen);
  const unosi: string[] = [];

  for (const rad of radovi) {
    // Sve fotografije jednog djela pripadaju njegovoj stranici.
    const slike: string[] = [];
    for (const s of rad.data.slike) {
      try {
        const v = await getImage({
          src: s.datoteka, width: 1600, format: 'webp', quality: 82, fit: 'contain',
        });
        slike.push(apsolutno(v.src));
      } catch { /* slika koja se ne da obraditi ne ruši sitemap */ }
    }
    if (!slike.length) continue;

    const blok = (putanja: string) =>
      `  <url>\n    <loc>${esc(apsolutno(putanja))}</loc>\n` +
      slike.map((u) => `    <image:image>\n      <image:loc>${esc(u)}</image:loc>\n    </image:image>`).join('\n') +
      `\n  </url>`;

    unosi.push(blok(putanjaRada(rad, 'hr')));
    // Engleska stranica postoji samo ako je rad stvarno preveden.
    if (imaEngleski(rad)) unosi.push(blok(putanjaRada(rad, 'en')));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${unosi.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
