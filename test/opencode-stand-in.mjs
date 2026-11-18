// A stand-in for OpenCode's plugin host, run by test/hooks.test.mjs inside its throwaway home: it loads
// opencode/driftless.js the way each OpenCode generation does, replays one short session over the cap, and prints what
// the plugin did. It checks the plugin against the documented API, not against OpenCode: nothing here runs OpenCode.
//   node opencode-stand-in.mjs <1|2> <project folder> [<opencode's arguments>]
//     what the user typed after "opencode": the 1.x plugin reads how OpenCode was started in the command line of the
//     process it runs in (none: "opencode" alone, the terminal UI)
import fs from 'node:fs';
import path from 'node:path';
import plugin, { Driftless } from '../opencode/driftless.js';

const [generation, root, ...typed] = process.argv.slice(2);
process.argv = [process.argv[0], 'opencode', ...typed];
const out = { said: [], created: [], prompted: [], toasts: [], logs: [], fetched: [] };
const handoffDone = (id) => fs.writeFileSync(path.join(root, '.driftless', 'handoff.json'), JSON.stringify({ session_id: id }));
const tick = () => new Promise((r) => setImmediate(r));

if (generation === '1') {
  // The route that shows a session in the terminal UI is not in the plugin's client: the plugin calls the server itself.
  globalThis.fetch = async (url, init) => { out.fetched.push({ path: new URL(url).pathname, headers: init.headers, body: JSON.parse(init.body) }); return { ok: true }; };
  const client = {
    tui: { showToast: async ({ body }) => { out.toasts.push(body.message); } },
    app: { log: async ({ body }) => { out.logs.push(body); } },
    session: {
      promptAsync: async ({ path: p, body }) => { out.said.push({ sessionID: p.id, text: body.parts[0].text }); },
      create: async ({ body }) => { out.created.push(body); return { data: { id: 's2' } }; },
    },
  };
  const hooks = await Driftless({ client, directory: root, serverUrl: 'http://127.0.0.1:9' });
  const event = (type, properties) => hooks.event({ event: { type, properties } });
  // The config hook gets the config already parsed: what it adds is read as it is.
  const cfg = { agent: {} };
  await hooks.config(cfg);
  out.agent = cfg.agent['driftless-handoff'];
  await event('session.created', { info: { id: 's1', directory: root } });
  await event('session.created', { info: { id: 'child', parentID: 's1', directory: root } });
  const system = { system: [] };
  await hooks['experimental.chat.system.transform']({ sessionID: 's1' }, system);
  const childSystem = { system: [] };
  await hooks['experimental.chat.system.transform']({ sessionID: 'child' }, childSystem);
  for (const t of [30_000, 120_000]) {
    await event('message.updated', { info: { role: 'assistant', sessionID: 's1', time: { completed: 1 }, tokens: { input: 10, cache: { read: t - 10, write: 0 } }, modelID: 'm' } });
  }
  await event('session.idle', { sessionID: 's1' });
  handoffDone('s1');
  await event('session.idle', { sessionID: 's1' });
  Object.assign(out, { system: system.system, childSystem: childSystem.system, sameServer: plugin.server === Driftless });
} else {
  const hooks = {};
  const waiting = [];
  let wake = null;
  const emit = async (type, data) => { waiting.push({ id: 'e', type, data }); wake?.(); await tick(); await tick(); };
  const ctx = {
    location: { directory: root },
    session: {
      hook: async (name, cb) => { hooks[name] = cb; return { dispose: async () => {} }; },
      get: async ({ sessionID }) => (sessionID === 'child' ? { id: 'child', parentID: 's1' } : { id: sessionID }),
      synthetic: async (x) => { out.said.push(x); },
      create: async (x) => { out.created.push(x); return { id: 's2' }; },
      prompt: async (x) => { out.prompted.push(x); },
    },
    // The host unwraps an answer that is { data } alone; the model list comes with its location, as it is.
    model: { list: async () => ({ location: { directory: root }, data: [{ providerID: 'p', id: 'm', modelID: 'm', limit: { context: 400_000, output: 32_000 } }] }) },
    // The agent editor, as the host's own: update makes the agent when it is not there, from the host's defaults.
    agent: {
      transform: async (cb) => {
        const agents = new Map();
        cb({
          list: () => [...agents.values()], get: (id) => agents.get(id), remove: (id) => agents.delete(id),
          update: (id, fn) => {
            const a = agents.get(id) || { id, name: id, mode: 'primary', hidden: false, permissions: [{ action: '*', resource: '*', effect: 'allow' }] };
            agents.set(id, a); fn(a); a.id = id;
          },
        });
        out.agents = Object.fromEntries(agents);
        return { dispose: async () => {} };
      },
    },
    event: {
      subscribe: ({ types, signal }) => {
        out.subscribed = types;
        return (async function* events() {
          while (!signal.aborted) {
            while (waiting.length) yield waiting.shift();
            await new Promise((r) => { wake = r; signal.addEventListener('abort', r, { once: true }); });
          }
        })();
      },
    },
  };
  out.oldHost = (await plugin.setup({ client: {}, directory: root })) === undefined; // OpenCode 1.x calling default.setup
  const cleanup = await plugin.setup(ctx);
  const first = { sessionID: 's1', model: { providerID: 'p', id: 'm' }, system: [] };
  await hooks.context(first);
  await hooks.context({ sessionID: 's1', model: { providerID: 'p', id: 'm' }, system: [] }); // the session's second request
  const child = { sessionID: 'child', model: { providerID: 'p', id: 'm' }, system: [] };
  await hooks.context(child);
  for (const t of [30_000, 120_000]) await emit('session.step.ended', { sessionID: 's1', tokens: { input: 10, output: 5, cache: { read: t - 10, write: 0 } } });
  await emit('session.step.ended', { sessionID: 'child', tokens: { input: 900_000, cache: { read: 0, write: 0 } } });
  // The handoff subagent still at work: the plugin waits for the hook to come back.
  await hooks['experimental.idle']({ sessionID: 's1', background: [{ kind: 'subagent', sessionID: 's1', childSessionID: 'child' }] });
  out.saidWhileBusy = out.said.length;
  await hooks['experimental.idle']({ sessionID: 's1', background: [] });
  await hooks['experimental.idle']({ sessionID: 'child', background: [] });
  await hooks['experimental.idle']({ sessionID: 'old', background: [] }); // a session that made no request since the plugin loaded
  handoffDone('s1');
  await hooks['experimental.idle']({ sessionID: 's1', background: [] });
  const fresh = { sessionID: 's2', model: { providerID: 'p', id: 'm' }, system: [] };
  await hooks.context(fresh);
  await cleanup();
  Object.assign(out, { system: first.system, childSystem: child.system, freshSystem: fresh.system, id: plugin.id });
}
process.stdout.write(JSON.stringify(out));
