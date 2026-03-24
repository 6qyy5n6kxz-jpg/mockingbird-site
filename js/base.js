(function(){
  let cachedDebug;
  function isDebug(){
    if (cachedDebug !== undefined) return cachedDebug;
    if (window.__debug !== undefined) {
      cachedDebug = !!window.__debug;
      return cachedDebug;
    }
    cachedDebug = new URLSearchParams(window.location.search).get('debug') === '1';
    window.__debug = cachedDebug;
    return cachedDebug;
  }
  window.__debug = isDebug();
  window.isDebugEnabled = isDebug;
  window.dbg = function (...args) {
    if (!isDebug()) return;
    console.log('[dbg]', ...args);
  };
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
