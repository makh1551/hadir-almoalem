// حاضر المعلم — سحب الحصص من تقويم Outlook (يعمل فقط في التبويب الذي فتحته الإضافة للسحب)
(() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim();
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = { 'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8, 'اغسطس': 8, 'سبتمبر': 9,
    'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12, January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8,
    September: 9, October: 10, November: 11, December: 12 };
  const TIME = /(\d{1,2}):(\d{2})\s*(صباحاً|صباحا|ص|مساءً|مساء|م|AM|PM)?\s*(?:إلى|to|-)\s*(\d{1,2}):(\d{2})\s*(صباحاً|صباحا|ص|مساءً|مساء|م|AM|PM)?/i;
  const DATE = new RegExp('(' + Object.keys(MONTHS).join('|') + ')\\s+(\\d{1,2}),?\\s*(\\d{4})');
  const ORG = /(?:بواسطة|By|Organizer:?|المنظم:?)\s+([^,،]+)/;
  const CANCEL = /^(تم الإلغاء|ملغى|Canceled|Cancelled)/i;

  const to24 = (h, m, ap) => { h = +h; const pm = /مساء|^م$|PM/i.test(ap || ''), am = /صباح|^ص$|AM/i.test(ap || '');
    if (pm && h < 12) h += 12; if (am && h === 12) h = 0; return pad(h) + ':' + pad(m); };
  function parse(label) {
    const t = label.match(TIME), d = label.match(DATE); if (!t || !d) return null;
    const title = norm(label.slice(0, t.index).replace(/[،,\s]+$/, '')); if (!title || CANCEL.test(title)) return null;
    const start = to24(t[1], t[2], t[3] || t[6]), end = to24(t[4], t[5], t[6] || t[3]);
    const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number);
    const date = `${d[3]}-${pad(MONTHS[d[1]])}-${pad(+d[2])}`;
    const org = (label.match(ORG) || [])[1]; const online = /Online meeting|اجتماع عبر الإنترنت|Teams/i.test(label);
    return { title, date, start, dur: Math.max(10, (eh * 60 + em) - (sh * 60 + sm)), organizer: org ? norm(org) : '', online };
  }
  const isMe = (org, me) => { if (!org) return true; const p = norm(me).split(' ').filter(x => x.length > 2);
    if (!p.length) return true; return p.filter(x => org.includes(x)).length >= Math.min(2, p.length); };
  function findLink(root = document) {
    const h = [...root.querySelectorAll('a[href]')].map(a => a.href).find(x => /teams\.(microsoft|live)\.com\/(l\/meetup-join|meet\/)/.test(x));
    if (h) return h;
    const m = (root.innerText || '').match(/https:\/\/teams\.(?:microsoft|live)\.com\/(?:l\/meetup-join|meet)\/[^\s"<>]+/); return m ? m[0] : '';
  }
  function findVideo(root = document) {
    const re = /(youtube\.com\/watch|youtu\.be\/|youtube\.com\/embed|ien\.edu\.sa|ien\.sa|\.mp4)/i;
    const h = [...root.querySelectorAll('a[href]')].map(a => a.href).find(x => re.test(x)); return h || '';
  }
  const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  function findBtn(list) {
    const els = [...document.querySelectorAll('button,[role="button"]')];
    for (const w of list.map(norm)) { const e = els.find(x => norm(x.getAttribute('aria-label') + ' ' + x.innerText).includes(w)); if (e) return e; }
    return null;
  }

  async function scrapeVisible(cfg, out) {
    const seen = new Set();
    for (let pass = 0; pass < 2; pass++) {
      const els = [...document.querySelectorAll('[role="button"][aria-label]')];
      for (const el of els) {
        const label = el.getAttribute('aria-label'); const ev = parse(label); if (!ev) continue;
        const key = ev.date + '|' + ev.start + '|' + ev.title; if (seen.has(key) || out[key]) continue; seen.add(key);
        if (!isMe(ev.organizer, cfg.teacherName)) continue;
        if (cfg.known[key]?.link) { out[key] = { ...ev, link: cfg.known[key].link, video: cfg.known[key].video || '' }; continue; }
        // افتح بطاقة الحدث واقرأ الرابط
        el.scrollIntoView({ block: 'center' }); el.click(); await sleep(1600);
        const pop = document.querySelector('[role="dialog"],[class*="callout"],[class*="Callout"]') || document;
        let link = findLink(pop), video = findVideo(pop);
        if (!link) {
          const url = location.href; el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await sleep(3500);
          link = findLink(); video = video || findVideo();
          if (location.href !== url) { history.back(); await sleep(2500); }
        } else esc();
        await sleep(400);
        if (link || ev.online) out[key] = { ...ev, link, video };
      }
    }
  }

  async function run() {
    let cfg; try { cfg = await chrome.runtime.sendMessage({ t: 'syncWho' }); } catch (e) { return; }
    if (!cfg) return;
    for (let i = 0; i < 20 && !document.querySelector('[role="button"][aria-label]'); i++) await sleep(1000);
    await sleep(3000);
    if (!cfg.teacherName) { // الاسم غير معروف بعد: اقرأه من الحساب حتى لا تُسحب اجتماعات الآخرين
      const acc = document.querySelector('#mectrl_currentAccount_primary, [data-tid="me-control-display-name"]');
      const b = [...document.querySelectorAll('button[aria-label]')].map(x => x.getAttribute('aria-label')).find(l => /Account manager for|مدير الحساب ل/.test(l || ''));
      cfg.teacherName = acc ? norm(acc.textContent) : b ? norm(b.replace(/.*(Account manager for|مدير الحساب لـ?)\s*/, '')) : '';
    }
    const out = {};
    await scrapeVisible(cfg, out);
    for (let w = 1; w < (cfg.weeks || 2); w++) {
      const next = findBtn(['الانتقال إلى الأسبوع التالي', 'Go to next week', 'الأسبوع التالي', 'Next week', 'الانتقال إلى الفترة الزمنية التالية', 'Go to next']);
      if (!next) break; next.click(); await sleep(4000); await scrapeVisible(cfg, out);
    }
    let me = '';
    const acc = document.querySelector('#mectrl_currentAccount_primary, #O365_MainLink_Me [class*="Name"], [data-tid="me-control-display-name"]');
    if (acc) me = norm(acc.textContent);
    if (!me) { const b = [...document.querySelectorAll('button[aria-label]')].map(x => x.getAttribute('aria-label')).find(l => /Account manager for|مدير الحساب ل/.test(l || ''));
      if (b) me = norm(b.replace(/.*(Account manager for|مدير الحساب لـ?)\s*/, '')); }
    chrome.runtime.sendMessage({ t: 'calResult', events: Object.values(out), me });
  }
  run();
})();
