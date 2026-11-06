// حاضر المعلم — يعمل داخل اجتماع Teams في التبويب الذي فتحته الإضافة فقط
(() => {
  const L = {
    continueBrowser: ['متابعة على هذا المتصفح', 'Continue on this browser', 'الانضمام على الويب', 'Join on the web'],
    noAV: ['المتابعة بدون استخدام الصوت أو الفيديو', 'Continue without audio or video'],
    joinNow: ['الانضمام الآن', 'Join now'],
    rejoin: ['إعادة الانضمام', 'Rejoin', 'انضمام مرة أخرى'],
    leave: ['مغادرة', 'Leave'],
    leaveOpts: ['خيارات المغادرة', 'Leave options', 'المزيد من خيارات المغادرة', 'More leave options'],
    endMeeting: ['إنهاء الاجتماع', 'End meeting', 'إنهاء الاجتماع للجميع', 'End meeting for everyone'],
    endConfirm: ['إنهاء', 'End'],
    people: ['أشخاص', 'People', 'المشاركون', 'Participants'],
    muteAll: ['كتم صوت الجميع', 'Mute all'],
    muteConfirm: ['كتم الصوت', 'Mute'],
    disMic: ['تعطيل الميكروفون للحضور', 'Disable mic for attendees', 'منع الحضور من إلغاء كتم الصوت', "Don't allow attendees to unmute"],
    disCam: ['تعطيل الكاميرا للحضور', 'Disable camera for attendees', 'منع الحضور من تشغيل الكاميرا', "Don't allow attendees to turn on video"],
    disable: ['تعطيل', 'Disable', 'عدم السماح', "Don't allow"],
    more: ['خيارات أخرى', 'More options', 'مزيد من الخيارات'],
    allowMic: ['السماح بالميكروفون', 'Allow mic', 'السماح بإلغاء كتم الصوت', 'Allow to unmute'],
    chat: ['الدردشة', 'Chat'],
    you: ['(أنت)', '(You)'],
    headers: ['مقدمو الاجتماع', 'Presenters', 'الحضور', 'Attendees', 'في هذا الاجتماع', 'In this meeting', 'المنظم', 'Organizer',
      'مدعوون', 'Invited', 'الأيدي المرفوعة', 'Raised hands', 'الآخرون المدعوون', 'Others invited']
  };
  const norm = s => (s || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/\s+/g, ' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hhmm = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  function findBtn(list, root = document) {
    const els = [...root.querySelectorAll('button,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="tab"]')].filter(vis);
    for (const w of list.map(norm)) {
      const e = els.find(x => (norm(x.getAttribute('aria-label')) + ' | ' + norm(x.innerText)).includes(w));
      if (e) return e;
    }
    return null;
  }
  async function click(list, root) { const b = findBtn(list, root); if (b) { b.click(); await sleep(900); return true; } return false; }
  const dialog = () => document.querySelector('[role="alertdialog"],[role="dialog"]') || document;

  let ctx = null;
  const seen = {}; // اسم الطالب ← {first, last} بالدقائق من بداية الحصة
  const send = m => chrome.runtime.sendMessage(m);
  const patch = p => { Object.assign(ctx.s, p); return send({ t: 'update', key: ctx.key, patch: p }); };
  const log = ev => { ctx.s.events.push({ at: hhmm(), ev }); patch({ events: ctx.s.events }); setBadge(ev); };
  const note = msg => send({ t: 'note', msg });
  const startMs = () => { const [h, m] = ctx.s.start.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };
  const minsSince = () => (Date.now() - startMs()) / 60000;

  // شارة صغيرة داخل الصفحة
  let badgeEl;
  function setBadge(txt) {
    if (!badgeEl) {
      badgeEl = document.createElement('div');
      badgeEl.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;background:#0f766e;color:#fff;font:13px/1.4 Tahoma,Arial;padding:8px 12px;border-radius:10px;direction:rtl;box-shadow:0 2px 8px #0004;max-width:320px';
      document.documentElement.appendChild(badgeEl);
    }
    badgeEl.textContent = '🎓 حاضر المعلم — ' + txt;
  }

  const inMeeting = () => !!findBtn(L.leave);

  function peopleRoot() {
    const c = [...document.querySelectorAll('[role="tree"],[data-tid*="roster"],[aria-label*="المشاركون"],[aria-label*="Participants"]')].filter(vis);
    return c.sort((a, b) => b.innerText.length - a.innerText.length)[0] || null;
  }
  function readPeople() {
    const root = peopleRoot(); if (!root) return null;
    const items = [...root.querySelectorAll('[role="treeitem"],[role="listitem"]')].filter(vis);
    const hdr = L.headers.map(norm); const out = []; let section = '';
    for (const it of items) {
      const first = norm((it.innerText || '').split('\n')[0]); if (!first) continue;
      const h = hdr.find(x => first.startsWith(x)); if (h) { section = h; continue; }
      if (it.querySelector('[role="treeitem"],[role="listitem"]')) continue;
      const self = L.you.some(y => first.includes(norm(y)));
      const name = first.replace(/\(.*?\)/g, '').trim(); if (name.length < 3) continue;
      const raised = /رفع|raised/i.test(it.getAttribute('aria-label') || '') || /الأيدي|Raised/.test(section);
      out.push({ name, self, raised, el: it });
    }
    return out;
  }
  function isTeacher(n) {
    const parts = norm(ctx.st.teacherName).split(' ').filter(x => x.length > 2);
    if (!parts.length) return false;
    return parts.filter(p => norm(n).includes(p)).length >= Math.min(2, parts.length);
  }
  async function openPeople() {
    if (peopleRoot() && (readPeople() || []).length) return true;
    await click(L.people); await sleep(1500); return !!peopleRoot();
  }

  // 1) الدخول
  async function joinStep() {
    if (inMeeting()) { await patch({ phase: 'lock' }); log('دخلت الاجتماع'); return; }
    (await click(L.rejoin)) || (await click(L.continueBrowser)) || (await click(L.noAV)) || (await click(L.joinNow));
  }

  // 2) القفل
  async function lockStep() {
    ctx.tries = (ctx.tries || 0) + 1;
    await openPeople();
    const lk = ctx.s.locked;
    if (!lk.mute && (await click(L.muteAll))) { await click(L.muteConfirm, dialog()); lk.mute = true; }
    for (const [k, lbl] of [['mic', L.disMic], ['cam', L.disCam]]) {
      if (lk[k]) continue;
      const moreBtns = [...document.querySelectorAll('button,[role="button"]')]
        .filter(b => vis(b) && L.more.map(norm).some(w => norm(b.getAttribute('aria-label')).includes(w)));
      for (const mb of moreBtns) {
        mb.click(); await sleep(700);
        if (await click(lbl)) { await click(L.disable, dialog()); lk[k] = true; break; }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300);
      }
    }
    await patch({ locked: lk });
    if (lk.mic && lk.cam) {
      await patch({ phase: 'live' });
      log('تم القفل: كتم الجميع وتعطيل المايك والكاميرا');
      note(`حصة ${ctx.s.cls} جاهزة: المايكات والكاميرات معطّلة – ادخل الآن`);
      if (ctx.video) { send({ t: 'video', url: ctx.video }); note('مقطع الدرس مفتوح في تبويب جاهز: من Teams اضغط «مشاركة» واختر تبويب المقطع مع الصوت.'); }
      else note(`درس ${ctx.s.lesson || ctx.s.cls} بلا مقطع فيديو في الإعدادات – أضف الرابط.`);
    } else if (ctx.tries >= 6) {
      await patch({ phase: 'live' });
      log('تعذّر القفل الكامل');
      note(`تعذّر قفل المايك/الكاميرا في ${ctx.s.cls} – تأكد أن الحساب «مقدّم» أو اقفل يدويًا`);
    }
  }

  // 3) طوال الحصة
  async function liveStep() {
    if (!inMeeting()) {
      await sleep(4000);
      if (!inMeeting() && minsSince() < ctx.s.dur) {
        const n = (ctx.s.reconnects || 0) + 1;
        if (n <= 3) { await patch({ reconnects: n, phase: 'join' }); log('انقطع الاتصال – أعيد الدخول (' + n + ')'); note(`انقطع اتصال حصة ${ctx.s.cls} – جارٍ إعادة الدخول`); }
        else { await stop('تعذّرت إعادة الدخول بعد 3 محاولات'); }
        return;
      }
    }
    await openPeople();
    const ppl = readPeople() || []; const t = minsSince(); const now = hhmm();
    const teacherIn = ctx.manualTeacher || ppl.some(p => !p.self && isTeacher(p.name));
    if (teacherIn) { ctx.lastTeacher = Date.now(); if (!ctx.s.teacherSeen) { await patch({ teacherSeen: now }); log('دخل المعلم ' + now); } }
    const students = ppl.filter(p => !p.self && !isTeacher(p.name));
    if (t >= 0) for (const p of students) { const r = seen[p.name] || (seen[p.name] = { first: t, last: t }); r.last = t; }
    const raised = students.filter(p => p.raised).map(p => p.name);
    for (const n of raised) if (!ctx.handsNow.has(n)) { ctx.s.hands.push({ n, at: now }); note('✋ ' + n); }
    ctx.handsNow = new Set(raised);
    for (const mk of [5, 20, ctx.s.dur - 2]) if (t >= mk && !ctx.s.snaps[mk]) ctx.s.snaps[mk] = students.map(p => p.name);
    await patch({ snaps: ctx.s.snaps, hands: ctx.s.hands, seen });
    setBadge(`يعمل · الطلاب الآن ${students.length}`);

    const g = Number(ctx.st.guardMin || 10);
    if (!ctx.s.teacherSeen && t > g) return stop(`لم يدخل المعلم خلال ${g} دقائق – أوقفت المساعد وغادرت`);
    if (ctx.s.teacherSeen && ctx.lastTeacher && (Date.now() - ctx.lastTeacher) / 60000 > g) return stop(`غاب المعلم أكثر من ${g} دقائق – أوقفت المساعد وغادرت`);
    const warn = Number(ctx.st.endWarnMin ?? 2);
    if (warn > 0 && t >= ctx.s.dur - warn && !ctx.s.endWarned) {
      await patch({ endWarned: true });
      note(`⏰ تنتهي حصة ${ctx.s.cls} بعد ${warn} دقيقة – سيُنهى الاجتماع آليًا`);
      log('تنبيه نهاية الحصة');
    }
    if (t >= ctx.s.dur) return finish();
    if (!ctx.lastChat || Date.now() - ctx.lastChat > 60000) { ctx.lastChat = Date.now(); await readChat(); }
  }

  async function readChat() {
    if (!(await click(L.chat))) return; await sleep(1500);
    const msgs = [...document.querySelectorAll('[data-tid="chat-pane-message"],[data-tid*="chat-pane-item"],[data-tid*="message-body"]')].filter(vis);
    for (const m of msgs) {
      const txt = norm(m.innerText).slice(0, 300); if (!txt || ctx.chatSeen.has(txt)) continue;
      ctx.chatSeen.add(txt);
      ctx.s.chat.push({ at: hhmm(), txt });
      if (ctx.chatInit) note('💬 ' + txt.slice(0, 140));
    }
    ctx.chatInit = true;
    await patch({ chat: ctx.s.chat });
    await click(L.people);
  }

  const sim = (a, b) => { a = norm(a); b = norm(b); if (a === b) return true; const A = a.split(' '), B = b.split(' ');
    return (A[0] === B[0] && A[1] && B[1] && A[1] === B[1]) || a.includes(b) || b.includes(a); };
  function compute() {
    const late = Number(ctx.st.lateMin || 5), dur = ctx.s.dur, used = new Set(), rows = [];
    const stat = r => !r ? 'غائب' : r.first > late ? 'متأخر' : r.last < dur - 5 ? 'خرج مبكرًا' : 'حاضر';
    for (const n of ctx.roster || []) {
      const k = Object.keys(seen).find(x => !used.has(x) && sim(x, n)); if (k) used.add(k);
      const r = k ? seen[k] : null;
      rows.push({ name: n, teams: k || '', status: stat(r), first: r ? Math.max(0, Math.round(r.first)) : '', last: r ? Math.round(r.last) : '' });
    }
    for (const k of Object.keys(seen)) if (!used.has(k)) {
      const r = seen[k]; rows.push({ name: k, teams: k, status: stat(r) + ' (غير مدرج)', first: Math.max(0, Math.round(r.first)), last: Math.round(r.last) });
    }
    return rows;
  }
  async function leaveMeeting() { if (await click(L.leave)) await click(L.leave, dialog()); }
  // إنهاء الاجتماع للجميع (يتطلب صلاحية المنظّم/المقدّم)، وإلا مغادرة فقط
  async function endMeeting() {
    if ((ctx.st.endMode || 'end') === 'end') {
      if (!(await click(L.leaveOpts))) { const lb = findBtn(L.leave); const arrow = lb?.parentElement?.querySelector('button[aria-haspopup],[aria-expanded]'); if (arrow && arrow !== lb) { arrow.click(); await sleep(800); } }
      if (await click(L.endMeeting)) { await click(L.endConfirm, dialog()); return 'ended'; }
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300);
    }
    await leaveMeeting(); return 'left';
  }
  async function finish() {
    const rows = compute(); const c = s => rows.filter(r => r.status.startsWith(s)).length;
    await patch({ phase: 'done', report: rows, endedAt: hhmm() });
    const how = await endMeeting();
    log(how === 'ended' ? 'انتهت الحصة وأُغلق الاجتماع للجميع' : 'انتهت الحصة (غادرت فقط – لم يظهر خيار الإنهاء)');
    note(`انتهت حصة ${ctx.s.cls}${how === 'ended' ? ' وأُغلق الاجتماع' : ' (أغلق الاجتماع يدويًا)'}: حاضر ${c('حاضر')} · متأخر ${c('متأخر')} · خرج مبكرًا ${c('خرج')} · غائب ${c('غائب')}`);
  }
  async function stop(reason) {
    await patch({ phase: 'stopped', report: compute(), endedAt: hhmm() });
    log(reason); note(reason);
    await leaveMeeting();
  }

  async function allow(name) {
    await openPeople();
    const p = (readPeople() || []).find(x => sim(x.name, name)); if (!p) return { ok: false, err: 'لم أجد الطالب' };
    p.el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await sleep(400);
    const mb = [...p.el.querySelectorAll('button,[role="button"]')].find(b => L.more.map(norm).some(w => norm(b.getAttribute('aria-label')).includes(w)));
    if (!mb) return { ok: false, err: 'لا يوجد خيار للطالب' };
    mb.click(); await sleep(600);
    return { ok: await click(L.allowMic) };
  }

  chrome.runtime.onMessage.addListener((m, _, reply) => {
    if (!ctx || m.t !== 'cmd') return;
    (async () => {
      if (m.c === 'muteAll') { await openPeople(); const ok = await click(L.muteAll); if (ok) await click(L.muteConfirm, dialog()); reply({ ok }); }
      else if (m.c === 'relock') { await patch({ locked: { mute: false, mic: false, cam: false }, phase: 'lock' }); ctx.tries = 0; reply({ ok: true }); }
      else if (m.c === 'teacherIn') { ctx.manualTeacher = true; reply({ ok: true }); }
      else if (m.c === 'allow') reply(await allow(m.name || ''));
      else if (m.c === 'status') { const ppl = (readPeople() || []).filter(p => !p.self && !isTeacher(p.name)); reply({ ok: true, people: ppl.map(p => p.name), hands: [...ctx.handsNow] }); }
      else if (m.c === 'video') { if (ctx.video) send({ t: 'video', url: ctx.video }); reply({ ok: !!ctx.video, err: ctx.video ? '' : 'لا يوجد رابط مقطع' }); }
      else if (m.c === 'end') { await finish(); reply({ ok: true }); }
      else reply({ ok: false });
    })();
    return true;
  });

  async function init() {
    let r; try { r = await send({ t: 'whoami' }); } catch (e) { return; }
    if (!r) return;
    ctx = { ...r, handsNow: new Set(), chatSeen: new Set(), chatInit: false };
    Object.assign(seen, r.s.seen || {});
    if (['done', 'stopped'].includes(ctx.s.phase)) return;
    setBadge('بدأ التشغيل');
    const loop = async () => {
      try {
        if (ctx.s.phase === 'join') await joinStep();
        else if (ctx.s.phase === 'lock') await lockStep();
        else if (ctx.s.phase === 'live') await liveStep();
      } catch (e) { console.warn('hadir', e); }
      if (!['done', 'stopped'].includes(ctx.s.phase)) setTimeout(loop, ctx.s.phase === 'live' ? 15000 : 2500);
    };
    loop();
  }
  init();
})();
