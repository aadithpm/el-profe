const btn = document.getElementById("toggle-btn");
const reloadBanner = document.getElementById("reload-banner");
const reloadBtn = document.getElementById("reload-btn");
const noApiKeyBanner = document.getElementById("no-api-key-banner");
const apiKeysSection = document.getElementById("api-keys-section");
const tokenUsageEl = document.getElementById("token-usage");
const apiKeyInput = document.getElementById("api-key-input");
const debugCheckbox = document.getElementById("debug-checkbox");
const controls = document.getElementById("controls");
const notYtmBanner = document.getElementById("not-ytm-banner");

function updateTokenUsage({ input_tokens, output_tokens }) {
  const total = input_tokens + output_tokens;
  tokenUsageEl.textContent = total > 0
    ? `Tokens used: ${total.toLocaleString()} (↑${input_tokens.toLocaleString()} ↓${output_tokens.toLocaleString()})`
    : "";
}

function updateApiKeyBanner(apiKey) {
  const missing = !apiKey;
  noApiKeyBanner.hidden = !missing;
  // Auto-expand the section when no key is set so it's obvious where to add one
  if (missing) apiKeysSection.open = true;
}

function updateButton(enabled) {
  btn.textContent = enabled ? "Enabled" : "Disabled";
  btn.dataset.state = enabled ? "on" : "off";
}

browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!tab.url.startsWith("https://music.youtube.com")) {
    controls.hidden = true;
    notYtmBanner.hidden = false;
    return;
  }

  browser.storage.local
    .get({ enabled: true, apiKey: "", debugLogging: false, tokenUsage: { input_tokens: 0, output_tokens: 0 } })
    .then(({ enabled, apiKey, debugLogging: stored, tokenUsage }) => {
      log.debug = stored;
      updateButton(enabled);
      apiKeyInput.value = apiKey;
      debugCheckbox.checked = stored;
      updateApiKeyBanner(apiKey);
      updateTokenUsage(tokenUsage);
      log("popup loaded", { enabled, debugLogging: stored });
    });
});

btn.addEventListener("click", () => {
  browser.storage.local.get({ enabled: true }).then(({ enabled }) => {
    const next = !enabled;
    browser.storage.local.set({ enabled: next });
    updateButton(next);
    reloadBanner.hidden = false;
    log("enabled toggled", { enabled: next });
  });
});

reloadBtn.addEventListener("click", async () => {
  log("reloading tab");
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  await browser.tabs.update(tab.id, { url: tab.url });
  window.close();
});

apiKeyInput.addEventListener("input", () => {
  const apiKey = apiKeyInput.value.trim();
  browser.storage.local.set({ apiKey });
  updateApiKeyBanner(apiKey);
  log("api key changed");
});


debugCheckbox.addEventListener("change", () => {
  log.debug = debugCheckbox.checked;
  browser.storage.local.set({ debugLogging: log.debug });
  log("debug logging toggled", { debugLogging: log.debug });
});
