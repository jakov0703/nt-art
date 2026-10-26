# nikolina-art

Stranica za sakralnu umjetnost. Astro 7, statički izlaz, dvojezično (hr na
rootu, en pod `/en/`). Atelier radi lokalno i online na `/admin/`.
Online verzija zaštićena je prijavom i sprema radove/fotografije u GitHub;
Netlify zatim automatski ponovno gradi javnu stranicu.

**Netlify demo: [NETLIFY.md](NETLIFY.md)** — račun, varijable i provjera objave.

**Za nju:** `UPUTE-ZA-NIKOLINU.md`. **Za tebe:** ovo.

---

## Naredbe

```bash
npm run dev                 # stranica na :4321
npm run atelier             # samo admin sučelje na 127.0.0.1:4444
node scripts/pokreni.mjs    # oboje + otvori preglednik (ovo radi Atelier.cmd)

npm run provjeri            # validira sve radove + broji nepopunjene placeholdere
npm run provjeri-kontrast   # preračuna svaki par boja, pada na WCAG prekršaju
npm run build               # -> dist/
npm run primjeri            # vrati 4 primjera
npm run ocisti-primjere     # makni ih (u arhivu, ne briše)
npm run novi-rad            # CLI unos — rezervni put kad Atelier ne radi
```

---

## Stanje podataka

Sve potvrđeno od autorice **15.09.2026.** (ispunjen upitnik):

| | |
|---|---|
| Ime | Nikolina Tomić |
| Grad | Zagreb |
| E-mail | tnikolina41@gmail.com |
| Instagram | @nikoline.art (javan) |
| Smjer | zapadna devocijska slika — akril na platnu, impasto |
| Registrirana | **ne** → nema Organization čvora, nema uvjeta poslovanja |
| Cjenik | 40×50 → 50–100 €, 50×70 → 80–150 €, 70×100 → 150–300 € |
| Dostava | samo Hrvatska + osobno preuzimanje u Zagrebu |
| Predujam | ne traži |
| Po fotografiji | ne radi |
| Crkve/oltari | ne prima |
| Okvir | prodaje neuokvirene |
| Liturgijske boje | da (potvrdila) |

`npm run provjeri` → **„Spremno za objavu"**.

### Što još nedostaje

1. **Fotografija Presvetog Srca Isusova.** Jedini sakralni rad za koji je
   ispunila obrazac, ali fotografije nije poslala. Zato stranica trenutno
   NEMA nijedan sakralni rad — naslovnica i `/radovi/tema/sakralno` zato
   vode prema narudžbi umjesto da glume galeriju.
2. **„Laste u letu" su premalene.** Nakon izreza platna iz fotografije
   ostaje 1318×676 px, ispod praga od 2000 px. Rad je objavljen jer je
   stvaran, ali bi ga trebalo ponovno fotografirati (upute su u DIJELU 5
   upitnika).
3. **Engleski.** Rekla je „može", ali nijedan rad nema `opis_en`, pa
   `/en/works/` stoji prazan i pošteno upućuje na hrvatske stranice.
   Engleske stranice o njoj i o narudžbama su prevedene i točne.

### Što je uklonjeno jer ne odgovara njezinom radu

Ikonopisne tehnike (jajčana tempera, zlatni list, ikonopis, lipova daska),
tema „Ikone" i sav tekst o pisanju ikona i bizantskoj tradiciji. To je drugi
zanat koji ona ne radi — tekst bi obećavao nešto što ne može isporučiti.
Ako se jednom počne time baviti, vraća se u `src/core/taxonomije.mjs`.

**Ništa o njoj nije pretpostavljeno.** S Instagrama nije bilo moguće dohvatiti
nijedan podatak. Ne upisuj titulu („akademska slikarica"), školu ni nagradu bez
dokumenta — to su provjerljive tvrdnje o stvarnoj osobi.

---

## Arhitektura, ukratko

**Jedna kolekcija, dva pogleda.** `/dostupni-radovi` i `/radovi` su filtri nad
istom kolekcijom, nikad zasebne kolekcije. Prodaja mijenja jedno polje;
URL ostaje 200 i u sitemapu.

**Jedan izvor istine.** `src/core/shema.mjs` — Zod shemu dijele build, Atelier
i CLI. Zod dolazi iz `astro/zod` (Zod 4) na sva tri mjesta; druga Zod instanca
znači drugu, nekompatibilnu shemu.

**Prag za teme.** Tema dobiva URL na 3+ rada I 200+ riječi uvoda
(`src/core/uvodi-tema.mjs`). Ispod praga URL ne postoji. Prazne kategorijske
stranice su SEO teret.

**Dvojezičnost je ručna.** Astrov i18n ne zna mapirati `/radovi/x` ↔
`/en/works/y` — `locales: [{path, codes}]` mijenja samo segment jezika. Rute su
zato obične (`src/pages/` i `src/pages/en/`), a `hreflang` se gradi iz jedne
mape. Rad bez `opis_en` **ne generira** englesku stranicu i ne dobiva `hreflang`
na nju.

**Slike.** Sve ide kroz `src/components/Slika.astro`. Nikad `width` I `height`
zajedno — od Astra v6 to REŽE sliku, što na uspravnoj ikoni znači odrezanu
glavu. v6+ također nikad ne povećava: zato Atelier upozorava ispod 1400px.

---

## Zamke Astra 7 (provjereno u dokumentaciji, ne po sjećanju)

| |
|---|
| config je `src/content.config.ts`, ne `src/content/config.ts` |
| `loader` je obavezan (`glob()` iz `astro/loaders`) |
| `render(entry)`, ne `entry.render()` |
| `entry.id` je slug; `entry.slug` ne postoji |
| Zod iz `astro/zod`; Zod 4 **ne nosi upisanu vrijednost u greški** |
| `compressHTML: true` — v7 default `'jsx'` jede razmake između elemenata |
| `getStaticPaths` ide u vlastiti chunk: konstante iz frontmattera mu nisu dostupne, uvezeni moduli jesu |
| u integracijama `fileURLToPath(dir)`, nikad `dir.pathname` |
| **`astro dev` se sam demonizira** — prednji proces odmah izađe, server ostaje u pozadini s lockom u `.astro/dev.json`. Gasi se s `astro dev stop`, ne ubijanjem PID-a |

## Pokretač — dvije greške koje su ga rušile

1. **`shell: true` + `process.execPath`.** Node je u `C:\Program Files\nodejs\`.
   Uz `shell:true` argumenti se spajaju bez navodnika, cmd rastavi putanju na
   razmaku i javi `'C:\Program' is not recognized…`. Oba procesa umru, a
   preglednik se svejedno otvori na `ERR_CONNECTION_REFUSED`. Sve se sada
   pokreće izravno Nodeom (`shell: false`), bez npm-a.
2. **Astro dev demon.** Držan kao obično dijete izgledao je kao stalni pad, a
   preživljavao je zatvaranje prozora i držao port 4321. Sada se pokreće s
   `--background`, gasi s `astro dev stop`, i — ključno — `astro dev stop` se
   zove i **na početku** svakog pokretanja, jer zatvaranje konzole na Windowsu
   ne šalje Nodeu pouzdan signal. Bez toga „zatvorite prozor i kliknite prečac
   ponovno" ne bi bila istina.

Preglednik se otvara tek kad `/api/zdravlje` stvarno odgovori.

---

## Društvene kartice

`src/integrations/drustvene-kartice.mjs`, kroz `astro:build:done`. Slika se
**umeće** u pergament 1200×630 (`fit: 'inside'`), nikad ne obrezuje — inače se
uspravna ikona dijeli s odrezanom glavom. Tekst crta sharp + SVG; satori nije
potreban jer sharp ispravno renderira kvačice (provjereno). Build **pada** ako
se kvačice nacrtaju kao kvadratići.

---

## Domena

Zadaje se pri buildu, bez diranja koda:

```bash
SITE_URL=https://nikolina-art.hr npm run build
```

Iz te jedne vrijednosti generiraju se **svi** apsolutni URL-ovi: kanonski,
hreflang, JSON-LD `@id`, `og:image`, sitemap i `robots.txt`. Provjereno:
nakon buildova s novom domenom u `dist/` ne ostane **nijedna** datoteka sa
starom. Bez `SITE_URL` koristi se Netlifyjev `DEPLOY_PRIME_URL` / `URL`,
a lokalno `https://nikolineart.hr`, pa je
promjena domene jedna varijabla + rebuild, a ne pretraga po datotekama.

Traži `https://`; `http://` prolazi uz upozorenje.

## Što je isporuka

`npm run build` → **statički `dist/`**, uključujući `/admin/` sučelje.
Javna galerija radi na statičkom hostingu. Online uređivanje dodatno traži
Netlify Functions iz `netlify/functions/` i GitHub pristup iz `NETLIFY.md`.
Samo kopiranje `dist/` neće omogućiti spremanje.

Dvije stvari koje mora podesiti onaj tko poslužuje, jer se ne mogu zapeći u
datoteke:
- **jedna kanonska domena** (s `www` ili bez — jedno od toga, drugo 301 na prvo)
- **dosljedan završni `/`** — stranica gradi URL-ove s njim (`build.format:
  'directory'`, `trailingSlash: 'always'`)

Bez toga se ista stranica indeksira na dvije adrese i dijeli si vlastiti rang.

## Hosting

Netlify iz GitHuba: vidi [NETLIFY.md](NETLIFY.md). Lozinke i tokeni zadaju se
isključivo kao varijable na Netlifyju; nisu dio repozitorija.

## Prije objave — redoslijed

```bash
npm test                    # online prijava, spremanje i sukobi
npm run provjeri            # mora reći "Spremno za objavu"
npm run ocisti-primjere     # makni 4 primjera
npm run provjeri-kontrast   # 100 parova, WCAG AA
SITE_URL=https://prava-domena.hr npm run build
```

Nakon objave: Search Console (Performance → **Search type = IMAGE** je izvještaj
koji na ovakvoj stranici jedini nešto znači), prijavi `sitemap-index.xml`, i
provjeri Rich Results Test **i** validator.schema.org — prvi šuti o
`VisualArtwork`, drugi provjerava cijeli `@graph`.

---

## Sigurnost

Lokalni Atelier veže se **isključivo na 127.0.0.1** i piše po disku.
Online Atelier koristi zasebne Netlify funkcije, prijavu, HttpOnly/Secure
kolačić, provjeru izvora zahtjeva i GitHub zapis bez force-pusha.
