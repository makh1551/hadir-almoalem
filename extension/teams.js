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
    ctx.joinTries = (ctx.joinTries || 0) + 1;
    if ((await click(L.rejoin)) || (await click(L.continueBrowser)) || (await click(L.noAV))) return;
    const jb = findBtn(L.joinNow);
    if (jb) {
      if (jb.disabled || jb.getAttribute('aria-disabled') === 'true') { log('زر الانضمام معطّل — بانتظار الصفحة'); return; }
      press(jb); await sleep(1500);
      if (findBtn(L.joinNow) && ctx.joinTries % 2 === 0) { jb.focus(); for (const t of ['keydown', 'keypress', 'keyup']) jb.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })); }
      if (ctx.joinTries === 8) note(`لم أستطع الضغط على «الانضمام الآن» في ${ctx.s.cls} — اضغطه بنفسك مرة واحدة وسأكمل.`);
    }
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
    if (!lk.mic || !lk.cam) await meetingOptionsLock(lk);
    await patch({ locked: lk });
    if (lk.mic && lk.cam) {
      await patch({ phase: 'live' });
      log('تم القفل: كتم الجميع وتعطيل المايك والكاميرا');
      note(`حصة ${ctx.s.cls} جاهزة: المايكات والكاميرات معطّلة – ادخل الآن`);
      if (!ctx.video) note(`درس ${ctx.s.lesson || ctx.s.cls} بلا مقطع – أضف الرابط من «الحصص».`);
    } else if (ctx.tries >= 10) {
      await patch({ phase: 'live' });
      log('تعذّر القفل الكامل');
      note(`تعذّر قفل المايك/الكاميرا في ${ctx.s.cls}. أرسل «🩺 تشخيص» من الإضافة، وأوقفها يدويًا من: المزيد ← الإعدادات ← خيارات الاجتماع.`);
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
    // بداية الحصة: افتح المقطع وشغّله، واطلب ضغطة العرض
    if (t >= 0 && ctx.video && !ctx.s.videoOpened) {
      await patch({ videoOpened: hhmm() });
      send({ t: 'video', url: ctx.video, active: true });
      note('🎬 المقطع يعمل الآن — اضغط Ctrl+Shift+1 لعرضه للطلاب في Teams');
    }

    const g = Number(ctx.st.guardMin || 10);
    if (!ctx.s.teacherSeen && t > g) return stop(`لم يدخل المعلم خلال ${g} دقائق – أوقفت المساعد وغادرت`);
    if (ctx.s.teacherSeen && ctx.lastTeacher && (Date.now() - ctx.lastTeacher) / 60000 > g) return stop(`غاب المعلم أكثر من ${g} دقائق – أوقفت المساعد وغادرت`);
    const warn = Number(ctx.st.endWarnMin ?? 2);
    if (warn > 0 && t >= ctx.s.dur - warn && !ctx.s.endWarned) {
      await patch({ endWarned: true, summary: lessonSummary() });
      if (ctx.st.postSummary !== false) { if (await postChat(ctx.s.summary)) log('نُشر ملخص الدرس في الدردشة'); }
      note(`⏰ تنتهي حصة ${ctx.s.cls} بعد ${warn} دقيقة – سيُنهى الاجتماع آليًا`);
      log('تنبيه نهاية الحصة');
    }
    if (t >= ctx.s.dur) return finish();
    if (!ctx.lastChat || Date.now() - ctx.lastChat > ((ctx.s.questions || []).length ? 30000 : 60000)) { ctx.lastChat = Date.now(); await readChat(); }
  }

  async function readChat() {
    if (!(await click(L.chat))) return; await sleep(1500);
    await readChatPane();
    ctx.chatInit = true;
    await click(L.people);
  }

  // قراءة الدردشة (المرسل + النص) وربط الإجابات بآخر سؤال
  async function readChatPane() {
    const items = [...document.querySelectorAll('[data-tid*="chat-pane-item"],[data-tid="chat-pane-message"]')].filter(vis);
    for (const it of items) {
      const body = it.querySelector('[data-tid*="message-body"],[data-tid*="message-content"]') || it;
      const author = norm((it.querySelector('[data-tid*="author"],[data-tid*="message-author"]') || {}).textContent || '');
      const txt = norm(body.innerText).slice(0, 300); if (!txt) continue;
      const key = author + '|' + txt; if (ctx.chatSeen.has(key)) continue; ctx.chatSeen.add(key);
      if (ctx.mine.has(txt)) continue; // رسائل المساعد نفسه
      ctx.s.chat.push({ at: hhmm(), who: author, txt });
      const q = (ctx.s.questions || []).slice(-1)[0];
      if (ctx.chatInit && q && author && !isTeacher(author) && !q.answers.some(a => a.name === author) && q.answers.length < 10) {
        q.answers.push({ name: author, txt: txt.slice(0, 120), at: hhmm() });
        if (q.answers.length <= 3) note(`🏅 ${q.answers.length}. ${author}: ${txt.slice(0, 80)}`);
      } else if (ctx.chatInit) note('💬 ' + (author ? author + ': ' : '') + txt.slice(0, 140));
    }
    await patch({ chat: ctx.s.chat, questions: ctx.s.questions || [] });
  }
  // نشر سؤال في دردشة الاجتماع
  function defaultQuestions(title) {
    const t = (title || 'الدرس').replace(/\(.*?\)/g, '').trim();
    return [`ما أهم ما تعلّمته في درس «${t}»؟`, `اكتب مثالًا من عندك على «${t}».`, `ما الفكرة الأصعب في «${t}»؟ ولماذا؟`];
  }
  async function postChat(text) {
    if (!(await click(L.chat))) return false; await sleep(1500);
    const box = [...document.querySelectorAll('[data-tid="ckeditor"] [contenteditable="true"],[contenteditable="true"][role="textbox"],div[contenteditable="true"]')].filter(vis).pop();
    if (!box) return false;
    box.focus(); document.execCommand('insertText', false, text); await sleep(500);
    const sendBtn = findBtn(L.send);
    if (sendBtn) sendBtn.click(); else box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(800); ctx.mine.add(norm(text));
    await readChatPane(); // خط أساس قبل الإجابات
    await click(L.people);
    return true;
  }
  async function ask(textOrNull) {
    const list = String(ctx.questions || '').split('\n').map(x => x.trim()).filter(Boolean);
    const pool = list.length ? list : defaultQuestions(ctx.s.lesson);
    const i = ctx.s.questions?.length || 0;
    const text = textOrNull || pool[i % pool.length];
    ctx.s.questions = ctx.s.questions || [];
    ctx.s.questions.push({ text, at: hhmm(), answers: [] });
    ctx.chatInit = true;
    const ok = await postChat('❓ ' + text);
    if (!ok) { ctx.s.questions.pop(); return { ok: false, err: 'تعذّر الوصول لصندوق الدردشة' }; }
    await patch({ questions: ctx.s.questions }); log('سؤال: ' + text);
    ctx.lastChat = Date.now() - 45000; // اقرأ الإجابات قريبًا
    return { ok: true, text };
  }
  // تشخيص: أي عناصر Teams وُجدت
  async function diag() {
    const out = { وقت: hhmm(), الرابط: location.host + location.pathname.slice(0, 40), داخل_الاجتماع: inMeeting() };
    const keys = { people: 'زر أشخاص', muteAll: 'كتم صوت الجميع', more: 'خيارات أخرى', chat: 'زر الدردشة', leave: 'زر مغادرة', leaveOpts: 'خيارات المغادرة', joinNow: 'الانضمام الآن', noAV: 'بدون صوت أو فيديو' };
    for (const [k, label] of Object.entries(keys)) out[label] = !!findBtn(L[k]);
    out['لوحة المشاركين'] = !!peopleRoot();
    const ppl = readPeople() || []; out['عدد المقروئين'] = ppl.length; out['المعلم ظاهر'] = ppl.some(p => !p.self && isTeacher(p.name)) || !!ctx.manualTeacher;
    out['قفل'] = JSON.stringify(ctx.s.locked); out['المرحلة'] = ctx.s.phase;
    out['زر المزيد'] = !!findBtn(L.moreTop); out['زر مشاركة'] = !!findBtn(L.share); out['مفتاح مايك الحضور'] = (t => t ? (isOn(t) ? 'مفعّل' : 'مقفل') : 'غير ظاهر')(findToggle(L.allowMic));
    out['مفتاح كاميرا الحضور'] = (t => t ? (isOn(t) ? 'مفعّل' : 'مقفل') : 'غير ظاهر')(findToggle(L.allowCam));
    out['صندوق الدردشة'] = !![...document.querySelectorAll('[contenteditable="true"]')].filter(vis).length;
    out['أزرار ظاهرة'] = [...document.querySelectorAll('button[aria-label]')].filter(vis).slice(0, 25).map(b => norm(b.getAttribute('aria-label')).slice(0, 30)).join(' | ');
    return out;
  }
  function lessonSummary() {
    const qs = (ctx.s.questions || []).map(q => '• ' + q.text).join('\n');
    return `📝 ملخص درس «${(ctx.s.lesson || ctx.s.cls).trim()}»` + (ctx.video ? `\n🎬 مقطع الدرس: ${ctx.video}` : '') + (qs ? `\n❓ أسئلة اليوم:\n${qs}` : '') + '\nراجعوا الدرس، ومن فاته شيء يسأل في الحصة القادمة.';
  }
  // مشاركة تبويب المقطع في Teams (التبويب يلتقطه المتصفح بإذن ضغطة المعلم على الإضافة)
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
    if (r.ok) log('بدأت مشاركة المقطع');
    return r.ok ? { ok: true } : { ok: false, err: r.err };
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
    await patch({ phase: 'done', report: rows, endedAt: hhmm(), summary: ctx.s.summary || lessonSummary() });
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

  async function runCmd(m) {
    if (m.c === 'muteAll') { await openPeople(); const ok = await click(L.muteAll); if (ok) await click(L.muteConfirm, dialog()); return { ok }; }
    if (m.c === 'relock') { await patch({ locked: { mute: false, mic: false, cam: false }, phase: 'lock' }); ctx.tries = 0; return { ok: true }; }
    if (m.c === 'teacherIn') { ctx.manualTeacher = true; return { ok: true }; }
    if (m.c === 'allow') return await allow(m.name || '');
    if (m.c === 'status') { await openPeople(); const ppl = (readPeople() || []).filter(p => !p.self && !isTeacher(p.name)).map(p => p.name);
      const absent = (ctx.roster || []).filter(n => !ppl.some(x => sim(x, n))); return { ok: true, people: ppl, absent, hands: [...ctx.handsNow] }; }
    if (m.c === 'video') { if (ctx.video) send({ t: 'video', url: ctx.video, active: !!m.remote }); return { ok: !!ctx.video, err: ctx.video ? '' : 'لا يوجد رابط مقطع لهذه الحصة' }; }
    if (m.c === 'end') { await finish(); return { ok: true }; }
    if (m.c === 'ask') return await ask(m.text || null);
    if (m.c === 'shareTab') return await shareTab(m.streamId);
    if (m.c === 'stopShare') return { ok: await click(L.stopShare) };
    if (m.c === 'diag') return { ok: true, diag: await diag() };
    if (m.c === 'summary') { const t = lessonSummary(); await patch({ summary: t }); return { ok: await postChat(t), text: t }; }
    return { ok: false };
  }
  chrome.runtime.onMessage.addListener((m, _, reply) => {
    if (!ctx || m.t !== 'cmd') return;
    runCmd(m).then(reply, e => reply({ ok: false, err: String(e) }));
    return true;
  });

  // التحكم من الجوال: يسأل عن أمر جديد كل 3 ثوانٍ، ويرفع حالة الحصة كل 15 ثانية أو بعد كل أمر
  async function remoteLoop() {
    if (!ctx.st.ctlToken) return;
    let after = null, lastPush = 0, ack = null, busy = false;
    const state = () => {
      let ppl = []; try { ppl = (readPeople() || []).filter(p => !p.self && !isTeacher(p.name)).map(p => p.name); } catch (e) {}
      const roster = ctx.roster || [], absent = roster.length ? roster.filter(n => !ppl.some(x => sim(x, n))).length : null;
      return { teacher: ctx.st.teacherName || '', cls: ctx.s.cls, lesson: ctx.s.lesson, start: ctx.s.start, phase: ctx.s.phase, teacherSeen: ctx.s.teacherSeen || (ctx.manualTeacher ? hhmm() : null),
        left: Math.max(0, Math.round(ctx.s.dur - minsSince())), present: ppl.length, absent, hands: [...ctx.handsNow], chat: (ctx.s.chat || []).slice(-3).map(c => ({ who: c.who, txt: String(c.txt).slice(0, 120) })), ack };
    };
    const push = () => { lastPush = Date.now(); return send({ t: 'ctlState', state: state() }).catch(() => {}); };
    const tickR = async () => {
      if (busy) return; busy = true;
      try {
        const r = await send({ t: 'ctlPoll', after: after || 0 });
        if (after === null) after = (r && r.cmd && r.cmd.id) || 1; // أول سؤال: تجاهل أي أمر قديم
        else if (r && r.cmd && r.cmd.id > after) {
          after = r.cmd.id; log('📱 أمر من الجوال: ' + r.cmd.c);
          let res; try { res = await runCmd({ ...r.cmd, remote: true }); } catch (e) { res = { ok: false, err: String(e) }; }
          ack = { id: r.cmd.id, ...res, people: res.people, absent: res.absent }; await push();
        } else if (Date.now() - lastPush > 15000) await push();
      } catch (e) {}
      busy = false;
      if (['done', 'stopped'].includes(ctx.s.phase)) { await push(); clearInterval(iv); }
    };
    const iv = setInterval(tickR, 3000); push();
  }

  async function init() {
    let r; try { r = await send({ t: 'whoami' }); } catch (e) { return; }
    if (!r) return;
    ctx = { ...r, handsNow: new Set(), chatSeen: new Set(), chatInit: false, mine: new Set() };
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
    remoteLoop();
  }
  init();
})();
