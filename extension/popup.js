// حاضر المعلم 3 — شاشة واحدة: تشغيل آلي، سحب من التقويم، اجتماعات الأحد–الخميس ومقطع كل اجتماع
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DEF = { settings: { auto: true, prepMin: 1, syncTime: '06:30' }, meetings: [], runs: {}, sync: {}, update: {} };
async function get(k) { const o = await chrome.storage.local.get(k); return o[k] ?? structuredClone(DEF[k]); }
async function set(k, v) { await chrome.storage.local.set({ [k]: v }); }
const pad = n => String(n).padStart(2, '0'), ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmt = t => { let [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; };
const RUN = { join: ['⏳ يدخل', 'a'], lock: ['🔒 يعطّل المايك', 'a'], live: ['🟢 جارية', 'g'], done: ['✓ انتهت', ''], closed: ['أُغلقت', ''], error: ['✗ تعذّر الدخول', 'r'] };

async function render() {
  const st = await get('settings'), ms = await get('meetings'), runs = await get('runs'), sync = await get('sync');
  $('#auto').checked = st.auto !== false; $('#autoTxt').textContent = st.auto !== false ? 'يعمل آليًا' : 'متوقف';
  const today = ymd(new Date());
  let h = `<div class="card"><div class="row"><button class="btn p" id="sync">${sync.tabId ? '⏳ جارٍ السحب من التقويم…' : '🔄 اسحب اجتماعات الأسبوع من التقويم'}</button></div>
    <div class="mut" style="margin-top:4px">${sync.err ? '<span class="r">' + esc(sync.err) + '</span>' : sync.last ? 'آخر سحب: ' + new Date(sync.last).toLocaleString('ar-SA', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + ' · ' + (sync.count || 0) + ' اجتماع' : 'سجّل الدخول في Outlook على الويب في هذا المتصفح، ثم اسحب.'} · يُسحب آليًا كل يوم ${fmt(st.syncTime || '06:30')}</div></div>`;
  const byDay = {}; for (const m of ms) if (m.date >= today) (byDay[m.date] = byDay[m.date] || []).push(m);
  const days = Object.keys(byDay).sort();
  if (!days.length) h += `<div class="card mut">لا اجتماعات بعد. اضغط «اسحب اجتماعات الأسبوع».<br>يفتح كل اجتماع قبل موعده بدقيقة، ويعطّل المايك والكاميرا للحضور، ويفتح مقطع الدرس، ويغلق الاجتماع عند نهايته — من الأحد إلى الخميس.</div>`;
  for (const d of days) {
    h += `<div class="card"><div class="day">${new Date(d + 'T12:00').toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}${d === today ? ' <span class="tag">اليوم</span>' : ''}</div>`;
    for (const m of byDay[d]) {
      const r = runs[m.id], rs = r && RUN[r.phase];
      h += `<div class="m ${m.off ? 'off' : ''}"><div class="row"><b>${fmt(m.start)}</b><span style="flex:1">${esc(m.title)}</span>${rs ? `<span class="tag ${rs[1]}">${rs[0]}</span>` : ''}
          <label class="sw" title="${m.off ? 'لن يُفتح' : 'سيُفتح آليًا'}" style="transform:scale(.8)"><input type="checkbox" data-on="${m.id}" ${m.off ? '' : 'checked'}><span></span></label></div>
        <div class="row" style="margin-top:4px"><input type="text" data-v="${m.id}" value="${esc(m.video)}" placeholder="رابط مقطع يوتيوب للدرس" style="flex:1">
          ${r && ['lock', 'live'].includes(r.phase) ? `<button class="btn s" data-end="${m.id}">⏹ إنهاء</button>` : `<button class="btn s" data-open="${m.id}" title="افتح الآن للتجربة">▶ افتح</button>`}</div>
        ${m.video ? '' : '<div class="mut a">بلا مقطع: الصق رابط يوتيوب ليُفتح آليًا مع الحصة</div>'}</div>`;
    }
    h += '</div>';
  }
  h += `<details class="card"><summary class="mut" style="cursor:pointer">الإعدادات</summary>
    <div class="row" style="margin-top:8px"><span style="flex:1">يفتح الاجتماع قبل موعده بـ</span><input type="number" id="prep" min="0" max="10" value="${st.prepMin ?? 1}" style="width:56px;font:inherit;padding:4px;border-radius:8px;border:1px solid var(--bd)"> د</div>
    <div class="row" style="margin-top:6px"><span style="flex:1">موعد السحب اليومي من التقويم</span><input type="time" id="syncTime" value="${st.syncTime || '06:30'}" style="font:inherit;padding:4px;border-radius:8px;border:1px solid var(--bd)"></div>
    <div class="mut" style="margin-top:6px">لعرض المقطع للطلاب داخل Teams: افتح تبويب المقطع واضغط <b>Ctrl+Shift+1</b>.</div>
    <div class="row" style="margin-top:6px"><button class="btn s" id="upd">التحقق من التحديث</button><span id="updMsg" class="mut"></span></div></details>`;
  $('#main').innerHTML = h;
  $('#foot').textContent = 'حاضر المعلم ' + chrome.runtime.getManifest().version + ' · إعداد وتطوير: عبدالمجيد السيد';

  $('#sync').onclick = async () => { const r = await chrome.runtime.sendMessage({ t: 'syncNow' }); if (r && !r.ok) alert(r.err); setTimeout(render, 500); };
  document.querySelectorAll('[data-on]').forEach(cb => cb.onchange = async () => { const l = await get('meetings'); const m = l.find(x => x.id === cb.dataset.on); if (m) m.off = !cb.checked; await set('meetings', l); render(); });
  document.querySelectorAll('[data-v]').forEach(i => i.onchange = async () => {
    const v = i.value.trim(); if (v && !/^https?:\/\//.test(v)) { i.style.borderColor = 'var(--r)'; return; }
    const l = await get('meetings'); const m = l.find(x => x.id === i.dataset.v); if (m) m.video = v; await set('meetings', l); render(); });
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => chrome.runtime.sendMessage({ t: 'openNow', id: b.dataset.open }));
  document.querySelectorAll('[data-end]').forEach(b => b.onclick = () => { if (confirm('إنهاء الاجتماع للجميع الآن؟')) chrome.runtime.sendMessage({ t: 'endNow', id: b.dataset.end }); });
  $('#prep').onchange = async e => { const s = await get('settings'); s.prepMin = Math.max(0, Math.min(10, Number(e.target.value) || 0)); await set('settings', s); };
  $('#syncTime').onchange = async e => { const s = await get('settings'); s.syncTime = e.target.value || '06:30'; s.lastSyncDay = ''; await set('settings', s); };
  $('#upd').onclick = async () => { const r = await chrome.runtime.sendMessage({ t: 'checkUpdate' }); $('#updMsg').textContent = !r?.ok ? 'تعذّر التحقق' : r.newer ? `يتوفر ${r.latest} – شغّل «Hadir Update»` : '✓ لديك آخر نسخة'; };
}
$('#auto').onchange = async e => { const s = await get('settings'); s.auto = e.target.checked; await set('settings', s); render(); };
chrome.storage.onChanged.addListener(ch => { if ((ch.runs || ch.sync || ch.meetings) && !document.activeElement?.matches('input[type=text]')) render(); });
render();
