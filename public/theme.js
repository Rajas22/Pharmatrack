// Light / dark theme for every PharmaTrack page.
// - The choice is saved in the browser (localStorage) and used on all pages.
// - If the user never chose, the device setting (light or dark) is used.
// - Put <span id="themeSlot"></span> where the button should go. Without it,
//   the button is fixed in the top right corner of the page.
(function () {
  var KEY = 'pharmaTheme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === 'dark' || v === 'light' ? v : null; }
    catch (e) { return null; }
  }
  function current() { return saved() || (media && media.matches ? 'dark' : 'light'); }
  function apply(theme) { root.setAttribute('data-theme', theme); }

  // Apply right away (this script is in <head>) so the page never flashes the wrong theme
  apply(current());

  var MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  var button;
  function paint() {
    if (!button) return;
    var dark = root.getAttribute('data-theme') === 'dark';
    var label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    // The icon shows what you will get when you click
    button.innerHTML = dark ? SUN : MOON;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    button.title = label;
  }

  function toggle() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(KEY, next); } catch (e) { /* private mode: still works for this page */ }
    apply(next);
    paint();
  }

  function build() {
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'themeToggle';
    button.className = 'theme-toggle';
    button.addEventListener('click', toggle);
    var slot = document.getElementById('themeSlot');
    if (slot) slot.appendChild(button);
    else { button.classList.add('theme-fab'); document.body.appendChild(button); }
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();

  // Follow the device setting while the user has not chosen
  if (media) {
    var onChange = function () { if (!saved()) { apply(current()); paint(); } };
    if (media.addEventListener) media.addEventListener('change', onChange);
    else if (media.addListener) media.addListener(onChange);
  }
  // Keep other open tabs in sync
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { apply(current()); paint(); }
  });
})();
