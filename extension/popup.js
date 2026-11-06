// حاضر المعلم — النافذة المنبثقة
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const DEF = { settings: { teacherName: '', guardMin: 10, prepMin: 1, lateMin: 5, endWarnMin: 2, endMode: 'end', syncTimes: '06:30,20:30', weeks: 2, waPhone: '' }, classes: [], rosters: {}, sessions: {}, sync: {}, update: {} };
const classToday = (c, day, dow) => c.date ? c.date === day : (c.day !== undefined && c.day !== '' && Number(c.day) === dow);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function get(k) { const o = await chrome.storage.local.get(k); return o[k] ?? structuredClone(DEF[k]); }
async function set(k, v) { await chrome.storage.local.set({ [k]: v }); }
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const PH = { join: ['جارٍ الدخول', 'warn'], lock: ['جارٍ القفل', 'warn'], live: ['يعمل', 'ok'], done: ['انتهت', 'ok'], stopped: ['أُوقف', 'bad'] };
let view = 'today', pulled = [];

document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b)); view = b.dataset.v; render();
});
setInterval(() => $('#clock').textContent = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }), 1000);

async function render() {
  await ({ today: vToday, classes: vClasses, students: vStudents, reports: vReports, settings: vSettings })[view]();
  const u = await get('update');
  if (u.newer) {
    const b = document.createElement('div'); b.className = 'card ok';
    b.innerHTML = `⬆️ تحديث جديد ${esc(u.version)} — ${esc(u.notes)} <button class="btn" id="upGo">تنزيل</button>`;
    $('#main').prepend(b); $('#upGo').onclick = () => chrome.tabs.create({ url: u.url });
  }
}

// ===== اليوم =====
async function vToday() {
  const classes = await get('classes'), sessions = await get('sessions'), st = await get('settings');
  const dow = new Date().getDay(), day = today();
  const list = classes.filter(c => classToday(c, day, dow)).sort((a, b) => a.start.localeCompare(b.start));
  const sync = await get('sync');
  const active = Object.entries(sessions).find(([k, s]) => s.day === day && ['join', 'lock', 'live'].includes(s.phase));
  let h = '';
  if (!st.teacherName) h += `<div class="card bad">اكتب اسمك كما يظهر في Teams من «الإعدادات» أولًا.</div>`;
  if (active) {
    const [key, s] = active; const ph = PH[s.phase];
    h += `<div class="card"><div class="row"><b>الحصة الجارية: ${esc(s.cls)}</b><span class="tag ${ph[1]}">${ph[0]}</span></div>
      <div class="mut">${esc(s.lesson)} · ${s.start} · المعلم: ${s.teacherSeen ? 'دخل ' + s.teacherSeen : 'لم يدخل بعد'}</div>
      <div class="row" style="margin-top:8px">
        <button class="btn" data-c="teacherIn">أنا داخل</button>
        <button class="btn s" data-c="video">شغّل المقطع</button>
        <button class="btn s" data-c="muteAll">كتم الجميع</button>
        <button class="btn s" data-c="relock">إعادة القفل</button>
        <button class="btn s" data-c="status">الحضور الآن</button>
        <button class="btn r" data-c="end">إنهاء</button>
      </div>
      <div class="row" style="margin-top:6px"><input id="allowName" placeholder="اسم الطالب"><button class="btn s" data-c="allow">اسمح له بالحديث</button></div>
      <div id="cmdOut" class="mut" style="margin-top:6px"></div></div>`;
    setTimeout(() => document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => cmd(key, b.dataset.c)), 0);
  }
  h += `<div class="card"><div class="row"><button class="btn" id="syncNow">🔄 اسحب حصصي من التقويم</button><span class="mut">${sync.tabId ? 'جارٍ السحب...' : sync.last ? 'آخر سحب: ' + new Date(sync.last).toLocaleString('ar-SA', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + sync.lastCount + ' حصة' : 'لم يُسحب بعد'}</span></div>${sync.lastErr ? `<div class="tag bad">${esc(sync.lastErr)}</div>` : ''}</div>`;
  if (!list.length) h += `<div class="card mut">لا حصص اليوم.</div>`;
  h += `<details class="card"><summary><b>🧪 حصة تجريبية الآن</b></summary>
    <div class="mut">أنشئ اجتماع Teams تجريبيًا وادخله من جوالك كطالب، ثم ضع رابطه هنا. تبدأ الحصة بعد دقيقة.</div>
    <label>رابط الاجتماع التجريبي</label><input id="tLink" style="width:100%" placeholder="https://teams.microsoft.com/...">
    <label>رابط مقطع (اختياري)</label><input id="tVideo" style="width:100%">
    <div class="row" style="margin-top:6px"><label style="margin:0">المدة (د)</label><input id="tDur" type="number" value="10" style="width:70px">
    <button class="btn" id="tGo">ابدأ التجربة</button></div></details>`;
  for (const c of list) {
    const s = Object.values(sessions).find(x => x.day === day && x.classId === c.id);
    const ph = s ? PH[s.phase] : null;
    h += `<div class="card"><div class="row"><b>${c.start} · ${esc(c.cls || c.lesson)}</b>${c.src === 'cal' ? '<span class="tag">📅 التقويم</span>' : ''}${ph ? `<span class="tag ${ph[1]}">${ph[0]}</span>` : ''}</div>
      <div class="mut">${esc(c.lesson || '')}</div>
      <div class="row" style="margin-top:6px">
        ${c.link ? '' : '<span class="tag bad">بلا رابط</span>'}${c.video ? '<span class="tag ok">المقطع جاهز</span>' : '<span class="tag warn">بلا مقطع – أضف الرابط</span>'}
        <button class="btn s" data-open="${c.id}" style="margin-inline-start:auto">افتح الآن</button></div></div>`;
  }
  $('#main').innerHTML = h;
  const tg = $('#tGo'); if (tg) tg.onclick = async () => {
    const r = await chrome.runtime.sendMessage({ t: 'testNow', link: $('#tLink').value.trim(), video: $('#tVideo').value.trim(), dur: Number($('#tDur').value || 10) });
    if (!r?.ok) alert(r?.err || 'تعذّر'); else setTimeout(render, 800);
  };
  const sb = $('#syncNow'); if (sb) sb.onclick = async () => { const r = await chrome.runtime.sendMessage({ t: 'syncNow' }); if (!r?.ok) alert(r?.err || 'تعذّر'); setTimeout(render, 500); };
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
    const r = await chrome.runtime.sendMessage({ t: 'startNow', id: b.dataset.open }); if (!r?.ok) alert(r?.err || 'تعذّر'); render();
  });
}
async function cmd(key, c) {
  const out = $('#cmdOut'); out.textContent = '...';
  const r = await chrome.runtime.sendMessage({ t: 'cmd', key, c, name: $('#allowName')?.value || '' });
  if (!r?.ok) { out.textContent = r?.err || 'تعذّر التنفيذ'; return; }
  if (c === 'status') out.innerHTML = `الطلاب الآن (${r.people.length}): ${esc(r.people.join('، '))}<br>✋ ${esc(r.hands.join('، ') || 'لا أحد')}`;
  else out.textContent = '✓ تم';
  if (c === 'end') setTimeout(render, 1500);
}

// ===== الحصص =====
async function vClasses() {
  const classes = await get('classes');
  let h = `<div class="card"><b>إضافة حصة</b><div class="cls-grid" style="margin-top:6px">
    <div><label>اليوم</label><select id="cDay">${DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('')}</select></div>
    <div><label>البداية</label><input id="cStart" type="time" value="07:45"></div>
    <div><label>المدة (د)</label><input id="cDur" type="number" value="39"></div>
    <div><label>الصف</label><input id="cCls" placeholder="السادس أ"></div>
    <div class="full"><label>الدرس</label><input id="cLesson"></div>
    <div class="full"><label>رابط اجتماع Teams</label><input id="cLink" placeholder="https://teams.microsoft.com/..."></div>
    <div class="full"><label>رابط مقطع الدرس (من التحضير)</label><input id="cVideo" placeholder="https://..."></div>
  </div><div class="row" style="margin-top:8px"><button class="btn" id="cAdd">حفظ الحصة</button><span class="mut">تُفتح الحصة تلقائيًا قبل موعدها</span></div></div>`;
  const now = new Date().toISOString().slice(0, 10);
  const shown = [...classes].filter(c => !c.date || c.date >= now)
    .sort((a, b) => (a.date || '0' + a.day).localeCompare(b.date || '0' + b.day) || a.start.localeCompare(b.start));
  h = `<div class="card mut">حصص التقويم تُسحب آليًا (${esc((await get('settings')).syncTimes)}). عدّل «الصف» و«المقطع» لكل حصة من زر تعديل.</div>` + h;
  for (const c of shown) {
    const when = c.date ? new Date(c.date + 'T12:00').toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'short' }) : 'كل ' + DAYS[c.day];
    h += `<div class="card"><div class="row"><b>${when} ${c.start} · ${esc(c.cls || c.lesson)}</b>${c.src === 'cal' ? '<span class="tag">📅</span>' : ''}${c.cls ? '' : '<span class="tag warn">حدّد الصف</span>'}
      <button class="btn s" data-edit="${c.id}" style="margin-inline-start:auto">تعديل</button><button class="btn r" data-del="${c.id}">حذف</button></div>
      <div class="mut">${esc(c.lesson || '')} ${c.video ? '· 🎬' : '· ⚠️ بلا مقطع'} ${c.link ? '' : '· ⚠️ بلا رابط'}</div></div>`;
  }
  $('#main').innerHTML = h;
  let editId = null;
  $('#cAdd').onclick = async () => {
    const list = await get('classes');
    const old = list.find(x => x.id === editId) || {};
    const c = { ...old, id: editId || Date.now().toString(36), day: old.date ? undefined : Number($('#cDay').value), start: $('#cStart').value, dur: Number($('#cDur').value || 39),
      cls: $('#cCls').value.trim(), lesson: $('#cLesson').value.trim(), link: $('#cLink').value.trim(), video: $('#cVideo').value.trim() };
    if (!c.start || !(c.cls || c.lesson)) return alert('البداية والصف أو الدرس مطلوبة');
    const i = list.findIndex(x => x.id === c.id); if (i >= 0) list[i] = c; else list.push(c);
    await set('classes', list);
    if (c.src === 'cal' && c.cls && c.cls !== old.cls) {
      const n = await chrome.runtime.sendMessage({ t: 'learnCls', link: c.link, cls: c.cls });
      if (n) alert(`تعلّمت الإضافة الصف «${c.cls}» لهذا الفريق، وطبّقته على ${n} حصة أخرى.`);
    }
    render();
  };
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف الحصة؟')) return; await set('classes', (await get('classes')).filter(x => x.id !== b.dataset.del)); render();
  });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const c = classes.find(x => x.id === b.dataset.edit); editId = c.id;
    $('#cDay').value = c.day ?? new Date((c.date || '2026-01-01') + 'T12:00').getDay(); $('#cStart').value = c.start; $('#cDur').value = c.dur; $('#cCls').value = c.cls;
    $('#cLesson').value = c.lesson || ''; $('#cLink').value = c.link || ''; $('#cVideo').value = c.video || '';
    $('#cAdd').textContent = 'حفظ التعديل'; window.scrollTo(0, 0);
  });
}

// ===== الطلاب =====
async function vStudents() {
  const rosters = await get('rosters'), classes = await get('classes');
  const names = [...new Set([...classes.map(c => c.cls), ...Object.keys(rosters)])].filter(Boolean);
  let h = `<div class="card"><b>سحب أسماء الطلاب (مرة واحدة لكل صف)</b>
    <div class="mut">افتح صفحة الفصل التي فيها أسماء الطلاب (أعضاء فريق الفصل في Teams، أو قائمة الفصل في مدرستي)، ثم اضغط «اسحب».</div>
    <label>الصف</label><input id="rCls" list="clsList" placeholder="السادس أ"><datalist id="clsList">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row" style="margin-top:8px"><button class="btn" id="pull">اسحب من الصفحة المفتوحة</button><span id="pullMsg" class="mut"></span></div>
    <label>الأسماء (اسم في كل سطر — راجعها واحذف غير الطلاب)</label><textarea id="rNames">${esc(pulled.join('\n'))}</textarea>
    <div class="row"><button class="btn" id="rSave">حفظ قائمة الصف</button></div></div>`;
  for (const [k, v] of Object.entries(rosters)) {
    h += `<div class="card"><div class="row"><b>${esc(k)}</b><span class="tag">${v.length} طالب</span>
      <button class="btn s" data-ed="${esc(k)}" style="margin-inline-start:auto">عرض/تعديل</button><button class="btn r" data-rd="${esc(k)}">حذف</button></div></div>`;
  }
  $('#main').innerHTML = h;
  $('#pull').onclick = pullNames;
  $('#rSave').onclick = async () => {
    const cls = $('#rCls').value.trim(); if (!cls) return alert('اكتب اسم الصف');
    const list = [...new Set($('#rNames').value.split('\n').map(s => s.trim()).filter(Boolean))];
    const r = await get('rosters'); r[cls] = list; await set('rosters', r); pulled = []; render();
  };
  document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => { $('#rCls').value = b.dataset.ed; $('#rNames').value = rosters[b.dataset.ed].join('\n'); });
  document.querySelectorAll('[data-rd]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف قائمة الصف؟')) return; const r = await get('rosters'); delete r[b.dataset.rd]; await set('rosters', r); render();
  });
}

// يُحقن في الصفحة المفتوحة ويجمع ما يشبه أسماء الأشخاص
function scrapeNames() {
  const ok = /^[\u0600-\u06FFA-Za-z\s.'-]+$/;
  const bad = /^(الاسم|اسم الطالب|الطلاب|الطالب|المعلم|الصف|الفصل|حاضر|غائب|متأخر|الكل|بحث|إضافة|حذف|تعديل|عرض|الأعضاء|المالكون|الضيوف|أعضاء|مالك|عضو|الإعدادات|القنوات|المنشورات|الملفات|Name|Owner|Owners|Member|Members|Guest|Guests|Search|Role|Title)$/i;
  const out = new Set();
  const sel = 'td,[role="gridcell"],[role="listitem"],[role="treeitem"],[role="row"],li,.name,.student-name,[data-tid*="name"],[class*="name"]';
  for (const e of document.querySelectorAll(sel)) {
    let t = (e.innerText || '').split('\n')[0].replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
    if (t.length < 6 || t.length > 60 || !ok.test(t) || bad.test(t)) continue;
    const w = t.split(' ').length; if (w < 2 || w > 6) continue;
    out.add(t);
  }
  return [...out];
}
async function pullNames() {
  const msg = $('#pullMsg'); msg.textContent = 'جارٍ السحب...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || /^chrome|^edge/.test(tab.url || '')) { msg.textContent = 'افتح صفحة الفصل أولًا'; return; }
  try {
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: scrapeNames });
    pulled = [...new Set(res.flatMap(r => r.result || []))];
    $('#rNames').value = pulled.join('\n');
    msg.textContent = pulled.length ? `وُجد ${pulled.length} اسمًا – راجعها ثم احفظ` : 'لم أجد أسماء. مرّر القائمة حتى تظهر كل الأسماء ثم أعد المحاولة، أو الصقها يدويًا.';
  } catch (e) { msg.textContent = 'تعذّر الوصول للصفحة: ' + e.message; }
}

// ===== التقارير =====
async function vReports() {
  const sessions = await get('sessions');
  const list = Object.entries(sessions).filter(([, s]) => s.report).sort((a, b) => (b[1].day + b[1].start).localeCompare(a[1].day + a[1].start));
  if (!list.length) { $('#main').innerHTML = '<div class="card mut">لا تقارير بعد. يظهر التقرير هنا بعد انتهاء كل حصة.</div>'; return; }
  let h = `<div class="card"><div class="row"><button class="btn" id="waDay">📲 ملخص اليوم على واتساب</button><button class="btn s" id="cpDay">نسخ الملخص</button></div></div>`;
  for (const [k, s] of list) {
    const c = p => s.report.filter(r => r.status.startsWith(p)).length;
    h += `<div class="card"><div class="row"><b>${s.day} · ${s.start} · ${esc(s.cls)}</b><span class="tag ${PH[s.phase]?.[1] || ''}">${PH[s.phase]?.[0] || ''}</span></div>
      <div class="mut">${esc(s.lesson)} · المعلم: ${s.teacherSeen || '—'}</div>
      <div class="row" style="margin:6px 0"><span class="tag ok">حاضر ${c('حاضر')}</span><span class="tag warn">متأخر ${c('متأخر')}</span>
      <span class="tag warn">خرج مبكرًا ${c('خرج')}</span><span class="tag bad">غائب ${c('غائب')}</span><span class="tag">✋ ${s.hands.length}</span><span class="tag">💬 ${s.chat.length}</span></div>
      <div class="row"><button class="btn" data-rasd="${esc(k)}">📋 للرصد السريع</button><button class="btn s" data-csv="${esc(k)}">تنزيل CSV</button><button class="btn s" data-det="${esc(k)}">التفاصيل</button><button class="btn r" data-sdel="${esc(k)}">حذف</button></div>
      <div id="det-${btoa(unescape(encodeURIComponent(k))).replace(/=/g, '')}"></div></div>`;
  }
  $('#main').innerHTML = h;
  document.querySelectorAll('[data-csv]').forEach(b => b.onclick = () => csv(sessions[b.dataset.csv]));
  $('#waDay').onclick = () => chrome.runtime.sendMessage({ t: 'waSummary' });
  $('#cpDay').onclick = async () => { await navigator.clipboard.writeText(await chrome.runtime.sendMessage({ t: 'summaryText' })); $('#cpDay').textContent = '✓ نُسخ'; };
  document.querySelectorAll('[data-rasd]').forEach(b => b.onclick = async () => {
    const s = sessions[b.dataset.rasd];
    const abs = s.report.filter(r => r.status === 'غائب').map(r => r.name);
    await navigator.clipboard.writeText(abs.join('\n'));
    alert(abs.length ? `نُسخ ${abs.length} غائب.\nفي «رصد الحضور السريع» اختر «يوجد غياب» والصق الأسماء، ثم ارصد.` : 'لا غياب في هذه الحصة. في «رصد الحضور السريع» اختر «جميع الطلاب حاضرون».');
    chrome.tabs.create({ url: 'https://schools.madrasati.sa/SchoolStructure/ClassRooms' });
  });
  document.querySelectorAll('[data-sdel]').forEach(b => b.onclick = async () => {
    if (!confirm('حذف التقرير؟')) return; const ss = await get('sessions'); delete ss[b.dataset.sdel]; await set('sessions', ss); render();
  });
  document.querySelectorAll('[data-det]').forEach(b => b.onclick = () => {
    const s = sessions[b.dataset.det]; const id = 'det-' + btoa(unescape(encodeURIComponent(b.dataset.det))).replace(/=/g, '');
    document.getElementById(id).innerHTML = `<table><tr><th>الطالب</th><th>الحالة</th><th>دخل</th><th>آخر ظهور</th></tr>${
      s.report.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.status)}</td><td>${r.first}</td><td>${r.last}</td></tr>`).join('')}</table>
      ${s.hands.length ? `<p><b>✋ رفع اليد:</b> ${esc(s.hands.map(x => x.n + ' ' + x.at).join('، '))}</p>` : ''}
      ${s.chat.length ? `<p><b>💬 الدردشة:</b><br>${s.chat.map(x => esc(x.at + ' — ' + x.txt)).join('<br>')}</p>` : ''}
      <p class="mut">${s.events.map(e => esc(e.at + ' ' + e.ev)).join(' · ')}</p>`;
  });
}
function csv(s) {
  const rows = [['الطالب', 'الاسم في Teams', 'الحالة', 'دخل (دقيقة)', 'آخر ظهور (دقيقة)'], ...s.report.map(r => [r.name, r.teams, r.status, r.first, r.last])];
  const text = '\uFEFF' + rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = `حضور-${s.cls}-${s.day}-${s.start.replace(':', '')}.csv`; a.click();
}

// ===== الإعدادات =====
async function vSettings() {
  const st = await get('settings');
  $('#main').innerHTML = `<div class="card">
    <label>اسمك كما يظهر في Teams</label><input id="sName" value="${esc(st.teacherName)}" style="width:100%">
    <div class="cls-grid">
      <div><label>فتح الحصة قبل (د)</label><input id="sPrep" type="number" value="${st.prepMin ?? 1}"></div>
      <div><label>الضمانة (د)</label><input id="sGuard" type="number" value="${st.guardMin}"></div>
      <div><label>متأخر بعد (د)</label><input id="sLate" type="number" value="${st.lateMin}"></div>
      <div><label>تنبيه قبل النهاية (د)</label><input id="sWarn" type="number" value="${st.endWarnMin ?? 2}"></div>
      <div class="full"><label>أوقات سحب التقويم (مفصولة بفاصلة)</label><input id="sSync" value="${esc(st.syncTimes ?? '06:30,20:30')}"></div>
      <div><label>أسابيع السحب</label><input id="sWeeks" type="number" min="1" max="4" value="${st.weeks ?? 2}"></div>
      <div class="full"><label>عند نهاية الحصة</label><select id="sEnd">
        <option value="end" ${(st.endMode || 'end') === 'end' ? 'selected' : ''}>إنهاء الاجتماع للجميع</option>
        <option value="leave" ${st.endMode === 'leave' ? 'selected' : ''}>مغادرة المساعد فقط</option></select></div>
    </div>
    <label>جوالك لملخص اليوم على واتساب</label><input id="sWa" value="${esc(st.waPhone || '')}" placeholder="05xxxxxxxx" style="width:100%">
    <div class="mut" style="margin-top:6px">الضمانة: إذا لم تدخل خلال هذه المدة، أو غبت أكثر منها، يوقف المساعد ويغادر.</div>
    <div class="row" style="margin-top:8px"><button class="btn" id="sSave">حفظ</button><span id="sMsg" class="mut"></span></div></div>
    <div class="card"><b>التحديث</b> <span class="mut">الإصدار الحالي ${chrome.runtime.getManifest().version}</span>
      <div class="row" style="margin-top:6px"><button class="btn s" id="upChk">فحص التحديث الآن</button><span id="upMsg" class="mut"></span></div></div>
    <div class="card"><b>نسخة احتياطية</b><div class="row" style="margin-top:6px">
      <button class="btn s" id="bExp">تصدير</button><label class="btn s" style="margin:0">استيراد<input id="bImp" type="file" accept=".json" hidden></label></div></div>
    <div class="card mut">يجب أن يكون الحساب المسجّل في Teams بهذا المتصفح «مقدّمًا» في الاجتماع حتى يستطيع القفل. لمشاركة المقطع اضغط «مشاركة» في Teams واختر تبويب المقطع (يطلب Chrome ضغطة منك لأسباب أمنية).</div>`;
  $('#sSave').onclick = async () => {
    await set('settings', { teacherName: $('#sName').value.trim(), prepMin: Number($('#sPrep').value ?? 1), syncTimes: $('#sSync').value.trim(), weeks: Number($('#sWeeks').value || 2), guardMin: Number($('#sGuard').value || 10), lateMin: Number($('#sLate').value || 5), endWarnMin: Number($('#sWarn').value ?? 2), endMode: $('#sEnd').value, waPhone: $('#sWa').value.trim() });
    $('#sMsg').textContent = '✓ حُفظ';
  };
  $('#upChk').onclick = async () => { $('#upMsg').textContent = '...'; const r = await chrome.runtime.sendMessage({ t: 'checkUpdate' });
    $('#upMsg').textContent = !r.ok ? r.err : r.newer ? 'يوجد إصدار ' + r.version : 'لديك آخر إصدار'; render(); };
  $('#bExp').onclick = async () => {
    const all = await chrome.storage.local.get(['settings', 'classes', 'rosters', 'sessions']);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(all, null, 1)], { type: 'application/json' }));
    a.download = `hadir-backup-${today()}.json`; a.click();
  };
  $('#bImp').onchange = async e => {
    try { const d = JSON.parse(await e.target.files[0].text()); await chrome.storage.local.set(d); alert('تم الاستيراد'); render(); }
    catch (x) { alert('ملف غير صالح'); }
  };
}
render();
