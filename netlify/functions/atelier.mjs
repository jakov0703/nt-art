import { createAtelier } from '../../atelier/app.mjs';
import { createGithubStore } from '../../atelier/github-store.mjs';
import { authConfig, authenticated, sameOrigin, logoutCookie, json } from '../../atelier/auth.mjs';

export default async function handler(request) {
  const auth = authConfig();
  if (!auth) return json({ ok: false, poruka: 'Online Atelier još nije podešen. Javite se administratoru.' }, 503);
  if (!authenticated(request, auth)) return json({ ok: false, poruka: 'Prijavite se za uređivanje.' }, 401);
  if (!['GET', 'HEAD'].includes(request.method) && !sameOrigin(request)) return json({ ok: false }, 403);
  const url = new URL(request.url);
  if (url.pathname === '/admin/api/session' && request.method === 'GET') return json({ ok: true });
  if (url.pathname === '/admin/api/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': logoutCookie() });
  // Local-only process-control endpoints are never exposed online.
  if (!url.pathname.startsWith('/admin/api/') && !url.pathname.startsWith('/admin/slicica/')) return json({ ok: false }, 404);
  if (Number(request.headers.get('content-length')) > 4_000_000) return json({ ok: false, poruka: 'Fotografija je prevelika. Dodajte JPG manji od 3 MB.' }, 413);
  try {
    const storage = createGithubStore({ repo: process.env.GITHUB_REPO, branch: process.env.GITHUB_BRANCH || 'main', token: process.env.GITHUB_TOKEN });
    const app = createAtelier(storage, { online: true, siteUrl: '/' });
    url.pathname = url.pathname.slice('/admin'.length);
    const response = await app.fetch(new Request(url, request));
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  } catch (error) {
    return json({ ok: false, poruka: error.status ? error.message : 'Spremanje nije uspjelo. Pokušajte ponovno.' }, error.status || 500);
  }
}

export const config = {
  path: ['/admin/api/*', '/admin/slicica/*'],
  excludedPath: ['/admin/api/login'],
};
