/**
 * Obrada fotografija pri unosu.
 *
 * Ovo je JEDINA točka kroz koju slika ulazi u projekt — i iz Ateliera i iz
 * CLI-a. Razlog: putanja datoteke i zapis u frontmatteru moraju nastati iz
 * istog koda. Kad se razdvoje, prvi rad koji doda pukne s "slika ne postoji",
 * a ona nema kako to sama popraviti.
 */

import sharp from 'sharp';
import { MIN_SIRINA_SLIKE, PREPORUCENA_SIRINA } from './shema.mjs';
import { slugify } from './slug.mjs';

/** Master se arhivira na 2400px; najveća izvedenica koja se isporučuje je 2000px. */
export const MAX_MASTER = 2400;

const HEIC = /^(heic|heif)$/i;

function ekstenzija(ime) {
  const t = String(ime).lastIndexOf('.');
  return t > 0 ? ime.slice(t + 1).toLowerCase() : '';
}

/**
 * @returns {Promise<{buffer: Buffer, sirina: number, visina: number,
 *   ime: string, upozorenja: string[], izvorno: {sirina:number,visina:number,format:string}}>}
 */
export async function obradiSliku(ulaz, imeDatoteke, { osnovaImena } = {}) {
  const upozorenja = [];
  let buffer = ulaz;

  // iPhone šalje HEIC. sharp ga na Windowsu u pravilu ne čita bez dodatnog
  // libheifa, pa ga prvo dekodiramo čistim JS-om.
  if (HEIC.test(ekstenzija(imeDatoteke))) {
    try {
      const { default: heicConvert } = await import('heic-convert');
      buffer = Buffer.from(
        await heicConvert({ buffer: ulaz, format: 'JPEG', quality: 0.95 })
      );
    } catch (e) {
      throw new GreskaSlike(
        'Ova fotografija je u HEIC formatu (tako ih sprema iPhone) i nije ju bilo moguće otvoriti. ' +
        'Na iPhoneu: Postavke → Kamera → Formati → odaberite „Najkompatibilnije", ' +
        'pa ponovno fotografirajte. Ili pošaljite fotografiju sebi e-mailom — tako se obično pretvori u JPG.'
      );
    }
  }

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new GreskaSlike(
      'Ovu datoteku nije moguće otvoriti kao sliku. Provjerite je li to doista fotografija ' +
      '(JPG, PNG, HEIC ili TIFF), a ne npr. PDF ili dokument.'
    );
  }

  // .rotate() bez argumenta zapeče EXIF orijentaciju u same piksele. Bez toga
  // su fotografije s telefona zakrenute svugdje osim u Windows pregledniku.
  let cjevovod = sharp(buffer).rotate();

  const duziRub = Math.max(meta.width ?? 0, meta.height ?? 0);

  if (duziRub < MIN_SIRINA_SLIKE) {
    upozorenja.push(
      `Ova fotografija je mala (${meta.width}×${meta.height} točaka). ` +
      `Za lijep prikaz na stranici trebala bi imati barem ${PREPORUCENA_SIRINA} točaka po duljoj strani. ` +
      'Stranica NE povećava male fotografije — prikazat će se manja nego što biste htjeli i bit će mutna na velikom ekranu. ' +
      'Ako imate originalnu fotografiju s fotoaparata ili telefona (ne onu skinutu s Instagrama), upotrijebite nju.'
    );
  } else if (duziRub < PREPORUCENA_SIRINA) {
    upozorenja.push(
      `Fotografija je upotrebljiva, ali malo manja od preporučenog (${meta.width}×${meta.height}). ` +
      'Veća fotografija bolje izgleda pri povećanju.'
    );
  }

  if (meta.space === 'cmyk') {
    upozorenja.push(
      'Fotografija je bila u CMYK prostoru boja (tako izlaze datoteke pripremljene za tisak). ' +
      'Pretvorena je u sRGB za web — boje mogu izgledati malo drukčije nego u originalu.'
    );
  }

  if (duziRub > MAX_MASTER) {
    cjevovod = cjevovod.resize({
      width: MAX_MASTER, height: MAX_MASTER,
      fit: 'inside', withoutEnlargement: true,
    });
  }

  const izlaz = await cjevovod
    .toColorspace('srgb')
    .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer({ resolveWithObject: true });

  const osnova = slugify(osnovaImena || imeDatoteke.replace(/\.[^.]+$/, '')) || 'slika';

  return {
    buffer: izlaz.data,
    sirina: izlaz.info.width,
    visina: izlaz.info.height,
    ime: `${osnova}.jpg`,
    upozorenja,
    izvorno: { sirina: meta.width, visina: meta.height, format: meta.format },
  };
}

export class GreskaSlike extends Error {
  constructor(poruka) { super(poruka); this.name = 'GreskaSlike'; this.zaKorisnika = true; }
}

/** Sličica za nadzornu ploču Ateliera. Nikad se ne isporučuje na stranicu. */
export async function napraviSlicicu(buffer, sirina = 480) {
  return sharp(buffer).rotate()
    .resize({ width: sirina, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
}
