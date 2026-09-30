// Preserve an input through layout shifts, never by pinning the viewport.
// DOMRect.top is viewport-relative. Adding scrollY distinguishes a layout
// change from scrollIntoView(), touch scrolling and native scroll anchoring.
export function focusLayoutCorrection(previous, current) {
  const keys = ['documentTop', 'scrollY', 'height', 'viewportHeight', 'viewportOffset', 'viewportScale'];
  if (!previous || !current || keys.some(key => !Number.isFinite(previous[key]) || !Number.isFinite(current[key]))) return 0;
  if (Math.abs(current.scrollY - previous.scrollY) > 0.5) return 0;
  if (Math.abs(current.viewportHeight - previous.viewportHeight) > 0.5 ||
      Math.abs(current.viewportOffset - previous.viewportOffset) > 0.5 ||
      current.viewportScale !== previous.viewportScale) return 0;
  const previousTop = previous.documentTop - previous.scrollY - previous.viewportOffset;
  if (previousTop < 0 || previousTop + previous.height > previous.viewportHeight) return 0;
  const delta = current.documentTop - previous.documentTop;
  return Math.abs(delta) > 0.5 ? delta : 0;
}

export function installTradeFocusGuard({ticket, layoutRoot = ticket, win = window} = {}) {
  if (!ticket || !layoutRoot) return () => {};
  const doc = win.document;
  const selector = 'input:not([type=checkbox]):not([type=range]):not([type=hidden])';
  const mobile = () => win.matchMedia('(max-width:680px)').matches;
  const financialInput = target => target?.matches?.(selector) && ticket.contains(target) && !target.disabled && !target.readOnly ? target : null;
  const sample = input => {
    const box = input.getBoundingClientRect(), viewport = win.visualViewport;
    return {
      documentTop: box.top + win.scrollY,
      scrollY: win.scrollY,
      height: box.height,
      viewportHeight: viewport?.height ?? win.innerHeight,
      viewportOffset: viewport?.offsetTop ?? 0,
      viewportScale: viewport?.scale ?? 1
    };
  };
  const clock = () => win.performance.now();
  let anchor = null, frame = 0;
  const release = () => {
    anchor = null;
    if (frame) { win.cancelAnimationFrame(frame); frame = 0; }
  };
  const reconcile = () => {
    frame = 0;
    if (!anchor) return;
    const {input, previous, until} = anchor;
    if (!mobile() || !input.isConnected || doc.activeElement !== input || clock() > until) { release(); return; }
    const current = sample(input);
    const delta = focusLayoutCorrection(previous, current);
    if (delta) {
      const scroller = doc.scrollingElement || doc.documentElement;
      scroller.scrollTop = Math.max(0, current.scrollY + delta);
    }
    // Accept the current scroll position, including native/browser/user scroll.
    // A second observer notification must never reapply the same correction.
    anchor.previous = sample(input);
  };
  const schedule = () => {
    if (anchor && !frame) frame = win.requestAnimationFrame(reconcile);
  };
  const arm = input => {
    if (!mobile() || !input?.isConnected) { release(); return; }
    if (anchor?.input === input && clock() <= anchor.until) anchor.until = clock() + 1400;
    else anchor = {input, previous: sample(input), until: clock() + 1400};
    schedule();
  };
  const pointerDown = event => {
    const input = financialInput(event.target);
    if (input !== anchor?.input) release();
    if (!input || !mobile() || doc.activeElement === input) return;
    const before = sample(input);
    // Off-screen and keyboard-obscured inputs must be free to scroll into view.
    const top = before.documentTop - before.scrollY - before.viewportOffset;
    if (top < 0 || top + before.height > before.viewportHeight) return;
    event.preventDefault();
    arm(input);
    try { input.focus({preventScroll: true}); } catch { input.focus(); }
  };
  const focusIn = event => { const input = financialInput(event.target); if (input) arm(input); };
  const inputEvent = event => { const input = financialInput(event.target); if (input) arm(input); };
  const keyDown = event => { if (['Tab','Escape','PageUp','PageDown'].includes(event.key)) release(); };
  const viewportChanged = () => {
    if (!anchor) return;
    const current = sample(anchor.input), previous = anchor.previous;
    // Charts dispatch synthetic resize events while mounting. Only a real
    // visual viewport change should release a focused field's layout guard.
    if (!mobile() || Math.abs(current.viewportHeight - previous.viewportHeight) > 0.5 ||
        Math.abs(current.viewportOffset - previous.viewportOffset) > 0.5 ||
        current.viewportScale !== previous.viewportScale) release();
    else schedule();
  };
  doc.addEventListener('pointerdown', pointerDown, true);
  ticket.addEventListener('focusin', focusIn);
  ticket.addEventListener('input', inputEvent);
  ticket.addEventListener('focusout', release);
  doc.addEventListener('keydown', keyDown, true);
  win.addEventListener('wheel', release, {passive: true});
  win.addEventListener('touchmove', release, {passive: true});
  win.addEventListener('resize', viewportChanged);
  win.visualViewport?.addEventListener('resize', viewportChanged);
  // Market updates can request a layout check but never renew the deadline.
  // There is no perpetual animation-frame loop or scroll event write handler.
  const mutation = new win.MutationObserver(schedule);
  mutation.observe(layoutRoot, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden','open','class']});
  let resize;
  if (win.ResizeObserver) { resize = new win.ResizeObserver(schedule); resize.observe(layoutRoot); resize.observe(ticket); }
  return () => {
    release(); mutation.disconnect(); resize?.disconnect();
    doc.removeEventListener('pointerdown', pointerDown, true);
    ticket.removeEventListener('focusin', focusIn);
    ticket.removeEventListener('input', inputEvent);
    ticket.removeEventListener('focusout', release);
    doc.removeEventListener('keydown', keyDown, true);
    win.removeEventListener('wheel', release);
    win.removeEventListener('touchmove', release);
    win.removeEventListener('resize', viewportChanged);
    win.visualViewport?.removeEventListener('resize', viewportChanged);
  };
}
