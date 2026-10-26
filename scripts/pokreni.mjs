#!/usr/bin/env node
/**
 * Pokretač: diže Atelier i pregled stranice, otvara preglednik, i pri
 * zatvaranju gasi OBA procesa.
 *
 * Jedan prozor, jedan proces-stablo, jedna rečenica za oporavak:
 * „zatvori prozor i klikni prečac ponovno".
 *
 * ── DVA PRAVILA KOJA SU OVDJE PLAĆENA GREŠKOM ──────────────────────
 *
 * 1. NIKAD `shell: true` sa `process.execPath`.
 *    Node je na Windowsu u "C:\Program Files\nodejs\node.exe". Uz shell:true
 *    argumenti se spajaju BEZ navodnika, cmd rastavi putanju na razmaku i
 *    javi: 'C:\Program' is not recognized as an internal or external command.
 *    Oba procesa tada umru odmah, a preglednik se svejedno otvori — i ona
 *    vidi „This site can't be reached" bez ijedne poruke o tome što se
 *    dogodilo. Zato se sve pokreće izravno Nodeom, bez shella i bez npm-a.
 *
 * 2. Preglednik se otvara TEK kad Atelier stvarno odgovara.
 *    Otvoriti ga prije toga znači da prva stvar koju vidi bude greška
 *    preglednika, čak i kad se server digne sekundu kasnije.
 */

import { spawn, execFile } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KORIJEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const naWindowsu = process.platform === 'win32';

const ATELIER = path.join(KORIJEN, 'atelier', 'server.mjs');
const ASTRO = path.join(KORIJEN, 'node_modules', 'astro', 'bin', 'astro.mjs');

const djeca = [];
let gasimo = false;

function slobodanPort(pocetni, maks = 15) {
  return new Promise((resolve) => {
    let port = pocetni;
    const pokusaj = () => {
      const s = net.createServer();
      s.once('error', () => {
        s.close();
        if (port - pocetni >= maks) return resolve(null);
        port++; pokusaj();
      });
      s.once('listening', () => s.close(() => resolve(port)));
      s.listen(port, '127.0.0.1');
    };
    pokusaj();
  });
}

/** Pokreće Node skriptu kao dijete. Bez shella — vidi pravilo 1 gore. */
function pokreniDijete(ime, skripta, argumenti = [], env = {}) {
  if (!existsSync(skripta)) {
    console.error(`\n  Nedostaje datoteka: ${path.relative(KORIJEN, skripta)}`);
    if (skripta === ASTRO) {
      console.error('  Izgleda da priprema nije dovršena. Zatvorite prozor,');
      console.error('  kliknite prečac ponovno i pričekajte da se dovrši.\n');
    }
    return null;
  }

  const p = spawn(process.execPath, [skripta, ...argumenti], {
    cwd: KORIJEN,
    env: { ...process.env, ...env, FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,          // ← nikad true; putanja do node.exe sadrži razmak
    windowsHide: true,
  });

  djeca.push({ ime, proces: p });

  const ispis = (podaci) => {
    const tekst = String(podaci).trim();
    if (!tekst) return;
    if (/DeprecationWarning|ExperimentalWarning|--trace-deprecation/i.test(tekst)) return;
    if (ime === 'atelier') console.log(tekst);
  };
  p.stdout.on('data', ispis);
  p.stderr.on('data', ispis);

  p.on('error', (e) => {
    console.error(`\n  Nije moguće pokrenuti ${ime}: ${e.message}`);
    console.error('  Zatvorite ovaj prozor i kliknite prečac ponovno.\n');
  });

  // Tiha smrt djeteta je najgori mogući ishod: prozor izgleda uredno, a ništa
  // ne radi. Zato se svaki neočekivani izlazak prijavi.
  p.on('exit', (kod) => {
    if (gasimo) return;
    console.error(`\n  ────────────────────────────────────────────────────`);
    console.error(`  Dio programa (${ime}) se zaustavio${kod != null ? ` (kod ${kod})` : ''}.`);
    console.error('  Zatvorite ovaj prozor i kliknite prečac ponovno.');
    console.error(`  ────────────────────────────────────────────────────\n`);
  });

  return p;
}

function ugasiSve() {
  if (gasimo) return;
  gasimo = true;

  // Astro dev je demon s vlastitim lockom — gasi se svojom naredbom, inače
  // preživi zatvaranje prozora i sljedeći put drži port.
  try {
    execFile(process.execPath, [ASTRO, 'dev', 'stop'],
      { cwd: KORIJEN, windowsHide: true, timeout: 10000 }, () => {});
  } catch { /* svejedno nastavljamo gasiti ostalo */ }

  for (const { proces } of djeca) {
    if (!proces || proces.killed || proces.exitCode !== null) continue;
    try {
      if (naWindowsu && proces.pid) {
        // /T gasi i unučad. Bez toga Astro dev preživi zatvaranje prozora,
        // zauzme port 4321, i sljedeće pokretanje izgleda pokvareno.
        execFile('taskkill', ['/PID', String(proces.pid), '/T', '/F'], { windowsHide: true }, () => {});
      } else {
        proces.kill('SIGTERM');
      }
    } catch { /* gasimo što možemo */ }
  }
}

function otvoriPreglednik(url) {
  if (naWindowsu) execFile('cmd', ['/c', 'start', '""', url], { windowsHide: true }, () => {});
  else if (process.platform === 'darwin') execFile('open', [url], () => {});
  else execFile('xdg-open', [url], () => {});
}

/** Čeka da Atelier stvarno odgovori. Bez ovoga preglednik pokaže grešku. */
async function cekajAtelier(port, sekundi = 25) {
  const kraj = Date.now() + sekundi * 1000;
  while (Date.now() < kraj) {
    if (gasimo) return false;
    try {
      const o = await fetch(`http://127.0.0.1:${port}/api/zdravlje`, {
        signal: AbortSignal.timeout(1000),
      });
      if (o.ok) return true;
    } catch { /* još se diže */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// ---------------------------------------------------------------

/**
 * Počisti za sobom PRIJE nego što išta pokreneš.
 *
 * Zatvaranje konzolnog prozora na Windowsu ne šalje Nodeu pouzdan signal, pa
 * demon Astro dev servera zna preživjeti. Bez ovoga bi drugo pokretanje našlo
 * zauzet port i „zatvorite prozor i kliknite prečac ponovno" ne bi bilo istina.
 * S ovime jest — a to je jedina uputa koju je dobila.
 */
await new Promise((resolve) => {
  execFile(process.execPath, [ASTRO, 'dev', 'stop'],
    { cwd: KORIJEN, windowsHide: true, timeout: 10000 }, () => resolve());
});

const portAtelier = await slobodanPort(4444);
const portStranice = await slobodanPort(4321);

if (!portAtelier) {
  console.error('\n  Nema slobodnog porta za Atelier.');
  console.error('  Zatvorite ovaj prozor i kliknite prečac ponovno.\n');
  process.exit(1);
}

console.log('');
console.log('  ════════════════════════════════════════════════════');
console.log('     ATELIER SE POKREĆE — ne zatvaraj ovaj prozor');
console.log('  ════════════════════════════════════════════════════');
console.log('');

pokreniDijete('atelier', ATELIER, [], {
  ATELIER_PORT: String(portAtelier),
  // Atelier iz ovoga prikazuje gumb „Pogledaj stranicu" — da ne mora pamtiti adresu.
  STRANICA_URL: portStranice ? `http://localhost:${portStranice}` : '',
});

/**
 * Astro 7 `astro dev` se SAM demonizira: prednji proces odmah izađe, a server
 * ostaje u pozadini sa svojim lock zapisom u .astro/dev.json. Ako ga se pokuša
 * držati kao obično dijete, izgleda kao da se srušio — i doista se „sruši" pri
 * svakom pokretanju, a demon preživi zatvaranje prozora i zauzme port 4321.
 *
 * Zato se ne borimo s time nego ga koristimo: pokrenemo ga izrijekom u pozadini
 * i ugasimo preko `astro dev stop`, koji zna svoj PID.
 */
let stranicaRadi = false;
if (portStranice) {
  stranicaRadi = await new Promise((resolve) => {
    execFile(
      process.execPath, [ASTRO, 'dev', '--background', '--port', String(portStranice)],
      { cwd: KORIJEN, windowsHide: true, timeout: 60000 },
      (greska) => resolve(!greska)
    );
  });
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => { ugasiSve(); process.exit(0); });
}
process.on('exit', ugasiSve);

const radi = await cekajAtelier(portAtelier);

if (!radi) {
  console.error('');
  console.error('  ────────────────────────────────────────────────────');
  console.error('  Atelier se nije uspio pokrenuti.');
  console.error('  Zatvorite ovaj prozor i kliknite prečac ponovno.');
  console.error('  Ako se ponovi, javite se osobi koja vam je postavila stranicu.');
  console.error('  ────────────────────────────────────────────────────');
  console.error('');
  ugasiSve();
  process.exitCode = 1;
} else {
  console.log('');
  console.log('  ════════════════════════════════════════════════════');
  console.log('     ATELIER RADI — ne zatvaraj ovaj prozor');
  console.log('  ════════════════════════════════════════════════════');
  console.log('');
  console.log(`     1) OBJAVA RADOVA (samo za vas)`);
  console.log(`        http://127.0.0.1:${portAtelier}`);
  console.log('');
  if (stranicaRadi) {
    console.log(`     2) VAŠA STRANICA — ovako je vide posjetitelji`);
    console.log(`        http://localhost:${portStranice}`);
  } else {
    console.log(`     2) VAŠA STRANICA — trenutno se ne može prikazati`);
    console.log(`        Objava radova svejedno radi normalno.`);
  }
  console.log('');
  console.log('     Gotovi ste? Samo zatvorite ovaj prozor.');
  console.log('     Nešto je zapelo? Zatvorite prozor i kliknite prečac ponovno.');
  console.log('');
  console.log('  ────────────────────────────────────────────────────');
  console.log('');

  // Otvaraju se OBA: admin sučelje i stranica kakvu vide posjetitelji.
  otvoriPreglednik(`http://127.0.0.1:${portAtelier}`);
  if (stranicaRadi) {
    setTimeout(() => otvoriPreglednik(`http://localhost:${portStranice}`), 1200);
  }
}
