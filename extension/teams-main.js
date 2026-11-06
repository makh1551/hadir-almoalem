// حاضر المعلم — يعمل داخل صفحة Teams نفسها: إذا جهّزت الإضافة تبويب المقطع للمشاركة،
// يُعطى لـ Teams بدل نافذة اختيار الشاشة. وإلا تبقى المشاركة العادية كما هي.
(() => {
  const md = navigator.mediaDevices;
  if (!md || !md.getDisplayMedia || md.__hadir) return;
  md.__hadir = true;
  const orig = md.getDisplayMedia.bind(md);
  let pending = null;
  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.__hadir !== 'share') return;
    pending = { id: e.data.streamId, at: Date.now() };
  });
  md.getDisplayMedia = async function (constraints) {
    if (pending && Date.now() - pending.at < 30000) {
      const id = pending.id; pending = null;
      try {
        const stream = await md.getUserMedia({
          audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: id } },
          video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: id, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } }
        });
        window.postMessage({ __hadir: 'shared', ok: true }, '*');
        return stream;
      } catch (err) {
        window.postMessage({ __hadir: 'shared', ok: false, err: String(err && err.message || err) }, '*');
      }
    }
    return orig(constraints);
  };
})();
