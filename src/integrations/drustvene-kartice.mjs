/**
 * Generira slike za dijeljenje (og:image) u trenutku builda.
 *
 * PROBLEM KOJI RJEŠAVA: og:image mora biti 1200×630 (položeno), a slike djela
 * su često uspravne. Ako se uspravna ikona preda kao og:image, Facebook i X je
 * obrežu po sredini — i podijeli se slika Bogorodice s odrezanom glavom.
 * Zato se slika UMEĆE u pergamentnu podlogu (contain), nikad ne obrezuje.
 *
 * Tekst se crta kroz sharp + SVG, ne kroz satori: provjereno je da sharp
 * ispravno renderira č ć š ž đ Č Ć Š Ž Đ, pa satori, dodatni font i woff/woff2
 * problem otpadaju. Cijena je oslanjanje na sistemske fontove — zato dolje
 * postoji zaštita koja ruši build ako se kvačice ne nacrtaju.
 */

import sharp from 'sharp';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PERGAMENT = '#F6EFE1';
const UVUCENO = '#EDE2CD';
const TEKST = '#241F17';
const TIHO = '#665A45';
const ZLATO = '#96761C';
const FONT = "Georgia, 'Times New Roman', 'Liberation Serif', serif";

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * Prosječna širina znaka u odnosu na veličinu fonta, za Georgiju/serif.
 * Ne postoji mjerenje teksta bez učitavanja fonta, pa se procjenjuje — i to
 * NAMJERNO konzervativno, jer je predugačak redak (koji izađe izvan kartice)
 * puno gori od malo premalog fonta.
 */
const OMJER_ZNAKA = 0.54;

function prelomiURedke(tekst, maxZnakova) {
  const redci = [];
  let red = '';
  for (const rijec of String(tekst).split(/\s+/).filter(Boolean)) {
    // Riječ dulja od retka se lomi, inače probije rub kartice.
    if (rijec.length > maxZnakova) {
      if (red) { redci.push(red); red = ''; }
      for (let i = 0; i < rijec.length; i += maxZnakova) redci.push(rijec.slice(i, i + maxZnakova));
      continue;
    }
    if ((red + ' ' + rijec).trim().length > maxZnakova && red) { redci.push(red); red = rijec; }
    else red = (red + ' ' + rijec).trim();
  }
  if (red) redci.push(red);
  return redci;
}

/**
 * Traži najveću veličinu fonta pri kojoj naslov stane u zadanu širinu i
 * najviše `maxRedaka` redaka. Bez ovoga dugački hrvatski naslovi
 * („Bogorodica s Djetetom i svetim Josipom") izađu izvan kartice.
 */
function slozi(tekst, sirinaPx, pocetnaVelicina, maxRedaka) {
  let velicina = pocetnaVelicina;
  for (let korak = 0; korak < 14; korak++) {
    const maxZnakova = Math.max(8, Math.floor(sirinaPx / (velicina * OMJER_ZNAKA)));
    const redci = prelomiURedke(tekst, maxZnakova);
    if (redci.length <= maxRedaka) return { redci, velicina };
    velicina = Math.round(velicina * 0.92);
  }
  const maxZnakova = Math.max(8, Math.floor(sirinaPx / (velicina * OMJER_ZNAKA)));
  const redci = prelomiURedke(tekst, maxZnakova).slice(0, maxRedaka);
  redci[redci.length - 1] = `${redci[redci.length - 1].slice(0, maxZnakova - 1)}…`;
  return { redci, velicina };
}

/**
 * ZAŠTITA OD TOFU KVADRATIĆA.
 *
 * sharp crta tekst sistemskim fontovima. Ako na stroju koji radi build nema
 * fonta s Latin Extended-A, kvačice se nacrtaju kao prazni kvadratići — i to
 * se otkrije tek kad netko podijeli link. Ovdje se nacrtaju „ČĆŠŽĐ" i „CCSZD"
 * pa se usporedi količina tinte: tofu kvadratić je znatno gušći od slova.
 */
export async function provjeriKvacice() {
  const nacrtaj = async (tekst) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="10" y="80" font-family="${FONT}" font-size="60" fill="#000000">${esc(tekst)}</text>
    </svg>`;
    const { data } = await sharp(Buffer.from(svg)).greyscale().raw()
      .toBuffer({ resolveWithObject: true });
    let tamni = 0;
    for (let i = 0; i < data.length; i++) if (data[i] < 128) tamni++;
    return tamni;
  };

  const sKvacicama = await nacrtaj('ČĆŠŽĐ');
  const bez = await nacrtaj('CCSZD');

  if (sKvacicama === 0) {
    throw new Error(
      'Kartice za dijeljenje: tekst se uopće ne crta. Na ovom računalu sharp nema font.'
    );
  }
  // Kvačice dodaju malo tinte iznad slova; kvadratići je udvostruče.
  const omjer = sKvacicama / Math.max(bez, 1);
  if (omjer > 2.2) {
    throw new Error(
      'Kartice za dijeljenje: hrvatske kvačice se crtaju kao prazni kvadratići ' +
      `(omjer tinte ${omjer.toFixed(2)}). Na ovom računalu nema fonta s Latin Extended-A. ` +
      'Build je zaustavljen da se ne objave kartice s kvadratićima umjesto slova.'
    );
  }
  return { omjer };
}

/** Jedna kartica: slika umetnuta u pergament + naslov i potpis u sigurnoj zoni. */
async function nacrtajKarticu({ slika, naslov, podnaslov, autor, sirina, visina, uspravna }) {
  const margina = Math.round(sirina * 0.045);
  const okvir = uspravna
    // Pinterest 1000×1500: slika gore, tekst dolje.
    ? { x: margina, y: margina, w: sirina - margina * 2, h: Math.round(visina * 0.62) }
    // og 1200×630: slika lijevo, tekst desno.
    : { x: margina, y: margina, w: Math.round(sirina * 0.42), h: visina - margina * 2 };

  const podloga = sharp({
    create: { width: sirina, height: visina, channels: 3, background: PERGAMENT },
  });

  // fit: 'inside' = NIKAD ne reže. Ovo je cijela poanta ove datoteke.
  const umetnuta = await sharp(slika)
    .rotate()
    .resize({ width: okvir.w, height: okvir.h, fit: 'inside', withoutEnlargement: false })
    .toBuffer({ resolveWithObject: true });

  const sx = okvir.x + Math.round((okvir.w - umetnuta.info.width) / 2);
  const sy = okvir.y + Math.round((okvir.h - umetnuta.info.height) / 2);

  const tekstX = uspravna ? margina : okvir.x + okvir.w + Math.round(sirina * 0.05);
  const tekstSirina = uspravna ? sirina - margina * 2 : sirina - tekstX - margina;

  // Veličina se prilagođava naslovu, a ne obrnuto.
  const { redci: redciNaslova, velicina: velNaslov } =
    slozi(naslov, tekstSirina, Math.round(sirina * (uspravna ? 0.062 : 0.052)), 3);
  const velManji = Math.round(velNaslov * 0.46);

  const podnaslovRedci = prelomiURedke(
    podnaslov, Math.max(10, Math.floor(tekstSirina / (velManji * OMJER_ZNAKA)))
  ).slice(0, 2);

  const baza = uspravna
    ? okvir.y + okvir.h + Math.round(visina * 0.07)
    : Math.round(visina / 2) - Math.round((redciNaslova.length - 1) * velNaslov * 0.6);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sirina}" height="${visina}">
    <rect x="${sx - 1}" y="${sy - 1}" width="${umetnuta.info.width + 2}" height="${umetnuta.info.height + 2}"
          fill="none" stroke="${UVUCENO}" stroke-width="2"/>
    <rect x="${tekstX}" y="${baza - velNaslov * 1.6}" width="72" height="2" fill="${ZLATO}"/>
    ${redciNaslova.map((r, i) => `<text x="${tekstX}" y="${baza + i * velNaslov * 1.22}"
        font-family="${FONT}" font-size="${velNaslov}" fill="${TEKST}">${esc(r)}</text>`).join('\n')}
    ${podnaslovRedci.map((r, i) => `<text x="${tekstX}"
        y="${baza + redciNaslova.length * velNaslov * 1.22 + velManji * (0.6 + i * 1.25)}"
        font-family="${FONT}" font-size="${velManji}" fill="${TIHO}">${esc(r)}</text>`).join('\n')}
    <text x="${tekstX}" y="${visina - margina - velManji * 0.3}"
          font-family="${FONT}" font-size="${velManji}" fill="${TIHO}"
          letter-spacing="${velManji * 0.08}">${esc(autor)}</text>
  </svg>`;

  return podloga
    .composite([
      { input: umetnuta.data, left: sx, top: sy },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

/** XMP paket s autorstvom. Astro/sharp inače strgaju sve metapodatke. */
function xmp({ naslov, autor, godina, licencaUrl }) {
  const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
    xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${e(naslov)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${e(autor)}</rdf:li></rdf:Seq></dc:creator>
   <dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© ${e(godina)} ${e(autor)}</rdf:li></rdf:Alt></dc:rights>
   <photoshop:Credit>${e(autor)}</photoshop:Credit>
   <xmpRights:Marked>True</xmpRights:Marked>
   <xmpRights:WebStatement>${e(licencaUrl)}</xmpRights:WebStatement>
   <plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource">
     <plus:LicensorName>${e(autor)}</plus:LicensorName>
     <plus:LicensorURL>${e(licencaUrl)}</plus:LicensorURL>
   </rdf:li></rdf:Seq></plus:Licensor>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

async function spremi(cjevovod, meta, putanja) {
  let s = sharp(cjevovod);
  // withXmp postoji od sharp 0.34.3; ako ga nema, slika se svejedno spremi.
  if (typeof s.withXmp === 'function') s = s.withXmp(xmp(meta));
  await s.jpeg({ quality: 88, mozjpeg: true }).toFile(putanja);
}

/**
 * Astro integracija. `astro:build:done` je ispravna kuka jer se izvršava NAKON
 * što je dist/ zapisan — ništa poslije ne može strgati XMP koji smo upravo
 * ugradili.
 */
export default function drustveneKartice({ radovi, autor, licencaUrl, izlaz = 'social' }) {
  return {
    name: 'drustvene-kartice',
    hooks: {
      async 'astro:build:done'({ dir, logger }) {
        // fileURLToPath, NIKAD dir.pathname: na Windowsu pathname daje
        // "/C:/Users/..." s vodećom kosom crtom i svaki fs poziv padne.
        const korijen = fileURLToPath(dir);
        const odrediste = path.join(korijen, izlaz);
        await mkdir(odrediste, { recursive: true });

        const { omjer } = await provjeriKvacice();
        logger.info(`kvačice se crtaju ispravno (omjer tinte ${omjer.toFixed(2)})`);

        const stavke = await radovi();

        // Zadana kartica za stranice bez djela (naslovnica, kontakt…).
        const zadanaSlika = stavke[0]?.slika;
        if (zadanaSlika) {
          await spremi(
            await nacrtajKarticu({
              slika: zadanaSlika, naslov: 'Ručno slikane sakralne slike',
              podnaslov: 'Originali i narudžbe', autor,
              sirina: 1200, visina: 630, uspravna: false,
            }),
            { naslov: 'Sakralno slikarstvo', autor, godina: new Date().getFullYear(), licencaUrl },
            path.join(odrediste, 'zadana-og.jpg')
          );
        }

        let n = 0;
        for (const r of stavke) {
          try {
            await spremi(
              await nacrtajKarticu({
                slika: r.slika, naslov: r.naslov, podnaslov: r.podnaslov, autor,
                sirina: 1200, visina: 630, uspravna: false,
              }),
              { naslov: r.naslov, autor, godina: r.godina, licencaUrl },
              path.join(odrediste, `${r.slug}-og.jpg`)
            );
            await spremi(
              await nacrtajKarticu({
                slika: r.slika, naslov: r.naslov, podnaslov: r.podnaslov, autor,
                sirina: 1000, visina: 1500, uspravna: true,
              }),
              { naslov: r.naslov, autor, godina: r.godina, licencaUrl },
              path.join(odrediste, `${r.slug}-pin.jpg`)
            );
            n++;
          } catch (e) {
            logger.error(`kartica za „${r.slug}" nije napravljena: ${e.message}`);
            throw e;
          }
        }
        logger.info(`${n * 2 + (zadanaSlika ? 1 : 0)} slika za dijeljenje u ${izlaz}/`);
      },
    },
  };
}
