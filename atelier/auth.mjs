import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = '__Host-atelier';
const TTL = 8 * 60 * 60;
const digest = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');
const equal = (a, b) => {
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};

export function authConfig(env = process.env) {
  const { ADMIN_USERNAME = 'admin', ADMIN_PASSWORD, ADMIN_SESSION_SECRET } = env;
  if (ADMIN_PASSWORD?.length < 16 || !ADMIN_PASSWORD || ADMIN_SESSION_SECRET?.length < 32 || !ADMIN_SESSION_SECRET) return null;
  return { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, secret: ADMIN_SESSION_SECRET };
}

export function credentialsMatch(username, password, config) {
  return equal(digest(`${username}\0${password}`, config.secret), digest(`${config.username}\0${config.password}`, config.secret));
}

export function sessionCookie(config, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    exp: Math.floor(now / 1000) + TTL,
    identity: digest(`${config.username}\0${config.password}`, config.secret),
  })).toString('base64url');
  return `${COOKIE}=${payload}.${digest(payload, config.secret)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`;
}

export function authenticated(request, config, now = Date.now()) {
  const cookie = request.headers.get('cookie')?.split(';').map((x) => x.trim()).find((x) => x.startsWith(`${COOKIE}=`));
  if (!cookie) return false;
  const [payload, signature] = cookie.slice(COOKIE.length + 1).split('.');
  if (!payload || !signature || !equal(digest(payload, config.secret), signature)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Math.floor(now / 1000) && equal(data.identity, digest(`${config.username}\0${config.password}`, config.secret));
  } catch { return false; }
}

export const logoutCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export const sameOrigin = (request) => request.headers.get('origin') === new URL(request.url).origin;

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff', ...headers,
  } });
}
