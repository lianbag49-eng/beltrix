const PAGES = Object.freeze(['wallet', 'markets', 'swap', 'settings', 'explore', 'defi', 'boost']);

export function resolveWalletRoute(hash, fallback = 'wallet') {
  const route = typeof hash === 'string' ? hash.replace(/^#/, '') : '';
  const alias = route === 'assets' ? 'wallet' : route === 'discover' ? 'explore' : route;
  return PAGES.includes(alias) ? alias : PAGES.includes(fallback) ? fallback : 'wallet';
}

export function walletAssetMatches(query, symbol, contract) {
  const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
  const needle = normalize(query).slice(0, 128);
  return !needle || [symbol, contract].some(value => normalize(value).includes(needle));
}

/** Compose the wallet shell without changing account, signing or order transport state. */
export function installWalletUx(win = window) {
  const doc = win.document;
  if (doc.documentElement.dataset.walletUx === '1') return;
  const home = doc.getElementById('wallet');
  const assets = doc.getElementById('wAssets');
  if (!home || !assets || typeof win.openPage !== 'function') return;
  doc.documentElement.dataset.walletUx = '1';

  const style = doc.createElement('style');
  style.id = 'wallet-ux-styles';
  style.textContent = `
    .w-trading-entry{margin:12px 0 20px;padding:16px;border:1px solid var(--line);border-radius:14px}
    .w-trading-entry h2{font-size:15px;margin:0 0 10px}.w-trading-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .w-trading-buttons button{min-height:44px;white-space:normal}.w-trading-entry .w-note{margin:10px 0 0}
    .w-asset-filter{display:flex;align-items:end;gap:10px;margin:10px 0}.w-asset-filter label{flex:1;min-width:0;font-size:12px}
    .w-asset-filter input{display:block;box-sizing:border-box;width:100%;min-width:0;margin-top:6px;min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:inherit;padding:10px 12px;font:inherit}
    .w-asset-filter button{min-height:44px}.w-filter-summary{font-size:12px;color:var(--muted);margin:8px 0}
    #wAssets .w-token-row[hidden]{display:none!important}.w-filter-empty{padding:16px;border:1px dashed var(--line);border-radius:10px;color:var(--muted)}
    @media(max-width:360px){.w-trading-entry{padding:12px}.w-trading-buttons{gap:6px}}
  `;
  doc.head.append(style);

  const entry = doc.createElement('section');
  entry.className = 'w-trading-entry';
  entry.setAttribute('aria-label', 'Open trading terminal');
  entry.innerHTML = '<h2>Trade from your wallet</h2><div class="w-trading-buttons"><button id="walletSpotEntry" class="w-secondary" type="button">Spot trading</button><button id="walletPerpsEntry" class="w-secondary" type="button">Perpetual trading</button></div><p class="w-note">Trading uses a separate account view. Check the selected network before reviewing an order. Opening the terminal never signs or submits an order.</p>';
  const actions = home.querySelector('.w-actions');
  if (actions) actions.after(entry); else home.prepend(entry);

  // Only known pages can be activated. Hashes never act as selectors, URLs or wallet requests.
  const originalOpenPage = win.openPage;
  const activate = (id, { record = true, focus = true } = {}) => {
    if (!PAGES.includes(id) || !doc.getElementById(id)?.classList.contains('page')) return false;
    if (doc.body.dataset.page !== id) originalOpenPage(id);
    if (record && win.location.hash !== '#' + id) {
      try { win.history.pushState(null, '', '#' + id); } catch { /* Navigation still works without history. */ }
    }
    if (focus) {
      const target = doc.getElementById(id);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    return true;
  };
  win.openPage = id => activate(id);
  const restore = () => activate(resolveWalletRoute(win.location.hash), { record: false });
  win.addEventListener('popstate', restore);
  win.addEventListener('hashchange', restore);
  const initial = resolveWalletRoute(win.location.hash);
  activate(initial, { record: false, focus: false });
  try { win.history.replaceState(null, '', '#' + initial); } catch { /* Restricted history environments are supported. */ }

  const openTrading = type => {
    const selector = doc.getElementById('marketType');
    if (!selector || selector.disabled || !Array.from(selector.options).some(option => option.value === type)) return;
    if (selector.value !== type) {
      selector.value = type;
      // Existing market listeners invalidate stale reviews and retain the signing guard.
      selector.dispatchEvent(new win.Event('change', { bubbles: true }));
    }
    win.openPage('markets');
  };
  doc.getElementById('walletSpotEntry').addEventListener('click', () => openTrading('spot'));
  doc.getElementById('walletPerpsEntry').addEventListener('click', () => openTrading('perp'));

  const filter = doc.createElement('div');
  filter.className = 'w-asset-filter';
  filter.innerHTML = '<label for="walletAssetFilter">Filter assets on this network<input id="walletAssetFilter" type="search" maxlength="128" placeholder="Symbol or contract address" autocomplete="off" spellcheck="false" aria-controls="wAssets" aria-describedby="walletFilterSummary"></label><button id="walletFilterClear" class="w-text-button" type="button">Clear filter</button>';
  const summary = doc.createElement('p');
  summary.id = 'walletFilterSummary'; summary.className = 'w-filter-summary'; summary.setAttribute('role', 'status');
  const empty = doc.createElement('p');
  empty.id = 'walletFilterEmpty'; empty.className = 'w-filter-empty'; empty.hidden = true;
  empty.textContent = 'No loaded assets match. Clear the filter or verify the token contract on this network.';
  assets.before(filter, summary); assets.after(empty);
  const input = doc.getElementById('walletAssetFilter');
  const clear = doc.getElementById('walletFilterClear');
  const applyFilter = () => {
    const rows = Array.from(assets.querySelectorAll('.w-token-row[data-token]'));
    let visible = 0;
    for (const row of rows) {
      const symbol = row.querySelector('.w-token-name')?.firstChild?.textContent || '';
      const matches = walletAssetMatches(input.value, symbol, row.dataset.token);
      row.hidden = !matches;
      if (matches) visible++;
    }
    summary.textContent = rows.length ? `${visible} of ${rows.length} loaded assets shown` : 'Connect or refresh your wallet to load assets.';
    empty.hidden = rows.length === 0 || visible > 0;
    clear.disabled = !input.value;
  };
  input.addEventListener('input', applyFilter);
  clear.addEventListener('click', () => { input.value = ''; applyFilter(); input.focus(); });
  // Wallet refresh replaces rows; filtering never retains previous account balances.
  new win.MutationObserver(applyFilter).observe(assets, { childList: true, subtree: true, characterData: true });
  applyFilter();
}
