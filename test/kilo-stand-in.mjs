// A stand-in for Kilo Code's plugin host, run by test/hooks.test.mjs inside its throwaway home: it loads the file
// "install kilo" wrote the way Kilo's loader does (a local file must default-export { id, server }), replays one short
// session over the cap with events in the shape of Kilo's SDK, and prints what the plugin did. It checks the plugin
// against Kilo's documentation and source, not against Kilo: nothing here runs Kilo.
//   node kilo-stand-in.mjs <installed plugin file> <project folder> [status-only | no-create | load-only | resumed | resumed-… | no-tokens | -] [-- <kilo's arguments>]
//     status-only   a Kilo that no longer publishes the deprecated "session.idle"
//     no-create     a Kilo that gives no fresh session back
//     load-only     a Kilo that loads the plugin and never calls it again
//     resumed       sessions Kilo does not announce: they were there before Kilo started. Asked, it says whose they are
//     resumed-mute  the same, and a Kilo that fails when asked
//     resumed-hang  the same, and a Kilo that never answers
//     resumed-late  a session Kilo announces after its first request
//     resumed-crossed  a session Kilo announces while it is being asked whose it is: the answer comes after
//     no-tokens     a Kilo whose messages say nothing of their tokens
//     after --      what the user typed after "kilo": the plugin reads how Kilo was started in the command line of the
//                   process it runs in (none: "kilo" alone, the terminal UI)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const given = process.argv.slice(2);
const cut = given.indexOf('--');
const [file, root, mode] = cut < 0 ? given : given.slice(0, cut);
process.argv = [process.argv[0], 'kilo', ...(cut < 0 ? [] : given.slice(cut + 1))];
const out = { said: [], created: [], toasts: [], logs: [], fetched: [], asked: [] };
let answer = () => {}; // resumed-crossed: what lets Kilo's held answer go
const handoffDone = (id) => fs.writeFileSync(path.join(root, '.driftless', 'handoff.json'), JSON.stringify({ session_id: id }));

// Kilo's loader (packages/opencode/src/plugin/shared.ts, readV1Plugin and resolvePluginId): the default export is an
// object, its server is a function, it has no tui, and a plugin loaded from a path says its id.
const mod = await import(pathToFileURL(file).href);
const plugin = mod.default;
out.exports = Object.keys(mod);
if (!plugin || typeof plugin !== 'object' || typeof plugin.server !== 'function' || plugin.tui !== undefined) throw new Error('not a server plugin');
if (typeof plugin.id !== 'string' || !plugin.id.trim()) throw new Error('a path plugin must export id');
out.id = plugin.id;

// The route that shows a session in the terminal UI is not in the plugin's client: the plugin calls the server itself.
globalThis.fetch = async (url, init) => { out.fetched.push({ path: new URL(url).pathname, headers: init.headers, body: JSON.parse(init.body) }); return { ok: true }; };
const client = {
  tui: { showToast: async ({ body }) => { out.toasts.push(body.message); } },
  app: { log: async ({ body }) => { out.logs.push(body); } },
  session: {
    promptAsync: async ({ path: p, body }) => { out.said.push({ sessionID: p.id, text: body.parts[0].text }); },
    create: async ({ body }) => { out.created.push(body); return mode === 'no-create' ? {} : { data: { id: 'ses_2' } }; },
    get: async ({ path: p }) => {
      out.asked.push(p.id);
      if (mode === 'resumed-mute') throw new Error('no such route');
      if (mode === 'resumed-hang') return new Promise(() => {});
      const info = { data: { id: p.id, directory: root, ...(p.id === 'ses_child' && { parentID: 'ses_1' }) } };
      if (mode === 'resumed-crossed' && p.id === 'ses_1') return new Promise((r) => { answer = () => r(info); });
      return info;
    },
  },
};
const hooks = await plugin.server({ client, directory: root, worktree: root, project: {}, serverUrl: new URL('http://127.0.0.1:4096') });
if (mode === 'load-only') { process.stdout.write(JSON.stringify(out)); process.exit(0); }
// Kilo hands a plugin every event of its directory as { id, type, properties }.
const event = (type, properties) => hooks.event({ event: { id: 'evt', type, properties } });

// The config hook gets the resolved config: an agent the user defined under the same name stays theirs.
const cfg = { agent: { mine: { mode: 'primary' } } };
await hooks.config(cfg);
const own = { agent: { 'driftless-handoff': { model: 'p/m' } } };
await hooks.config(own);
Object.assign(out, { agents: cfg.agent, ownAgent: own.agent['driftless-handoff'] });

if (!String(mode).startsWith('resumed')) {
  await event('session.created', { info: { id: 'ses_1', directory: root } });
  await event('session.created', { info: { id: 'ses_child', parentID: 'ses_1', directory: root } });
}
await hooks['chat.params']({ sessionID: 'ses_1', agent: 'code', model: { id: 'm', providerID: 'p', limit: { context: 400_000, output: 8_000 } } }, {});
const system = { system: [] };
const first = hooks['experimental.chat.system.transform']({ sessionID: 'ses_1', model: {} }, system);
if (mode === 'resumed-crossed') {
  await new Promise((r) => { setImmediate(r); }); // the plugin has asked, and waits
  await event('session.created', { info: { id: 'ses_1', directory: root } });
  answer();
}
await first;
if (mode === 'resumed-late') await event('session.created', { info: { id: 'ses_1', directory: root } });
const childSystem = { system: [] };
await hooks['experimental.chat.system.transform']({ sessionID: 'ses_child', model: {} }, childSystem);
// The session's second request, and one that names no session (Kilo writing an agent for the user).
const again = { system: [] };
await hooks['experimental.chat.system.transform']({ sessionID: 'ses_1', model: {} }, again);
await hooks['experimental.chat.system.transform']({ model: {} }, { system: [] });
out.againSystem = again.system;
out.waiting = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length; // timers the plugin left running
for (const t of [30_000, 120_000]) {
  await event('message.updated', { info: { id: 'msg', role: 'assistant', sessionID: 'ses_1', time: { created: 1, completed: 2 }, modelID: 'm', providerID: 'p',
    path: { cwd: root, root }, cost: 0, ...(mode !== 'no-tokens' && { tokens: { input: 10, output: 5, reasoning: 0, cache: { read: t - 10, write: 0 } } }) } });
}
// The end of a turn as Kilo says it (SessionStatus.set): the status, then the deprecated event, back to back.
const idle = async () => {
  await event('session.status', { sessionID: 'ses_1', status: { type: 'idle' } });
  if (mode !== 'status-only') await event('session.idle', { sessionID: 'ses_1' });
};
await event('session.status', { sessionID: 'ses_child', status: { type: 'idle' } }); // the subagent's own turn ends first
await idle();
out.saidAtFirstIdle = out.said.length;
await event('session.status', { sessionID: 'ses_1', status: { type: 'busy' } }); // the turn that runs the handoff
handoffDone('ses_1');
await idle();
Object.assign(out, { system: system.system, childSystem: childSystem.system });
process.stdout.write(JSON.stringify(out));
