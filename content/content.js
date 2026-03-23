console.log("El Profe: content script running");

// Inject interceptor.js into the page's JS context so it can wrap fetch
const script = document.createElement("script");
script.src = browser.runtime.getURL("content/interceptor.js");
document.documentElement.appendChild(script);
script.remove();

function syncDebugSetting(enabled) {
  log.debug = enabled;
  window.postMessage({ type: "EL_PROFE_DEBUG", enabled }, "*");
}

// Load initial settings and relay flags to the interceptor
browser.storage.local
  .get({ enabled: true, debugLogging: false })
  .then((settings) => {
    syncDebugSetting(settings.debugLogging);
    window.postMessage(
      { type: "EL_PROFE_ENABLED", enabled: settings.enabled },
      "*",
    );
  });

// Returns a Map from original line -> translation (cache-first).
async function translateLines(lines, language) {
  const cached = await TranslationCache.get(lines, language);
  if (cached) return cached;

  const { apiKey } = await browser.storage.local.get({ apiKey: "" });
  if (!apiKey) {
    log("no API key set, skipping translation");
    return new Map(lines.map((l) => [l, l]));
  }

  const translationMap = await ClaudeTranslator.translate(
    lines,
    language,
    apiKey,
  );
  await TranslationCache.set(lines, language, translationMap);
  return translationMap;
}

// insert each translated line in-line in different formatting
async function insertTranslations(node, lines, { language }) {
  node.textContent = "";

  const translationMap = await translateLines(lines, language);

  for (const line of lines) {
    node.appendChild(document.createTextNode(line));
    node.appendChild(document.createElement("br"));

    if (line.trim()) {
      const translation = translationMap.get(line) ?? line;
      log("translating", { original: line, translation, language });

      const em = document.createElement("em");
      em.textContent = translation;
      em.style.color = "#a8d5a2";
      node.appendChild(em);
      node.appendChild(document.createElement("br"));
    }
  }

  // YT Music seems to add this if loading doesn't complete fully
  // there seems to be a race condition where modify the DOM before it's fully done
  // 'loading' and YT Music checks against the serialized lyric text and says
  // 'this isn't loaded' yet - we're intercepting the lyrics so let's force remove this
  // attribute so the lyrics load
  node.removeAttribute("is-empty");
}

const SELECTOR =
  "ytmusic-description-shelf-renderer[is-track-lyrics-page] yt-formatted-string.description";

let lastLines = null;
let pendingObserver = null;

// Attaches an observer to find the lyrics node and insert translations
// Observer polls every second
function applyLyrics(lines, language) {
  // if we're applying lyrics edits, we already found the node
  // so disconnect the observer so we aren't polling more
  if (pendingObserver) {
    pendingObserver.disconnect();
    pendingObserver = null;
  }

  const nodes = document.querySelectorAll(SELECTOR);

  if (nodes.length) {
    nodes.forEach((node) => insertTranslations(node, lines, { language }));
    return;
  }

  // Lyrics nodes not in the DOM yet — watch for them to appear, then debounce
  // 1s to let YT Music finish populating them before we modify
  pendingObserver = new MutationObserver(() => {
    const nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;
    pendingObserver.disconnect();
    pendingObserver = null;
    setTimeout(() => {
      nodes.forEach((node) => insertTranslations(node, lines, { language }));
    }, 1000);
  });
  pendingObserver.observe(document.body, { childList: true, subtree: true });
}

// listen for message from interceptor script
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.type !== "EL_PROFE_LYRICS") return;

  const lines = event.data.text.split(/\r\n|\r|\n/);
  lastLines = lines;

  browser.storage.local
    .get({ enabled: true, language: "", apiKey: "" })
    .then(({ enabled, language, apiKey }) => {
      if (!enabled) return;
      if (!apiKey) {
        log("no API key set, skipping translation.");
        return;
      }
      if (!language) {
        log("no target language set, skipping translation.");
        return;
      }
      applyLyrics(lines, language);
    });
});

// Listen to extension specific settings
// relays to interceptor if required
// triggers translations firing
browser.storage.onChanged.addListener((changes) => {
  if ("debugLogging" in changes) {
    syncDebugSetting(changes.debugLogging.newValue);
  }

  // Re-apply last known lyrics when re-enabled from the toolbar
  if ("enabled" in changes) {
    window.postMessage(
      { type: "EL_PROFE_ENABLED", enabled: changes.enabled.newValue },
      "*",
    );
  }

  if ("enabled" in changes && changes.enabled.newValue === true && lastLines) {
    browser.storage.local
      .get({ language: "", apiKey: "" })
      .then(({ language, apiKey }) => {
        if (!apiKey) return;
        if (!language) return;
        applyLyrics(lastLines, language);
      });
  }
});
