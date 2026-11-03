(() => {
  const key = 'campusplan.theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch { /* The theme still works for this session if storage is blocked. */ }

  function apply() {
    const dark = (preference || (system.matches ? 'dark' : 'light')) === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    const button = document.getElementById('theme-button');
    if (button) {
      const label = dark ? 'Heller Modus' : 'Dunkelmodus';
      button.setAttribute('aria-label', dark ? 'Hellen Modus aktivieren' : 'Dunkelmodus aktivieren');
      button.setAttribute('aria-pressed', String(dark));
      document.getElementById('theme-label').textContent = label;
    }
    const background = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }

  apply();
  system.addEventListener('change', () => { if (!preference) apply(); });
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-button').addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch { /* Keep session preference. */ }
      apply();
    });
  });
})();
