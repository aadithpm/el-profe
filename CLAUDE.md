### El Profe

A Firefox extension that intercepts YouTube Music's `youtubei/v1/browse` API responses to extract lyrics, then inserts translated lyrics inline in the DOM using the Claude API.

#### Folder structure

`popup` - extension popup in the toolbar UI. Should contain styling and only be used to modify state in browser local storage
`examples` - DOM sub-trees captured & used to make logical decisions
`content` - extension business logic (DOM manipulation, MutationObserver, translation orchestration)
`shared` - utilities loaded before content and popup scripts (e.g. `log.js`)
`translators` - pluggable translator backends; each exports a global object with a `translate(lines, language, apiKey)` method. `cache.js` provides a shared `TranslationCache` backed by browser local storage (max 30 tracks, LRU eviction)

#### Architecture

- `content/interceptor.js` is injected into the page JS context (via a `<script>` tag) so it can wrap `window.fetch` and intercept browse responses. It relays lyrics to the content script via `window.postMessage`.
- `content/content.js` receives lyrics, checks storage for `enabled`/`language`/`apiKey`, then calls `applyLyrics` which uses a `MutationObserver` to find the lyrics nodes and insert translations inline.
- Translations are cached per-track in `browser.storage.local` keyed by a djb2 hash of the lyrics + language. Running token totals (`tokenUsage`) are also persisted in storage and shown in the popup.
- `shared/log.js` defines a global `log()` that gates on `log.debug`, controlled via the popup's debug checkbox.