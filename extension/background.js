// حاضر المعلم — الخلفية: سحب الحصص من التقويم، وفتح كل حصة في موعدها، والتنبيهات
const DEF = {
  settings: { teacherName: '', guardMin: 10, prepMin: 1, lateMin: 5, endWarnMin: 2, endMode: 'end', syncTimes: '06:30,20:30', weeks: 2, waPhone: '', postSummary: true, cloud: false, cloudToken: '', source: 'table' },
  clsMap: {},    // معرّف فريق/قناة Teams ← الصف (يتعلّم من تعديلاتك)
  update: {},    // {version, url, notes, checked}
  daySummary: {}, // {date: true} أُرسل تنبيه ملخص اليوم
  autoRosters: {}, // {الصف: true} قائمة تعلّمتها الإضافة من الحصص
  classes: [],   // أسبوعية {id, day, start, dur, cls, lesson, link, video} أو من التقويم {id, date, ..., src:'cal'}
  rosters: {},
  sessions: {},
  tabs: {},
  myClasses: [], periods: {},
  sync: { tabId: null, startedAt: 0, last: null, lastCount: 0, lastErr: '' }
};
async function get(k) { const o = await chrome.storage.local.get(k); return o[k] ?? structuredClone(DEF[k]); }
async function set(k, v) { await chrome.storage.local.set({ [k]: v }); }
// تعديل متسلسل لمفتاح واحد: يمنع ضياع البيانات عند وصول تحديثين في اللحظة نفسها
const Q = {};
function mutate(k, fn) {
  const run = (Q[k] || Promise.resolve()).then(async () => { const v = await get(k); const r = await fn(v); await set(k, v); return r; });
  Q[k] = run.catch(() => {}); return run;
}
const CAP = { events: 150, chat: 300, hands: 200 };
function capSession(s) { for (const [f, n] of Object.entries(CAP)) if (Array.isArray(s[f]) && s[f].length > n) s[f] = s[f].slice(-n); return s; }
// تنظيف يومي: حذف الجلسات الأقدم من 60 يومًا وحصص التقويم المنقضية
async function prune() {
  const lim = ymd(new Date(Date.now() - 60 * 86400000)), y = ymd(new Date(Date.now() - 86400000));
  await mutate('sessions', ss => { for (const k of Object.keys(ss)) if ((ss[k].day || '') < lim) delete ss[k]; else capSession(ss[k]); });
  await mutate('classes', cl => { const keep = cl.filter(c => !c.date || c.date >= y); cl.length = 0; cl.push(...keep); });
  await mutate('tabs', async tb => { const open = new Set((await chrome.tabs.query({})).map(t => String(t.id))); for (const id of Object.keys(tb)) if (!open.has(id)) delete tb[id]; });
}
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const mins = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const hhmm = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const UPDATE_URL = 'https://hadir.wasl.uk/version.json';
const threadOf = link => { try { const m = decodeURIComponent(decodeURIComponent(link || '')).match(/19:[^@\/\s"]+@thread\.[a-z0-9]+/i); return m ? m[0] : ''; } catch (e) { return ''; } };
const GRADE = /(الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس)(?:\s*الابتدائي)?\s*[\/\-]?\s*(أ|ا|ب|ج|د|هـ|\d)?/;
function guessCls(title, link, clsMap, rosterKeys) {
  const th = threadOf(link); if (th && clsMap[th]) return clsMap[th];
  const k = rosterKeys.find(r => r && title.includes(r)); if (k) return k;
  const g = title.match(GRADE); if (g) return (g[1].replace('الاول', 'الأول') + (g[2] ? ' ' + g[2].replace(/^ا$/, 'أ') : '')).trim();
  return '';
}
const vnum = v => String(v || '0').split('.').map(Number).reduce((a, x) => a * 1000 + (x || 0), 0);
const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };

function ensureAlarm() { chrome.alarms.create('tick', { periodInMinutes: 1 }); }
chrome.runtime.onInstalled.addListener(async () => {
  ensureAlarm();
  // توحيد أسماء الصفوف المحفوظة: «سادس ج» ← «السادس ج» (لتطابق جدول مدرستي)
  const fix = n => n.replace(/^(أول|اول|ثاني|ثالث|رابع|خامس|سادس)(?=\s)/, w => 'ال' + (w === 'اول' ? 'أول' : w));
  for (const k of ['rosters', 'autoRosters']) { const r = (await chrome.storage.local.get(k))[k]; if (!r) continue; let ch = 0;
    for (const n of Object.keys(r)) { const m = fix(n); if (m !== n) { r[m] = r[m] || r[n]; delete r[n]; ch = 1; } } if (ch) await chrome.storage.local.set({ [k]: r }); }
});
chrome.runtime.onStartup.addListener(async () => { ensureAlarm(); if ((await get('settings')).source === 'outlook') startSync(); });
chrome.storage.local.get('justUpdated').then(o => { if (o.justUpdated) { note('✅ حُدِّث حاضر المعلم إلى ' + o.justUpdated + ' تلقائيًا'); chrome.storage.local.remove('justUpdated'); ensureAlarm(); } });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick') tick(); });

function note(message, title = 'حاضر المعلم') {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/128.png', title, message, priority: 2 });
}
const classToday = (c, day, dow) => c.date ? c.date === day : (c.day !== undefined && c.day !== '' && Number(c.day) === dow);

async function tick() {
  const classes = (await get('classes')).filter(c => !c.skip), st = await get('settings'), sessions = await get('sessions'), sync = await get('sync');
  const d = new Date(), dow = d.getDay(), nm = nowMin(), day = today();
  // سحب التقويم في الأوقات المحددة
  const times = String(st.syncTimes || '').split(',').map(s => s.trim()).filter(Boolean);
  if (st.source === 'outlook' && times.includes(hhmm())) startSync();
  if (sync.tabId && Date.now() - sync.startedAt > 8 * 60000) { // مهلة
    try { await chrome.tabs.remove(sync.tabId); } catch (e) {}
    await set('sync', { ...sync, tabId: null, lastErr: 'انتهت مهلة السحب' });
  }
  // إعادة تحميل ذاتية إذا حدّث «مُحدِّث حاضر المعلم» الملفات على القرص (ولا توجد حصة جارية)
  if (d.getMinutes() % 5 === 0) try {
    const disk = await (await fetch(chrome.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' })).json();
    const live = Object.values(sessions).some(x => x.day === day && ['join', 'lock', 'live'].includes(x.phase));
    if (disk.version && disk.version !== chrome.runtime.getManifest().version && !live) {
      await chrome.storage.local.set({ justUpdated: disk.version });
      chrome.runtime.reload(); return;
    }
  } catch (e) {}
  if (d.getMinutes() % 30 === 7) pushSched();
  // تنظيف التخزين مرة يوميًا (يبقي الإضافة سريعة)
  if ((await chrome.storage.local.get('pruned')).pruned !== day) { await chrome.storage.local.set({ pruned: day }); prune(); }
  // فحص التحديث كل 6 ساعات
  const up = await get('update');
  if (!up.checked || Date.now() - up.checked > 6 * 3600000) checkUpdate();
  // تنبيه ملخص اليوم بعد انتهاء آخر حصة
  const todays = Object.values(sessions).filter(x => x.day === day);
  const pendingToday = classes.some(c => classToday(c, day, dow) && c.link && nm < mins(c.start) + Number(c.dur || 39));
  const ds = await get('daySummary');
  if (todays.length && !pendingToday && todays.every(x => ['done', 'stopped'].includes(x.phase)) && !ds[day]) {
    ds[day] = true; await set('daySummary', ds);
    chrome.notifications.create('summary-' + day, { type: 'basic', iconUrl: 'icons/128.png', title: 'حاضر المعلم',
      message: `انتهت حصص اليوم (${todays.length}). اضغط لإرسال الملخص على واتساب.`, buttons: [{ title: '📲 إرسال الملخص' }], priority: 2 });
  }
  // منع نوم الجهاز من قبل أول حصة بـ10 د حتى نهاية آخر حصة
  try {
    const td = classes.filter(c => classToday(c, day, dow) && c.link);
    const live = Object.values(sessions).some(x => x.day === day && ['join', 'lock', 'live'].includes(x.phase));
    const from = td.length ? Math.min(...td.map(c => mins(c.start))) - 10 : 1e9;
    const to = td.length ? Math.max(...td.map(c => mins(c.start) + Number(c.dur || 39))) + 5 : -1;
    if (live || (nm >= from && nm <= to)) chrome.power.requestKeepAwake('display'); else chrome.power.releaseKeepAwake();
  } catch (e) {}
  // عدّاد الأيقونة
  try {
    const live = Object.values(sessions).find(x => x.day === day && ['join', 'lock', 'live'].includes(x.phase));
    const next = classes.filter(c => classToday(c, day, dow) && c.link && mins(c.start) >= nm).sort((a, b) => mins(a.start) - mins(b.start))[0];
    if (live) { chrome.action.setBadgeText({ text: '●' }); chrome.action.setBadgeBackgroundColor({ color: '#16a34a' }); chrome.action.setTitle({ title: 'حاضر المعلم — حصة ' + live.cls + ' تعمل الآن' }); }
    else if (next && mins(next.start) - nm <= 90) { const m = mins(next.start) - nm; chrome.action.setBadgeText({ text: m + 'د' }); chrome.action.setBadgeBackgroundColor({ color: m <= 5 ? '#d97706' : '#0f766e' }); chrome.action.setTitle({ title: `حاضر المعلم — ${next.cls || next.lesson} بعد ${m} دقيقة` }); }
    else { chrome.action.setBadgeText({ text: '' }); chrome.action.setTitle({ title: 'حاضر المعلم' }); }
  } catch (e) {}
  // فتح كل حصة في موعدها
  for (const c of classes) {
    if (!classToday(c, day, dow) || !c.link) continue;
    const key = day + '|' + c.id;
    if (sessions[key]) continue;
    const open = mins(c.start) - Number(st.prepMin ?? 1);
    if (nm >= open && nm < mins(c.start) + Number(st.guardMin || 10)) await openSession(c, key);
  }
}

async function openSession(c, key) {
  await mutate('sessions', sessions => { sessions[key] = {
    classId: c.id, link: c.link, test: !!c.test, cls: c.cls || c.lesson || 'حصة', lesson: c.lesson || '', start: c.start, dur: Number(c.dur || 39),
    day: today(), phase: 'join', events: [], snaps: {}, chat: [], hands: [], seen: {},
    teacherSeen: null, locked: { mute: false, mic: false, cam: false }, report: null
  }; });
  const tab = await chrome.tabs.create({ url: c.link, active: true });
  await mutate('tabs', tabs => { tabs[tab.id] = key; });
  note(`بدأت حصة ${c.cls || c.lesson} – جارٍ فتحها وتجهيزها`);
}

// ===== سحب الحصص من تقويم Outlook =====
async function startSync() {
  if ((await get('settings')).source !== 'outlook') return { ok: true, table: true };
  const sync = await get('sync');
  if (sync.tabId) return { ok: false, err: 'السحب يعمل الآن' };
  const tab = await chrome.tabs.create({ url: 'https://outlook.office.com/calendar/view/workweek', active: false });
  await set('sync', { ...sync, tabId: tab.id, startedAt: Date.now(), lastErr: '' });
  return { ok: true };
}
async function mergeCal(events) {
  const classes = await get('classes');
  const clsMap = await get('clsMap'); const rosterKeys = Object.keys(await get('rosters'));
  const pick = (await get('settings')).pickMode === true;
  const dates = new Set(events.map(e => e.date));
  const now = today();
  const byId = Object.fromEntries(classes.map(c => [c.id, c]));
  const fresh = {};
  for (const e of events) {
    if (e.date < now) continue;
    const id = 'cal-' + e.date + '-' + e.start.replace(':', '') + '-' + hash(e.title);
    const old = byId[id] || {};
    fresh[id] = { id, src: 'cal', date: e.date, start: e.start, dur: e.dur, lesson: e.title,
      cls: old.cls || guessCls(e.title, e.link || old.link, clsMap, rosterKeys), link: e.link || old.link || '', video: old.video || e.video || '',
      skip: old.id ? !!old.skip : pick };
  }
  // احذف حصص التقويم الملغاة في الأيام التي سُحبت، واحتفظ بالباقي
  const kept = classes.filter(c => c.src !== 'cal' || (!dates.has(c.date) && c.date >= now));
  const merged = [...kept.filter(c => !fresh[c.id]), ...Object.values(fresh)];
  await set('classes', merged);
  return Object.values(fresh);
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  (async () => {
    if (m.t === 'whoami') {
      if (CHK.tab && sender.tab?.id === CHK.tab) return reply({ check: true });
      const tabs = await get('tabs'); const key = tabs[sender.tab?.id];
      if (!key) return reply(null);
      const s = (await get('sessions'))[key]; if (!s) return reply(null);
      const st = await get('settings');
      const roster = (await get('rosters'))[s.cls] || [];
      const c = (await get('classes')).find(x => x.id === s.classId) || {};
      reply({ key, s, st, roster, video: c.video || '', questions: c.questions || '' });
    } else if (m.t === 'syncWho') {
      const sync = await get('sync'); if (sender.tab?.id !== sync.tabId) return reply(null);
      const st = await get('settings'); const known = {};
      for (const c of await get('classes')) if (c.src === 'cal') known[c.date + '|' + c.start + '|' + c.lesson] = { link: c.link, video: c.video };
      reply({ teacherName: st.teacherName, weeks: Number(st.weeks || 2), known });
    } else if (m.t === 'calResult') {
      const sync = await get('sync'); if (sender.tab?.id !== sync.tabId) return reply(false);
      if (m.me) { const st = await get('settings'); if (!st.teacherName) { st.teacherName = m.me; await set('settings', st); } }
      const list = await mergeCal(m.events || []);
      const waiting = list.filter(c => c.skip).length;
      const noLink = list.filter(c => !c.link).length, noVid = list.filter(c => !c.video).length;
      await set('sync', { ...sync, tabId: null, last: new Date().toISOString(), lastCount: list.length, lastErr: '' });
      try { await chrome.tabs.remove(sender.tab.id); } catch (e) {}
      note(`سُحبت ${list.length} حصة من التقويم` + (noLink ? ` · ${noLink} بلا رابط` : '') + (noVid ? ` · ${noVid} بلا مقطع – أضف الرابط` : '') + (waiting ? ` · ${waiting} تنتظر اختيارك من «الأسبوع»` : ''));
      reply(true);
    } else if (m.t === 'testNow') {
      const d = new Date(Date.now() + 60000);
      const c = { id: 'test-' + Date.now(), test: true, cls: m.cls || 'حصة تجريبية', lesson: 'حصة تجريبية', start: pad(d.getHours()) + ':' + pad(d.getMinutes()),
        dur: Number(m.dur || 10), link: m.link, video: m.video || '' };
      if (!/teams\./.test(c.link || '')) return reply({ ok: false, err: 'ضع رابط اجتماع Teams' });
      const cl = await get('classes'); cl.push({ ...c, date: today(), src: 'test' }); await set('classes', cl);
      await openSession(c, today() + '|' + c.id); reply({ ok: true });
    } else if (m.t === 'learnCls') {
      const th = threadOf(m.link); if (!th || !m.cls) return reply(0);
      const map = await get('clsMap'); map[th] = m.cls; await set('clsMap', map);
      const cl = await get('classes'); let n = 0;
      for (const c of cl) if (c.src === 'cal' && !c.cls && threadOf(c.link) === th) { c.cls = m.cls; n++; }
      await set('classes', cl); reply(n);
    } else if (m.t === 'suggestVideo') {
      reply(await suggestVideo(m.title || '', m.cls || ''));
    } else if (m.t === 'liveTab') {
      const tabs = await get('tabs'), ss = await get('sessions');
      const e = Object.entries(tabs).find(([, k]) => ss[k] && ['join', 'lock', 'live'].includes(ss[k].phase));
      reply(e ? { tabId: Number(e[0]), key: e[1] } : null);
    } else if (m.t === 'openVideo') {
      const tabs = await get('tabs'), ss = await get('sessions');
      const e = Object.entries(tabs).find(([, k]) => ss[k] && ['join', 'lock', 'live'].includes(ss[k].phase));
      const c = e ? (await get('classes')).find(x => x.id === ss[e[1]].classId) : null;
      if (!c?.video) return reply({ ok: false, err: 'لا يوجد رابط مقطع لهذه الحصة' });
      await chrome.tabs.create({ url: c.video, active: true });
      note('شغّل المقطع، ثم اضغط أيقونة «حاضر المعلم» ← «📤 شارك هذا التبويب في Teams».');
      reply({ ok: true });
    } else if (m.t === 'cloudLink') {
      const st = await get('settings');
      if (!st.cloudToken) { const a = new Uint8Array(18); crypto.getRandomValues(a); st.cloudToken = [...a].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 32); await set('settings', st); }
      if (m.enable !== undefined) { st.cloud = !!m.enable; await set('settings', st); }
      if (st.cloud) await cloudSync();
      reply({ ok: true, cloud: st.cloud, url: CLOUD + '/m/' + st.cloudToken });
    } else if (m.t === 'checkUpdate') {
      reply(await checkUpdate(true));
    } else if (m.t === 'ctlPoll') {
      const st = await get('settings'); if (!st.ctlToken) return reply({});
      try { reply(await (await fetch(CLOUD + '/api/ctl/' + st.ctlToken + '/cmd?after=' + Number(m.after || 0), { cache: 'no-store' })).json()); } catch (e) { reply({}); }
    } else if (m.t === 'ctlState') {
      const st = await get('settings'); if (!st.ctlToken) return reply(false);
      try { await fetch(CLOUD + '/api/ctl/' + st.ctlToken + '/state', { method: 'POST', body: JSON.stringify(m.state) }); reply(true); } catch (e) { reply(false); }
    } else if (m.t === 'ctlLink') {
      const st = await get('settings');
      if (m.enable === false) { st.ctlToken = ''; await set('settings', st); return reply({ on: false }); }
      if (!st.ctlToken && m.enable) { const a = new Uint8Array(16); crypto.getRandomValues(a); st.ctlToken = [...a].map(x => x.toString(36).padStart(2, '0')).join('').slice(0, 30); await set('settings', st); }
      if (st.ctlToken) { await chrome.storage.local.remove('schedSig'); pushSched(); }
      reply(st.ctlToken ? { on: true, url: CLOUD + '/c/' + st.ctlToken } : { on: false });
    } else if (m.t === 'rasdMadrasati') {
      reply(await rasdMadrasati(m.day, m.names || []));
    } else if (m.t === 'checkLinks') {
      checkLinks(); reply(true);
    } else if (m.t === 'checkResult') {
      if (CHK.tab && sender.tab?.id === CHK.tab && CHK.done) CHK.done(m.r); reply(true);
    } else if (m.t === 'syncNow') {
      reply(await startSync());
    } else if (m.t === 'update') {
      const s = await mutate('sessions', ss => { ss[m.key] = capSession(Object.assign(ss[m.key] || {}, m.patch)); return ss[m.key]; });
      if (m.patch.report && !s.test) cloudSync();
      if (m.patch.report && !s.test && s.cls) { // تعلّم أسماء الطلاب من الحصة
        const rosters = await get('rosters'), auto = await get('autoRosters');
        const seenNames = m.patch.report.filter(r => !r.status.startsWith('غائب')).map(r => r.teams || r.name).filter(Boolean);
        if (!rosters[s.cls] || auto[s.cls]) {
          rosters[s.cls] = [...new Set([...(rosters[s.cls] || []), ...seenNames])]; auto[s.cls] = true;
          await set('rosters', rosters); await set('autoRosters', auto);
        }
      }
      reply(true);
    } else if (m.t === 'note') {
      note(m.msg); reply(true);
    } else if (m.t === 'video') {
      const vt = await chrome.tabs.create({ url: m.url, active: !!m.active });
      if (m.active) try { await chrome.windows.update(vt.windowId, { focused: true }); } catch (e) {}
      reply(true);
    } else if (m.t === 'cmd') {
      const tabs = await get('tabs'); const tabId = Object.keys(tabs).find(id => tabs[id] === m.key);
      if (!tabId) return reply({ ok: false, err: 'لا توجد حصة مفتوحة' });
      try { reply(await chrome.tabs.sendMessage(Number(tabId), m)); }
      catch (e) { reply({ ok: false, err: 'تبويب الحصة غير متاح' }); }
    } else if (m.t === 'startNow') {
      const c = (await get('classes')).find(x => x.id === m.id);
      if (c && c.link) { await openSession(c, today() + '|' + c.id + '|' + Date.now()); reply({ ok: true }); }
      else reply({ ok: false, err: 'الحصة بلا رابط' });
    }
  })();
  return true;
});

chrome.tabs.onRemoved.addListener(async id => {
  const tabs = await get('tabs'); const key = tabs[id];
  if (key) {
    await mutate('tabs', tb => { delete tb[id]; });
    const ss = await get('sessions'); const s = ss[key];
    if (s && ['join', 'lock', 'live'].includes(s.phase) && s.day === today() && nowMin() < mins(s.start) + s.dur && (s.reopens || 0) < 1) {
      const c = (await get('classes')).find(x => x.id === s.classId) || { link: s.link };
      if (c.link) {
        await mutate('sessions', s2 => { s2[key] = { ...s2[key], reopens: (s.reopens || 0) + 1, phase: 'join' }; });
        const t = await chrome.tabs.create({ url: c.link, active: false }); await mutate('tabs', tb => { tb[t.id] = key; });
        note(`أُغلق تبويب حصة ${s.cls} فأعدت فتحه. لإيقاف المساعد اضغط «إنهاء» من الإضافة.`);
      }
    }
  }
  const sync = await get('sync'); if (sync.tabId === id) await set('sync', { ...sync, tabId: null });
});

// ===== التحديث التلقائي =====
async function checkUpdate(manual) {
  const cur = chrome.runtime.getManifest().version;
  try {
    const r = await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(r.status);
    const v = await r.json(); const old = await get('update');
    const info = { version: v.version, url: v.url, notes: v.notes || '', checked: Date.now(), newer: vnum(v.version) > vnum(cur) };
    await set('update', info);
    if (info.newer && old.version !== v.version) {
      chrome.notifications.create('update', { type: 'basic', iconUrl: 'icons/128.png', title: 'حاضر المعلم — تحديث جديد ' + v.version,
        message: (v.notes || 'يوجد إصدار جديد') + ' — يُثبَّت تلقائيًا صباحًا، أو شغّل «Hadir Update» من سطح المكتب الآن', buttons: [{ title: 'طريقة التحديث' }], priority: 1 });
    }
    return { ok: true, ...info, current: cur };
  } catch (e) {
    await set('update', { ...(await get('update')), checked: Date.now() });
    return { ok: false, err: 'تعذّر فحص التحديث', current: cur };
  }
}

// ===== ملخص اليوم على واتساب =====
async function daySummaryText(day) {
  const ss = Object.values(await get('sessions')).filter(s => s.day === day && s.report && !s.test).sort((a, b) => a.start.localeCompare(b.start));
  const absCount = {};
  let t = `📊 *ملخص حصص اليوم — حاضر المعلم*\n${new Date(day + 'T12:00').toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}\n`;
  for (const s of ss) {
    const c = p => s.report.filter(r => r.status.startsWith(p));
    const abs = c('غائب').map(r => r.name);
    abs.forEach(n => absCount[n] = (absCount[n] || 0) + 1);
    t += `\n• ح ${s.start} – ${s.cls}: حاضر ${c('حاضر').length} · متأخر ${c('متأخر').length} · غائب ${abs.length}`;
    if (abs.length) t += `\n  الغائبون: ${abs.join('، ')}`;
  }
  const rep = Object.entries(absCount).filter(([, n]) => n > 1);
  if (rep.length) t += `\n\n🔁 تكرر غيابهم اليوم: ${rep.map(([n, k]) => n + ' (' + k + ')').join('، ')}`;
  if (!ss.length) t += '\nلا توجد حصص مرصودة اليوم.';
  return t;
}
async function openWhatsApp(day) {
  const st = await get('settings'); const text = await daySummaryText(day || today());
  const phone = String(st.waPhone || '').replace(/\D/g, '').replace(/^0/, '966');
  await chrome.tabs.create({ url: 'https://web.whatsapp.com/send?' + (phone ? 'phone=' + phone + '&' : '') + 'text=' + encodeURIComponent(text) });
}
chrome.notifications.onButtonClicked.addListener(async (id) => {
  if (id.startsWith('summary-')) openWhatsApp(id.slice(8));
  else if (id === 'update') chrome.tabs.create({ url: 'https://hadir.wasl.uk/install' });
});
chrome.notifications.onClicked.addListener(async (id) => {
  if (id.startsWith('summary-')) openWhatsApp(id.slice(8));
  else if (id === 'update') chrome.tabs.create({ url: 'https://hadir.wasl.uk/install' });
});
chrome.runtime.onMessage.addListener((m, _, reply) => {
  if (m.t === 'waSummary') { openWhatsApp(m.day).then(() => reply(true)); return true; }
  if (m.t === 'summaryText') { daySummaryText(m.day || today()).then(reply); return true; }
});

// ===== اقتراح مقطع «عين» للدرس =====
async function suggestVideo(title, cls) {
  const clean = String(title).replace(/\(.*?\)/g, ' ').replace(/(الدرس|درس)\s*(الأول|الثاني|الثالث|الرابع|الخامس|السادس|\d+)\s*[:：-]?/g, '').trim();
  const grade = (String(cls).match(/الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس/) || [''])[0];
  const q = `عين ${clean} ${grade ? 'الصف ' + grade : ''}`.replace(/\s+/g, ' ').trim();
  const searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  try {
    const html = await (await fetch(searchUrl, { headers: { 'accept-language': 'ar' } })).text();
    const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s); if (!m) throw 0;
    const out = [];
    (function walk(o) {
      if (!o || typeof o !== 'object' || out.length >= 12) return;
      if (o.videoRenderer) { const v = o.videoRenderer;
        out.push({ id: v.videoId, title: (v.title?.runs || []).map(r => r.text).join(''), owner: (v.ownerText?.runs || []).map(r => r.text).join(''),
          len: v.lengthText?.simpleText || '' }); return; }
      for (const k in o) walk(o[k]);
    })(JSON.parse(m[1]));
    const ien = out.filter(v => /عين|iEN|ien/i.test(v.owner));
    const list = (ien.length ? ien : out).slice(0, 3).map(v => ({ ...v, url: 'https://www.youtube.com/watch?v=' + v.id }));
    return { ok: true, list, searchUrl, q };
  } catch (e) { return { ok: false, list: [], searchUrl, q }; }
}

// ===== التقارير على الجوال (اختياري — يفعّله المعلم من الإعدادات) =====
const CLOUD = 'https://hadir.wasl.uk';
async function cloudSync() {
  const st = await get('settings'); if (!st.cloud || !st.cloudToken) return;
  const since = ymd(new Date(Date.now() - 21 * 86400000));
  const ss = Object.values(await get('sessions')).filter(s => s.report && !s.test && s.day >= since).map(s => ({
    day: s.day, start: s.start, cls: s.cls, lesson: s.lesson, phase: s.phase, teacherSeen: s.teacherSeen || '',
    report: s.report.map(r => ({ n: r.name, s: r.status })), hands: (s.hands || []).length,
    questions: (s.questions || []).map(q => ({ t: q.text, a: q.answers.slice(0, 5).map(a => a.name) })), summary: s.summary || '' }));
  try { await fetch(CLOUD + '/api/sync/' + st.cloudToken, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teacher: st.teacherName, at: new Date().toISOString(), sessions: ss }) }); } catch (e) {}
}

// ===== فحص الجاهزية: يفتح رابط كل صف لثوانٍ (دون الانضمام) ويتأكد أنه صالح وأنك داخل بحسابك =====
const CHK = { tab: null, done: null };
async function checkLinks() {
  const st = await get('settings'), now = new Date(), items = [], seen = new Set();
  const classes = (await get('classes')).filter(c => c.link && !c.skip && !c.test);
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() + i); const day = ymd(d), dow = d.getDay();
    for (const c of classes.filter(c => classToday(c, day, dow)).sort((a, b) => a.start.localeCompare(b.start))) {
      if (seen.has(c.link)) continue; seen.add(c.link);
      items.push({ id: c.id, cls: c.cls || c.lesson, day, start: c.start, link: c.link, status: 'wait' });
    }
  }
  const res = { running: true, at: Date.now(), items, teacher: st.teacherName || '' };
  await set('linkCheck', res);
  if (!items.length) { res.running = false; await set('linkCheck', res); return; }
  for (const it of items) {
    it.status = 'run'; await set('linkCheck', res);
    let tab;
    try {
      tab = await chrome.tabs.create({ url: it.link, active: false }); CHK.tab = tab.id;
      const r = await new Promise(ok => { CHK.done = ok; setTimeout(() => ok({ kind: 'timeout' }), 50000); });
      Object.assign(it, { status: r.kind, account: r.account || '', detail: r.detail || '' });
    } catch (e) { it.status = 'error'; it.detail = String(e.message || e); }
    CHK.tab = null; CHK.done = null; if (tab) chrome.tabs.remove(tab.id).catch(() => {});
    await set('linkCheck', res);
  }
  res.running = false; res.at = Date.now(); await set('linkCheck', res);
  const bad = items.filter(x => x.status !== 'ok').length;
  note(bad ? `فحص الجاهزية: ${bad} من ${items.length} رابط يحتاج إصلاحًا – افتح الإضافة لترى التفاصيل` : `فحص الجاهزية: كل الروابط (${items.length}) جاهزة ✓`);
}

// ===== رصد الغياب في منصة مدرستي (بمحرك «رصد الحضور السريع»: فحص ← معاينة ← حفظ بتأكيد المستخدم) =====
async function rasdMadrasati(day, names) {
  let [tab] = await chrome.tabs.query({ url: 'https://schools.madrasati.sa/*' });
  if (!tab) tab = await chrome.tabs.create({ url: 'https://schools.madrasati.sa/SchoolStructure/ClassRooms', active: true });
  else await chrome.tabs.update(tab.id, { active: true }), await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  for (let i = 0; i < 40; i++) { const t = await chrome.tabs.get(tab.id); if (t.status === 'complete') { tab = t; break; } await new Promise(r => setTimeout(r, 500)); }
  if (!/schools\.madrasati\.sa/.test(tab.url || '') || /login|Account\/Log/i.test(tab.url || '')) return { ok: false, err: 'سجّل الدخول في منصة مدرستي أولًا، ثم اضغط الزر مرة أخرى.' };
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/madrasati-engine.js'] });
    const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [day, names], func: (day, names) => {
      if (!window.__smEngine) return 'noengine';
      return window.__smEngine.open({ dates: [day], mode: names.length ? 'abs' : 'all', names, reason: 'رصد حضور حصة Teams (حاضر المعلم)', concurrency: 3 }) ? 'ok' : 'noschool';
    } });
    if (result === 'noschool') return { ok: false, err: 'افتح صفحة «الفصول المدرسية» في منصة مدرستي ثم أعد المحاولة.' };
    return { ok: result === 'ok', err: result === 'ok' ? '' : 'تعذّر تشغيل الرصد في الصفحة' };
  } catch (e) { return { ok: false, err: 'تعذّر الوصول لصفحة مدرستي: ' + e.message }; }
}

// ===== نسخ الجدول وأسماء الطلاب لتطبيق الجوال (عند تفعيل التحكم من الجوال) =====
async function pushSched() {
  const st = await get('settings'); if (!st.ctlToken) return;
  const day = today(), classes = (await get('classes')).filter(c => !c.date || c.date >= day).map(c => ({ src: c.src, day: c.day, p: c.p, date: c.date, start: c.start, dur: c.dur, cls: c.cls, lesson: c.lesson, link: c.link, skip: !!c.skip }));
  const body = { teacher: st.teacherName || '', myClasses: await get('myClasses'), periods: await get('periods'), classes, rosters: await get('rosters') };
  const sig = JSON.stringify(body).length + ':' + hash(JSON.stringify(body));
  if ((await chrome.storage.local.get('schedSig')).schedSig === sig) return;
  try { const r = await fetch(CLOUD + '/api/ctl/' + st.ctlToken + '/sched', { method: 'POST', body: JSON.stringify(body) }); if (r.ok) await chrome.storage.local.set({ schedSig: sig }); } catch (e) {}
}
chrome.storage.onChanged.addListener(ch => { if (ch.classes || ch.myClasses || ch.periods || ch.rosters) { clearTimeout(pushSched.t); pushSched.t = setTimeout(pushSched, 4000); } });

// ===== اختصار Ctrl+Shift+1: اعرض التبويب الحالي (المقطع) في Teams =====
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== 'share-video') return;
  const tabs = await get('tabs'), ss = await get('sessions');
  const e = Object.entries(tabs).find(([, k]) => ss[k] && ['join', 'lock', 'live'].includes(ss[k].phase));
  if (!e) return note('لا توجد حصة جارية الآن');
  let target = tab;
  if (!target) [target] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!target || target.id === Number(e[0])) return note('افتح تبويب المقطع أولًا، ثم اضغط Ctrl+Shift+1');
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: target.id, consumerTabId: Number(e[0]) });
    const r = await chrome.tabs.sendMessage(Number(e[0]), { t: 'cmd', key: e[1], c: 'shareTab', streamId });
    note(r?.ok ? '✅ المقطع يُعرض الآن للطلاب في Teams' : '❌ ' + (r?.err || 'تعذّرت المشاركة'));
  } catch (err) { note('❌ تعذّرت المشاركة: ' + err.message); }
});
