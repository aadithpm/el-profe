// Runs in page context (not the extension sandbox).
// Wraps fetch to intercept the browse lyrics response and relay it to the content script.
let enabled = true;
let debugLogging = false;

function log(...args) {
  if (debugLogging) console.log("[El Profe]", ...args);
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "EL_PROFE_ENABLED") enabled = event.data.enabled;
  if (event.data?.type === "EL_PROFE_DEBUG") debugLogging = event.data.enabled;
});

const _fetch = window.fetch;
window.fetch = async function (...args) {
  const response = await _fetch.apply(this, args);
  const url = args[0] instanceof Request ? args[0].url : String(args[0]);

  if (enabled && url.includes("youtubei/v1/browse")) {
    log("browse request intercepted", url);
    response.clone().json().then((data) => {
      const runs =
        data?.contents?.sectionListRenderer?.contents?.[0]
          ?.musicDescriptionShelfRenderer?.description?.runs;
      if (runs?.[0]?.text) {
        log("lyrics found, relaying to content script");
        window.postMessage({ type: "EL_PROFE_LYRICS", text: runs[0].text }, "*");
      } else {
        log("browse response had no lyrics", data);
      }
    }).catch((err) => log("failed to parse browse response", err));
  }

  return response;
};
