// Compensate document-layout shifts, never a user's or browser's scrolling.
// Rect.top is viewport-relative: compare rect.top + scrollY before deciding.
const EPSILON = 0.5;
const INPUT_SELECTOR = 'input:not([type=checkbox]):not([type=range]):not([type=hidden])';

export function focusedLayoutDecision(anchor, sample) {
  if (!anchor || !sample || ![anchor.documentTop, anchor.scrollTop, anchor.until,
    sample.documentTop, sample.scrollTop, sample.now].every(Number.isFinite)) {
    return {kind:'release', reason:'invalid-sample'};
  }
  if (sample.now >= anchor.until) return {kind:'release', reason:'expired'};
  if (sample.viewport !== anchor.viewport) return {kind:'release', reason:'viewport-changed'};
  const layoutDelta = sample.documentTop - anchor.documentTop;
  const scrollDelta = sample.scrollTop - anchor.scrollTop;
  if (Math.abs(scrollDelta) > EPSILON) {
    // Native scroll anchoring may already have compensated the exact layout shift.
    if (Math.abs(layoutDelta) > EPSILON && Math.abs(layoutDelta - scrollDelta) <= EPSILON) {
      return {kind:'rebase', reason:'native-layout-anchor'};
    }
    // This includes scrollIntoView used to reach another control. Do not undo it.
    return {kind:'release', reason:'scrolled'};
  }
  return Math.abs(layoutDelta) > EPSILON
    ? {kind:'adjust', top:sample.scrollTop + layoutDelta}
    : {kind:'rebase', reason:'unchanged'};
}

export function installTradeFocusLayout(ticket, {win=window, durationMs=1400}={}) {
  if (!ticket || !win?.document) return () => {};
  const doc = win.document;
  let anchor = null, frame = 0;
  const removers = [];
  const now = () => win.performance.now();
  const mobile = () => win.matchMedia('(max-width:680px)').matches;
  const viewport = () => [win.innerWidth, win.innerHeight,
    win.visualViewport?.height ?? win.innerHeight,
    win.visualViewport?.offsetTop ?? 0, win.visualViewport?.scale ?? 1].join(':');
  const sample = input => ({
    documentTop:input.getBoundingClientRect().top + win.scrollY,
    scrollTop:win.scrollY, viewport:viewport(), now:now()
  });
  const financialInput = target => target?.matches?.(INPUT_SELECTOR) && ticket.contains(target)
    && !target.disabled && !target.readOnly ? target : null;
  const release = () => {
    anchor = null;
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
  };
  const tick = () => {
    frame = 0;
    if (!anchor || doc.activeElement !== anchor.input || !anchor.input.isConnected
      || doc.hidden || !mobile()) { release(); return; }
    const input = anchor.input, next = sample(input);
    const decision = focusedLayoutDecision(anchor, next);
    if (decision.kind === 'release') { release(); return; }
    if (decision.kind === 'adjust') {
      const scroller = doc.scrollingElement || doc.documentElement;
      const max = Math.max(0, scroller.scrollHeight - win.innerHeight);
      // Instant correction is bounded by the actual document. No smooth-scroll loop.
      scroller.scrollTo({top:Math.min(max, Math.max(0, decision.top)), behavior:'instant'});
    }
    anchor = {...anchor, ...sample(input)};
    frame = win.requestAnimationFrame(tick);
  };
  const arm = input => {
    if (!input || !mobile()) return;
    const rect = input.getBoundingClientRect();
    const height = win.visualViewport?.height ?? win.innerHeight;
    // Let the browser bring offscreen fields above its keyboard before anchoring.
    if (rect.top < 0 || rect.bottom > height) { release(); return; }
    if (anchor?.input === input) anchor.until = now() + durationMs;
    else anchor = {input, ...sample(input), until:now() + durationMs};
    if (!frame) frame = win.requestAnimationFrame(tick);
  };
  const on = (target, name, handler, options) => {
    target?.addEventListener(name, handler, options);
    removers.push(() => target?.removeEventListener(name, handler, options));
  };
  on(ticket, 'pointerdown', event => {
    const input = financialInput(event.target);
    if (!input || !mobile() || doc.activeElement === input) return;
    const rect = input.getBoundingClientRect();
    const height = win.visualViewport?.height ?? win.innerHeight;
    if (rect.top < 0 || rect.bottom > height) return;
    // Cancel only the initial focus default, not typing, selections or buttons.
    event.preventDefault();
    arm(input);
    input.focus({preventScroll:true});
  });
  on(ticket, 'focusin', event => arm(financialInput(event.target)));
  on(ticket, 'input', event => arm(financialInput(event.target)));
  on(ticket, 'focusout', release);
  on(doc, 'pointerdown', event => {
    if (anchor && event.target !== anchor.input) release();
  }, true);
  on(doc, 'wheel', release, {passive:true, capture:true});
  on(doc, 'touchmove', release, {passive:true, capture:true});
  on(doc, 'keydown', event => {
    if (['Tab','PageUp','PageDown','Escape'].includes(event.key)) release();
  }, true);
  on(doc, 'scroll', event => {
    // A nested scroll container is also intentional navigation, not document layout.
    if (anchor && ![doc, doc.documentElement, doc.body, doc.scrollingElement].includes(event.target)) release();
  }, true);
  on(win, 'resize', release);
  on(win.visualViewport, 'resize', release);
  on(doc, 'visibilitychange', release);
  return () => { release(); removers.forEach(remove => remove()); };
}
