// A stand-in for Amp's plugin host, run by test/hooks.test.mjs inside its throwaway home: it loads amp/driftless.js the
// way Amp does (a default function given the plugin API), replays one short thread over the cap, and prints what the
// plugin did. It checks the plugin against the documented API, not against Amp: nothing here runs Amp.
//   node amp-stand-in.mjs [switches] <project folder> [no-workspace | no-tools | reloaded]
//     switches   what Amp itself was started with (-x, --stream-json-input): the plugin reads them on its own process
//     reloaded   the plugin loaded in the middle of a thread: the end of a turn whose start it was not there for
//     no-tools   an Amp that takes no tools from plugins: the handoff tool is refused, the rest goes on
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import plugin, { description } from '../amp/driftless.js';

const [root, mode] = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const out = { created: [], appended: [], notified: [], logged: [], read: [], waited: [], description };
const handoffDone = (id) => fs.writeFileSync(path.join(root, '.driftless', 'handoff.json'), JSON.stringify({ session_id: id }));
const tick = () => new Promise((r) => setImmediate(r));
const usage = (t) => ({ model: 'anthropic/claude-x', inputTokens: 10, outputTokens: 5, cacheCreationInputTokens: 20, cacheReadInputTokens: t - 30 });
const answer = (t) => ({ role: 'assistant', id: `m${t}`, stopReason: 'end_turn', usage: usage(t), content: [{ type: 'text', text: 'ok' }] });
const prompt = { role: 'user', id: 'u1', content: [{ type: 'text', text: 'go on' }] };

// Threads as the API hands them out. "history" is what thread.messages() reads from; "parent" what Amp says of it.
const threads = new Map();
let made = 0;
function thread(id, { parent = null, history = [] } = {}) {
  const t = {
    id,
    parentThreadID: async () => parent,
    agent: async () => ({
      createThread: async (options = {}) => {
        const child = thread(`T-new${++made}`); // what Amp says of a thread a plugin made is not relied on: no parent here
        out.created.push({ from: id, id: child.id, ...options });
        return child;
      },
    }),
    messages: async (options) => {
      out.read.push({ id, ...options });
      const list = history.filter((m) => !options.roles || options.roles.includes(m.role));
      return (options.from === 'start' ? list : list.slice().reverse()).slice(0, options.limit);
    },
    appendUserMessage: async (message) => { out.appended.push({ id, ...message }); },
    waitForResponse: async (options) => { out.waited.push({ id, ...options }); await tick(); return { role: 'assistant', id: 'r', content: [{ type: 'text', text: 'Handoff written.' }] }; },
    cancel: async () => {},
  };
  threads.set(id, t);
  return t;
}

const handlers = {};
const tools = {};
const amp = {
  logger: { log: (text) => { out.logged.push(text); } },
  system: { workspaceRoot: mode === 'no-workspace' ? null : pathToFileURL(root).href },
  helpers: { filePathFromURI: (uri) => fileURLToPath(uri) },
  on: (name, handler) => { handlers[name] = handler; return { unsubscribe() {} }; },
  registerTool: (definition) => {
    if (mode === 'no-tools') throw new Error('plugins cannot register tools');
    tools[definition.name] = definition;
    return { unsubscribe() {} };
  },
};
// No interface, as in "amp -x": a notification is refused and the plugin falls back to the log.
const ctx = (id, ui = true) => ({ thread: threads.get(id), ui: { notify: async (text) => { if (!ui) throw new Error('UI not available'); out.notified.push(text); } } });
const start = (id) => handlers['agent.start']({ thread: { id }, message: 'go on', id: 'u1' }, ctx(id));
const end = (id, status, tokens, ui) => handlers['agent.end']({ thread: { id }, message: 'go on', id: 'u1', status, messages: [prompt, ...tokens.map(answer)] }, ctx(id, ui));

out.loaded = plugin(amp) === undefined;
out.tool = { name: tools.driftless_handoff?.name, defer: tools.driftless_handoff?.defer, required: tools.driftless_handoff?.inputSchema.required };
thread('T-1', { history: [prompt, answer(20_000), answer(120_000)] });
thread('T-sub', { parent: 'T-1' });

if (mode === 'reloaded') {
  out.end = await end('T-1', 'done', [120_000]) ?? null;
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
out.first = await start('T-1');
out.second = await start('T-1') ?? null;
out.sub = await start('T-sub') ?? null;
if (mode !== 'no-workspace') {
  // The user stops a turn that is already over the cap: measured, nothing asked.
  out.cancelled = await end('T-1', 'cancelled', [30_000, 120_000]) ?? null;
  out.asked = await end('T-1', 'done', [30_000, 120_000]);
  out.subEnd = await end('T-sub', 'done', [900_000]) ?? null;
  // The agent calls the handoff tool: a child thread of its own agent, which gets no context and asks for nothing.
  if (mode !== 'no-tools') {
    out.report = await tools.driftless_handoff.execute({ folder: root, session_id: 'T-1', summary: 'Did the thing; next: the other thing.' },
      { thread: threads.get('T-1'), signal: new AbortController().signal });
    const child = out.created[0].id;
    out.childStart = await start(child) ?? null;
    out.childEnd = await end(child, 'done', [900_000]) ?? null;
  }
  handoffDone('T-1');
  out.done = await end('T-1', 'done', [121_000], false) ?? null;
  await tick();
  const fresh = out.created.find((c) => c.show)?.id;
  out.freshStart = fresh ? await start(fresh) ?? null : 'no fresh thread';
  out.freshEnd = fresh ? await end(fresh, 'done', [25_000]) ?? null : 'no fresh thread';
}
process.stdout.write(JSON.stringify(out));
