window.__debug = new URLSearchParams(window.location.search).get('debug') === '1';
window.dbg = function (...args) {
  if (!window.__debug) return;
  console.log('[dbg]', ...args);
};
(function(){
  function getBasePath(){
    const { hostname, pathname } = window.location;
    if (hostname.endsWith('github.io')) {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) return `/${parts[0]}`;
    }
    return '';
  }
  function withBase(path){
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    const base = getBasePath();
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
  }
  window.getBasePath = window.getBasePath || getBasePath;
  window.withBase = window.withBase || withBase;
})();
