import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGithubStore } from '../atelier/github-store.mjs';
import { createAtelier } from '../atelier/app.mjs';
import { authConfig, authenticated, credentialsMatch, sessionCookie } from '../atelier/auth.mjs';
import handler from '../netlify/functions/atelier.mjs';
import login from '../netlify/functions/login.mjs';

const root = 'src/content/radovi/';
const env = {
  ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'test-password-long-enough',
  ADMIN_SESSION_SECRET: 'test-session-secret-at-least-32-characters',
  GITHUB_REPO: 'test/gallery', GITHUB_TOKEN: 'test-token', GITHUB_BRANCH: 'main',
};

// Model GitHub's immutable blobs/trees/commits and non-force ref update. The
// real HTTP handler, auth, photo processing, schema and storage run unchanged.
async function githubFixture() {
  const blobs = new Map(), trees = new Map(), commits = new Map();
  let serial = 0, head = 'initial', failWrites = false, conflict = false;
  const calls = [];
  const put = (value) => {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const sha = createHash('sha1').update(buffer).digest('hex');
    blobs.set(sha, buffer);
    return sha;
  };
  const files = new Map();
  for (const path of ['bozuri-u-vazi.md', 'slike/bozuri-u-vazi.jpg', '_slugovi.json']) {
    files.set(root + path, put(await readFile(root + path)));
  }
  trees.set('initial-tree', files);
  commits.set(head, { tree: { sha: 'initial-tree' }, parents: [] });
  const fetchImpl = async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/repos/test/gallery', '');
    const method = options.method || 'GET';
    const data = options.body && JSON.parse(options.body);
    calls.push({ method, path });
    if (failWrites && method !== 'GET') return Response.json({}, { status: 503 });
    if (path === '/git/ref/heads/main') return Response.json({ object: { sha: head } });
    if (path.startsWith('/git/commits/') && method === 'GET') return Response.json(commits.get(path.split('/').pop()));
    if (path.startsWith('/git/trees/') && method === 'GET') return Response.json({ tree: [...trees.get(path.split('/').pop())].map(([path, sha]) => ({ path, sha, type: 'blob' })), truncated: false });
    if (path.startsWith('/git/blobs/') && method === 'GET') return Response.json({ content: blobs.get(path.split('/').pop()).toString('base64') });
    if (path === '/git/blobs' && method === 'POST') return Response.json({ sha: put(Buffer.from(data.content, 'base64')) });
    if (path === '/git/trees' && method === 'POST') {
      const next = new Map(trees.get(data.base_tree));
      for (const entry of data.tree) entry.sha === null ? next.delete(entry.path) : next.set(entry.path, entry.sha);
      const sha = `tree-${++serial}`;
      trees.set(sha, next);
      return Response.json({ sha });
    }
    if (path === '/git/commits' && method === 'POST') {
      const sha = `commit-${++serial}`;
      commits.set(sha, { tree: { sha: data.tree }, parents: data.parents });
      return Response.json({ sha });
    }
    if (path === '/git/refs/heads/main' && method === 'PATCH') {
      assert.equal(data.force, false);
      if (conflict || commits.get(data.sha).parents[0] !== head) return Response.json({}, { status: 422 });
      head = data.sha;
      return Response.json({ object: { sha: head } });
    }
    throw new Error(`Unexpected GitHub call: ${method} ${path}`);
  };
  return {
    fetchImpl, calls,
    failWrites: () => { failWrites = true; },
    conflict: () => { conflict = true; },
    read: (path) => blobs.get(trees.get(commits.get(head).tree.sha).get(path)),
    head: () => head,
    store: () => createGithubStore({ repo: env.GITHUB_REPO, token: env.GITHUB_TOKEN, fetchImpl }),
  };
}

test('sessions reject tampering, expiry, changed credentials and missing configuration', () => {
  const config = authConfig(env);
  const now = 1_000_000;
  const cookie = sessionCookie(config, now).split(';')[0];
  const req = (value) => new Request('https://gallery.test/admin/api/session', { headers: { cookie: value } });
  assert.ok(authenticated(req(cookie), config, now));
  assert.ok(!authenticated(req(cookie + 'x'), config, now));
  assert.ok(!authenticated(req(cookie), config, now + 9 * 3600_000));
  assert.ok(!authenticated(req(cookie), { ...config, password: 'changed' }, now));
  assert.ok(credentialsMatch('admin', env.ADMIN_PASSWORD, config));
  assert.ok(!credentialsMatch('admin', 'wrong', config));
  assert.equal(authConfig({}), null);
  assert.equal(authConfig({ ...env, ADMIN_PASSWORD: 'short' }), null);
});

test('HTTP login, authenticated editing, photo upload, persistence, validation and archive', async (t) => {
  const github = await githubFixture();
  const previous = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  t.after(() => { for (const [k, v] of Object.entries(previous)) v === undefined ? delete process.env[k] : process.env[k] = v; });
  t.mock.method(globalThis, 'fetch', github.fetchImpl);
  const origin = 'https://gallery.test';
  let cookie = '';
  async function request(path, { method = 'GET', body, auth = true, source = origin } = {}) {
    const headers = { origin: source };
    if (auth) headers.cookie = cookie;
    if (body && !(body instanceof FormData)) { headers['content-type'] = 'application/json'; body = JSON.stringify(body); }
    const req = new Request(origin + path, { method, headers, body });
    return path === '/admin/api/login' ? login(req) : handler(req);
  }
  assert.equal((await request('/admin/api/djela', { auth: false })).status, 401);
  assert.equal(github.calls.length, 0);
  assert.equal((await request('/admin/api/login', { method: 'POST', body: { username: 'admin', password: 'wrong' } })).status, 401);
  assert.equal((await request('/admin/api/login', { method: 'POST', source: 'https://evil.test', body: { username: 'admin', password: env.ADMIN_PASSWORD } })).status, 403);
  const signedIn = await request('/admin/api/login', { method: 'POST', body: { username: 'admin', password: env.ADMIN_PASSWORD } });
  assert.equal(signedIn.status, 200);
  cookie = signedIn.headers.get('set-cookie').split(';')[0];
  assert.match(signedIn.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await request('/admin/api/session')).status, 200);
  assert.equal((await request('/admin/api/izlaz', { method: 'POST' })).status, 404);
  assert.equal((await request('/admin/api/djela', { method: 'POST', source: 'https://evil.test', body: {} })).status, 403);
  const listed = await (await request('/admin/api/djela')).json();
  assert.equal(listed.length, 1);

  const form = new FormData();
  form.append('slike', new File([await readFile(root + 'slike/bozuri-u-vazi.jpg')], 'painting.jpg', { type: 'image/jpeg' }));
  form.append('osnova', 'Test slika');
  const uploadedResponse = await request('/admin/api/slike', { method: 'POST', body: form });
  assert.equal(uploadedResponse.status, 200);
  const uploaded = await uploadedResponse.json();
  assert.equal(uploaded.slike[0].ok, true);
  const photo = uploaded.slike[0];
  assert.ok(github.read(root + photo.datoteka.slice(2)));
  assert.equal((await request('/admin/slicica/' + photo.ime)).status, 200);

  const original = await (await request('/admin/api/djela/bozuri-u-vazi')).json();
  const newWork = { podaci: { ...original.podaci, id: undefined, slug: 'nova-slika', naslov_hr: 'Nova slika', stanje_objave: 'skica', slike: [{ datoteka: photo.datoteka, uloga: 'glavna', alt_hr: 'Nova fotografija' }] }, opis_hr: 'Skica za test.' };
  const created = await request('/admin/api/djela', { method: 'POST', body: newWork });
  assert.equal(created.status, 200, await created.clone().text());
  assert.ok(github.read(root + 'nova-slika.md'));
  assert.equal((await request('/admin/api/djela', { method: 'POST', body: newWork })).status, 409);
  const current = await (await request('/admin/api/djela/nova-slika')).json();
  assert.equal(current.opis_hr, 'Skica za test.');
  assert.notEqual(current.podaci.id, original.podaci.id);
  const changed = { ...current, podaci: { ...current.podaci, naslov_hr: 'Promijenjena slika' } };
  assert.equal((await request('/admin/api/djela/nova-slika', { method: 'PUT', body: changed })).status, 200);
  assert.equal((await request('/admin/api/djela/nova-slika', { method: 'PUT', body: current })).status, 409);
  const latest = await (await request('/admin/api/djela/nova-slika')).json();
  assert.equal(latest.podaci.naslov_hr, 'Promijenjena slika');
  const beforeInvalid = github.head();
  assert.equal((await request('/admin/api/djela/nova-slika', { method: 'PUT', body: { ...latest, podaci: { ...latest.podaci, stanje_objave: 'objavljeno' } } })).status, 422);
  assert.equal(github.head(), beforeInvalid);
  const published = { ...latest, opis_hr: 'Opis umjetničkog rada i tehnike. '.repeat(20), podaci: { ...latest.podaci, stanje_objave: 'objavljeno' } };
  assert.equal((await request('/admin/api/djela/nova-slika', { method: 'PUT', body: published })).status, 200);
  const publicWork = await (await request('/admin/api/djela/nova-slika')).json();
  assert.equal(publicWork.podaci.stanje_objave, 'objavljeno');
  const archived = await request('/admin/api/djela/nova-slika/arhiviraj', { method: 'POST', body: { revision: publicWork.revision } });
  assert.equal(archived.status, 200);
  assert.equal((await request('/admin/api/djela/nova-slika')).status, 404);
  assert.ok(github.read('atelier/arhiva-online/nova-slika.md'));
  assert.ok(github.read(root + photo.datoteka.slice(2)));
  assert.equal(JSON.parse(github.read(root + '_slugovi.json')).find((r) => r.slug === 'nova-slika').stanje, 'povucen');
  assert.equal((await request('/admin/api/djela', { method: 'POST', body: newWork })).status, 409);
  const logout = await request('/admin/api/logout', { method: 'POST', body: {} });
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  cookie = '';
  assert.equal((await request('/admin/api/session')).status, 401);
});

test('GitHub failure and competing writes do not report success or change committed content', async () => {
  for (const failure of ['failWrites', 'conflict']) {
    const github = await githubFixture();
    const store = github.store();
    const work = await store.citajRad('bozuri-u-vazi');
    const head = github.head();
    github[failure]();
    const app = createAtelier(store, { online: true });
    const response = await app.request('/api/djela/bozuri-u-vazi', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: work.revision, podaci: { ...work.podaci, naslov_hr: 'Changed' }, opis_hr: work.tijelo }),
    });
    assert.equal(response.status, failure === 'conflict' ? 409 : 503);
    assert.equal((await response.json()).ok, false);
    assert.equal(github.head(), head);
    assert.equal((await github.store().citajRad('bozuri-u-vazi')).podaci.naslov_hr, work.podaci.naslov_hr);
  }
});

test('store rejects path traversal and missing photos', async () => {
  const github = await githubFixture();
  const store = github.store();
  await assert.rejects(store.citajRad('../../secret'), /Neispravna/);
  const work = await store.citajRad('bozuri-u-vazi');
  await assert.rejects(store.spremiRad(work.slug, { ...work.podaci, slike: [{ datoteka: '../../secret' }] }, work.tijelo), /fotografiju/);
  await assert.rejects(store.spremiRad(work.slug, { ...work.podaci, slike: [{ datoteka: './slike/missing.jpg' }] }, work.tijelo), /nije spremljena/);
});
