import matter from 'gray-matter';
import { serijaliziraj } from '../src/core/yaml.mjs';

const ROOT = 'src/content/radovi/';
const REGISTRY = `${ROOT}_slugovi.json`;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const imagePattern = /^[a-z0-9-]+\.jpg$/;

export function userError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

// One snapshot and one atomic commit per request. A competing writer causes a
// conflict, never a force-push or a success response for an unsaved change.
export function createGithubStore({ repo, branch = 'main', token, fetchImpl = fetch }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !token || !branch) {
    throw userError('Online spremanje još nije podešeno. Javite se administratoru.', 503);
  }
  const base = `https://api.github.com/repos/${repo}`;
  const branchPath = branch.split('/').map(encodeURIComponent).join('/');
  const staged = new Map();
  const cached = new Map();
  let snapshot;

  async function api(path, method = 'GET', body) {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      if (method === 'PATCH' && [409, 422].includes(response.status)) {
        throw userError('U međuvremenu je spremljena druga promjena. Ponovno otvorite rad prije spremanja.', 409);
      }
      throw userError('GitHub spremanje nije dostupno. Pokušajte ponovno ili provjerite pristup repozitoriju.', 503);
    }
    return response.json();
  }

  async function load() {
    snapshot ??= (async () => {
      const ref = await api(`/git/ref/heads/${branchPath}`);
      const commit = await api(`/git/commits/${ref.object.sha}`);
      const tree = await api(`/git/trees/${commit.tree.sha}?recursive=1`);
      if (tree.truncated) throw userError('Repozitorij je prevelik za ovaj editor. Javite se administratoru.', 503);
      return { head: ref.object.sha, tree: commit.tree.sha, files: new Map(tree.tree.filter((x) => x.type === 'blob').map((x) => [x.path, x.sha])) };
    })();
    return snapshot;
  }

  async function read(path) {
    if (staged.has(path)) return staged.get(path);
    const { files } = await load();
    if (!files.has(path)) return null;
    if (!cached.has(path)) {
      cached.set(path, api(`/git/blobs/${files.get(path)}`).then((b) => Buffer.from(b.content, 'base64')));
    }
    return cached.get(path);
  }

  function workPath(slug) {
    if (!slugPattern.test(slug)) throw userError('Neispravna web adresa rada.');
    return `${ROOT}${slug}.md`;
  }
  function imagePath(name) {
    if (!imagePattern.test(name)) throw userError('Neispravan naziv fotografije.');
    return `${ROOT}slike/${name}`;
  }

  async function citajRad(slug) {
    const path = workPath(slug);
    const value = await read(path);
    if (!value) return null;
    const { data, content } = matter(value.toString('utf8'));
    return { slug, podaci: data, tijelo: content.trim(), revision: (await load()).files.get(path) };
  }
  async function popisRadova() {
    const { files } = await load();
    const names = [...files.keys()].filter((p) => p.startsWith(ROOT) && /^[^/]+\.md$/.test(p.slice(ROOT.length)));
    return Promise.all(names.map((p) => citajRad(p.slice(ROOT.length, -3))));
  }
  async function citajRegistar() {
    const raw = await read(REGISTRY);
    const registry = raw ? JSON.parse(raw.toString('utf8')) : [];
    // Older local versions did not register imported works.
    for (const work of await popisRadova()) {
      if (!registry.some((r) => r.slug === work.slug)) registry.push({ slug: work.slug, id: work.podaci.id, stanje: 'aktivan' });
    }
    return registry;
  }

  async function spremiRad(slug, data, body) {
    const { files } = await load();
    for (const image of data.slike) {
      if (!/^\.\/slike\/[a-z0-9-]+\.jpg$/.test(image.datoteka)) throw userError('Ponovno dodajte fotografiju kroz obrazac.');
      if (!files.has(`${ROOT}${image.datoteka.slice(2)}`)) throw userError('Fotografija nije spremljena. Ponovno je dodajte.');
    }
    if (data.slug_en) {
      const duplicate = (await popisRadova()).some((r) => r.slug !== slug && r.podaci.slug_en === data.slug_en);
      if (duplicate) throw userError('Engleska web adresa već postoji. Promijenite engleski naslov.');
    }
    const registry = await citajRegistar();
    if (!registry.some((r) => r.slug === slug)) registry.push({ slug, id: data.id, stanje: 'aktivan', od: new Date().toISOString().slice(0, 10) });
    staged.set(workPath(slug), Buffer.from(serijaliziraj(data, body)));
    staged.set(REGISTRY, Buffer.from(JSON.stringify(registry, null, 2) + '\n'));
  }

  async function arhivirajRad(slug) {
    const path = workPath(slug);
    const raw = await read(path);
    if (!raw) throw userError('Taj rad ne postoji.', 404);
    const registry = await citajRegistar();
    const entry = registry.find((r) => r.slug === slug);
    if (entry) entry.stanje = 'povucen';
    staged.set(REGISTRY, Buffer.from(JSON.stringify(registry, null, 2) + '\n'));
    staged.set(`atelier/arhiva-online/${slug}.md`, raw);
    staged.set(path, null);
    // Keep images in place: other works may reference the same image.
  }

  async function zabiljezi(message) {
    if (!staged.size) return { ok: true, promjena: false };
    const { head, tree } = await load();
    const entries = [];
    for (const [path, value] of staged) {
      const sha = value === null ? null : (await api('/git/blobs', 'POST', { content: value.toString('base64'), encoding: 'base64' })).sha;
      entries.push({ path, mode: '100644', type: 'blob', sha });
    }
    const nextTree = await api('/git/trees', 'POST', { base_tree: tree, tree: entries });
    const commit = await api('/git/commits', 'POST', { message, tree: nextTree.sha, parents: [head] });
    await api(`/git/refs/heads/${branchPath}`, 'PATCH', { sha: commit.sha, force: false });
    staged.clear();
    return { ok: true, promjena: true, sha: commit.sha };
  }

  return {
    citajRad, popisRadova, citajRegistar, spremiRad, arhivirajRad, zabiljezi,
    jeGitRepo: async () => true,
    citajSliku: (name) => read(imagePath(name)),
    spremiSliku: async (name, buffer) => {
      const path = imagePath(name);
      if ((await load()).files.has(path)) throw userError('Naziv fotografije već postoji. Pokušajte ponovno.', 409);
      staged.set(path, buffer);
    },
  };
}
