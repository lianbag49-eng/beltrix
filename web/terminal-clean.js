/** Approved compact presentation. Original financial inputs, events and guards own execution. */
const $ = id => document.getElementById(id);
function mount() {
  if (document.documentElement.dataset.cleanTerminal) return true;
  const bottom = document.querySelector('.bottom-nav'), top = document.querySelector('.top');
  const root = $('markets'), toolbar = root?.querySelector('.simple-trade-toolbar'), bar = $('fastOrderBar');
  if (!bottom || !top || !toolbar || !bar || !$('simpleOrderOptions')) return false;
  document.documentElement.dataset.cleanTerminal = 'v1';
  document.documentElement.dataset.beltrixTheme = 'black-gold';
  toolbar.querySelector('[data-trade-product=perp]').textContent = 'Futures';
  const old = document.querySelector('.app > .nav');
  if (old) { old.hidden = true; old.setAttribute('aria-hidden', 'true'); }
  bottom.setAttribute('aria-label', 'Main navigation');
  const trade = bottom.querySelector('[data-page="markets"]');
  if (trade) for (const n of [...trade.childNodes]) if (n.nodeType === Node.TEXT_NODE) n.textContent = 'Trade';
  const more = document.createElement('button');
  more.type = 'button'; more.id = 'cleanMore'; more.className = 'clean-icon-button'; more.textContent = '⋯';
  more.setAttribute('aria-label', 'More app options'); top.append(more);
  const menu = document.createElement('dialog'); menu.id = 'cleanMoreDialog'; menu.className = 'clean-more-dialog';
  menu.innerHTML = '<div class="clean-menu-head"><strong>More</strong><button type="button" data-clean-close aria-label="Close app options">×</button></div><button type="button" data-clean-route="swap">Practice · no real funds</button><button type="button" data-clean-route="settings">Settings</button><p>Trading and transfers always require a separate review and wallet approval.</p>';
  document.body.append(menu); more.onclick = () => menu.showModal(); menu.querySelector('[data-clean-close]').onclick = () => menu.close();
  menu.addEventListener('click', e => { const b = e.target.closest('[data-clean-route]'); if (!b) return; menu.close(); window.openPage?.(b.dataset.cleanRoute); });
  const chartButton = document.createElement('button');
  chartButton.type = 'button'; chartButton.id = 'cleanOpenChart'; chartButton.className = 'clean-icon-button';
  chartButton.setAttribute('aria-label', 'Open expanded chart');
  chartButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18M3 7h4v9H3zM12 2v20M10 5h4v8h-4zM19 4v16M17 11h4v6h-4z"/></svg>';
  toolbar.insertBefore(chartButton, $('tradeLayoutMode'));
  chartButton.onclick = () => window.dispatchEvent(new CustomEvent('beltrix:chart-open', { detail: { expanded: true } }));

  // A single primary action, like Spot. Forward to existing side buttons; never submit here.
  const originalSides = bar.querySelector('[aria-label="Order direction"]');
  originalSides.classList.add('gold-legacy-directions');
  const directions = document.createElement('div'); directions.className = 'gold-directions';
  directions.setAttribute('role', 'group'); directions.setAttribute('aria-label', 'Trade direction');
  directions.innerHTML = '<button type="button" data-gold-direction="buy" aria-pressed="true">Long</button><button type="button" data-gold-direction="sell" aria-pressed="false">Short</button>';
  originalSides.after(directions);
  const modeNote = $('tradeModeNote'), hint = $('futuresModeHint');
  const homes = new Map();
  for (const el of [modeNote, hint]) { const marker = document.createComment('compact-note-home'); el.before(marker); homes.set(el, marker); }
  const panel = root.querySelector('.chart-panel'), drawer = $('futuresChart'), layout = root.querySelector('.trade-layout');
  let queued = false;
  const set = (el, key, value) => { if (el.getAttribute(key) !== value) el.setAttribute(key, value); };
  const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  function sync() {
    const simple = root.dataset.tradeLayout === 'simple', spot = $('marketType').value === 'spot';
    const close = !spot && $('tradeReduce').checked, actualSide = $('tradeSide').value;
    const visibleSide = close ? (actualSide === 'buy' ? 'sell' : 'buy') : actualSide;
    set(root, 'data-compact-direction', visibleSide); set(root, 'data-compact-intent', close ? 'close' : 'open');
    directions.hidden = !simple;
    for (const b of directions.querySelectorAll('[data-gold-direction]')) {
      const requested = close ? (b.dataset.goldDirection === 'buy' ? 'sell' : 'buy') : b.dataset.goldDirection;
      const native = originalSides.querySelector(`[data-fast-side="${requested}"]`);
      b.disabled = !native || native.disabled || $('tradeDialog').open;
      set(b, 'aria-pressed', String(b.dataset.goldDirection === visibleSide));
      text(b, spot ? (b.dataset.goldDirection === 'buy' ? 'Buy' : 'Sell') : (b.dataset.goldDirection === 'buy' ? 'Long' : 'Short'));
    }
    for (const el of [modeNote, hint]) {
      if (simple) { if (!$('futuresExtra').contains(el)) $('futuresExtra').append(el); }
      else if (el.previousSibling !== homes.get(el)) homes.get(el).after(el);
    }
    // The chart is a primary trading surface: keep it visible inline on desktop and mobile.
    if (!panel.closest('dialog[open]')) {
      drawer.hidden = true;
      drawer.open = false;
      if (panel.parentNode !== layout) layout.prepend(panel);
    }
    const stats = $('simpleMarketDetails');
    for (const funding of root.querySelectorAll('.market-card > .funding-bar')) {
      if (stats && stats.nextElementSibling !== funding) stats.after(funding);
    }
  }
  function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; sync(); }); }
  directions.addEventListener('click', e => {
    const b = e.target.closest('[data-gold-direction]');
    if (!b || b.disabled || $('tradeDialog').open) return;
    const close = $('marketType').value !== 'spot' && $('tradeReduce').checked;
    const side = close ? (b.dataset.goldDirection === 'buy' ? 'sell' : 'buy') : b.dataset.goldDirection;
    const native = originalSides.querySelector(`[data-fast-side="${side}"]`);
    if (native && !native.disabled) native.click(); sync();
  });
  for (const event of ['input', 'change', 'click']) root.addEventListener(event, schedule);
  for (const event of ['resize', 'beltrix:market', 'beltrix:wallet']) window.addEventListener(event, schedule);
  $('tradeDialog').addEventListener('close', schedule);
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['data-trade-layout', 'data-active-product'] });
  new MutationObserver(schedule).observe(originalSides, { attributes: true, subtree: true, attributeFilter: ['disabled', 'aria-pressed'] });
  new MutationObserver(schedule).observe(root.querySelector('.market-card'), { childList: true });
  new MutationObserver(schedule).observe(layout, { childList: true });
  new MutationObserver(schedule).observe($('tradeDialog'), { attributes: true, attributeFilter: ['open'] });
  sync();
  return true;
}
if (!mount()) {
  const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
  observer.observe(document.body, { childList: true, subtree: true });
}
