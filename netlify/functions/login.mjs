import { authConfig, credentialsMatch, sameOrigin, sessionCookie, json } from '../../atelier/auth.mjs';

export default async function login(request) {
  const auth = authConfig();
  if (!auth) return json({ ok: false, poruka: 'Prijava još nije podešena. Javite se administratoru.' }, 503);
  if (request.method !== 'POST') return json({ ok: false }, 405);
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  try {
    if (Number(request.headers.get('content-length')) > 4096) return json({ ok: false }, 413);
    const text = await request.text();
    if (text.length > 4096) return json({ ok: false }, 413);
    const { username, password } = JSON.parse(text);
    if (typeof username !== 'string' || typeof password !== 'string' || !credentialsMatch(username, password, auth)) {
      return json({ ok: false, poruka: 'Korisničko ime ili lozinka nisu ispravni.' }, 401);
    }
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(auth) });
  } catch { return json({ ok: false, poruka: 'Prijava nije uspjela.' }, 400); }
}

export const config = {
  path: '/admin/api/login',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rate_limit' },
};
