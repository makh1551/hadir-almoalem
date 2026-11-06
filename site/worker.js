// hadir.wasl.uk — يخدم موقع «حاضر المعلم» من مستودع GitHub makh1551/hadir-almoalem (أي تعديل يُدفع للمستودع يظهر خلال دقيقتين)
const RAW = 'https://raw.githubusercontent.com/makh1551/hadir-almoalem/main/';
const SITE = 'https://hadir.wasl.uk';
const MAP = { '/': 'site/index.html', '/guide': 'site/guide/index.html' };
const TYPES = { html: 'text/html; charset=utf-8', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', css: 'text/css', js: 'text/javascript' };

async function raw(path) { return fetch(RAW + path, { cf: { cacheTtl: 120, cacheEverything: true } }); }

export default {
  async fetch(req) {
    const u = new URL(req.url);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    if (p === '/version.json') {
      const r = await raw('version.json');
      if (!r.ok) return new Response('{}', { status: 502, headers: { 'content-type': 'application/json' } });
      const v = await r.json(); v.url = SITE + '/hadir-almoalem.zip';
      return new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-cache' } });
    }
    if (p === '/hadir-almoalem.zip' || p === '/download') {
      const r = await raw('hadir-almoalem.zip');
      if (!r.ok) return new Response('غير متاح', { status: 502 });
      return new Response(r.body, { headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="hadir-almoalem.zip"', 'cache-control': 'no-cache' } });
    }
    let path = MAP[p];
    if (!path && /^\/g\/[\w.-]+$/.test(p)) path = 'site/guide/' + p.slice(3);
    if (!path) return Response.redirect(SITE + '/', 302);
    const r = await raw(path);
    if (!r.ok) return new Response('غير موجود', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const ext = path.split('.').pop();
    return new Response(r.body, { headers: { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'public, max-age=300' } });
  }
};
