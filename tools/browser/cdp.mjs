// Kleiner Chrome-DevTools-Protocol-Client für die Browser-Tests (headless).
// Nur für tools/*; braucht ein installiertes Chrome und Node ≥ 22 (WebSocket).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function chromeStarten({ port = 9333, breite = 1280, hoehe = 900 } = {}) {
  const profil = mkdtempSync(join(tmpdir(), 'gm-cdp-'));
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`,
    '--no-first-run', `--window-size=${breite},${hoehe}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  // Chromes Meldungen aufheben: scheitert der Start, stehen sie in der Fehlermeldung.
  let stderr = '';
  proc.stderr.on('data', d => { stderr = (stderr + d).slice(-2000); });
  let beendet = null;
  proc.on('exit', code => { beendet = code; });
  proc.on('error', e => { beendet = e.code || e.message; });   // z. B. Pfad falsch

  // Ein kalter Start (frischer CI-Runner, leerer Cache) kann deutlich länger
  // als 10 s dauern: bis zu 60 s warten, abbrechen, sobald Chrome beendet ist.
  let wsUrl = null;
  for (let i = 0; i < 300 && !wsUrl && beendet === null; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      wsUrl = l.find(t => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* Chrome startet noch */ }
    if (!wsUrl) await sleep(200);
  }
  if (!wsUrl) {
    proc.kill();
    throw new Error(`Chrome nicht erreichbar (${CHROME}${beendet !== null ? `, beendet mit ${beendet}` : ''})` +
      (stderr.trim() ? `\n${stderr.trim()}` : ''));
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let nr = 0;
  const offen = new Map();
  const fehler = [];
  const netz = [];
  let ladeWarten = null;
  ws.addEventListener('message', m => {
    const d = JSON.parse(m.data);
    if (d.id && offen.has(d.id)) { offen.get(d.id)(d); offen.delete(d.id); return; }
    if (d.method === 'Runtime.exceptionThrown') fehler.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') fehler.push(d.params.args.map(a => a.value ?? a.description).join(' '));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') fehler.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
    if (d.method === 'Network.requestWillBeSent') netz.push(d.params.request.url.slice(0, 80));
    if (d.method === 'Page.loadEventFired') ladeWarten?.();
  });

  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const id = ++nr;
    offen.set(id, d => (d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const js = async ausdruck => {
    const r = await cdp('Runtime.evaluate', { expression: ausdruck, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const laden = async url => {
    const w = new Promise(r => { ladeWarten = r; });
    await cdp('Page.navigate', { url });
    await w;
  };
  const neuLaden = async ausdruck => {
    const w = new Promise(r => { ladeWarten = r; });
    await js(ausdruck ?? 'location.reload()');
    await w;
  };

  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable'); await cdp('Network.enable');
  return {
    cdp, js, laden, neuLaden, fehler, netz,
    ende() { ws.close(); proc.kill(); },
  };
}

// Fester Zufall, damit zwei Läufe dieselben Fragen ziehen; confirm() sagt ja.
export const FESTER_ZUFALL = `
  (() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; }; window.confirm = () => true; })();`;
