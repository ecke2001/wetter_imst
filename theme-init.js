/**
 * Apply the saved color theme before first paint (loaded synchronously in <head>).
 * Full theme logic lives in app.js (applyTheme / cycleTheme).
 */
(function () {
    var pref = 'auto';
    try { pref = localStorage.getItem('agrarwetter_theme') || 'auto'; } catch (e) { /* storage unavailable */ }
    if (pref === 'auto') pref = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    if (['light', 'dark', 'contrast'].indexOf(pref) === -1) pref = 'dark';
    document.documentElement.setAttribute('data-theme', pref);
})();
