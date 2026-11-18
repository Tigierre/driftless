// The economics of a session. Carrying a context costs a little at every request; a fresh start costs
// once. Prices are data (data/pricing.json), so one rule works on every model, and a new price list
// needs one line, not new code.
import fs from 'node:fs';

const DATA = JSON.parse(fs.readFileSync(new URL('../data/pricing.json', import.meta.url), 'utf8'));
export const DEFAULTS = DATA.defaults;

const norm = (id) => String(id || '').toLowerCase().replace(/\[.*?\]/g, '').replace(/\./g, '-');
const KEYS = Object.keys(DATA.models).map((k) => [norm(k), k]).sort((a, b) => b[0].length - a[0].length);

// A release the list has not heard of ("claude-fable-5-3"): the newest one it knows of the same family and major
// version. Prices follow the latest release, not the first: Fable 5 read five times dearer than Fable 5.2, and for
// three days a 5.2 session was weighed with the prices of 5. A date ("-20261001") is not a release, and a new major
// version stays unknown.
const RELEASE = /^(.*-\d+)-(\d{1,2})$/;
function newestSibling(id) {
  let best = null;
  for (const [k, name] of KEYS) {
    const m = k.match(RELEASE);
    const at = m ? id.indexOf(m[1] + '-') : -1;
    if (at < 0 || !/^\d{1,2}(?!\d)/.test(id.slice(at + m[1].length + 1))) continue;
    if (!best || Number(m[2]) > best.n) best = { n: Number(m[2]), hit: [k, name] };
  }
  return best?.hit ?? null;
}

// The price list of a model, however the tool spells it ("anthropic/claude-opus-5-5[1m]"); null if unknown.
export function priceFor(model) {
  const id = norm(model);
  let hit = id && KEYS.find(([k]) => id.includes(k));
  if (id && (!hit || /^-\d{1,2}(?!\d)/.test(id.slice(id.indexOf(hit[0]) + hit[0].length)))) hit = newestSibling(id) || hit;
  if (!hit) return null;
  const p = DATA.models[hit[1]];
  return { ...p, write_short: p.write_short ?? p.input, write_long: p.write_long ?? p.write_short ?? p.input, model: hit[1] };
}

// Prices at a given context size: some lists charge the whole prompt more past a threshold.
export function ratesAt(p, tokens, longCache = true) {
  const j = p.jump && tokens > p.jump.at ? p.jump : null;
  const mi = j ? j.input : 1;
  const mo = j ? j.output : 1;
  return { input: p.input * mi, write: (longCache ? p.write_long : p.write_short) * mi, read: p.read * mi, output: p.output * mo };
}

// Characters to tokens, where nothing reports the real figure. Measured on Claude's usage: 0.38 to 0.49 by language.
// The usual "4 characters per token" is the rule of thumb for GPT models on English; it undercounts Claude by half.
export const tokensFromChars = (chars, model) => Math.ceil(chars * DEFAULTS.tokens_per_char[norm(model).includes('claude') ? 'claude' : 'other']);

export const restartTokens = (first, rise = DEFAULTS.resume_rise) => (first || 0) + rise;

// The model that runs the handoff: the cheaper one where the plugin can choose it, the session's elsewhere.
export function handoffPrice(p, harness = 'claude') {
  const chosen = DATA.handoff_model[harness] && priceFor(DATA.handoff_model[harness]);
  return chosen && chosen.read <= p.read * 4 && chosen.input <= p.input ? chosen : p;
}

// What one fresh start costs in dollars, built from its parts, each at the price of the model that pays it:
// - the handoff agent's own run, at the agent's prices (a subagent keeps the 5-minute cache);
// - the session's requests around it (the launch, the line while the agent works, the closing one): each reads the
//   whole context again at the session's prices, and writes and answers a little;
// - the new session's start, and what it has to read again.
// `context` is where the handoff is launched from. To decide, it is the restart size: what the launch reads above it
// grows by the same amount at every request one waits, so it is paid whenever one stops and does not move the best
// moment (per request it is a constant, like the rent). To count what a handoff did cost, pass the real context.
export function resetCost(p, restart, agent = p, context = restart) {
  const { agent: t, thread } = DEFAULTS.handoff_tokens;
  const a = ratesAt(agent, 0, false);
  const h = ratesAt(p, context);
  const s = ratesAt(p, restart);
  const share = DEFAULTS.first_request_cache_share;
  return (t.input * a.input + t.write * a.write + t.read * a.read + t.output * a.output) / 1e6
    + (thread.requests * context * h.read + thread.write * h.write + thread.output * h.output) / 1e6
    + restart * (share * s.read + (1 - share) * s.write) / 1e6
    + DEFAULTS.rediscovery * s.write / 1e6;
}

// What a successor has to find again: at least the measured minimum, and a share of what this agent gathered since its
// start. A fixed 10k said a fresh agent cost $0.19 at 134k, and live four review agents out of four were stopped with
// their reading half done: what an agent read is what its successor has to read again (REVISIONE 5).
export const subagentRediscovery = (first, context = first) =>
  Math.max(DEFAULTS.subagent.rediscovery, DEFAULTS.subagent.rediscovery_share * Math.max(0, (context || 0) - (first || 0)));

// What a fresh subagent costs instead of this one, at this context: its report, a successor's start, and what the
// successor reads again. Subagents keep the 5-minute cache.
export function subagentResetCost(p, first, context = first) {
  const d = DEFAULTS.subagent;
  const again = subagentRediscovery(first, context);
  const s = ratesAt(p, (first || 0) + again, false);
  const share = DEFAULTS.first_request_cache_share;
  return (d.report_tokens * s.output + (first || 0) * (share * s.read + (1 - share) * s.write) + again * s.write) / 1e6;
}

// Extra dollars one request pays for carrying the context, against what it would pay after a fresh start.
export function carryOf(p, context, restart, output, cold, longCache = true) {
  const now = ratesAt(p, context, longCache);
  const fresh = ratesAt(p, restart, longCache);
  const key = cold ? 'write' : 'read';
  return Math.max(0, context * now[key] - restart * fresh[key] + output * (now.output - fresh.output)) / 1e6;
}

// A hard stop before a price jump, when a fresh start lands clearly below it.
export function guardAt(p, restart) {
  const at = p.jump ? p.jump.at * DEFAULTS.jump_guard : null;
  return at && restart < at ? at : null;
}

// For tools that do not report every request: the classic economic order quantity, X = S + √(2·H·g / r).
export function orderQuantity(p, restart, agent = p, growth = DEFAULTS.growth_per_request) {
  const x = restart + Math.sqrt(2 * resetCost(p, restart, agent) * growth / (ratesAt(p, restart).read / 1e6));
  const guard = guardAt(p, restart);
  return Math.round(guard ? Math.min(x, guard) : x);
}

// ---------- the running ledger of a session, read incrementally from its transcript ----------
const usageOf = (d) => {
  const u = d.message?.usage;
  if (!u) return null;
  const i = u.input_tokens || 0, w = u.cache_creation_input_tokens || 0, r = u.cache_read_input_tokens || 0;
  if (!(i + w + r)) return null;
  const c = u.cache_creation || {};
  return { i, w, r, o: u.output_tokens || 0, short: (c.ephemeral_5m_input_tokens || 0) > (c.ephemeral_1h_input_tokens || 0) };
};

// A subagent's own transcript has every line marked as a side chain: { sidechain: true } reads those, and a fresh
// subagent, not a resumed session, is what it is weighed against.
export function updateLedger(prev, file, opts = {}) {
  const led = prev?.file === file ? { ...prev } : { file, offset: 0, requests: 0, first: null, last: 0, carry: 0, model: null, last_id: null };
  const size = fs.statSync(file).size;
  if (size < led.offset) return updateLedger(null, file, opts); // the file was replaced
  if (size === led.offset) return led;
  const buf = Buffer.alloc(size - led.offset);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buf, 0, buf.length, led.offset);
  fs.closeSync(fd);
  const end = buf.lastIndexOf(10); // only whole lines: the last one may still be being written
  if (end < 0) return led;
  led.offset += end + 1;
  for (const line of buf.toString('utf8', 0, end).split('\n')) {
    if (!line.includes('"usage"')) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (d.type !== 'assistant' || (d.isSidechain && !opts.sidechain)) continue;
    const u = usageOf(d);
    if (!u) continue;
    const id = d.requestId || null;
    if (id && id === led.last_id) continue; // one response, several lines
    led.last_id = id;
    const context = u.i + u.w + u.r;
    const cold = led.requests > 0 && context >= 20_000 && u.r < 0.5 * context;
    if (led.first === null) led.first = context;
    led.requests += 1;
    led.last = context;
    led.model = d.message?.model || led.model;
    const p = priceFor(led.model);
    if (p) led.carry += carryOf(p, context, restartTokens(led.first, opts.sidechain ? subagentRediscovery(led.first, context) : undefined), u.o, cold, !u.short);
  }
  return led;
}

// The decision at the end of a turn, for a session with a ledger.
export function decide(led, window, harness = 'claude') {
  const ceiling = Math.round((window || 1_000_000) * DEFAULTS.window_ceiling);
  const p = priceFor(led.model);
  if (!p) return { known: false, ceiling };
  const restart = restartTokens(led.first);
  const reset = resetCost(p, restart, handoffPrice(p, harness));
  const guard = guardAt(p, restart);
  const why = led.last >= ceiling ? `near the context window (${ceiling.toLocaleString('en')})`
    : guard && led.last >= guard ? `close to the price jump of ${p.model} at ${p.jump.at.toLocaleString('en')}`
    : led.carry >= reset ? `carrying it has cost $${led.carry.toFixed(2)}, a fresh start costs $${reset.toFixed(2)}`
    : null;
  return { known: true, model: p.model, reset, carry: led.carry, ceiling, guard, why };
}
