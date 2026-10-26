/* Atelier — sučelje.
   Bez framework-a i bez build koraka: ovo mora raditi za pet godina, bez
   ijednog `npm install` i bez obzira što se dogodilo s ekosustavom. */

const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const ONLINE = document.body.dataset.online === 'true';
const endpoint = (path) => `${ONLINE ? '/admin' : ''}${path}`;
let REVISION;
let UPLOADING = false;
let STARTED = false;
let EXITING = false;

let SIFRARNICI = null;
let SLIKE = [];
let UREDUJE = null;   // slug rada koji se uređuje, ili null za novi

// ---------------------------------------------------------------- pomoćno

async function api(putanja, opcije = {}) {
  const o = { ...opcije };
  if (o.json !== undefined) {
    o.method = o.method ?? 'POST';
    o.headers = { 'content-type': 'application/json' };
    o.body = JSON.stringify(o.json);
    delete o.json;
  }
  const odgovor = await fetch(endpoint(putanja), o);
  const tekst = await odgovor.text();
  let podaci;
  try { podaci = JSON.parse(tekst); } catch { podaci = { ok: false, poruka: tekst }; }
  if (ONLINE && odgovor.status === 401) {
    showLogin('Prijava je istekla. Ponovno se prijavite; obrazac je sačuvan.');
    throw new Error('Ponovno se prijavite pa spremite rad.');
  }
  if (!odgovor.ok && !podaci.poruka && !podaci.greske) podaci.poruka = 'Zahtjev nije uspio. Pokušajte ponovno za minutu.';

  // Popisne rute (/api/djela) vraćaju NIZ. Spread niza u objekt pretvorio bi
  // ga u {0:…, 1:…}, Array.isArray() bi pao i nadzorna ploča bi tvrdila da
  // radova nema iako ih poslužitelj uredno vraća. Zato niz prolazi netaknut.
  if (Array.isArray(podaci)) return podaci;

  return { status: odgovor.status, ...podaci };
}

let tajmerObavijesti;
function javi(poruka, greska = false) {
  const el = $('#obavijest');
  el.textContent = poruka;
  el.classList.toggle('obavijest--greska', greska);
  el.hidden = false;
  clearTimeout(tajmerObavijesti);
  tajmerObavijesti = setTimeout(() => { el.hidden = true; }, greska ? 9000 : 4000);
}

function prikazi(idZaslona) {
  $$('.zaslon').forEach((z) => { z.hidden = z.id !== idZaslona; });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- ploča

const NAZIV_STATUSA = {
  dostupno: 'Dostupno', rezervirano: 'Rezervirano', prodano: 'Prodano',
  nije_na_prodaju: 'Nije na prodaju', po_narudzbi: 'Po narudžbi',
};

async function ucitajPlocu() {
  const radovi = await api('/api/djela');
  const popis = $('#popis');
  if (!Array.isArray(radovi)) throw new Error(radovi.poruka || 'Radove nije moguće učitati.');
  popis.innerHTML = '';

  if (!Array.isArray(radovi) || radovi.length === 0) {
    popis.innerHTML = '<div class="prazno"><p>Još nema nijednog rada.</p>'
      + '<p>Kliknite „+ Novi rad" gore desno da dodate prvi.</p></div>';
    return;
  }

  for (const r of radovi) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'stavka';
    el.addEventListener('click', () => otvoriRad(r.slug));

    if (r.greska) {
      el.innerHTML = `<div class="stavka__slika"></div>
        <div><p class="stavka__naslov">${esc(r.slug)}</p>
        <p class="stavka__meta" style="color:var(--crvena)">Datoteku nije moguće pročitati — javite se za pomoć.</p></div><div></div>`;
      popis.append(el);
      continue;
    }

    const skica = r.stanje !== 'objavljeno';
    el.innerHTML = `
      ${r.slika
        ? `<img class="stavka__slika" src="${endpoint('/slicica/' + encodeURIComponent(r.slika))}" alt="" loading="lazy" />`
        : '<div class="stavka__slika"></div>'}
      <div>
        <p class="stavka__naslov">${esc(r.naslov)}</p>
        <p class="stavka__meta">${r.godina ?? ''}${r.cijena != null ? ` · ${r.cijena} €` : ''}${r.istaknuto ? ' · istaknuto' : ''}</p>
      </div>
      <div class="stavka__desno">
        ${skica ? '<span class="oznaka oznaka--skica">Skica</span>' : ''}
        ${r.status ? `<span class="oznaka oznaka--${r.status}">${NAZIV_STATUSA[r.status] ?? r.status}</span>` : ''}
        ${r.imaEngleski ? '<span class="cip cip--ima">EN</span>' : ''}
      </div>`;
    popis.append(el);
  }
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (z) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));

// ---------------------------------------------------------------- šifrarnici

async function ucitajSifrarnike() {
  SIFRARNICI = await api('/api/sifrarnici');
  if (!SIFRARNICI.tehnike) throw new Error(SIFRARNICI.poruka || 'Atelier nije dostupan.');

  // Gumb prema javnoj stranici. Atelier je samo alat za objavu — ovo je ono
  // što posjetitelji stvarno vide, i mora biti nadohvat ruke.
  if (SIFRARNICI.stranicaUrl) {
    const gumb = document.createElement('a');
    gumb.className = 'gumb gumb--tih';
    gumb.href = SIFRARNICI.stranicaUrl;
    gumb.target = '_blank';
    gumb.rel = 'noopener';
    gumb.textContent = 'Pogledaj stranicu ↗';
    gumb.title = 'Otvara vašu stranicu onakvu kakvu vide posjetitelji';
    $('.vrh__nav').prepend(gumb);
  }

  const teh = $('#tehnika');
  teh.innerHTML = '<option value="">— odaberite —</option>'
    + SIFRARNICI.tehnike.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');

  $('#podloga').innerHTML = '<option value="">—</option>'
    + SIFRARNICI.podloge.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');

  $('#statusi').innerHTML = SIFRARNICI.statusi.map((s, i) => `
    <label class="radio">
      <input type="radio" name="status" value="${s.id}" ${i === 0 ? 'checked' : ''} />
      <span><strong>${NAZIV_STATUSA[s.id] ?? s.id}</strong>
        <span class="radio__opis">${esc(s.opis)}</span></span>
    </label>`).join('');

  $('#teme').innerHTML = SIFRARNICI.teme.map((t) => `
    <label class="kvadratic"><input type="checkbox" name="teme" value="${t.slug}" />
    <span>${esc(t.naziv)}</span></label>`).join('');

  $('#namjene').innerHTML = SIFRARNICI.namjene.map((n) => `
    <label class="kvadratic"><input type="checkbox" name="namjena" value="${n}" />
    <span>${esc(n.replace(/-/g, ' '))}</span></label>`).join('');

  $('#ciklusi-popis').innerHTML = (SIFRARNICI.ciklusi ?? [])
    .map((c) => `<option value="${esc(c)}"></option>`).join('');
}

// ---------------------------------------------------------------- fotografije

function crtajSlike() {
  const ul = $('#slike');
  ul.innerHTML = '';
  SLIKE.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'slika';
    li.innerHTML = `
      <img src="${endpoint('/slicica/' + encodeURIComponent(s.ime))}" alt="" />
      <div>
        <label>Što je na fotografiji</label>
        <select data-uloga="${i}">
          ${SIFRARNICI.uloge.map((u) =>
            `<option value="${u.id}" ${s.uloga === u.id ? 'selected' : ''}>${esc(u.opis)}</option>`).join('')}
        </select>
        <label style="margin-top:.5rem">Opis za čitače ekrana i pretraživače</label>
        <input type="text" data-alt="${i}" value="${esc(s.alt_hr ?? '')}"
               placeholder="npr. Bogorodica s Djetetom, ulje na platnu" />
        ${(s.upozorenja ?? []).map((u) => `<p class="slika__upozorenje">${esc(u)}</p>`).join('')}
        ${s.sirina_px && s.visina_px ? `<p class="pomoc">${s.sirina_px}×${s.visina_px} točaka</p>` : ''}
      </div>
      <button type="button" class="gumb gumb--tih" data-makni="${i}">Makni</button>`;
    ul.append(li);
  });

  $$('[data-uloga]', ul).forEach((el) => el.addEventListener('change', (e) => {
    SLIKE[+el.dataset.uloga].uloga = e.target.value;
  }));
  $$('[data-alt]', ul).forEach((el) => el.addEventListener('input', (e) => {
    SLIKE[+el.dataset.alt].alt_hr = e.target.value;
  }));
  $$('[data-makni]', ul).forEach((el) => el.addEventListener('click', () => {
    SLIKE.splice(+el.dataset.makni, 1);
    if (SLIKE.length && !SLIKE.some((s) => s.uloga === 'glavna')) SLIKE[0].uloga = 'glavna';
    crtajSlike();
  }));
}

async function posaljiSlike(datoteke) {
  if (!datoteke.length || UPLOADING) return;
  UPLOADING = true;
  $('#spremi').disabled = true;
  const napredak = $('#napredak');
  napredak.hidden = false;
  napredak.textContent = `Obrađujem ${datoteke.length} fotografij${datoteke.length === 1 ? 'u' : 'e'}… ovo može potrajati.`;

  try {
    // One file per request stays within Netlify's buffered payload limit.
    for (const d of datoteke) {
    const forma = new FormData();
    forma.append('slike', ONLINE ? await preparePhoto(d) : d);
    forma.append('osnova', ($('#naslov_hr').value || 'rad'));
    forma.append('pocetniBroj', String(SLIKE.length + 1));
    const rez = await api('/api/slike', { method: 'POST', body: forma });
    if (!rez.ok) throw new Error(rez.poruka ?? 'Nepoznata greška.');

    for (const s of rez.slike) {
      if (!s.ok) { javi(s.poruka, true); continue; }
      SLIKE.push({
        datoteka: s.datoteka, ime: s.ime,
        uloga: SLIKE.length === 0 ? 'glavna' : 'detalj',
        alt_hr: '', sirina_px: s.sirina_px, visina_px: s.visina_px,
        upozorenja: s.upozorenja,
      });
    }
    crtajSlike();
    }
    napredak.hidden = true;
  } catch (e) {
    napredak.hidden = true;
    javi(`Fotografije nisu dodane: ${e.message}`, true);
  } finally {
    UPLOADING = false;
    $('#spremi').disabled = false;
  }
}

async function preparePhoto(file) {
  let result = file;
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Fotografiju nije moguće pripremiti. Pokušajte JPG.');
    result = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  }
  if (result.size > 3_000_000) throw new Error('Fotografija je prevelika. Odaberite JPG manji od 3 MB.');
  return result;
}

function postaviZonu() {
  const zona = $('#zona');
  const odabir = $('#odabir');

  zona.addEventListener('click', () => odabir.click());
  zona.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); odabir.click(); }
  });
  odabir.addEventListener('change', () => {
    posaljiSlike([...odabir.files]);
    odabir.value = '';
  });

  ['dragenter', 'dragover'].forEach((d) => zona.addEventListener(d, (e) => {
    e.preventDefault(); zona.classList.add('zona--aktivna');
  }));
  ['dragleave', 'drop'].forEach((d) => zona.addEventListener(d, (e) => {
    e.preventDefault(); zona.classList.remove('zona--aktivna');
  }));
  zona.addEventListener('drop', (e) => posaljiSlike([...e.dataTransfer.files]));
}

// ---------------------------------------------------------------- obrazac

function ocistiObrazac() {
  $('#forma').reset();
  SLIKE = [];
  UREDUJE = null;
  REVISION = undefined;
  crtajSlike();
  $('#greske').hidden = true;
  $('#obrazac-naslov').textContent = 'Novi rad';
  $('#arhiviraj').hidden = true;
  $('#godina').value = new Date().getFullYear();
  $('#slug-info').hidden = true;
  osvjeziUvjetnaPolja();
  osvjeziBrojacOpisa();
  osvjeziCipEN();
}

function skupiPodatke() {
  const v = (id) => $(`#${id}`).value.trim();
  const c = (id) => $(`#${id}`).checked;
  const oznaceni = (ime) => $$(`input[name="${ime}"]:checked`).map((e) => e.value);

  return {
    revision: REVISION,
    podaci: {
      id: UREDUJE ? ($('#forma').dataset.id || undefined) : undefined,
      stanje_objave: c('objavi') ? 'objavljeno' : 'skica',
      naslov_hr: v('naslov_hr'),
      slug: UREDUJE ?? undefined,
      godina: v('godina'),
      godina_priblizna: c('godina_priblizna'),
      tehnika: v('tehnika'),
      podloga: v('podloga'),
      visina_cm: v('visina_cm'),
      sirina_cm: v('sirina_cm'),
      status: ($('input[name="status"]:checked') ?? {}).value ?? '',
      cijena: v('cijena'),
      cijena_na_upit: c('cijena_na_upit'),
      datum_prodaje: v('datum_prodaje'),
      kategorija: ($('input[name="kategorija"]:checked') ?? {}).value ?? 'ostalo',
      teme: oznaceni('teme'),
      namjena: oznaceni('namjena'),
      ciklus: v('ciklus'),
      ikonografska_biljeska: v('ikonografska_biljeska'),
      zbirka_vlasnik: v('zbirka_vlasnik'),
      uokvireno: c('uokvireno'),
      opis_okvira: v('opis_okvira'),
      istaknuto: c('istaknuto'),
      naslov_en: v('naslov_en'),
      slug_en: v('naslov_en') ? slugifyKlijent(v('naslov_en')) : '',
      opis_en: v('opis_en'),
      slike: SLIKE.map((s) => ({
        datoteka: s.datoteka, uloga: s.uloga,
        alt_hr: s.alt_hr || `${v('naslov_hr')} — ${v('tehnika')}, ${v('godina')}.`,
        sirina_px: s.sirina_px, visina_px: s.visina_px,
      })),
    },
    opis_hr: $('#opis_hr').value.trim(),
  };
}

/* Ista transliteracija kao na poslužitelju — đ ide u "dj". Ovo je samo
   prijedlog; poslužitelj svejedno provjerava i može ga odbiti. */
function slugifyKlijent(s) {
  const m = { 'č': 'c', 'ć': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj', 'Č': 'c', 'Ć': 'c', 'Š': 's', 'Ž': 'z', 'Đ': 'dj' };
  return s.replace(/[čćšžđČĆŠŽĐ]/g, (z) => m[z])
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}

function pokaziGreske(greske) {
  const el = $('#greske');
  if (!greske?.length) { el.hidden = true; return; }
  el.innerHTML = `<h3>Još ${greske.length === 1 ? 'jedna stvar' : `${greske.length} stvari`} prije spremanja</h3>
    <ul>${greske.map((g) => `<li>${esc(g.poruka)}</li>`).join('')}</ul>`;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function otvoriRad(slug) {
  const rez = await api(`/api/djela/${encodeURIComponent(slug)}`);
  if (!rez.ok) { javi(rez.poruka ?? 'Rad nije pronađen.', true); return; }

  ocistiObrazac();
  UREDUJE = slug;
  REVISION = rez.revision;
  const d = rez.podaci;
  const f = $('#forma');
  f.dataset.id = d.id ?? '';

  $('#obrazac-naslov').textContent = d.naslov_hr ?? 'Uređivanje';
  $('#arhiviraj').hidden = false;

  const post = (id, val) => { if (val != null) $(`#${id}`).value = val; };
  post('naslov_hr', d.naslov_hr);
  post('godina', d.godina);
  post('tehnika', d.tehnika);
  post('podloga', d.podloga ?? '');
  post('visina_cm', d.dimenzije?.visina_cm);
  post('sirina_cm', d.dimenzije?.sirina_cm);
  post('cijena', d.cijena ?? '');
  post('datum_prodaje', d.datum_prodaje ? String(d.datum_prodaje).slice(0, 10) : '');
  post('ciklus', d.ciklus ?? '');
  post('ikonografska_biljeska', d.ikonografska_biljeska ?? '');
  post('zbirka_vlasnik', d.zbirka_vlasnik ?? '');
  post('opis_okvira', d.opis_okvira ?? '');
  post('naslov_en', d.naslov_en ?? '');
  post('opis_en', d.opis_en ?? '');
  $('#opis_hr').value = rez.opis_hr ?? '';

  $('#godina_priblizna').checked = Boolean(d.godina_priblizna);
  $('#uokvireno').checked = Boolean(d.uokvireno);
  $('#istaknuto').checked = Boolean(d.istaknuto);
  $('#cijena_na_upit').checked = Boolean(d.cijena_na_upit);
  $('#objavi').checked = d.stanje_objave === 'objavljeno';

  const status = $(`input[name="status"][value="${d.status}"]`);
  if (status) status.checked = true;
  const kat = $(`input[name="kategorija"][value="${d.kategorija ?? 'ostalo'}"]`);
  if (kat) kat.checked = true;
  for (const t of d.teme ?? []) { const el = $(`input[name="teme"][value="${t}"]`); if (el) el.checked = true; }
  for (const n of d.namjena ?? []) { const el = $(`input[name="namjena"][value="${n}"]`); if (el) el.checked = true; }

  SLIKE = (d.slike ?? []).map((s) => ({
    datoteka: s.datoteka,
    ime: String(s.datoteka).split('/').pop(),
    uloga: s.uloga ?? 'detalj',
    alt_hr: s.alt_hr ?? '',
    sirina_px: s.sirina_px, visina_px: s.visina_px,
    upozorenja: [],
  }));
  crtajSlike();

  $('#slug-info').hidden = false;
  $('#slug-info').innerHTML = `Web adresa: <code>/radovi/${esc(slug)}/</code>`
    + (d.stanje_objave === 'objavljeno'
      ? ' — zamrznuta jer je djelo objavljeno. Mijenjanje bi pokvarilo poslane veze.' : '');

  osvjeziUvjetnaPolja();
  osvjeziBrojacOpisa();
  osvjeziCipEN();
  prikazi('obrazac');
}

// ---------------------------------------------------------------- reaktivnost

function osvjeziUvjetnaPolja() {
  const status = ($('input[name="status"]:checked') ?? {}).value;
  $('#polje-prodaja').hidden = status !== 'prodano';
  $('#polje-cijena').hidden = status === 'prodano' || status === 'nije_na_prodaju';
  $('#cijena').disabled = $('#cijena_na_upit').checked;
  if ($('#cijena_na_upit').checked) $('#cijena').value = '';
  $('#opis_okvira').hidden = !$('#uokvireno').checked;

  const sakralno = ($('input[name="kategorija"]:checked') ?? {}).value === 'sakralno';
  $('#polje-teme').style.opacity = sakralno ? '1' : '0.75';
}

/**
 * Objašnjenje ispod polja, dok tipka.
 *
 * Polja su namjerno type="text" (vidi index.html) pa kriva vrijednost
 * preživi i može se objasniti. Ovdje se objašnjava ODMAH, da ne mora
 * spremati da bi saznala što nije u redu.
 */
function pokaziPoljeGresku(id, poruka) {
  const polje = $(`#${id}`);
  if (!polje) return;
  let el = polje.parentElement.querySelector('.polje-greska');
  if (!poruka) { if (el) el.remove(); polje.classList.remove('polje--lose'); return; }
  if (!el) {
    el = document.createElement('p');
    el.className = 'polje-greska';
    polje.insertAdjacentElement('afterend', el);
  }
  el.textContent = poruka;
  polje.classList.add('polje--lose');
}

function provjeriBroj(id, naziv) {
  const v = $(`#${id}`).value.trim();
  if (!v) return pokaziPoljeGresku(id, '');

  if (/^\s*\d+([.,]\d+)?\s*[x×*]\s*\d+/i.test(v)) {
    return pokaziPoljeGresku(id,
      'Visina i širina upisuju se u dva odvojena polja, samo brojke. ' +
      'Za djelo 50 × 70 cm upišite 50 u „Visina" i 70 u „Širina". „cm" ne treba pisati.');
  }
  if (!Number.isFinite(Number(v.replace(',', '.')))) {
    return pokaziPoljeGresku(id,
      id === 'cijena'
        ? `Cijena se upisuje samo brojkama, bez znaka € i bez riječi. Umjesto „${v}" upišite npr. 1200.`
        : `„${naziv}" se upisuje samo brojkama. Upisano je: „${v}".`);
  }
  pokaziPoljeGresku(id, '');
}

function osvjeziBrojacOpisa() {
  const n = $('#opis_hr').value.trim().length;
  const el = $('#brojac-opisa');
  el.textContent = n >= 400 ? `${n} znakova ✓` : `${n} / 400 znakova za objavu`;
  el.classList.toggle('brojac--malo', n < 400);
}

function osvjeziCipEN() {
  const ima = $('#naslov_en').value.trim() && $('#opis_en').value.trim();
  const cip = $('#cip-en');
  cip.textContent = ima ? 'Engleska verzija: da' : 'Nema engleske verzije';
  cip.classList.toggle('cip--ima', Boolean(ima));
}

// ---------------------------------------------------------------- spremanje

async function spremi(e) {
  e.preventDefault();
  if (UPLOADING) return;
  const gumb = $('#spremi');
  gumb.disabled = true;
  gumb.textContent = 'Spremam…';

  try {
    const tijelo = skupiPodatke();
    const rez = UREDUJE
      ? await api(`/api/djela/${encodeURIComponent(UREDUJE)}`, { method: 'PUT', json: tijelo })
      : await api('/api/djela', { json: tijelo });

    if (!rez.ok) {
      pokaziGreske(rez.greske ?? [{ poruka: rez.poruka ?? 'Spremanje nije uspjelo.' }]);
      javi('Rad nije spremljen — pogledajte poruke na vrhu.', true);
      return;
    }

    $('#greske').hidden = true;
    const message = $('#objavi').checked
      ? (ONLINE ? 'Spremljeno. Javna stranica ažurirat će se za nekoliko minuta.' : 'Spremljeno i objavljeno.')
      : 'Spremljeno kao skica.';
    javi(message);
    if (ONLINE) $('#online-napomena').textContent = message;
    await ucitajPlocu();
    ocistiObrazac();
    prikazi('ploca');
  } catch (err) {
    javi(`Greška: ${err.message}`, true);
  } finally {
    gumb.disabled = false;
    gumb.textContent = 'Spremi';
  }
}

async function arhiviraj() {
  if (!UREDUJE) return;
  const naslov = $('#naslov_hr').value || UREDUJE;
  if (!confirm(
    `Arhivirati „${naslov}"?\n\n`
    + 'Rad će nestati sa stranice, ali NIŠTA se ne briše — datoteka i fotografije '
    + 'ostaju sačuvane i mogu se vratiti.'
  )) return;

  const rez = await api(`/api/djela/${encodeURIComponent(UREDUJE)}/arhiviraj`, { json: { revision: REVISION } });
  if (!rez.ok) { javi(rez.poruka ?? 'Arhiviranje nije uspjelo.', true); return; }
  javi('Rad je arhiviran. Ništa nije izbrisano.');
  await ucitajPlocu();
  ocistiObrazac();
  prikazi('ploca');
}

// ---------------------------------------------------------------- start

async function start() {
  await ucitajSifrarnike();
  await ucitajPlocu();
  postaviZonu();

  $$('[data-idi]').forEach((b) => b.addEventListener('click', () => {
    const cilj = b.dataset.idi;
    if (cilj === 'novo') { ocistiObrazac(); prikazi('obrazac'); }
    else prikazi(cilj);
  }));

  $('#forma').addEventListener('submit', spremi);
  $('#arhiviraj').addEventListener('click', arhiviraj);

  $('#statusi').addEventListener('change', osvjeziUvjetnaPolja);
  $('#cijena_na_upit').addEventListener('change', osvjeziUvjetnaPolja);
  $('#uokvireno').addEventListener('change', osvjeziUvjetnaPolja);
  $$('input[name="kategorija"]').forEach((el) => el.addEventListener('change', osvjeziUvjetnaPolja));
  $('#opis_hr').addEventListener('input', osvjeziBrojacOpisa);

  // Objašnjenje se pojavi dok tipka, ne tek kad pokuša spremiti.
  for (const [id, naziv] of [['visina_cm', 'Visina'], ['sirina_cm', 'Širina'],
                             ['cijena', 'Cijena'], ['godina', 'Godina']]) {
    $(`#${id}`).addEventListener('input', () => provjeriBroj(id, naziv));
  }
  $('#naslov_en').addEventListener('input', osvjeziCipEN);
  $('#opis_en').addEventListener('input', osvjeziCipEN);

  $('#obrisi-en').addEventListener('click', () => {
    $('#naslov_en').value = '';
    $('#opis_en').value = '';
    osvjeziCipEN();
    javi('Engleska verzija obrisana. Djelo će imati samo hrvatsku stranicu.');
  });

  // Prijedlog web adrese dok tipka naslov — samo za nove radove.
  let tajmer;
  $('#naslov_hr').addEventListener('input', () => {
    if (UREDUJE) return;
    clearTimeout(tajmer);
    tajmer = setTimeout(async () => {
      const naslov = $('#naslov_hr').value.trim();
      if (!naslov) { $('#slug-info').hidden = true; return; }
      const r = await api(`/api/slug/provjera?naslov=${encodeURIComponent(naslov)}&godina=${$('#godina').value}`);
      $('#slug-info').hidden = false;
      $('#slug-info').innerHTML = r.slobodan
        ? `Web adresa: <code>/radovi/${esc(r.slug)}/</code>`
        : `Adresa <code>${esc(r.slug)}</code> je zauzeta — koristit će se <code>${esc(r.prijedlog)}</code>.`;
    }, 350);
  });

  // Zaštita od slučajnog zatvaranja usred uređivanja.
  window.addEventListener('beforeunload', (e) => {
    if (EXITING) return;
    if ($('#obrazac').hidden) return;
    if (!$('#naslov_hr').value && !SLIKE.length) return;
    e.preventDefault();
    e.returnValue = '';
  });

  ocistiObrazac();
  prikazi('ploca');
}

function showLogin(message = '') {
  document.body.dataset.auth = 'false';
  $('#prijava').hidden = false;
  $('#prijava-poruka').textContent = message;
}

async function enterEditor() {
  if (!STARTED) { await start(); STARTED = true; }
  document.body.dataset.auth = 'true';
  $('#prijava').hidden = true;
  $('#online-napomena').hidden = !ONLINE;
  $('#odjava').hidden = !ONLINE;
}

async function boot() {
  if (!ONLINE) return enterEditor();
  showLogin('Provjeravam prijavu…');
  $('#prijava-forma').addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    try {
      const response = await fetch(endpoint('/api/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('#korisnik').value, password: $('#lozinka').value }),
      });
      const result = await response.json().catch(() => ({ poruka: 'Previše pokušaja. Pričekajte minutu pa pokušajte ponovno.' }));
      if (!response.ok) throw new Error(result.poruka || 'Prijava nije uspjela.');
      $('#lozinka').value = '';
      await enterEditor();
    } catch (error) { showLogin(error.message); }
    finally { button.disabled = false; }
  });
  $('#odjava').addEventListener('click', async () => {
    if (!$('#obrazac').hidden && !confirm('Odjaviti se bez spremanja otvorenog obrasca?')) return;
    try {
      const result = await api('/api/logout', { json: {} });
      if (!result.ok) throw new Error(result.poruka || 'Odjava nije uspjela.');
      EXITING = true;
      location.reload();
    } catch (error) { javi(error.message, true); }
  });
  const response = await fetch(endpoint('/api/session'));
  if (response.ok) return enterEditor();
  const result = await response.json();
  showLogin(response.status === 401 ? '' : result.poruka);
}

boot().catch((error) => {
  if (ONLINE) showLogin(error.message);
  else javi(`Atelier nije dostupan: ${error.message}`, true);
});
