// TranslationCache: per-track translation cache backed by browser.storage.local.
// Keeps up to CACHE_MAX entries, evicting the oldest when full.
// Cache key: djb2 hash of "<lines joined by NUL>\0<language>".
const TranslationCache = (() => {
  const CACHE_MAX = 30;

  function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  function cacheKey(lines, language) {
    return hashString(lines.join("\0") + "\0" + language);
  }

  async function get(lines, language) {
    const key = cacheKey(lines, language);
    const { translationCache = {} } = await browser.storage.local.get({
      translationCache: {},
    });
    const entry = translationCache[key];
    if (entry) {
      log("translation cache hit", { key });
      return new Map(Object.entries(entry));
    }
    return null;
  }

  async function set(lines, language, translationMap) {
    const key = cacheKey(lines, language);
    const { translationCache = {}, translationCacheOrder = [] } =
      await browser.storage.local.get({
        translationCache: {},
        translationCacheOrder: [],
      });

    translationCache[key] = Object.fromEntries(translationMap);

    // Move key to end (most-recently-used), or append
    const order = translationCacheOrder.filter((k) => k !== key);
    order.push(key);

    // Evict oldest entries when over the limit
    while (order.length > CACHE_MAX) {
      const evicted = order.shift();
      delete translationCache[evicted];
    }

    await browser.storage.local.set({ translationCache, translationCacheOrder: order });
    log("translation cached", { key, total: order.length });
  }

  return { get, set };
})();
