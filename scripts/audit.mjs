// driftless audit: what would each policy have cost on your own history? It replays your Claude Code
// transcripts locally with today's prices, spends no tokens, and sends nothing anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULTS, priceFor, ratesAt, resetCost, handoffPrice, restartTokens, guardAt, tokensFromChars } from './economy.mjs';

const TAG = /<([a-zA-Z_-]+)[^>]*>[\s\S]*?<\/\1>/g;
// A first prompt that picks up earlier work, in English and in Italian (the languages of the history the figures were
// measured on; "cantiere" is Italian for the logbook): a piece of work that starts this way continues the one before it.
// Changing the words changes how pieces of work are chained, so the published figures would change too.
const RESUME = /resume|continue|logbook|cantiere|ripart|riprend|dove (siamo|eravamo)|avevamo lasciato/i;
const FORCED = 950_000; // past this every policy has to do something: native compaction or a fresh start
const TOO_BIG = 300_000; // the size past which a run is reported as out of bounds
const IMAGE_CHARS = 5250; // what an image in a tool result weighs, in characters of text
const UNATTRIBUTED_ALARM = 0.05;
const CHAIN_GAP_MS = 48 * 3600 * 1000; // a session continues the one before only if it starts within this of its end
const READ_ONLY_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead', 'ToolSearch', 'ListAgents', 'TodoRead', 'TaskList', 'TaskGet']);
const BASH_READERS = new Set(['cat', 'head', 'tail', 'sed', 'awk', 'grep', 'rg', 'find', 'ls', 'wc', 'du', 'stat', 'tree', 'less', 'diff', 'type', 'sort', 'uniq', 'cut']);
const list = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
const textOf = (c) => (typeof c === 'string' ? c : (c || []).filter((b) => b?.type === 'text').map((b) => b.text || '').join(' '));
const resultChars = (c) => (typeof c === 'string' ? c.length : (c || []).reduce((a, b) => a + (b?.type === 'image' ? IMAGE_CHARS : (b?.text || '').length), 0));

// Does this command only read? Judged by its first real segment, skipping cd, echo and variable assignments.
function bashReads(cmd) {
  for (const seg of String(cmd || '').split(/&&|;|\|\||\n/)) {
    const words = seg.trim().split(/\s+/).filter(Boolean);
    while (words.length && /^\w+=/.test(words[0])) words.shift();
    if (!words.length || ['cd', 'echo', 'export', 'set', 'true', 'sleep'].includes(words[0])) continue;
    return BASH_READERS.has(path.basename(words[0]).toLowerCase());
  }
  return false;
}

function readSession(file, seen, subagent = false) {
  const requests = [];
  const byId = new Map();
  const results = new Map();
  let pending = false, promptChars = 0, firstPrompt = '';
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('"usage"') && !line.includes('"type":"user"')) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (d.type === 'user') {
      const content = d.message?.content;
      if (Array.isArray(content)) for (const b of content) if (b?.type === 'tool_result') results.set(b.tool_use_id, resultChars(b.content));
      if (!d.isMeta && !d.toolUseResult) {
        const p = textOf(content).replace(TAG, '').trim();
        if (p) { pending = true; firstPrompt ||= p; if (!d.isCompactSummary) promptChars += p.length; }
      }
    }
    if (d.type !== 'assistant' || (d.isSidechain && !subagent)) continue;
    const u = d.message?.usage;
    if (!u) continue;
    const id = d.requestId || d.uuid;
    let q = id && byId.get(id);
    if (!q) {
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      q = { ts: d.timestamp ? Date.parse(d.timestamp) : null, model: d.message?.model, i: 0, w: 0, w5: 0, w1: 0, r: 0, o: 0, th: 0, text: 0, tools: [], prompt: promptChars, start: pending };
      pending = false; promptChars = 0;
      if (id) byId.set(id, q);
      requests.push(q);
    }
    const c = u.cache_creation || {};
    q.i = Math.max(q.i, u.input_tokens || 0);
    q.w = Math.max(q.w, u.cache_creation_input_tokens || 0);
    q.w5 = Math.max(q.w5, c.ephemeral_5m_input_tokens || 0);
    q.w1 = Math.max(q.w1, c.ephemeral_1h_input_tokens || 0);
    q.r = Math.max(q.r, u.cache_read_input_tokens || 0);
    q.o = Math.max(q.o, u.output_tokens || 0);
    q.th = Math.max(q.th, u.output_tokens_details?.thinking_tokens || 0);
    for (const b of Array.isArray(d.message?.content) ? d.message.content : []) {
      if (b?.type === 'text') q.text += (b.text || '').length;
      else if (b?.type === 'tool_use') q.tools.push({ id: b.id, name: b.name, chars: JSON.stringify(b.input ?? {}).length, read: bashReads(b.input?.command) });
    }
  }
  return { file, requests: requests.filter((q) => q.i + q.w + q.r > 0), firstPrompt, results };
}

const longCache = (q) => q.w5 <= q.w1;
const realCost = (q, p) => {
  const x = ratesAt(p, q.i + q.w + q.r, longCache(q));
  return (q.i * x.input + q.w * x.write + q.r * x.read + q.o * x.output) / 1e6;
};
const sessionCost = (s) => s.requests.reduce((a, q) => { const p = priceFor(q.model); return a + (p ? realCost(q, p) : 0); }, 0);

// The subagents of one session: their transcripts live in a folder named after it.
function subagentRuns(sessionDir) {
  const runs = [];
  for (const f of list(path.join(sessionDir, 'subagents'))) {
    if (!f.name.endsWith('.jsonl')) continue;
    const file = path.join(sessionDir, 'subagents', f.name);
    const s = readSession(file, new Set(), true);
    if (!s.requests.length) continue;
    let type = '?';
    try { type = JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType || '?'; } catch { /* no metadata */ }
    runs.push({ ...s, type, cost: sessionCost(s) });
  }
  return runs;
}

export function loadHistory(baseDir, dirs) {
  const seen = new Set();
  const sessions = [];
  const runs = [];
  let unknown = 0, known = 0;
  for (const dir of dirs) {
    const base = path.join(baseDir, dir);
    const own = [];
    for (const e of list(base)) {
      if (e.isFile() && e.name.endsWith('.jsonl')) {
        const s = readSession(path.join(base, e.name), seen);
        if (s.requests.length) own.push(s);
      } else if (e.isDirectory()) runs.push(...subagentRuns(path.join(base, e.name)));
    }
    own.sort((a, b) => (a.requests[0].ts || 0) - (b.requests[0].ts || 0));
    sessions.push(own.map((s) => ({ ...s, project: dir })));
  }
  // A work chain: the sessions that continue one another, replayed as one job. A session that says it resumes continues
  // the one before only if it starts within CHAIN_GAP_MS of its end: "continue" a week later is new work, and stitching
  // it on would make the never-reset side carry a context nobody carried (REVISIONE 9).
  const chains = [];
  const close = (prev, s) => {
    const end = prev.requests.at(-1).ts, start = s.requests[0].ts;
    return end === null || start === null || start - end <= CHAIN_GAP_MS;
  };
  for (const own of sessions) {
    let cur = null;
    for (const s of own) {
      if (s.requests.length < 3) continue;
      if (cur && RESUME.test(s.firstPrompt.slice(0, 300)) && close(cur.at(-1), s)) cur.push(s);
      else { if (cur) chains.push(cur); cur = [s]; }
    }
    if (cur) chains.push(cur);
  }
  const flat = sessions.flat();
  for (const s of flat) for (const q of s.requests) if (priceFor(q.model)) known += 1; else unknown += 1;
  return { sessions: flat, chains: chains.map(stitch), runs, subagents: runs.reduce((a, r) => a + r.cost, 0), subRuns: runs.length, unknownRequests: unknown, knownRequests: known };
}

// One request as part of a continuous job: what the context would have been without any reset. `extra` is
// context this session did not carry for another reason: what the diet hid.
const newLink = () => ({ carried: 0, lastTs: null, lastContext: 0 });
function stitched(link, q, j, extra = 0) {
  const c = q.i + q.w + q.r;
  let cold;
  if (j === 0 && link.lastTs !== null) {
    link.carried += Math.max(0, link.lastContext - c);
    cold = q.ts !== null && q.ts - link.lastTs > 3_600_000;
  } else cold = c >= 20_000 && q.r < 0.5 * c;
  const more = link.carried + extra;
  link.lastContext = c;
  if (q.ts !== null) link.lastTs = q.ts;
  return { C: c + more, i: q.i, w: q.w + (cold ? more : 0), r: q.r + (cold ? 0 : more), o: q.o, start: q.start || j === 0, cold, model: q.model, long: longCache(q), gapOk: true };
}

// The requests a continuation spends finding its place again: its first turn, as long as it only reads (the documents, the
// resume point) and answers. With no reset they would not exist, so every replay leaves them out: kept, they made the
// never-reset side pay them at the full stitched context (REVISIONE 8). The real cost still counts them.
export function resumeRequests(requests) {
  let n = 0;
  for (const [j, q] of requests.entries()) {
    if (j > 0 && q.start) break;
    if (!q.tools.every((t) => READ_ONLY_TOOLS.has(t.name) || ((t.name === 'Bash' || t.name === 'PowerShell') && t.read))) break;
    n = j + 1;
  }
  return n;
}
// A resume request stays in the chain as a placeholder the replays step over; the stitching starts at the first request
// that works, so what the resume read does not count as context carried over either.
const RESUMED = Object.freeze({ resume: true });

export function stitch(chain) {
  const link = newLink();
  const out = chain.flatMap((s, i) => {
    const skip = i ? resumeRequests(s.requests) : 0;
    return s.requests.map((q, j) => (j < skip ? RESUMED : stitched(link, q, j - skip)));
  });
  const first = chain[0].requests[0];
  return { first: first.i + first.w + first.r, requests: out };
}

const newReplay = (first) => ({ restart: restartTokens(first), removed: 0, carry: 0, total: 0, resets: 0, k: 0 });
function replayStep(st, x, policy, harness = 'claude') {
  if (x.resume) return; // see resumeRequests
  const k = st.k++;
  const p = priceFor(x.model);
  if (!p) return;
  let context = x.C - st.removed;
  let now = ratesAt(p, context, x.long);
  if (k && (x.start || context >= FORCED) && context > st.restart) {
    const agent = policy.agent === 'same' ? p : handoffPrice(p, harness);
    const wake = x.cold ? context * (now.write - now.read) / 1e6 : 0; // the session must wake up to hand off
    const reset = resetCost(p, st.restart, agent) + wake;
    const guard = guardAt(p, st.restart);
    const go = context >= FORCED
      || (policy.kind === 'fixed' && context >= policy.cap)
      || (policy.kind === 'rule' && (st.carry >= reset * (policy.factor || 1) || (guard && context >= guard)));
    if (go) {
      // What is decided on is the cost at the restart size; what is paid is the handoff launched from this context.
      st.total += resetCost(p, st.restart, agent, context) + wake;
      st.removed += context - st.restart; context = st.restart; st.carry = 0; st.resets += 1;
      now = ratesAt(p, context, x.long);
    }
  }
  const r = Math.max(0, x.r - st.removed);
  const w = Math.max(0, x.w - (st.removed - (x.r - r)));
  st.total += (x.i * now.input + w * now.write + r * now.read + x.o * now.output) / 1e6;
  const fresh = ratesAt(p, st.restart, x.long);
  const key = x.cold ? 'write' : 'read';
  st.carry += Math.max(0, context * now[key] - st.restart * fresh[key] + x.o * (now.output - fresh.output)) / 1e6;
}

// The cost of one chain under a policy. policy: {kind: 'never'} | {kind: 'fixed', cap} | {kind: 'rule', factor}
export function replay(chain, policy, harness = 'claude') {
  const st = newReplay(chain.first);
  for (const x of chain.requests) replayStep(st, x, policy, harness);
  return { total: st.total, resets: st.resets };
}

// Paired bootstrap over chains, with a seeded generator so the same history always gives the same answer.
export function pairedBootstrap(base, other, rounds = 4000, seed = 42) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const diff = base.map((b, i) => b - other[i]);
  const total = base.reduce((a, b) => a + b, 0) || 1;
  const m = diff.length;
  const runs = [];
  for (let r = 0; r < rounds; r++) {
    let sum = 0;
    for (let i = 0; i < m; i++) sum += diff[Math.floor(rnd() * m)];
    runs.push(sum / total);
  }
  runs.sort((a, b) => a - b);
  return { saving: diff.reduce((a, b) => a + b, 0) / total, low: runs[Math.floor(rounds * 0.025)], high: runs[Math.floor(rounds * 0.975)] };
}

// The same requests, had the cache lived for this long: a hit below the TTL, the whole prompt again above it.
export function ttlCost(sessions, seconds) {
  let total = 0;
  for (const s of sessions) {
    let prev = 0, prevTs = null;
    s.requests.forEach((q, j) => {
      const p = priceFor(q.model);
      const c = q.i + q.w + q.r;
      if (p) {
        const x = ratesAt(p, c, seconds > 300);
        const gap = prevTs !== null && q.ts !== null ? (q.ts - prevTs) / 1000 : 0;
        if (j === 0) total += (q.i * x.input + q.w * x.write + q.r * x.read + q.o * x.output) / 1e6;
        else if (gap <= seconds) { const fresh = Math.max(0, c - prev); total += ((c - fresh) * x.read + fresh * x.write + q.o * x.output) / 1e6; }
        else total += (c * x.write + q.o * x.output) / 1e6;
      }
      prev = c;
      if (q.ts !== null) prevTs = q.ts;
    });
  }
  return total;
}

// Where the money goes. A token pays once to enter the context, then again at every later request until the session
// ends, so what enters early costs most. The shares must add up to what was really spent: what does not is reported,
// because transcripts are not a stable format and a change there would otherwise bend these numbers in silence.
const ORIGINS = ['results', 'inputs', 'startup', 'thinking', 'text', 'prompts'];
const FREE = { input: 0, write: 0, read: 0, output: 0 };
function originsOf(sessions) {
  const c = Object.fromEntries(ORIGINS.map((k) => [k, 0]));
  let real = 0, bash = 0, reads = 0;
  for (const s of sessions) {
    const rq = s.requests, n = rq.length;
    if (!n) continue;
    const rate = rq.map((q) => { const p = priceFor(q.model); return p ? ratesAt(p, q.i + q.w + q.r, longCache(q)) : FREE; });
    const tail = new Array(n + 2).fill(0);
    for (let k = n - 1; k >= 0; k--) {
      const size = rq[k].i + rq[k].w + rq[k].r;
      tail[k] = tail[k + 1] + (size >= 20_000 && rq[k].r < 0.5 * size ? rate[k].write : rate[k].read);
    }
    const first = rq[0];
    c.startup += (first.i * rate[0].input + first.w * rate[0].write + first.r * rate[0].read + (first.i + first.w + first.r) * tail[1]) / 1e6;
    rq.forEach((q, k) => {
      const p = priceFor(q.model);
      if (p) real += realCost(q, p);
      const later = k + 1 < n ? rate[k + 1].write + tail[k + 2] : 0;
      const each = rate[k].output + later;
      const text = tokensFromChars(q.text, q.model);
      const input = Math.max(0, q.o - q.th - text);
      c.text += text * each / 1e6;
      c.thinking += q.th * each / 1e6;
      c.inputs += input * each / 1e6;
      const chars = q.tools.reduce((a, t) => a + t.chars, 0) || 1;
      for (const t of q.tools) {
        const asked = input * (t.chars / chars) * each / 1e6;
        const got = (s.results.get(t.id) || 0) * DEFAULTS.tokens_per_result_char * later / 1e6;
        c.results += got;
        if (t.name === 'Bash' || t.name === 'PowerShell') { bash += asked + got; if (t.read) reads += asked + got; }
      }
      if (k && q.prompt) c.prompts += tokensFromChars(q.prompt, q.model) * (rate[k].write + tail[k + 1]) / 1e6;
    });
  }
  const shown = ORIGINS.reduce((a, k) => a + c[k], 0);
  return { ...c, unattributed: real - shown, real, bash, bash_reads: reads };
}

function subagentsOf(runs) {
  const types = {};
  let past = 0, big = 0, reading = 0, readingRuns = 0;
  for (const r of runs) {
    types[r.type] = (types[r.type] || 0) + r.cost;
    let over = false;
    for (const q of r.requests) {
      if (q.i + q.w + q.r <= TOO_BIG) continue;
      over = true;
      const p = priceFor(q.model);
      if (p) past += realCost(q, p);
    }
    if (over) big += 1;
    if (!r.requests.some((q) => q.tools.some((t) => /^(Write|Edit|NotebookEdit|MultiEdit)$/.test(t.name)))) { reading += r.cost; readingRuns += 1; }
  }
  return { past_300k_runs: big, past_300k_usd: past, read_only_runs: readingRuns, read_only_usd: reading, by_type: Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([type, usd]) => ({ type, usd })) };
}

export function analyse(history) {
  const costs = (policy) => history.chains.map((c) => replay(c, policy).total);
  const sum = (v) => v.reduce((a, b) => a + b, 0);
  const never = costs({ kind: 'never' });
  const rule = costs({ kind: 'rule' });
  const f340 = costs({ kind: 'fixed', cap: 340_000 });
  const f250 = costs({ kind: 'fixed', cap: 250_000 });
  const f200 = costs({ kind: 'fixed', cap: 200_000 });
  const short = history.chains.map((c, i) => [c.requests.length < 100, i]);
  const pick = (v, s) => sum(short.filter(([x]) => x === s).map(([, i]) => v[i]));
  const main = history.sessions.flatMap((s) => s.requests);
  const real = sum(main.map((q) => { const p = priceFor(q.model); return p ? realCost(q, p) : 0; }));
  const w5 = sum(main.map((q) => q.w5));
  const w1 = sum(main.map((q) => q.w1));
  const gains = never.map((v, i) => v - rule[i]).sort((a, b) => b - a);
  const gained = sum(gains);
  return {
    sessions: history.sessions.length, chains: history.chains.length, requests: main.length,
    unknown_model_requests: history.unknownRequests,
    spend: { main: real, subagents: history.subagents, subagent_runs: history.subRuns },
    origins: { main: originsOf(history.sessions), subagents: originsOf(history.runs) },
    subagents: subagentsOf(history.runs),
    policies: { never: sum(never), fixed_340k: sum(f340), fixed_250k: sum(f250), fixed_200k: sum(f200), rule: sum(rule) },
    rule_vs_never: pairedBootstrap(never, rule),
    rule_vs_fixed_340k: pairedBootstrap(f340, rule),
    rule_vs_fixed_250k: pairedBootstrap(f250, rule),
    whole_bill_saving: sum(never) + history.subagents ? gained / (sum(never) + history.subagents) : 0,
    concentration: { top: Math.min(10, gains.length), share_of_saving: gained > 0 ? sum(gains.slice(0, 10)) / gained : 0, chains_gaining: gains.filter((g) => g > 0.005).length, chains_losing: gains.filter((g) => g < -0.005).length },
    by_length: {
      short: { chains: short.filter(([s]) => s).length, never: pick(never, true), rule: pick(rule, true) },
      long: { chains: short.filter(([s]) => !s).length, never: pick(never, false), rule: pick(rule, false) },
    },
    cache: { main_ttl_now: w5 > w1 ? '5m' : '1h', ttl_5m: ttlCost(history.sessions, 300), ttl_1h: ttlCost(history.sessions, 3600) },
  };
}

const usd = (x) => `$${x.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const ORIGIN_NAMES = { results: 'Tool results', inputs: 'Tool inputs', startup: 'Session start', thinking: 'Thinking', text: "The model's text", prompts: 'Your prompts', unattributed: 'Not attributed' };

function originLines(a) {
  const { main, subagents: sub } = a.origins;
  const total = main.real + sub.real;
  if (!total) return [];
  const row = (name, m, s, t) => `  ${name.padEnd(18)} ${m.padStart(11)} ${s.padStart(11)} ${t.padStart(11)}`;
  const L = ['Where the money goes (a token pays to enter, then again at every later request until the session ends):', row('', 'main', 'subagents', 'total') + '   share'];
  for (const k of [...ORIGINS, 'unattributed']) L.push(`${row(ORIGIN_NAMES[k], usd(main[k]), usd(sub[k]), usd(main[k] + sub[k]))}   ${pct((main[k] + sub[k]) / total).padStart(5)}`);
  L.push(row('Really spent', usd(main.real), usd(sub.real), usd(total)));
  const bash = main.bash + sub.bash;
  if (bash) L.push(`  Bash alone: ${usd(bash)} (${pct(bash / total)}), of which commands that only read: ${usd(main.bash_reads + sub.bash_reads)} (${pct((main.bash_reads + sub.bash_reads) / total)}).`);
  for (const [name, o] of [['main thread', main], ['subagent', sub]]) {
    if (o.real >= 1 && Math.abs(o.unattributed) / o.real > UNATTRIBUTED_ALARM) {
      L.push(`  WARNING: ${pct(Math.abs(o.unattributed) / o.real)} of the ${name} spend does not add up. The transcript format may have changed: do not trust these shares.`);
    }
  }
  return [...L, ''];
}

export function report(a) {
  const L = [];
  L.push(`Driftless audit: ${a.sessions} sessions, ${a.chains} work chains, ${a.requests.toLocaleString('en')} requests.`);
  L.push('List prices of today, computed on this machine; no tokens spent, nothing sent. On a subscription read them as shares of your usage, not as a bill.');
  L.push('');
  const total = a.spend.main + a.spend.subagents;
  if (total) L.push(`Spend so far: ${usd(a.spend.main)} main thread + ${usd(a.spend.subagents)} subagents (${pct(a.spend.subagents / total)} of it, in ${a.spend.subagent_runs} runs; no cap applies to them).`);
  if (a.unknown_model_requests) L.push(`${a.unknown_model_requests} requests on models without a price in data/pricing.json are left out.`);
  L.push('');
  L.push(...originLines(a));
  const sub = a.subagents;
  if (a.spend.subagent_runs) {
    L.push(`Subagents: ${sub.past_300k_runs} of ${a.spend.subagent_runs} runs went past ${TOO_BIG.toLocaleString('en')} tokens, with ${usd(sub.past_300k_usd)} spent past that point. ${sub.read_only_runs} only read, for ${usd(sub.read_only_usd)}.`);
    L.push(`  By type: ${sub.by_type.map((t) => `${t.type} ${usd(t.usd)}`).join(', ')}.`);
    L.push('');
  }
  L.push('The same work under each policy (main thread):');
  for (const [name, key] of [['Never reset', 'never'], ['Fixed cap at 340k', 'fixed_340k'], ['Fixed cap at 250k', 'fixed_250k'], ['Fixed cap at 200k', 'fixed_200k'], ['Economic rule', 'rule']]) {
    const v = a.policies[key];
    L.push(`  ${name.padEnd(20)} ${usd(v).padStart(12)}${key === 'never' ? '' : `   ${pct(1 - v / (a.policies.never || 1)).padStart(6)} less`}`);
  }
  L.push('');
  const r = a.rule_vs_never;
  L.push(`Rule against never resetting: ${pct(r.saving)} saved, 95% interval ${pct(r.low)} to ${pct(r.high)} (paired bootstrap over chains).`);
  L.push(`On the whole bill, with the subagents as they were: ${pct(a.whole_bill_saving)} saved.`);
  L.push(`Rule against a fixed cap at 340k: ${pct(a.rule_vs_fixed_340k.saving)} (${pct(a.rule_vs_fixed_340k.low)} to ${pct(a.rule_vs_fixed_340k.high)}); at 250k: ${pct(a.rule_vs_fixed_250k.saving)} (${pct(a.rule_vs_fixed_250k.low)} to ${pct(a.rule_vs_fixed_250k.high)}).`);
  const { short, long } = a.by_length;
  const gain = (g) => (g.never ? pct(1 - g.rule / g.never) : 'n/a');
  L.push(`Chains under 100 requests: ${short.chains}, saving ${gain(short)}. From 100 requests up: ${long.chains}, saving ${gain(long)}.`);
  const c = a.concentration;
  if (c.chains_gaining) L.push(`The ${c.top} best chains make ${pct(c.share_of_saving)} of the saving; ${c.chains_gaining} of ${a.chains} gain, ${c.chains_losing} lose.`);
  L.push('');
  const { main_ttl_now: now, ttl_5m: t5, ttl_1h: t1 } = a.cache;
  const better = t1 < t5 ? '1h' : '5m';
  const delta = Math.abs(t1 - t5) / Math.max(t1, t5, 1e-9);
  L.push(`Cache lifetime of the main thread: ${now} today. Replayed on your pauses: 5m ${usd(t5)}, 1h ${usd(t1)}.`);
  if (better !== now && delta >= 0.05) L.push(`  Worth changing: "promptCacheTtl": "${better}" in your settings would save about ${pct(delta)} (subscriptions already get 1h while within plan usage).`);
  L.push('');
  if (a.chains < 5) L.push('Verdict: too little history to say anything yet. Run this again after a few more sessions.');
  else if (r.low > 0) L.push(`Verdict: on this history Driftless' rule saves money with confidence, about ${pct(r.saving)} on the main thread and ${pct(a.whole_bill_saving)} on the whole bill. The gain comes from long work; quality is not measured here.`);
  else L.push('Verdict: no reliable saving on this history, typically because the work is short. Driftless would still keep the documents and the resume point, but do not install it for the bill.');
  return L.join('\n');
}

export function audit(claudeDir, projectDirs, json = false, print = true) {
  const base = path.join(claudeDir, 'projects');
  const dirs = projectDirs || list(base).filter((e) => e.isDirectory()).map((e) => e.name);
  const a = analyse(loadHistory(base, dirs));
  if (print) console.log(json ? JSON.stringify(a, null, 2) : report(a));
  return a;
}

// ---------- the running counter ----------
// The sums of the replay, one finished session at a time, so a session start only has to read the last transcript. What
// the sessions really cost, handoffs included, against the same work with no fresh start and no diet. The subagents are
// the same on both sides: they count in the total and not in the difference. The output cap's gain is left out.
export const newTally = () => ({ sessions: 0, fresh_starts: 0, never: 0, actual: 0, handoffs: 0, agents: 0, seen: [], chain: null });

export function addSession(t, file, { continues = false, diet = 0 } = {}) {
  const id = path.basename(file, '.jsonl');
  if (t.seen.includes(id)) return t;
  t.seen = [...t.seen, id].slice(-500);
  const s = readSession(file, new Set());
  if (s.requests.length) {
    const q = s.requests[0];
    const skip = t.chain ? resumeRequests(s.requests) : 0; // a continuation: its resume turn would not exist with no reset
    t.chain ||= { link: newLink(), replay: newReplay(q.i + q.w + q.r) };
    s.requests.forEach((r, j) => { if (j >= skip) replayStep(t.chain.replay, stitched(t.chain.link, r, j - skip, diet), { kind: 'never' }); });
    t.actual += sessionCost(s);
    for (const run of subagentRuns(file.replace(/\.jsonl$/, ''))) {
      if (/handoff/i.test(run.type)) t.handoffs += run.cost; else t.agents += run.cost;
    }
    t.sessions += 1;
  }
  if (continues) t.fresh_starts += 1;
  else if (t.chain) { t.never += t.chain.replay.total; t.chain = null; }
  return t;
}

export function savingsOf(t) {
  const never = t.never + (t.chain?.replay.total || 0);
  const whole = never + t.agents;
  const saved = never - t.actual - t.handoffs;
  return { saved, whole, share: whole ? saved / whole : 0, never, actual: t.actual, handoffs: t.handoffs, subagents: t.agents, sessions: t.sessions, fresh_starts: t.fresh_starts };
}

export { DEFAULTS };
