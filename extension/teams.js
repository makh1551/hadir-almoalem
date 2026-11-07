// حاضر المعلم 3 — داخل اجتماع Teams الذي فتحته الإضافة فقط: دخول ← تعطيل المايك والكاميرا ← (المقطع) ← إغلاق عند النهاية
(() => {
  const L = {
    continueBrowser: ['المتابعة على هذا المستعرض', 'متابعة على هذا المستعرض', 'المتابعة على هذا المتصفح', 'متابعة على هذا المتصفح', 'Continue on this browser', 'الانضمام على الويب', 'Join on the web', 'Use the web app instead', 'استخدام تطبيق الويب بدلاً من ذلك'],
    noAV: ['المتابعة بدون استخدام الصوت أو الفيديو', 'Continue without audio or video'],
    joinNow: ['الانضمام الآن', 'Join now'],
    rejoin: ['إعادة الانضمام', 'Rejoin', 'انضمام مرة أخرى'],
    leave: ['مغادرة', 'Leave'],
    leaveOpts: ['خيارات المغادرة', 'Leave options', 'المزيد من خيارات المغادرة', 'More leave options'],
    endMeeting: ['إنهاء الاجتماع', 'End meeting', 'إنهاء الاجتماع للجميع', 'End meeting for everyone'],
    endConfirm: ['إنهاء', 'End'],
    people: ['أشخاص', 'People', 'المشاركون', 'Participants'],
    muteAll: ['كتم صوت الكل', 'كتم صوت الجميع', 'Mute all'],
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
  // أزرار يجب ألا تُضغط أثناء القفل (المغادرة/الإنهاء)
  const DANGER = /مغادرة|leave|إنهاء|end meeting|hang ?up/i;
  const labelOf = b => norm((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.textContent || '').slice(0, 80));
  const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  // زر «المزيد» في شريط الاجتماع بالضبط (لا سهم المغادرة)
  function moreTopBtn() {
    const all = [...document.querySelectorAll('button,[role="button"]')].filter(vis);
    const byId = all.find(b => /more|showMore|callingButtons-showMoreBtn/i.test(b.id + ' ' + (b.getAttribute('data-tid') || '')) && !DANGER.test(labelOf(b)));
    if (byId) return byId;
    return all.find(b => { const a = norm(b.getAttribute('aria-label') || b.textContent || ''); return /^(المزيد|More|More actions|المزيد من الإجراءات)$/.test(a) && !DANGER.test(labelOf(b)); }) || null;
  }
  function closeLeaveMenu() { if ([...document.querySelectorAll('[role="menuitem"],[role="menuitemradio"]')].some(m => vis(m) && /إنهاء الاجتماع|End meeting/.test(m.textContent))) esc(); }
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
  // لوحة المشاركين: افتحها فقط إن كانت مغلقة (الضغط مرة ثانية يغلقها)
  const peopleHeading = () => [...document.querySelectorAll('h1,h2,h3,[role="heading"],span,div')].find(e => vis(e) && e.children.length === 0 && /^(المشاركون|Participants|People)$/.test(norm(e.textContent)));
  async function openPeople() { if (peopleHeading()) return true; await click(L.people); await sleep(1800); return !!peopleHeading(); }
  // زر «…» في رأس لوحة المشاركين
  function participantsMoreBtn() {
    const h = peopleHeading(); if (!h) return null;
    let box = h.parentElement;
    for (let i = 0; i < 5 && box; i++, box = box.parentElement) {
      const b = [...box.querySelectorAll('button,[role="button"]')].filter(x => vis(x) && !DANGER.test(labelOf(x)) && (L.more.map(norm).some(w => labelOf(x).includes(w)) || /^\W*$/.test(norm(x.textContent)) && !/إغلاق|close/i.test(labelOf(x))));
      if (b.length) return b[0];
    }
    return null;
  }
  // عنصر في القائمة المفتوحة حسب نصه
  function menuItem(labels) {
    const ws = labels.map(norm);
    const els = [...document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="menu"] button,[role="menu"] [role="option"]')].filter(vis);
    for (const w of ws) { const e = els.find(x => norm(x.textContent) === w || norm(x.textContent).startsWith(w) || norm(x.getAttribute('aria-label')).startsWith(w)); if (e) return e; }
    return null;
  }
  // زر تأكيد في نافذة الحوار بنصه الدقيق (لا يضغط عنوان الحوار نفسه)
  async function confirmDialog(words) {
    for (let i = 0; i < 6; i++) {
      const d = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(vis).pop();
      if (d) {
        const bs = [...d.querySelectorAll('button')].filter(vis).filter(x => !/^(إلغاء|Cancel|إغلاق|Close)$/i.test(norm(x.textContent)) && norm(x.textContent));
        // «تعطيل الميكروفونات» / «تعطيل الكاميرات» / «كتم الصوت»…: يبدأ بإحدى الكلمات
        const b = bs.find(x => words.some(w => norm(x.textContent) === norm(w) || norm(x.textContent).startsWith(norm(w))));
        if (b) { press(b); await sleep(400); try { b.click(); } catch (e) {} await sleep(1000); return true; }
      }
      await sleep(500);
    }
    return false;
  }

  // 1) الدخول: يستمر حتى يدخل فعلًا (صفحة «جارٍ الاتصال» وغرفة الانتظار قد تأخذ دقائق)
  async function join() {
    const deadline = Math.min(Date.now() + 8 * 60000, endAt() - 60000);
    let lastPress = 0, noted = false, avTries = 0;
    while (Date.now() < deadline) {
      if (inMeeting()) return true;
      if ((await click(L.rejoin)) || (await click(L.continueBrowser))) { badge('أتابع في المتصفح…'); await sleep(1500); continue; }
      // رسالة «هل أنت متأكد أنك لا تريد الصوت أو الفيديو؟» تظهر عند منع المايك/الكاميرا عن Teams
      const av = findBtn(L.noAV) || [...document.querySelectorAll('button,[role="button"]')].find(b => vis(b) && /بدون استخدام الصوت|without audio or video/i.test(b.textContent || ''));
      if (av) {
        avTries = (avTries || 0) + 1; badge('أتجاوز رسالة الصوت والفيديو (' + avTries + ')');
        press(av); await sleep(400); try { av.click(); } catch (e) {}
        if (avTries % 3 === 0) { av.focus(); av.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true })); }
        if (avTries === 6) note('Teams يسأل عن الصوت والفيديو: اسمح للكاميرا والميكروفون لموقع Teams (أيقونة القفل بجانب العنوان) لتختفي هذه الرسالة نهائيًا.');
        await sleep(2000); continue;
      }
      const jb = findBtn(L.joinNow);
      if (jb && !(jb.disabled || jb.getAttribute('aria-disabled') === 'true') && Date.now() - lastPress > 10000) {
        press(jb); lastPress = Date.now(); await sleep(1500);
        if (findBtn(L.joinNow)) { jb.focus(); for (const t of ['keydown', 'keypress', 'keyup']) jb.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })); }
        badge('ضغطت «الانضمام الآن» – بانتظار الاتصال…');
      }
      if (!noted && Date.now() > deadline - 5 * 60000 && !inMeeting()) { noted = true; note('الدخول يتأخر – إن ظهر زر «الانضمام الآن» فاضغطه وسأكمل.'); }
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
      const mt = moreTopBtn(); if (!mt) return; press(mt); await sleep(1000); closeLeaveMenu();
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
    esc();
    await openPeople();
  }

  // 2) تعطيل المايك والكاميرا للحضور (+ كتم الجميع) من قائمة «…» في لوحة المشاركين، ثم «خيارات الاجتماع» احتياطًا
  const lk = { mute: false, mic: false, cam: false };   // حالة القفل طوال الحصة
  async function lock(tries = 3) {
    for (let i = 1; i <= tries && !(lk.mic && lk.cam); i++) {
      closeLeaveMenu();
      badge('أفتح لوحة المشاركين…'); await openPeople();
      if (!lk.mute) { const mb = [...document.querySelectorAll('button')].filter(vis).find(b => L.muteAll.map(norm).includes(norm(b.textContent)));
        if (mb) { badge('كتم الجميع…'); press(mb); await sleep(900); await confirmDialog(['كتم الصوت', 'كتم', 'كتم صوت الكل', 'Mute', 'Mute all']); lk.mute = true; } }
      for (const [k, dis, allow] of [['mic', L.disMic, L.allowMic], ['cam', L.disCam, L.allowCam]]) {
        if (lk[k]) continue;
        const more = participantsMoreBtn(); if (!more) break;
        press(more); await sleep(900);
        if (menuItem(allow)) { lk[k] = true; esc(); await sleep(400); continue; }   // معطّل مسبقًا
        const it = menuItem(dis);
        if (it) { badge(k === 'mic' ? 'تعطيل الميكروفون للحضور…' : 'تعطيل الكاميرا للحضور…'); press(it); await sleep(1000);
          await confirmDialog(['تعطيل', 'Disable', 'عدم السماح', "Don't allow"]); lk[k] = true; }
        else esc();
        await sleep(600);
      }
      // تحقّق: افتح القائمة مرة وتأكد أن الخيارين صارا «السماح…»
      const more = participantsMoreBtn();
      if (more && (lk.mic || lk.cam)) { press(more); await sleep(900); lk.mic = lk.mic && !!menuItem(L.allowMic); lk.cam = lk.cam && !!menuItem(L.allowCam); esc(); await sleep(400); }
      closeLeaveMenu();
      if (!lk.mic || !lk.cam) { badge('أجرّب «خيارات الاجتماع»…'); await meetingOptionsLock(lk); closeLeaveMenu(); }
      if (!(lk.mic && lk.cam)) await sleep(3000);
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
    if (!(await join())) {
      badge('تعذّر الدخول – ادخل يدويًا وسأكمل'); await state({ phase: 'error', err: 'تعذّر الدخول' }); note(`تعذّر دخول «${ctx.m.title}» – ادخل يدويًا وسأكمل التعطيل والإغلاق.`);
      while (!inMeeting() && Date.now() < endAt()) await sleep(5000);
      if (!inMeeting()) return;
    }
    await state({ phase: 'lock' }); badge('دخلت – جارٍ تعطيل المايك والكاميرا…');
    let ok = await lock(2);
    await state({ phase: 'live', locked: ok });
    badge(ok ? 'المايك والكاميرا معطّلان للحضور' : 'بانتظار دخول الطلاب لتعطيل المايك والكاميرا…');
    note(ok ? `«${ctx.m.title}» جاهزة: المايك والكاميرا معطّلان للحضور` : `دخلتُ «${ctx.m.title}». سأعطّل المايك والكاميرا فور دخول أول طالب.`);
    let notedLock = ok;
    send({ t: 'ready', id: ctx.m.id });
    // الإغلاق عند نهاية الحصة، وإعادة الدخول إن انقطع
    let warned = false, reconnects = 0;
    while (true) {
      await sleep(ok ? 15000 : 5000);
      // خيار التعطيل يظهر في Teams بعد دخول الحضور: جرّب كلما دخل أحد حتى ينجح
      if (!ok && inMeeting()) { ok = await lock(1); if (ok && !notedLock) { notedLock = true; await state({ locked: true }); badge('المايك والكاميرا معطّلان للحضور'); note(`«${ctx.m.title}»: عُطّل المايك والكاميرا للحضور`); } }
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
