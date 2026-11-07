// hadir.wasl.uk — موقع «حاضر المعلم»: الصفحات من مستودع GitHub، والتقارير والاستبيان في KV (env.DATA)
const RAW = 'https://raw.githubusercontent.com/makh1551/hadir-almoalem/main/';
const SITE = 'https://hadir.wasl.uk';
const MAP = { '/': 'site/index.html', '/guide': 'site/guide/index.html', '/faq': 'site/faq/index.html',
  '/feedback': 'site/feedback/index.html', '/install': 'site/install/index.html', '/feedback/results': 'site/feedback/results.html', '/app': 'site/app/index.html' };
const TYPES = { html: 'text/html; charset=utf-8', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', css: 'text/css', js: 'text/javascript', webmanifest: 'application/manifest+json' };
const TOKEN = /^[a-z0-9]{24,40}$/;
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
async function raw(path) { return fetch(RAW + path, { cf: { cacheTtl: 120, cacheEverything: true } }); }
async function page(path) {
  const r = await raw(path);
  if (!r.ok) return new Response('غير موجود', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const ext = path.split('.').pop();
  return new Response(r.body, { headers: { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': path.endsWith('sw.js') ? 'no-cache' : 'public, max-age=300', 'x-robots-tag': path.includes('/m.') ? 'noindex' : 'all' } });
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const p = u.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type' } });

    // التحديث والتنزيل
    if (p === '/version.json') {
      const r = await raw('version.json'); if (!r.ok) return json({}, 502);
      const v = await r.json(); v.url = SITE + '/hadir-almoalem.zip';
      return json(v);
    }
    if (p === '/hadir-almoalem.zip' || p === '/download') {
      const r = await raw('hadir-almoalem.zip'); if (!r.ok) return new Response('غير متاح', { status: 502 });
      return new Response(r.body, { headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="hadir-almoalem.zip"', 'cache-control': 'no-cache' } });
    }

    if (p === '/install.bat' || p === '/update.bat') {
      const r = await raw('site/install.bat'); if (!r.ok) return new Response('غير متاح', { status: 502 });
      return new Response(r.body, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="hadir-install.bat"', 'cache-control': 'no-cache' } });
    }

    // التقارير على الجوال
    let m = p.match(/^\/api\/sync\/([a-z0-9]+)$/);
    if (m && req.method === 'POST') {
      if (!TOKEN.test(m[1])) return json({ ok: false }, 400);
      const body = await req.text(); if (body.length > 900000) return json({ ok: false, err: 'كبير' }, 413);
      try { JSON.parse(body); } catch (e) { return json({ ok: false }, 400); }
      await env.DATA.put('r:' + m[1], body, { expirationTtl: 60 * 86400 });
      return json({ ok: true });
    }
    m = p.match(/^\/api\/r\/([a-z0-9]+)$/);
    if (m) { if (!TOKEN.test(m[1])) return json({}, 400); const v = await env.DATA.get('r:' + m[1]); return v ? new Response(v, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }) : json({ sessions: [] }); }
    if (/^\/m\/[a-z0-9]+$/.test(p)) return page('site/m.html');

    // التحكم من الجوال: كائن دائم لكل معلم (فوري ومتسق)
    m = p.match(/^\/api\/ctl\/([a-z0-9]+)\/(cmd|state|sched)$/);
    if (m) {
      if (!TOKEN.test(m[1])) return json({ ok: false }, 400);
      const stub = env.CTL.get(env.CTL.idFromName(m[1]));
      const r = await stub.fetch('https://do/' + m[2] + u.search, { method: req.method, body: req.method === 'POST' ? await req.text() : undefined });
      return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
    }
    if (/^\/c\/[a-z0-9]+$/.test(p)) return page('site/c.html');

    // الاستبيان
    if (p === '/api/feedback' && req.method === 'POST') {
      const body = await req.text(); if (body.length > 6000) return json({ ok: false }, 413);
      let f; try { f = JSON.parse(body); } catch (e) { return json({ ok: false }, 400); }
      const rec = { at: new Date().toISOString(), rating: Number(f.rating) || 0, school: String(f.school || '').slice(0, 80), name: String(f.name || '').slice(0, 80),
        used: [].concat(f.used || []).slice(0, 12).map(x => String(x).slice(0, 40)), good: String(f.good || '').slice(0, 1500), bad: String(f.bad || '').slice(0, 1500), idea: String(f.idea || '').slice(0, 1500) };
      await env.DATA.put('fb:' + Date.now() + ':' + Math.random().toString(36).slice(2, 6), JSON.stringify(rec), { expirationTtl: 365 * 86400 });
      return json({ ok: true });
    }
    if (p === '/api/feedback') {
      if (!env.ADMIN || u.searchParams.get('k') !== env.ADMIN) return json({ ok: false }, 403);
      const list = await env.DATA.list({ prefix: 'fb:' }); const out = [];
      for (const k of list.keys) { const v = await env.DATA.get(k.name); if (v) out.push(JSON.parse(v)); }
      return json({ ok: true, items: out.sort((a, b) => b.at.localeCompare(a.at)) });
    }

    // الصفحات
    let path = MAP[p];
    if (!path && /^\/g\/[\w.-]+$/.test(p)) path = 'site/guide/' + p.slice(3);
    if (!path && /^\/app\/[\w.-]+$/.test(p)) path = 'site/app/' + p.slice(5);
    if (!path) return Response.redirect(SITE + '/', 302);
    return page(path);
  }
};

// كائن التحكم: آخر أمر من الجوال + آخر حالة من الحصة
export class Ctl {
  constructor(state) { this.st = state.storage; }
  async fetch(req) {
    const u = new URL(req.url), k = u.pathname.slice(1);
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
    if (req.method === 'POST') {
      const body = await req.text(); if (body.length > 60000) return J({ ok: false }, 413);
      let o; try { o = JSON.parse(body); } catch (e) { return J({ ok: false }, 400); }
      if (k === 'cmd') {
        const C = ['teacherIn', 'muteAll', 'relock', 'status', 'ask', 'summary', 'video', 'end', 'allow'];
        if (!C.includes(o.c)) return J({ ok: false }, 400);
        const cmd = { id: Date.now(), c: o.c, text: String(o.text || '').slice(0, 300), name: String(o.name || '').slice(0, 80) };
        await this.st.put('cmd', cmd); return J({ ok: true, id: cmd.id });
      }
      o.at = Date.now(); await this.st.put(k === 'sched' ? 'sched' : 'state', o); return J({ ok: true });
    }
    if (k === 'cmd') { const c = await this.st.get('cmd'); const after = Number(u.searchParams.get('after') || 0);
      return J(c && c.id > after && Date.now() - c.id < 120000 ? { cmd: c } : {}); }
    return J((await this.st.get(k === 'sched' ? 'sched' : 'state')) || {});
  }
}
