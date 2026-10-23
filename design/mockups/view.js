function show(view) {
  view = view === 'orders' ? 'orders' : 'dashboard';
  document.getElementById('dashboard').hidden = view !== 'dashboard';
  document.getElementById('orders').hidden = view !== 'orders';
  document
    .querySelectorAll('[data-view]')
    .forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const crumb = document.querySelector('.crumb-view');
  if (crumb) crumb.textContent = view === 'orders' ? 'Compras' : 'Resumen';
}
show(new URLSearchParams(location.search).get('view'));
document.querySelectorAll('[data-view]').forEach((b) =>
  b.addEventListener('click', () => {
    if (b.dataset.view === 'inactive') {
      const n = document.getElementById('notice');
      n.hidden = false;
      setTimeout(() => (n.hidden = true), 2500);
      return;
    }
    show(b.dataset.view);
  }),
);
window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data?.type === 'view') show(e.data.view);
});
if (document.body.classList.contains('noche')) {
  function appearance(mode, notify = false) {
    mode = mode === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.mode = mode;
    document.querySelectorAll('[data-mode-choice]').forEach((b) => {
      b.classList.toggle('selected', b.dataset.modeChoice === mode);
      b.setAttribute('aria-pressed', String(b.dataset.modeChoice === mode));
    });
    try {
      localStorage.setItem('obra-mockup-appearance', mode);
    } catch {}
    if (notify) {
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      history.replaceState(null, '', url);
      if (parent !== window)
        parent.postMessage({ type: 'appearance-changed', mode }, location.origin);
    }
  }
  appearance(document.documentElement.dataset.mode);
  document
    .querySelectorAll('[data-mode-choice]')
    .forEach((b) => (b.onclick = () => appearance(b.dataset.modeChoice, true)));
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.source === parent && e.data?.type === 'appearance')
      appearance(e.data.mode, true);
  });
}
