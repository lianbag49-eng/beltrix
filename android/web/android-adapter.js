/* Android packaging adapter only. No accounts, signatures or transaction requests. */
(() => {
  'use strict';
  const ORIGIN = 'https://appassets.androidplatform.net';
  const SITE = 'https://lianbag49-eng.github.io/beltrix/';
  if (location.origin !== ORIGIN || window.top !== window.self || !window.BeltrixAndroid) return;
  const port = window.BeltrixAndroid;
  const pending = new Map(), blobs = new Map();
  let serial = 0;
  const pages = new Set(['wallet','markets','swap','settings','explore','defi','boost']);
  const route = () => pages.has(document.body?.dataset.page) ? document.body.dataset.page : 'wallet';
  const publicPage = () => SITE + '#' + route();
  const notice = e => { const text = String(e?.message || e || 'Android action unavailable'); if (window.toast) window.toast(text); else console.warn(text); };
  function call(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = String(++serial);
      const timer = setTimeout(() => { pending.delete(id); reject(Error('Android prompt expired. No transaction was requested.')); }, 120000);
      pending.set(id, {resolve, reject, timer});
      try { port.postMessage(JSON.stringify({id, action, ...payload})); }
      catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
    });
  }
  port.onmessage = e => {
    let data; try { data = JSON.parse(e.data); } catch { return; }
    const request = pending.get(data.id); if (!request) return;
    pending.delete(data.id); clearTimeout(request.timer);
    if (data.ok === true) request.resolve(data.value); else request.reject(Error(data.error || 'Cancelled'));
  };
  function publicText(value) {
    const text = String(value ?? '');
    return text.startsWith(ORIGIN + '/assets/beltrix/index.html') ? publicPage() : text;
  }
  // Never expose clipboard reads. Copy/share still require an Android confirmation.
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: Object.freeze({writeText: text => call('copy', {text: publicText(text)})})});
  Object.defineProperty(navigator, 'canShare', {configurable: true, value: data => !!data && (!data.files || data.files.length === 1 && data.files[0].type === 'image/png')});
  Object.defineProperty(navigator, 'share', {configurable: true, value: async data => {
    if (data.files) {
      if (data.files.length !== 1) throw Error('Share one QR image at a time.');
      return exportBlob(data.files[0], data.files[0].name || 'BELTRIX-QR.png');
    }
    return call('shareText', {text: publicText([data.title, data.text, data.url].filter(Boolean).join('\n'))});
  }});
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); blobs.set(url, blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); return revoke(url); };
  async function exportBlob(blob, name) {
    if (!blob || blob.size === 0 || blob.size > 2 * 1024 * 1024) throw Error('QR or CSV export must be smaller than 2 MB.');
    const mime = blob.type.split(';')[0];
    if (!['image/png', 'text/csv'].includes(mime)) throw Error('Only PNG QR images and CSV history can be exported.');
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('Cannot read the export')); reader.readAsDataURL(blob); });
    return call('export', {name, mime, base64: data.slice(data.indexOf(',') + 1)});
  }
  async function download(anchor) {
    const url = anchor.href, name = anchor.download || 'BELTRIX';
    const known = blobs.get(url); // Retain bytes before the caller revokes its object URL.
    if (known) return exportBlob(known, name);
    if (!url.startsWith('data:image/png;base64,') || url.length > 3 * 1024 * 1024) throw Error('This download is not a supported QR export.');
    return call('export', {name, mime: 'image/png', base64: url.slice('data:image/png;base64,'.length)});
  }
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download')) { download(this).catch(notice); return; }
    return click.call(this);
  };
  const external = raw => {
    const url = new URL(raw, location.href);
    if (url.protocol !== 'https:' || url.username || url.password || url.origin === ORIGIN) throw Error('Only HTTPS external links can be opened.');
    return call('openExternal', {url: url.href});
  };
  window.open = url => { try { external(url).catch(notice); } catch (e) { notice(e); } return null; };
  document.addEventListener('click', e => {
    if (!(e.target instanceof Element)) return;
    const anchor = e.target.closest('a');
    if (anchor?.hasAttribute('download')) { e.preventDefault(); download(anchor).catch(notice); return; }
    if (anchor?.href && !anchor.href.startsWith(ORIGIN + '/')) {
      e.preventDefault(); try { external(anchor.href).catch(notice); } catch (error) { notice(error); } return;
    }
    // Use the real page controls without pretending to inject a wallet provider.
    const connect = e.target.closest('#tradeConnect, #usdtConnect, [data-action="connect"]');
    if (connect && !connect.disabled) {
      e.preventDefault(); e.stopImmediatePropagation(); call('wallet').catch(notice);
    }
  }, true);
  // Kept separate from routing: Android Back first dismisses the active review/dialog.
  const back = () => {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (dialog) {
      const cancel = new Event('cancel', {cancelable: true});
      if (dialog.dispatchEvent(cancel)) dialog.close();
      return 'handled';
    }
    return 'unhandled';
  };
  Object.defineProperty(window, 'BeltrixNative', {value: Object.freeze({back, publicPage, version: '0.1.0-preview'}), configurable: false});
  document.documentElement.dataset.androidPreview = '1';
})();
