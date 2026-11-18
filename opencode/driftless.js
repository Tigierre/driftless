// Driftless for OpenCode: the same core as every other harness (scripts/driftless.mjs), run in-process
// from OpenCode's plugin API, so it needs nothing but OpenCode itself. One file for both plugin generations:
// OpenCode 1.x loads the named export (or default.server), OpenCode 2.x reads default.id and default.setup.
//
//                      OpenCode 1.x                          OpenCode 2.x
//   session start      session.created, or the first         the session's first "context" hook
//                      request of a session that was there
//                      before the host started (see resume)
//   context injected   experimental.chat.system.transform    "context" hook, event.system
//   tokens             message.updated (assistant)           session.step.ended, under event.data
//   end of a turn      session.status idle, or session.idle  "experimental.idle" hook
//                      (not in a one-shot "run": see startedAs)
//   go on              session.promptAsync                   session.synthetic, in the same execution
//   fresh session      session.create + promptAsync          session.create + session.prompt
//   handoff agent      the "config" hook                     agent.transform
//
// The 2.x half is written from OpenCode's own documentation and source (packages/plugin, packages/client, packages/schema
// and packages/core, read again at @opencode/plugin 2.3.0) and has not been run in OpenCode: test/ drives it with a
// stand-in.
//
// What the host tells the plugin is written down as it comes (seen: loaded, session, turn, stray), for "doctor" to read:
// whether a host calls these handlers at all is what nothing else can say.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook, seen } from '../scripts/driftless.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HANDOFF_AGENT = 'driftless-handoff';
export const RESUME_TITLE = 'Driftless: resume';

// The handoff agent is shared with Claude Code: same instructions, without the Claude frontmatter. What it may use is
// said the way the host reads it. OpenCode: a "permission" map, which is all its agent builder reads of an agent a
// plugin adds (seen in its source at 1.19.5: "tools" is turned into permissions when the config files are parsed, before
// the plugin's hook), and the switch per tool OpenCode had before 1.1.1, for a host that old.
const OPENCODE_ACCESS = {
  permission: { bash: 'deny', webfetch: 'deny' },
  tools: { read: true, write: true, edit: true, glob: true, grep: true, bash: false, webfetch: false },
};
const handoffAgent = (host) => {
  const text = fs.readFileSync(path.join(ROOT, 'agents', 'handoff.md'), 'utf8');
  const description = (text.match(/^description:\s*(.+)$/m) || [])[1] || 'Driftless handoff';
  return {
    description, mode: 'subagent',
    prompt: text.replace(/^---[\s\S]*?---\s*/, ''),
    ...(host.agentAccess || OPENCODE_ACCESS),
  };
};
// The context a response left behind: what was sent, cached or not.
const contextTokens = (t) => (t ? (t.input || 0) + (t.cache?.read || 0) + (t.cache?.write || 0) : 0);

// ---------- OpenCode 1.x ----------
// One plugin for OpenCode and for a fork that kept this API under its own name (Kilo Code: kilo/driftless.js). "host"
// says what differs there:
//   agentAccess   what the handoff agent may use, in the host's own words
//   headers()     what a request to the host's own server needs besides its body: see basicAuth
//   unseen()      true when the host itself says no terminal UI is in front of this server (who started it, in its
//                 environment): nothing shows a toast or a session there. Its command line says the same: startedAs
//   interactiveRun  true where "run --interactive" is the split-footer interface, not one prompt (Kilo; OpenCode
//                 1.19.5 lists the option and does not read it)
// A password the user set on the host's server (OPENCODE_SERVER_PASSWORD, as OpenCode documents it): the server then asks
// every request for HTTP basic auth, the one that shows the fresh session too. The user's name is the host's own unless
// they set another.
export const basicAuth = (prefix, user) => () => {
  const password = process.env[`${prefix}_SERVER_PASSWORD`];
  if (!password) return {};
  return { Authorization: `Basic ${Buffer.from(`${process.env[`${prefix}_SERVER_USERNAME`] || user}:${password}`).toString('base64')}` };
};
// How the host was started, in its own command line: the plugin runs in the process that serves the sessions. Read in
// the source of both hosts (src/index.ts and cli/cmd/run.ts, OpenCode 1.19.5 and Kilo 7.8.28): before the command come
// two switches and --log-level with one of four values; "run" takes one prompt and leaves when its session goes idle.
// The split-footer interface is --mini in both, and run --interactive in Kilo alone.
//   'run'      one prompt, then the process ends: a turn started when that one ends would be cut short
//   'server'   serve, web, acp: no terminal UI of its own (an editor's extension, a browser, another program's client)
//   'mini'     the split-footer interface: someone is there, but it shows one session and no toast
//   'tui'      anything else: the terminal UI
export const startedAs = (argv = process.argv.slice(2), interactiveRun = false) => {
  const command = argv.find((a) => !a.startsWith('-') && !/^(DEBUG|INFO|WARN|ERROR)$/.test(a));
  if (argv.includes('--mini') || (interactiveRun && command === 'run' && argv.some((a) => a === '--interactive' || a === '-i'))) return 'mini';
  if (command === 'run') return 'run';
  return ['serve', 'web', 'acp'].includes(command) ? 'server' : 'tui';
};
// What the model is to tell the user where nothing brings the fresh session to the front.
const FRESH_NOTE_1X = 'Here the fresh session does not come to the front by itself: tell the user it is in the session list, ' +
  `named "${RESUME_TITLE}".`;
const WHOSE_MS = 3000; // how long a request may wait for the host to say whose session it is
export const serverFor = (harness, host = {}) => async ({ client, directory, serverUrl }) => {
  const sessions = new Map(); // id → { context, first, last, model, window, asked }
  const at = (id) => sessions.get(id) || sessions.set(id, {}).get(id);
  const children = new Set(); // the sessions the host said are a subagent's
  const idleBy = new Map(); // id → the event that last said the session's turn ended
  const started = startedAs(undefined, host.interactiveRun);
  const unseen = started !== 'tui' || !!host.unseen?.();
  seen(harness, 'loaded', { api: "OpenCode's 1.x plugin API", as: unseen && started === 'tui' ? 'server' : started });
  // What the core says to the user: on screen where there is one, else in the host's log.
  const toast = (message, variant = 'info') => Promise.resolve().then(() => (unseen
    ? client.app.log({ body: { service: 'driftless', level: variant === 'warning' ? 'warn' : 'info', message } })
    : client.tui.showToast({ body: { message, variant } }))).catch(() => {});
  const say = (id, text) =>
    client.session.promptAsync({ path: { id }, body: { parts: [{ type: 'text', text }] } });

  // Runs the core's session start once per session; its text joins the system prompt.
  function start(id, cwd) {
    if (sessions.get(id)?.context !== undefined) return;
    const out = runHook('session-start', { cwd: cwd || directory, session_id: id, pid: process.pid }, harness);
    at(id).context = out?.hookSpecificOutput?.additionalContext || null;
  }

  // A session the host never announced: "session.created" is published when a session is made, so one that was there
  // before the host started (resumed after a restart) comes without it. Its first request names it, in the hook the
  // host waits for before it sends the system prompt (session/llm/request.ts, OpenCode 1.19.5 and Kilo 7.8.28). The
  // host is asked whose session it is, once: a subagent's never drives the project, and where the host does not say
  // in time nothing is assumed and the session is left as it was.
  const asked = new Map(); // id → the answer on its way, or null once it came
  function resume(id) {
    if (!id || children.has(id) || sessions.get(id)?.context !== undefined) return null;
    if (asked.has(id)) return asked.get(id);
    let timer;
    const wait = new Promise((r) => { timer = setTimeout(r, WHOSE_MS, null); });
    const told = Promise.resolve().then(() => client.session.get({ path: { id } })).then((r) => r?.data || null, () => null);
    const answer = Promise.race([told, wait]).then((info) => {
      clearTimeout(timer); // an answer that came leaves nothing behind to keep a one-shot run from leaving
      asked.set(id, null);
      if (!info?.id) return;
      if (info.parentID) return void children.add(id);
      if (sessions.get(id)?.context !== undefined) return; // announced meanwhile
      start(id, info.directory);
      seen(harness, 'session', { by: 'its first request', context: !!sessions.get(id)?.context });
    });
    asked.set(id, answer);
    return answer;
  }

  // A fresh session in the same window: create it, show it, send the resume prompt. No gesture.
  async function reopen(prompt, cwd) {
    const created = await client.session.create({ body: { title: RESUME_TITLE } }).catch(() => null);
    const id = created?.data?.id;
    if (!id) return toast('Driftless: handoff done, but no new session could be created. Start one and say "resume".', 'warning');
    start(id, cwd);
    // The plugin client has no selectSession yet: the same server route the TUI client uses.
    if (!unseen) {
      await fetch(new URL('/tui/select-session', serverUrl), {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...host.headers?.() }, body: JSON.stringify({ sessionID: id }),
      }).catch(() => {});
    }
    await say(id, prompt);
  }

  return {
    config: async (cfg) => {
      cfg.agent = { ...(cfg.agent || {}), [HANDOFF_AGENT]: { ...handoffAgent(host), ...(cfg.agent?.[HANDOFF_AGENT] || {}) } };
    },

    // The model's context window, for a cap given as a percentage.
    'chat.params': async ({ sessionID, model }) => {
      if (sessionID && model?.limit?.context) at(sessionID).window = model.limit.context;
    },

    'experimental.chat.system.transform': async ({ sessionID }, output) => {
      await resume(sessionID);
      const ctx = sessionID && sessions.get(sessionID)?.context;
      if (ctx) output.system.push(ctx);
    },

    event: async ({ event }) => {
      const p = event.properties || {};
      if (event.type === 'session.created') {
        const info = p.info || {};
        if (info.parentID) { children.add(info.id); return; } // subagents never drive the project
        if (sessions.get(info.id)?.context !== undefined) return; // its first request came before the announcement
        start(info.id, info.directory);
        seen(harness, 'session', { by: event.type, context: !!sessions.get(info.id)?.context });
        return;
      }
      if (event.type === 'message.updated') {
        const m = p.info || {};
        if (m.role !== 'assistant' || !m.time?.completed || !m.tokens) return;
        const t = contextTokens(m.tokens);
        if (!t) return;
        const s = at(m.sessionID);
        if (s.first == null) s.first = t;
        Object.assign(s, { last: t, model: m.modelID, cwd: m.path?.cwd });
        return;
      }
      // The end of a turn, which the host says twice in a row: "session.status" with an idle status, then "session.idle",
      // which its source marks as deprecated. Either one is enough, so the plugin goes on working when one is dropped;
      // the one that comes after the other is the same end of turn said again.
      if (event.type === 'session.idle' || (event.type === 'session.status' && p.status?.type === 'idle')) {
        const id = p.sessionID;
        if (idleBy.get(id) && idleBy.get(id) !== event.type) { idleBy.delete(id); return; }
        idleBy.set(id, event.type);
        const s = sessions.get(id);
        const begun = s?.context !== undefined; // the host said this session started, and the core was asked
        if (!children.has(id)) seen(harness, begun ? 'turn' : 'stray', { by: event.type, ...(begun && { tokens: s.last ?? null }) });
        // A one-shot run leaves with this very event: a handoff asked now would start a turn the process does not wait
        // for, and a fresh session nobody is there to go on in. The session had its context at the start; no more.
        if (started === 'run') return;
        if (!s) return; // not a session this plugin saw start (or a subagent)
        const out = runHook('stop', {
          cwd: s.cwd || directory, session_id: id, pid: process.pid, ...(unseen && { fresh_note: FRESH_NOTE_1X }),
          context_tokens: s.last, first_tokens: s.first, model: s.model, context_window: s.window, stop_hook_active: !!s.asked,
        }, harness);
        s.asked = false;
        if (!out) return;
        if (out.decision === 'block') { s.asked = true; return say(id, out.reason); }
        if (out.reopen_prompt) { toast(out.stopReason); return reopen(out.reopen_prompt, s.cwd); }
        if (out.continue === false && out.stopReason) return toast(out.stopReason, 'warning');
        if (out.systemMessage) return toast(out.systemMessage, 'warning');
      }
    },
  };
};
export const Driftless = serverFor('opencode', { headers: basicAuth('OPENCODE', 'opencode') });

// ---------- OpenCode 2.x ----------
// What 2.x does not give a server plugin, and what Driftless does about it:
// - no way to show a session in the terminal UI: the fresh session is created and started, and the handoff request tells
//   the model to say where it is (the session list), so nobody waits for a window that does not change by itself;
// - no toast: what the core says to the user goes to the log;
// - no way to tell a one-shot "run" from someone at the terminal: the plugin lives in the server, a process of its own
//   ("serve", the background service or the private one of --standalone), and a session does not say who drives it. A
//   "run" that goes over the cap is asked for the handoff like any other session.
// The handoff agent: an agent a plugin updates is created when it is not there (the editor's update, in the host's
// source). What it may not use is said as the host's permission rules, where the last rule that matches wins.
const HANDOFF_DENIED = ['shell', 'webfetch', 'websearch', 'subagent', 'question'];
const FRESH_NOTE = 'On OpenCode 2 the fresh session does not come to the front by itself: tell the user it is in the session list, ' +
  `named "${RESUME_TITLE}".`;
async function setup(ctx) {
  // OpenCode 1.x (seen by others on 1.18) also calls default.setup, with its own context: that one is served above.
  if (typeof ctx?.session?.hook !== 'function' || typeof ctx.session.synthetic !== 'function') return;
  const here = ctx.location?.directory;
  const sessions = new Map(); // id → { context, child, cwd, first, last, model, window, asked, noted }
  const at = (id) => sessions.get(id) || sessions.set(id, {}).get(id);
  const log = (text) => { if (text) console.error(`[driftless] ${text}`); };
  seen('opencode', 'loaded', { api: "OpenCode's 2.x plugin API" });

  // Without the agent the handoff request falls back to the steps of agents/handoff.md: a host that refuses it changes
  // who does the handoff, not whether it is done.
  try {
    const { description, prompt } = handoffAgent({});
    await ctx.agent?.transform?.((editor) => editor.update(HANDOFF_AGENT, (agent) => {
      Object.assign(agent, { name: 'Driftless handoff', description, system: prompt, mode: 'subagent' });
      (agent.permissions ||= []).push(...HANDOFF_DENIED.map((action) => ({ action, resource: '*', effect: 'deny' })));
    }));
  } catch (e) { log(e.message); }

  // Once per session: is it a subagent's (they never drive the project), where does it work, what does the core say.
  async function start(id, cwd) {
    const s = at(id);
    if (s.context !== undefined || s.child) return s;
    const info = await ctx.session.get({ sessionID: id }).catch(() => null);
    if (info?.parentID) { s.child = true; return s; }
    s.cwd = cwd || info?.location?.directory || info?.directory || here;
    const out = runHook('session-start', { cwd: s.cwd, session_id: id, pid: process.pid }, 'opencode');
    s.context = out?.hookSpecificOutput?.additionalContext || null;
    return s;
  }
  // The model's context window, for a cap given as a percentage. Asked once per model.
  const windows = new Map();
  async function windowOf(model) {
    const key = `${model?.providerID}/${model?.id}`;
    if (!model?.id || windows.has(key)) return windows.get(key) || null;
    let size = null;
    try {
      const list = await ctx.model.list(); // { location, data }: the one answer here the host does not unwrap
      const all = Array.isArray(list) ? list : list?.data || [];
      size = all.find((m) => m.providerID === model.providerID && m.id === model.id)?.limit?.context || null;
    } catch { /* not told: the core falls back to its own estimate */ }
    windows.set(key, size);
    return size;
  }

  // A fresh session, started with the resume prompt. No gesture, but nothing brings it to the front. Its folder is said:
  // a session created without one is in the folder the server was started in, which is not the project's.
  async function reopen(prompt, cwd) {
    const created = await ctx.session.create({ title: RESUME_TITLE, location: { directory: cwd || here } }).catch(() => null);
    if (!created?.id) return log('handoff done, but no new session could be created. Start one and say "resume".');
    await start(created.id, cwd);
    await ctx.session.prompt({ sessionID: created.id, text: prompt });
  }

  await ctx.session.hook('context', async (event) => {
    try {
      const s = await start(event.sessionID);
      if (s.child) return;
      if (!s.noted) { s.noted = true; seen('opencode', 'session', { by: 'context', context: !!s.context }); }
      if (event.model?.id) Object.assign(s, { model: event.model.id, window: await windowOf(event.model) });
      if (s.context) event.system.push({ type: 'text', text: s.context });
    } catch (e) { log(e.message); } // a hook that fails would fail the user's request
  });

  await ctx.session.hook('experimental.idle', async (event) => {
    try {
      const id = event.sessionID;
      const s = sessions.get(id);
      if (s?.child) return;
      if (!s || s.context === undefined) return void seen('opencode', 'stray', { by: 'experimental.idle' }); // not a session this plugin saw start
      // Its own subagent or shell still at work (the handoff itself, for one): the hook runs again when that ends.
      if ((event.background || []).some((w) => w.sessionID === id)) return;
      seen('opencode', 'turn', { by: 'experimental.idle', tokens: s.last ?? null });
      const out = runHook('stop', {
        cwd: s.cwd || here, session_id: id, pid: process.pid, fresh_note: FRESH_NOTE,
        context_tokens: s.last, first_tokens: s.first, model: s.model, context_window: s.window, stop_hook_active: !!s.asked,
      }, 'opencode');
      s.asked = false;
      if (!out) return;
      if (out.decision === 'block') { s.asked = true; return void await ctx.session.synthetic({ sessionID: id, text: out.reason }); }
      if (out.reopen_prompt) return void await reopen(out.reopen_prompt, s.cwd);
      log(out.continue === false ? out.stopReason : out.systemMessage);
    } catch (e) { log(e.message); }
  });

  // The real context of each response. Every session of the server passes here: only those seen starting are kept.
  const controller = new AbortController();
  void (async () => {
    try {
      for await (const event of ctx.event.subscribe({ types: ['session.step.ended'], signal: controller.signal })) {
        const d = event.data || {};
        const s = sessions.get(d.sessionID);
        const t = contextTokens(d.tokens);
        if (!s || s.child || !t) continue;
        if (s.first == null) s.first = t;
        s.last = t;
      }
    } catch (e) { if (!controller.signal.aborted) log(e.message); }
  })();
  return () => controller.abort();
}

export default { id: 'driftless', server: Driftless, setup };
