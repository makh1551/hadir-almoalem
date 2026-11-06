// حاضر المعلم — تقرير الأسبوع لصف واحد (للطباعة أو الحفظ PDF)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const q = new URLSearchParams(location.search);
const cls = q.get('cls') || '', w = Number(q.get('w') || 0);
document.getElementById('print').onclick = () => window.print();

(async () => {
  const { sessions = {}, settings = {} } = await chrome.storage.local.get(['sessions', 'settings']);
  const start = new Date(); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - start.getDay() + w * 7);
  const end = new Date(start); end.setDate(start.getDate() + 4);
  const from = ymd(start), to = ymd(end);
  const fmt = d => d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' });
  const ss = Object.values(sessions).filter(s => s.cls === cls && s.report && !s.test && s.day >= from && s.day <= to)
    .sort((a, b) => (a.day + a.start).localeCompare(b.day + b.start));
  const page = document.getElementById('page');
  const head = `<header><div><h1>تقرير حضور الأسبوع — ${esc(cls)}</h1><div class="sub">${fmt(start)} – ${fmt(end)}</div></div>
    <div class="sub">المعلم: ${esc(settings.teacherName || '')}</div></header>`;
  if (!ss.length) { page.innerHTML = head + '<div class="empty">لا توجد حصص مرصودة لهذا الصف في هذا الأسبوع.</div>'; return; }

  const names = [...new Set(ss.flatMap(s => s.report.map(r => r.name)))].sort((a, b) => a.localeCompare(b, 'ar'));
  const short = s => new Date(s.day + 'T12:00').toLocaleDateString('ar-SA', { weekday: 'short' }) + ' ' + s.start;
  const sym = st => !st ? '<span class="mut">—</span>' : st.startsWith('حاضر') ? '<span class="ok">✓</span>' : st.startsWith('متأخر') ? '<span class="late">⏱</span>'
    : st.startsWith('خرج') ? '<span class="out">↩</span>' : '<span class="abs">غ</span>';
  let presentAll = 0, cellsAll = 0, absAll = 0, lateAll = 0;
  const rows = names.map(n => {
    let pres = 0, cnt = 0, abs = 0;
    const cells = ss.map(s => {
      const r = s.report.find(x => x.name === n); const st = r?.status || '';
      if (st) { cnt++; if (!st.startsWith('غائب')) pres++; else abs++; if (st.startsWith('متأخر')) lateAll++; }
      return `<td>${sym(st)}</td>`;
    }).join('');
    presentAll += pres; cellsAll += cnt; absAll += abs;
    const pct = cnt ? Math.round(pres / cnt * 100) : 0;
    return { n, abs, html: `<tr><td class="n">${esc(n)}</td>${cells}<td class="${pct < 75 ? 'abs' : ''}">${pct}%</td></tr>` };
  });
  // المشاركة: رفع اليد + الإجابة على الأسئلة
  const part = {};
  for (const s of ss) {
    for (const h of s.hands || []) part[h.n] = (part[h.n] || 0) + 1;
    for (const qq of s.questions || []) for (const a of qq.answers || []) part[a.name] = (part[a.name] || 0) + 1;
  }
  const top = Object.entries(part).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const repeated = rows.filter(r => r.abs >= 2).sort((a, b) => b.abs - a.abs);
  const avg = cellsAll ? Math.round(presentAll / cellsAll * 100) : 0;

  page.innerHTML = head + `
    <div class="kpis"><div class="kpi"><b>${ss.length}</b>حصة</div><div class="kpi"><b>${avg}%</b>متوسط الحضور</div>
      <div class="kpi"><b>${absAll}</b>حالة غياب</div><div class="kpi"><b>${lateAll}</b>حالة تأخر</div></div>
    <h2>سجل الحضور</h2>
    <table><thead><tr><th>الطالب</th>${ss.map(s => `<th>${esc(short(s))}<br><span class="sub" style="font-weight:normal">${esc((s.lesson || '').slice(0, 22))}</span></th>`).join('')}<th>الحضور</th></tr></thead>
    <tbody>${rows.map(r => r.html).join('')}</tbody></table>
    <div class="legend">✓ حاضر · ⏱ متأخر · ↩ خرج مبكرًا · غ غائب · — لم يُرصد</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div><h2>🔁 تكرر غيابهم (حصتان فأكثر)</h2>${repeated.length ? '<ul>' + repeated.map(r => `<li>${esc(r.n)}: ${r.abs} حصص</li>`).join('') + '</ul>' : '<div class="sub">لا يوجد</div>'}</div>
      <div><h2>🏅 الأكثر مشاركة</h2>${top.length ? '<ul>' + top.map(([n, c]) => `<li>${esc(n)}: ${c} مشاركة</li>`).join('') + '</ul>' : '<div class="sub">لا توجد مشاركات مسجّلة</div>'}</div>
    </div>
    <footer>أُعدّ بواسطة «حاضر المعلم» · إعداد وتطوير: عبدالمجيد السيد · 0561955430</footer>`;
  document.title = `تقرير ${cls} — ${fmt(start)}`;
})();
