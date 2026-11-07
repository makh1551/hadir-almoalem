// حاضر المعلم 3 — الخلفية: سحب اجتماعات الأسبوع (الأحد–الخميس) من تقويم Outlook، وفتح كل اجتماع في موعده، وفتح مقطعه، وإغلاقه عند نهايته.
const DEF = {
  settings: { auto: true, prepMin: 1, syncTime: '06:30', lastSyncDay: '' },
  meetings: [],          // {id, date, start, dur, title, link, video, off}
  runs: {},              // id → {tabId, phase, at}
  sync: { tabId: null, last: '', count: 0, err: '' },
  update: {}
};
const UPDATE_URL = 'https://hadir.wasl.uk/version.json';
async function get(k) { const o = await chrome.storage.local.get(k); return o[k] ?? structuredClone(DEF[k]); }
async function set(k, v) { await chrome.storage.local.set({ [k]: v }); }
const Q = {};
function mutate(k, fn) { const run = (Q[k] || Promise.resolve()).then(async () => { const v = await get(k); const r = await fn(v); await set(k, v); return r; }); Q[k] = run.catch(() => {}); return run; }
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mins = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
function note(message) { chrome.notifications.create('', { type: 'basic', iconUrl: 'icons/128.png', title: 'حاضر المعلم', message: String(message).slice(0, 300), priority: 2 }); }

function ensureAlarm() { chrome.alarms.create('tick', { periodInMinutes: 1 }); }
chrome.runtime.onInstalled.addListener(async () => { ensureAlarm(); const m = await get('meetings'); if (!m.length) startSync(); });
chrome.runtime.onStartup.addListener(ensureAlarm);
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'tick') tick(); });

// ===== الدقيقة =====
async function tick() {
  const st = await get('settings'), d = new Date(), day = ymd(d), dow = d.getDay(), nm = d.getHours() * 60 + d.getMinutes();
  // السحب: يوميًا في الموعد (وأول تشغيل في اليوم إن فات الموعد والجهاز كان مغلقًا)
  if (st.lastSyncDay !== day && nm >= mins(st.syncTime || '06:30') && nm < 22 * 60) { st.lastSyncDay = day; await set('settings', st); startSync(); }
  const meetings = (await get('meetings')).filter(m => m.date === day && !m.off && m.link);
  // إبقاء الجهاز مستيقظًا أثناء الدوام
  const busy = meetings.some(m => nm >= mins(m.start) - 10 && nm < mins(m.start) + Number(m.dur || 40) + 2);
  try { busy ? chrome.power.requestKeepAwake('system') : chrome.power.releaseKeepAwake(); } catch (e) {}
  // شارة الأيقونة: الوقت حتى الاجتماع القادم
  const next = meetings.filter(m => mins(m.start) + Number(m.dur || 40) > nm).sort((a, b) => a.start.localeCompare(b.start))[0];
  const live = next && nm >= mins(next.start) - (st.prepMin || 1);
  chrome.action.setBadgeBackgroundColor({ color: live ? '#16a34a' : '#0f766e' });
  chrome.action.setBadgeText({ text: !st.auto ? 'off' : live ? '●' : next && mins(next.start) - nm <= 99 ? (mins(next.start) - nm) + 'د' : '' });
  // تحديث كل 6 ساعات (لا يعيد التحميل أثناء حصة)
  const up = await get('update'); if (Date.now() - (up.at || 0) > 6 * 3600000) checkUpdate();
  if (!busy && d.getMinutes() % 5 === 0) try { const disk = await (await fetch(chrome.runtime.getURL('manifest.json') + '?t=' + Date.now())).json(); if (disk.version !== chrome.runtime.getManifest().version) chrome.runtime.reload(); } catch (e) {}
  if (!st.auto || dow > 4) return;   // الأحد (0) إلى الخميس (4)
  const runs = await get('runs');
  for (const m of meetings) {
    const s = mins(m.start), e = s + Number(m.dur || 40);
    if (nm >= s - (st.prepMin || 1) && nm < e - 2 && !runs[m.id]) await openMeeting(m);
  }
}

async function openMeeting(m) {
  const tab = await chrome.tabs.create({ url: m.link, active: true });
  await mutate('runs', r => { r[m.id] = { tabId: tab.id, phase: 'join', at: Date.now() }; });
  note(`فتحتُ «${m.title}» (${m.start}) – جارٍ الدخول وتعطيل المايك والكاميرا`);
}
async function openVideo(m) {
  if (!m.video) return note(`«${m.title}» بلا مقطع – أضف رابط المقطع من الإضافة.`);
  const runs = await get('runs'), r = runs[m.id];
  const v = await chrome.tabs.create({ url: m.video, active: true });
  await mutate('runs', rr => { if (rr[m.id]) rr[m.id].videoTab = v.id; });
  setTimeout(() => autoShare(m.id), 7000);
}

// ===== عرض المقطع داخل Teams آليًا =====
// يشغّل المقطع ويضغط «مشاركة» في Teams بلمسة «مستخدم» عبر واجهة المطوّر في Chrome،
// فيختار Chrome تبويب المقطع تلقائيًا على جهاز الحصص (مفتاح التشغيل --auto-select-tab-capture-source-by-title=YouTube)،
// وفي غيره تظهر نافذة اختيار المشاركة: اختر تبويب المقطع.
async function cdp(tabId, expr) {
  const t = { tabId };
  try { await chrome.debugger.attach(t, '1.3'); } catch (e) { if (!/already attached/i.test(e.message)) throw e; }
  try { const r = await chrome.debugger.sendCommand(t, 'Runtime.evaluate', { expression: expr, userGesture: true, awaitPromise: true, returnByValue: true }); return r?.result?.value; }
  finally { try { await chrome.debugger.detach(t); } catch (e) {} }
}
const FIND = `(labels)=>{const n=s=>(s||'').replace(/\\s+/g,' ').trim();const v=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0};
  const els=[...document.querySelectorAll('button,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="tab"],[role="option"]')].filter(v);
  for(const w of labels){const e=els.find(x=>{const a=n(x.getAttribute('aria-label')),t=n(x.textContent);return (a===w||t===w||a.startsWith(w)||t.startsWith(w))&&!/دعوة|invite|إيقاف|Stop/i.test(a+' '+t)});if(e)return e}return null}`;
async function autoShare(id) {
  const runs = await get('runs'), r = runs[id]; if (!r || !r.videoTab || !['lock', 'live'].includes(r.phase)) return;
  try {
    // 1) شغّل المقطع (كتم الصوت لا يُفعَّل)
    await cdp(r.videoTab, `(async()=>{for(let i=0;i<20;i++){const v=document.querySelector('video');if(v){v.muted=false;try{await v.play()}catch(e){}return !v.paused}await new Promise(r=>setTimeout(r,500))}return false})()`);
    // 2) «مشاركة» في Teams ثم اختيار «علامة تبويب/الشاشة»
    const ok = await cdp(r.tabId, `(async()=>{const f=${FIND};const s=f(['مشاركة المحتوى','مشاركة','Share content','Share']);if(!s)return 'noshare';s.click();
      for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,500));const o=f(['علامة التبويب','علامة تبويب','Tab','الشاشة','شاشة','Screen','نافذة','Window']);if(o){o.click();break}}
      for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,500));if(f(['إيقاف المشاركة','إيقاف العرض','Stop sharing','Stop presenting']))return 'shared'}return 'nopick'})()`);
    note(ok === 'shared' ? '✅ المقطع يُعرض الآن للطلاب داخل Teams' : ok === 'noshare' ? 'لم أجد زر «مشاركة» في Teams – اعرض المقطع يدويًا.' : 'اختر تبويب المقطع في نافذة المشاركة (أو اضغط Ctrl+Shift+1).');
    if (ok === 'shared') chrome.tabs.update(r.tabId, { active: true });
  } catch (e) { note('تعذّر عرض المقطع آليًا: ' + e.message + ' – اضغط Ctrl+Shift+1'); }
}

// ===== الرسائل =====
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  (async () => {
    if (m.t === 'whoami') {
      const runs = await get('runs'), id = Object.keys(runs).find(k => runs[k].tabId === sender.tab?.id);
      if (!id) return reply(null);
      const mt = (await get('meetings')).find(x => x.id === id);
      reply(mt ? { m: runs[id].start ? { ...mt, start: runs[id].start } : mt } : null);
    } else if (m.t === 'state') {
      await mutate('runs', r => { if (r[m.id]) Object.assign(r[m.id], m.patch); }); reply(true);
    } else if (m.t === 'ready') {
      const mt = (await get('meetings')).find(x => x.id === m.id); if (mt) openVideo(mt); reply(true);
    } else if (m.t === 'closeTab') {
      const id = sender.tab?.id; setTimeout(() => chrome.tabs.remove(id).catch(() => {}), m.later || 5000);
      const runs = await get('runs'), rid = Object.keys(runs).find(k => runs[k].tabId === id);
      if (rid && runs[rid].videoTab) chrome.tabs.remove(runs[rid].videoTab).catch(() => {});
      reply(true);
    } else if (m.t === 'note') { note(m.msg); reply(true); }
    else if (m.t === 'syncWho') {
      const sync = await get('sync'); if (sender.tab?.id !== sync.tabId) return reply(null);
      reply({ teacherName: '', weeks: 1, skipFirst: new Date().getDay() >= 5, known: {} });   // الجمعة/السبت: الأسبوع القادم فقط   // كل اجتماعات Teams في التقويم
    } else if (m.t === 'calResult') {
      const sync = await get('sync'); if (sender.tab?.id !== sync.tabId) return reply(false);
      const n = await merge(m.events || []);
      await set('sync', { tabId: null, last: new Date().toISOString(), count: n, err: '' });
      chrome.tabs.remove(sender.tab.id).catch(() => {});
      note(n ? `سُحب ${n} اجتماع من التقويم لأيام الأحد–الخميس` : 'لم أجد اجتماعات Teams في تقويمك لهذا الأسبوع'); reply(true);
    } else if (m.t === 'syncNow') reply(await startSync());
    else if (m.t === 'openNow') {
      const mt = (await get('meetings')).find(x => x.id === m.id); if (!mt) return reply(false);
      await mutate('runs', r => { delete r[mt.id]; }); await openMeeting(mt);
      // فتح للتجربة خارج موعده: يُحسب وقته من الآن (لا يُغلق فورًا)
      const d = new Date(), now = pad(d.getHours()) + ':' + pad(d.getMinutes()), s = mins(mt.start);
      const nm = d.getHours() * 60 + d.getMinutes();
      if (mt.date !== ymd(d) || nm < s - 15 || nm >= s + Number(mt.dur || 40)) await mutate('runs', r => { if (r[mt.id]) r[mt.id].start = now; });
      reply(true);
    } else if (m.t === 'endNow') {
      const runs = await get('runs'), r = runs[m.id]; if (!r) return reply(false);
      try { reply(await chrome.tabs.sendMessage(r.tabId, { t: 'cmd', c: 'end' })); } catch (e) { reply({ ok: false }); }
    } else if (m.t === 'checkUpdate') reply(await checkUpdate());
  })();
  return true;
});

// ===== السحب من تقويم Outlook =====
async function startSync() {
  const sync = await get('sync');
  if (sync.tabId) { try { await chrome.tabs.get(sync.tabId); return { ok: false, err: 'السحب يعمل الآن' }; } catch (e) {} }
  // افتح التقويم مباشرة على أسبوع الدوام المطلوب (الأسبوع القادم إذا كان اليوم جمعة أو سبت)
  const tab = await chrome.tabs.create({ url: 'https://outlook.office.com/calendar/view/week', active: false });
  await set('sync', { ...sync, tabId: tab.id, err: '' });
  setTimeout(async () => { const s = await get('sync'); if (s.tabId === tab.id) { await set('sync', { ...s, tabId: null, err: 'انتهت مهلة السحب – تأكد من تسجيل الدخول في Outlook' }); chrome.tabs.remove(tab.id).catch(() => {}); } }, 6 * 60000);
  return { ok: true };
}
// أيام الدوام لهذا الأسبوع (والأسبوع القادم إذا كان اليوم جمعة أو سبت)
function workDays() {
  const d = new Date(); d.setHours(12, 0, 0, 0); if (d.getDay() >= 5) d.setDate(d.getDate() + 7);
  d.setDate(d.getDate() - d.getDay()); const out = [];
  for (let i = 0; i < 5; i++) { const x = new Date(d); x.setDate(d.getDate() + i); out.push(ymd(x)); }
  return out;
}
async function merge(events) {
  const days = workDays(), today = ymd(new Date());
  const old = Object.fromEntries((await get('meetings')).map(x => [x.id, x]));
  const out = [];
  for (const e of events) {
    if (!days.includes(e.date) || e.date < today || !e.link) continue;
    const id = e.date + '-' + e.start.replace(':', '') + '-' + hash(e.title + e.link);
    const o = old[id] || {};
    out.push({ id, date: e.date, start: e.start, dur: e.dur || 40, title: e.title, link: e.link, video: o.video || e.video || '', off: !!o.off });
  }
  // احتفظ بما أُضيف يدويًا ولم يمض
  const manual = Object.values(old).filter(x => x.manual && x.date >= today);
  await mutate('runs', r => { for (const k of Object.keys(r)) if (k.slice(0, 10) < today) delete r[k]; });
  await set('meetings', [...manual, ...out].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)));
  return out.length;
}

// ===== مشاركة تبويب المقطع في Teams =====
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== 'share-video') return;
  const runs = await get('runs'), live = Object.values(runs).filter(r => ['lock', 'live'].includes(r.phase)).sort((a, b) => b.at - a.at)[0];
  if (!live) return note('لا يوجد اجتماع جارٍ الآن');
  let target = tab; if (!target) [target] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!target || target.id === live.tabId) return note('افتح تبويب المقطع أولًا، ثم اضغط Ctrl+Shift+1');
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: target.id, consumerTabId: live.tabId });
    const r = await chrome.tabs.sendMessage(live.tabId, { t: 'cmd', c: 'shareTab', streamId });
    note(r?.ok ? '✅ المقطع يُعرض الآن للطلاب في Teams' : '❌ ' + (r?.err || 'تعذّرت المشاركة'));
  } catch (err) { note('❌ تعذّرت المشاركة: ' + err.message); }
});

chrome.tabs.onRemoved.addListener(async id => {
  await mutate('runs', r => { for (const k of Object.keys(r)) if (r[k].tabId === id && r[k].phase !== 'done') r[k].phase = 'closed'; });
  const s = await get('sync'); if (s.tabId === id) await set('sync', { ...s, tabId: null });
});

// ===== التحديث =====
async function checkUpdate() {
  try {
    const v = await (await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' })).json();
    const cur = chrome.runtime.getManifest().version, newer = v.version && v.version.localeCompare(cur, undefined, { numeric: true }) > 0;
    await set('update', { at: Date.now(), latest: v.version, newer });
    return { ok: true, cur, latest: v.version, newer };
  } catch (e) { return { ok: false }; }
}
