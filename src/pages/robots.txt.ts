/**
 * robots.txt — generiran, ne statičan, jer sadrži apsolutni URL sitemapa koji
 * ovisi o `site.url`. Statična datoteka bi pri promjeni domene tiho pokazivala
 * na staru.
 *
 * Namjerno permisivan. Najčešća greška na stranicama s puno slika je blokiranje
 * mapa sa slikama ili /_astro/ — time se ubije promet s Google Images, a to je
 * za slikaricu glavni kanal otkrivanja. CSS i JS se također NE blokiraju:
 * Google renderira stranicu i bez njih je vidi razbijenu.
 */
import type { APIRoute } from 'astro';
import { site } from '../site.config.mjs';

export const GET: APIRoute = () => {
  const tijelo = `# ${site.naziv}

User-agent: *
Allow: /

# Stranica zahvale nije sadržaj — nema je smisla indeksirati.
# (Nosi i noindex u <head>; ovdje NIJE Disallow, jer Disallow spriječi
#  čitanje noindexa i stranica onda ostane u indeksu bez opisa.)

# Nikad ne blokirati /_astro/ — tamo su optimizirane slike djela.

Sitemap: ${site.url}/sitemap-index.xml
`;

  return new Response(tijelo, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
