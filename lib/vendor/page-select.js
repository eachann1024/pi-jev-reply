/* Slim Select 4.5.0 integration: native selects hold form state only. */
window.pageSelect = function (select) {
  let syncing = false, notifying = false, control;
  const fallback = select.parentElement.querySelector('.select-unavailable');
  if (!window.SlimSelect || !document.querySelector('link[href="/vendor/slimselect.css"]')?.sheet) return { rebuild: fn => fn(), lock() {}, close() {} };
  select.addEventListener('change', event => {
    if (!notifying) event.stopImmediatePropagation();
  }, true);
  control = new SlimSelect({select, settings: {
    showSearch: false, focusSearch: false, modal: 'off', contentLocation: document.body,
    contentPosition: 'fixed', openPosition: 'auto', timeoutDelay: 0
  }, events: { afterChange() {
    if (syncing) return;
    queueMicrotask(() => {
      notifying = true;
      select.dispatchEvent(new Event('change', {bubbles:true}));
      notifying = false;
    });
  } }});
  fallback.hidden = true;
  const main = control.render.main.main, content = control.render.content.main;
  const described = select.getAttribute('aria-describedby');
  if (described) main.setAttribute('aria-describedby', described);
  // Replace the library's overlapping placement, including its scroll/resize path.
  function position() {
    const rect = main.getBoundingClientRect(), gap = 6, edge = 8;
    const below = Math.max(0, innerHeight - rect.bottom - gap - edge);
    const above = Math.max(0, rect.top - gap - edge);
    const desired = Math.min(300, control.render.content.list.scrollHeight + 2);
    const up = below < desired && above > below;
    const height = Math.min(desired, up ? above : below);
    for (const element of [main, content]) {
      element.classList.toggle('ss-dir-above', up);
      element.classList.toggle('ss-dir-below', !up);
    }
    Object.assign(content.style, {position:'fixed', margin:'0', width:rect.width + 'px',
      left:Math.max(edge, Math.min(rect.left, innerWidth - rect.width - edge)) + 'px',
      top:(up ? rect.top - gap - height : rect.bottom + gap) + 'px',
      height:height + 'px', maxHeight:height + 'px'});
  }
  control.render.moveContent = position;
  control.render.repositionOpenContent = position;
  main.addEventListener('keydown', event => {
    if (control.settings.disabled) { if (event.key !== 'Tab') event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!['Home','End'].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); control.open();
    const options = [...content.querySelectorAll('.ss-option:not(.ss-disabled)')];
    const option = event.key === 'Home' ? options[0] : options.at(-1);
    content.querySelectorAll('.ss-highlighted').forEach(el => el.classList.remove('ss-highlighted'));
    if (option) {
      option.classList.add('ss-highlighted'); main.setAttribute('aria-activedescendant', option.id);
      control.render.ensureElementInView(control.render.content.list, option);
    }
  }, true);
  return {
    rebuild(fn) {
      syncing = true; control.close(); control.select.changeListen(false);
      try { fn(); control.setData(control.select.getData()); }
      finally { control.select.changeListen(true); syncing = false; }
      const label = [...select.labels].map(el => {
        const copy = el.cloneNode(true);
        copy.querySelectorAll('.select-wrap').forEach(wrap => wrap.remove());
        return copy.textContent.trim();
      }).join(' ') || select.getAttribute('aria-label') || '';
      main.setAttribute('aria-label', label); control.render.content.list.setAttribute('aria-label', label);
    },
    lock(disabled) {
      if (disabled) control.close();
      if (control.settings.disabled !== disabled) disabled ? control.disable() : control.enable();
      main.tabIndex = disabled ? -1 : 0;
    },
    close() { control.close(); }
  };
};
