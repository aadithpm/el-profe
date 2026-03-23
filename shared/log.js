function log(...args) {
  if (log.debug) console.log("[El Profe]", ...args);
}
log.debug = false;
