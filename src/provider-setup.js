/* Provider setup helpers: never persist or log credentials. */
const BridgeSetup = window.BridgeSetup = (() => {
 const timers = new WeakMap();
 function hide(input) { clearTimeout(timers.get(input)); timers.delete(input); input.type = 'password'; }
 function reveal(input) { hide(input); if (!input.value) return; input.type = 'text'; timers.set(input, setTimeout(() => hide(input), 60000)); }
 function clear(input) { hide(input); input.value = ''; }
 function select(input) { input.focus(); input.select(); input.setSelectionRange?.(0, input.value.length); }
 async function copyField(input, fallback = () => {}) {
  const value = input.value;
  if (!value) return false;
  // Run synchronously inside the click gesture before awaiting Clipboard API.
  select(input);
  try { if (document.execCommand?.('copy')) return true; } catch {}
  let timer;
  try {
   await Promise.race([
    navigator.clipboard?.writeText ? navigator.clipboard.writeText(value) : Promise.reject(Error('Clipboard unavailable')),
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Clipboard timeout')), 1500); })
   ]);
   return true;
  } catch {
   if (input.value === value) { fallback(); select(input); }
   return false;
  } finally { clearTimeout(timer); }
 }
 function port(value) { return Number.isInteger(value) && value > 0 && value <= 65535 ? value : 8787; }
 function url(deployment, value) { return 'http://' + (deployment === 'docker' ? 'host.docker.internal' : '127.0.0.1') + ':' + port(value) + '/v1'; }
 return { hide, reveal, clear, copyField, url };
})();
