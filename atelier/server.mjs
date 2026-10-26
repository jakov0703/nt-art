#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as storage from '../src/core/datoteke.mjs';
import { createAtelier } from './app.mjs';
const { KORIJEN, osiguraj } = storage;
const JAVNO = path.join(KORIJEN, 'atelier', 'public');
const app = createAtelier(storage, { siteUrl: process.env.STRANICA_URL || '' });
app.get('/', async (c) => c.html(await readFile(path.join(JAVNO, 'index.html'), 'utf8')));
app.get('/static/:datoteka', async (c) => {
  const ime = c.req.param('datoteka');
  if (!['app.js', 'app.css'].includes(ime)) return c.notFound();
  return c.body(await readFile(path.join(JAVNO, ime)), 200, {
    'content-type': ime.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
  });
});
app.post('/api/izlaz', (c) => {
  setTimeout(() => process.exit(0), 200);
  return c.json({ ok: true });
});

// -------------------------------------------------- pokretanje

const ZELJENI_PORT = Number(process.env.ATELIER_PORT ?? 4444);

function pokreni(port, preostalo = 12) {
  const server = serve(
    { fetch: app.fetch, port, hostname: '127.0.0.1' },   // NIKAD 0.0.0.0
    (info) => {
      const adresa = `http://127.0.0.1:${info.port}`;
      console.log('');
      console.log('  ┌────────────────────────────────────────────────┐');
      console.log('  │  ATELIER RADI — ne zatvaraj ovaj prozor         │');
      console.log('  └────────────────────────────────────────────────┘');
      console.log('');
      console.log(`  Otvori u pregledniku:  ${adresa}`);
      console.log('');
      console.log('  Ako nešto zapne: zatvori ovaj prozor i klikni prečac ponovno.');
      console.log('');
    }
  );

  server.on?.('error', (e) => {
    if (e.code === 'EADDRINUSE' && preostalo > 0) {
      pokreni(port + 1, preostalo - 1);
    } else {
      console.error('\n  Atelier se nije mogao pokrenuti:', e.message);
      console.error('  Zatvori ovaj prozor i klikni prečac ponovno.\n');
      process.exit(1);
    }
  });
}

await osiguraj();
pokreni(ZELJENI_PORT);
