// Presentation only: keep the original inputs, events, account state and signing guards.
const $ = id => document.getElementById(id);
const root = $('markets'), ticket = root?.querySelector('.order-ticket');
const KEY = 'beltrix-trade-layout-v1';
const required = ['marketType','marketNetwork','marketInterval','tradeType','tradeSide','tradeReduce','tradeSlippageField','fastOrderBar','futuresExtra','futuresLeverageDrawer'];
if (ticket && required.every(id => $(id)) && !document.documentElement.dataset.simpleTrade) {
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = new URL('./trade-simple.css', import.meta.url).href;
  css.id = 'simpleTradeStyles'; document.head.append(css);
  const node = (tag, cls, html) => {
    const el = document.createElement(tag); el.className = cls; el.innerHTML = html; return el;
  };
  const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
  const header = root.querySelector('.market-card > .market-controls');
  const toolbar = node('div', 'simple-trade-toolbar', `<div class="simple-products" role="group" aria-label="Trading product"><button type="button" data-trade-product="spot" aria-pressed="false">Spot</button><button type="button" data-trade-product="perp" aria-pressed="true">Perps</button></div><button type="button" id="tradeLayoutMode" class="simple-view-toggle" aria-pressed="false">Advanced view</button>`);
  header.before(toolbar);
  $('marketType').classList.add('simple-native-product');
  $('tradeSide').classList.add('simple-native-side');

  // Secondary market metrics stay available instead of occupying several rows.
  const stats = root.querySelector('.market-stats');
  const statsDrawer = node('details', 'simple-market-details', `<summary><span>Market details</span><span class="simple-market-snapshot"><b id="simpleMark">—</b><b id="simpleChange">—</b></span></summary>`);
  statsDrawer.id = 'simpleMarketDetails'; stats.before(statsDrawer); statsDrawer.append(stats);
  // The wallet bundle may mount funding actions later beside .market-stats.
  // Keep these primary actions outside a collapsed secondary-information drawer.
  const keepFundingVisible = () => {
    for (const bar of statsDrawer.querySelectorAll(':scope > .funding-bar')) statsDrawer.before(bar);
  };
  keepFundingVisible();
  new MutationObserver(keepFundingVisible).observe(statsDrawer, { childList: true });

  // Mark original locations before moving actual nodes; never clone financial controls.
  const homes = new Map();
  const remember = el => { const marker = document.createComment('simple-trade-home'); el.before(marker); homes.set(el, marker); return el; };
  const restore = el => homes.get(el).after(el);
  const refreshMarket = remember($('marketRefresh'));
  const interval = remember($('marketInterval'));
  const chartTools = node('div', 'simple-chart-tools', '<label for="marketInterval">Chart interval</label>');
  root.querySelector('.chart-panel').prepend(chartTools);
  const type = remember($('tradeType'));
  const slippage = remember($('tradeSlippageField'));
  const reduce = remember($('tradeReduce').closest('label'));
  const triggers = [...$('fastOrderBar').querySelectorAll('[data-fast-type="Stop"], [data-fast-type="TakeProfit"]')].map(remember);
  const options = node('details', 'simple-order-options', `<summary id="simpleOrderSummary">Order settings</summary><div class="simple-option-fields"><label id="simpleOrderTypeLabel" for="tradeType">All order types</label><div id="simpleTriggerTools" class="fast-row" role="group" aria-label="Existing position TP and SL"></div></div>`);
  options.id = 'simpleOrderOptions'; $('fastOrderBar').append(options);
  const optionFields = options.querySelector('.simple-option-fields');
  const notional = remember($('tradeNotional').closest('div'));
  const margin = remember($('tradeMarginEstimate').closest('div'));
  margin.classList.add('simple-margin-estimate');
  const amounts = root.querySelector('.futures-available');
  const feeNote = node('p','simple-fee-note','Estimates exclude fees. Review before signing.');
  amounts.after(feeNote);
  const recent = root.querySelector('.recent-trades');
  const nativeReview = $('tradeReview');
  const availableLabel = $('tradeAvailable').closest('div').querySelector('dt');
  let mode = 'simple', scheduled = false, observedType = null;
  try { if (localStorage.getItem(KEY) === 'advanced') mode = 'advanced'; } catch { /* Session-only view remains usable. */ }

  function locked() { return $('marketType').disabled || $('tradeDialog').open; }
  function applyMode(next, save = false) {
    mode = next === 'advanced' ? 'advanced' : 'simple';
    const simple = mode === 'simple';
    root.dataset.tradeLayout = mode; observedType = null;
    text('tradeLayoutMode', simple ? 'Advanced view' : 'Simple view');
    $('tradeLayoutMode').setAttribute('aria-pressed', String(!simple));
    if (simple) {
      chartTools.append(interval);
      statsDrawer.append(refreshMarket);
      $('simpleOrderTypeLabel').after(type);
      optionFields.append(slippage, reduce);
      $('simpleTriggerTools').append(...triggers);
      amounts.append(notional, margin);
    } else {
      [refreshMarket,interval,type,slippage,reduce,...triggers,notional,margin].forEach(restore);
    }
    options.hidden = !simple; chartTools.hidden = !simple;
    const expanded = !simple && !matchMedia('(max-width:680px)').matches;
    $('futuresExtra').open = expanded;
    $('futuresLeverageDrawer').open = expanded;
    statsDrawer.open = !simple;
    if (recent) recent.open = !simple;
    // The original review button is invoked by the existing large directional buttons.
    nativeReview.classList.toggle('simple-secondary-review', simple);
    if (save) try { localStorage.setItem(KEY, mode); } catch { /* No financial state is stored here. */ }
    sync();
  }
  function sync() {
    const spot = $('marketType').value === 'spot', simple = mode === 'simple';
    root.dataset.activeProduct = spot ? 'spot' : 'perp';
    $('tradeLayoutMode').disabled = locked();
    for (const b of toolbar.querySelectorAll('[data-trade-product]')) {
      b.disabled = locked();
      b.setAttribute('aria-pressed', String(b.dataset.tradeProduct === $('marketType').value));
    }
    const t = type.value, special = !['Gtc','Market'].includes(t);
    const name = type.selectedOptions[0]?.textContent || 'Order settings';
    const slip = $('tradeSlippage').value;
    text('simpleOrderSummary', t === 'Market' ? `Settings · max slip ${slip || '—'}%` : `Settings · ${name}`);
    // Never hide a currently selected trigger/TWAP/post-only/IOC configuration.
    if (simple && special && observedType !== t) options.open = true;
    observedType = t;
    options.classList.toggle('has-special-order', special);
    $('simpleTriggerTools').hidden = spot;
    reduce.classList.toggle('simple-spot-only-hidden', spot && simple);
    availableLabel.textContent = spot ? 'Available to trade' : 'Available margin';
    text('simpleMark', $('marketMark').textContent);
    text('simpleChange', $('marketChange').textContent);
    $('simpleChange').className = $('marketChange').className;
    // Spot does not show futures-only tabs, leverage, or an unusable percentage slider.
    for (const id of ['positions','funding']) root.querySelector(`[data-account-tab="${id}"]`).classList.toggle('simple-spot-only-hidden', simple && spot);
    const active = root.querySelector('[data-account-tab][aria-selected="true"]');
    if (simple && spot && ['positions','funding'].includes(active?.dataset.accountTab)) root.querySelector('[data-account-tab="balances"]').click();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  }
  toolbar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled || locked()) return;
    if (b.id === 'tradeLayoutMode') { applyMode(mode === 'simple' ? 'advanced' : 'simple', true); return; }
    const value = b.dataset.tradeProduct;
    if (!['spot','perp'].includes(value) || $('marketType').value === value) return;
    $('marketType').value = value;
    // Use the native change listener: this invalidates old market data and pending reviews.
    $('marketType').dispatchEvent(new Event('change', { bubbles: true }));
    sync();
  });
  for (const event of ['input','change']) root.addEventListener(event, schedule);
  for (const event of ['beltrix:market','beltrix:wallet']) window.addEventListener(event, schedule);
  for (const event of ['close','cancel']) $('tradeDialog').addEventListener(event, schedule);
  new MutationObserver(schedule).observe($('marketType'), { attributes: true, attributeFilter: ['disabled'] });
  new MutationObserver(schedule).observe($('tradeDialog'), { attributes: true, attributeFilter: ['open'] });
  for (const id of ['marketMark','marketChange']) new MutationObserver(schedule).observe($(id), { childList: true, subtree: true, characterData: true });
  // Resizing must not silently force the Simple view's secondary account panels open.
  matchMedia('(max-width:680px)').addEventListener('change', () => {
    if (mode === 'simple') { $('futuresExtra').open = false; $('futuresLeverageDrawer').open = false; }
  });
  applyMode(mode);
  document.documentElement.dataset.simpleTrade = 'v1';
}
