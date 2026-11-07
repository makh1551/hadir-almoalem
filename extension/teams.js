// حاضر المعلم 3 — داخل اجتماع Teams الذي فتحته الإضافة فقط: دخول ← تعطيل المايك والكاميرا ← (المقطع) ← إغلاق عند النهاية
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
    send: ['إرسال', 'Send'],
    moreTop: ['المزيد', 'More actions', 'More'],
    settings: ['الإعدادات', 'Settings'],
    meetingOptions: ['خيارات الاجتماع', 'Meeting options'],
    allowMic: ['السماح بالميكروفون للحضور', 'السماح للحضور بإلغاء كتم الصوت', 'Allow mic for attendees', 'Allow attendees to unmute'],
    allowCam: ['السماح بالكاميرا للحضور', 'Allow camera for attendees'],
    save: ['حفظ', 'Save'],
    share: ['مشاركة', 'Share', 'مشاركة المحتوى', 'Share content'],
    shareScreen: ['مشاركة الشاشة', 'الشاشة', 'شاشة', 'Screen', 'Share screen', 'علامة تبويب', 'Tab'],
    stopShare: ['إيقاف المشاركة', 'إيقاف العرض', 'Stop sharing', 'Stop presenting'],
    you: ['(أنت)', '(You)'],
    headers: ['مقدمو الاجتماع', 'Presenters', 'الحضور', 'Attendees', 'في هذا الاجتماع', 'In this meeting', 'المنظم', 'Organizer',
      'مدعوون', 'Invited', 'الأيدي المرفوعة', 'Raised hands', 'الآخرون المدعوون', 'Others invited']
  };
  const norm = s => (s || '').replace(/[\u064B-\u0652\u0640]/g, '').replace(/\s+/g, ' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hhmm = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // أسرع: يطابق النص أولًا ثم يفحص الظهور للمرشحين فقط (صفحة Teams فيها آلاف العناصر)
  const SEL = 'button,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="tab"]';
  function findBtn(list, root = document) {
    const ws = list.map(norm), cands = [];
    for (const x of root.querySelectorAll(SEL)) {
      const al = x.getAttribute('aria-label'), tx = x.textContent;
      if (!al && !tx) continue;
      const s = norm(al) + ' | ' + norm(tx.length > 200 ? tx.slice(0, 200) : tx);
      const i = ws.findIndex(w => s.includes(w)); if (i >= 0) cands.push([i, x]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (const [, x] of cands) if (vis(x)) return x;
    return null;
  }
  // ضغط كامل يحاكي المؤشر (بعض واجهات Teams لا تستجيب لـ click() وحده)
  function press(el) {
    const r = el.getBoundingClientRect(), o = { bubbles: true, cancelable: true, composed: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.scrollIntoView?.({ block: 'center' });
    for (const t of ['pointerover', 'pointerenter', 'mouseover', 'pointerdown', 'mousedown']) el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o));
    el.focus?.();
    for (const t of ['pointerup', 'mouseup']) el.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, o));
    el.click();
  }
  async function click(list, root) { const b = findBtn(list, root); if (b) { press(b); await sleep(900); return true; } return false; }
  const dialog = () => document.querySelector('[role="alertdialog"],[role="dialog"]') || document;

  let ctx = null;
  const send = m => chrome.runtime.sendMessage(m);
  const note = msg => send({ t: 'note', msg });
  const state = p => send({ t: 'state', id: ctx.m.id, patch: p });
  const endAt = () => { const [h, m] = ctx.m.start.split(':').map(Number); const d = new Date(); d.setHours(h, m + Number(ctx.m.dur || 40), 0, 0); return d.getTime(); };
  let badgeEl;
  function badge(txt) {
    if (!badgeEl) { badgeEl = document.createElement('div');
      badgeEl.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;background:#0f766e;color:#fff;font:13px/1.4 Tahoma,Arial;padding:8px 12px;border-radius:10px;direction:rtl;box-shadow:0 2px 8px #0004;max-width:320px';
      document.documentElement.appendChild(badgeEl); }
    badgeEl.textContent = '🎓 حاضر المعلم — ' + txt;
  }
  const inMeeting = () => !!findBtn(L.leave);
  async function openPeople() { await click(L.people); await sleep(1500); }

  // 1) الدخول
  async function join() {
    for (let i = 1; i <= 40; i++) {
      if (inMeeting()) return true;
      if ((await click(L.rejoin)) || (await click(L.continueBrowser)) || (await click(L.noAV))) continue;
      const jb = findBtn(L.joinNow);
      if (jb && !(jb.disabled || jb.getAttribute('aria-disabled') === 'true')) {
        press(jb); await sleep(1500);
        if (findBtn(L.joinNow) && i % 2 === 0) { jb.focus(); for (const t of ['keydown', 'keypress', 'keyup']) jb.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })); }
        if (i === 8) note('لم أستطع الضغط على «الانضمام الآن» — اضغطه بنفسك وسأكمل.');
      }
      await sleep(2500);
    }
    return inMeeting();
  }

  // قفل بديل من «خيارات الاجتماع» (يعمل حتى لو لم يدخل طلاب بعد)
  function findToggle(labels) {
    const all = [...document.querySelectorAll('[role="switch"],input[type="checkbox"],button[aria-checked],button[aria-pressed]')].filter(vis);
    for (const w of labels.map(norm)) {
      const t = all.find(x => (norm(x.getAttribute('aria-label')) + ' ' + norm((x.closest('label,li,[role="group"],div') || {}).innerText || '')).includes(w));
      if (t) return t;
    }
    return null;
  }
  const isOn = t => t.getAttribute('aria-checked') === 'true' || t.checked === true || t.getAttribute('aria-pressed') === 'true';
  async function meetingOptionsLock(lk) {
    const already = findToggle(L.allowMic) || findToggle(L.allowCam);
    if (!already) {
      if (!(await click(L.moreTop))) return;
      if (!(await click(L.meetingOptions))) { if (await click(L.settings)) await click(L.meetingOptions); }
      await sleep(2500);
    }
    let changed = false;
    for (const [k, lbl] of [['mic', L.allowMic], ['cam', L.allowCam]]) {
      const t = findToggle(lbl); if (!t) continue;
      if (isOn(t)) { t.click(); await sleep(500); changed = true; }
      if (!isOn(t)) lk[k] = true;
    }
    if (changed) await click(L.save);
    if (lk.mic) lk.mute = true; // من لا يملك المايك لا يحتاج كتمًا
    await sleep(800);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await click(L.people);
  }

  // 2) تعطيل المايك والكاميرا للحضور (+ كتم الجميع)
  async function lock() {
    const lk = { mute: false, mic: false, cam: false };
    for (let i = 1; i <= 8 && !(lk.mic && lk.cam); i++) {
      await openPeople();
      if (!lk.mute && (await click(L.muteAll))) { await click(L.muteConfirm, dialog()); lk.mute = true; }
      for (const [k, lbl] of [['mic', L.disMic], ['cam', L.disCam]]) {
        if (lk[k]) continue;
        const moreBtns = [...document.querySelectorAll('button,[role="button"]')].filter(b => vis(b) && L.more.map(norm).some(w => norm(b.getAttribute('aria-label')).includes(w)));
        for (const mb of moreBtns) {
          mb.click(); await sleep(700);
          if (await click(lbl)) { await click(L.disable, dialog()); lk[k] = true; break; }
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300);
        }
      }
      if (!lk.mic || !lk.cam) await meetingOptionsLock(lk);
      if (!(lk.mic && lk.cam)) await sleep(4000);
    }
    return lk.mic && lk.cam;
  }

  // 3) الإغلاق
  async function leaveMeeting() { if (await click(L.leave)) await click(L.leave, dialog()); }
  async function endMeeting() {
    if (!(await click(L.leaveOpts))) { const lb = findBtn(L.leave); const arrow = lb?.parentElement?.querySelector('button[aria-haspopup],[aria-expanded]'); if (arrow && arrow !== lb) { arrow.click(); await sleep(800); } }
    if (await click(L.endMeeting)) { await click(L.endConfirm, dialog()); return true; }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(300);
    await leaveMeeting(); return false;
  }

  // مشاركة تبويب المقطع (Ctrl+Shift+1)
  function waitShared(ms) {
    return new Promise(res => {
      const t = setTimeout(() => { window.removeEventListener('message', h); res({ ok: false, err: 'لم يطلب Teams الشاشة — جرّب زر «مشاركة» يدويًا' }); }, ms);
      function h(e) { if (e.source === window && e.data && e.data.__hadir === 'shared') { clearTimeout(t); window.removeEventListener('message', h); res(e.data); } }
      window.addEventListener('message', h);
    });
  }
  async function shareTab(streamId) {
    window.postMessage({ __hadir: 'share', streamId }, '*');
    const wait = waitShared(15000);
    const topShare = [...document.querySelectorAll('button,[role="button"]')].filter(vis)
      .find(b => /^(مشاركة|Share)(\s|$)/.test(norm(b.getAttribute('aria-label') || b.innerText)) || /share-button|sharing-button/i.test(b.getAttribute('data-tid') || b.id || ''));
    if (topShare) { topShare.click(); await sleep(1500); } else if (!(await click(L.share))) return { ok: false, err: 'لم أجد زر «مشاركة» في Teams' };
    await click(L.shareScreen); // درج المشاركة: اختر «الشاشة» إن ظهر
    const r = await wait;
    if (r.ok) badge('المقطع يُعرض للطلاب');
    return r.ok ? { ok: true } : { ok: false, err: r.err };
  }
  chrome.runtime.onMessage.addListener((m, _, reply) => {
    if (!ctx || m.t !== 'cmd') return;
    (async () => {
      if (m.c === 'shareTab') return shareTab(m.streamId);
      if (m.c === 'end') { const ok = await endMeeting(); await state({ phase: 'done' }); return { ok }; }
      if (m.c === 'relock') { const ok = await lock(); return { ok }; }
      return { ok: false };
    })().then(reply, e => reply({ ok: false, err: String(e) }));
    return true;
  });

  async function init() {
    let r; try { r = await send({ t: 'whoami' }); } catch (e) { return; }
    if (!r) return;
    ctx = r;
    badge('جارٍ الدخول…');
    if (!(await join())) { badge('تعذّر الدخول'); await state({ phase: 'error', err: 'تعذّر الدخول' }); note(`تعذّر دخول اجتماع ${ctx.m.title} – ادخل يدويًا.`); return; }
    await state({ phase: 'lock' }); badge('دخلت – جارٍ تعطيل المايك والكاميرا…');
    const ok = await lock();
    await state({ phase: 'live', locked: ok });
    badge(ok ? 'المايك والكاميرا معطّلان للحضور' : 'تعذّر التعطيل الكامل');
    note(ok ? `«${ctx.m.title}» جاهزة: المايك والكاميرا معطّلان للحضور` : `تعذّر تعطيل المايك/الكاميرا في «${ctx.m.title}». عطّلهما من: المزيد ← خيارات الاجتماع.`);
    send({ t: 'ready', id: ctx.m.id });
    // الإغلاق عند نهاية الحصة، وإعادة الدخول إن انقطع
    let warned = false, reconnects = 0;
    while (true) {
      await sleep(15000);
      const left = endAt() - Date.now();
      if (!warned && left <= 120000 && left > 0) { warned = true; note(`«${ctx.m.title}» تنتهي بعد دقيقتين وسيُغلق الاجتماع.`); }
      if (left <= 0) {
        const ended = await endMeeting(); await state({ phase: 'done' });
        badge(ended ? 'انتهت الحصة وأُغلق الاجتماع' : 'انتهت الحصة');
        note(ended ? `انتهت «${ctx.m.title}» وأُغلق الاجتماع للجميع` : `انتهت «${ctx.m.title}» – غادرتُ، ولم يظهر خيار «إنهاء الاجتماع» (أغلقه يدويًا إن لزم)`);
        send({ t: 'closeTab', later: 8000 }); return;
      }
      if (!inMeeting()) { await sleep(4000); if (!inMeeting() && reconnects < 3) { reconnects++; badge('انقطع الاتصال – أعيد الدخول'); if (await join()) await lock(); } }
    }
  }
  init();
})();
