// Driftless for Amp: the same core as every other harness (scripts/driftless.mjs), run in-process from Amp's plugin
// API, so it needs nothing but Amp itself (which runs its plugins with Bun).
//
//   session start      the first agent.start of a thread this plugin has not seen
//   context injected   agent.start's result: a message appended to the user's own, not displayed
//   tokens             usage of the assistant messages agent.end brings
//   end of a turn      agent.end
//   go on              agent.end's result: { action: 'continue', userMessage }
//   fresh session      createThread({ show: true }) on the thread's own agent, then appendUserMessage
//   handoff subagent   a tool, driftless_handoff: the thread's own agent, run once as a child thread
//
// Written from Amp's plugin API page (ampcode.com/manual/plugin-api) and never run in Amp: test/ drives it with a
// stand-in for that API.
//
// What Amp tells the plugin is written down as it comes (seen: loaded, session, turn, stray), for "doctor amp" to read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runHook, seen } from '../scripts/driftless.mjs';

export const description = 'Driftless: hands the project off to a fresh thread before carrying the context costs more than starting again.';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HANDOFF_FILE = path.join(ROOT, 'agents', 'handoff.md');
const HANDOFF_TOOL = 'driftless_handoff';
const HANDOFF_MINUTES = 10; // waitForResponse's own default

// The context a response left behind: what was sent, cached or not. Amp names the three figures as Anthropic does,
// where they add up; a provider that counts its cached tokens inside inputTokens would make this read high, which
// asks for the handoff early, never late.
const contextTokens = (u) => (u ? (u.inputTokens || 0) + (u.cacheReadInputTokens || 0) + (u.cacheCreationInputTokens || 0) : 0);
const measured = (messages) => (Array.isArray(messages) ? messages : []).filter((m) => m?.role === 'assistant' && contextTokens(m.usage) > 0);
const textOf = (message) => (message?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim();

export default function driftless(amp) {
  const sessions = new Map(); // thread id → { context, told, child, cwd, first, last, model, asked, noted }
  const at = (id) => sessions.get(id) || sessions.set(id, {}).get(id);
  const log = (text) => { try { amp.logger.log(`[driftless] ${text}`); } catch { /* no logger: nothing to say it with */ } };
  // What the core says to the user. A client without an interface (amp -x) has no notification: the log keeps it.
  // Never waited for: a handler's answer must not hang on a notification.
  const tell = (ctx, text) => { if (text) Promise.resolve().then(() => ctx.ui.notify(text)).catch(() => log(text)); };
  // The folder the user has open; Amp without a workspace has none, and Driftless does nothing there.
  const workspace = () => {
    try { return amp.system.workspaceRoot ? amp.helpers.filePathFromURI(amp.system.workspaceRoot) : null; } catch { return null; }
  };

  // Once per thread: a thread with a parent is a subagent's and never drives the project; any other gets the core's
  // session start, whose text is what the thread starts from. "thread" is the handle of the handler's own thread, the
  // only one Amp answers for about its parent.
  async function start(id, thread) {
    const s = at(id);
    if (s.context !== undefined || s.child) return s;
    s.cwd = workspace();
    if (!s.cwd) { s.context = null; return s; }
    let parent = null;
    try { parent = thread ? await thread.parentThreadID() : null; } catch { /* not told: a thread of its own */ }
    if (parent) { s.child = true; return s; }
    const out = runHook('session-start', { cwd: s.cwd, session_id: id, pid: process.pid }, 'amp');
    s.context = out?.hookSpecificOutput?.additionalContext || null;
    s.note = out?.systemMessage || null;
    return s;
  }

  // The thread's first request, which says what a fresh start costs: read from the thread itself, so a plugin
  // reloaded in the middle of a thread does not take a later request for the first.
  async function firstTokens(thread, seen) {
    try {
      const [first] = await thread.messages({ full: true, from: 'start', limit: 1, roles: ['assistant'] });
      return contextTokens(first?.usage) || seen;
    } catch { return seen; }
  }

  // A fresh thread in the same client: created on the thread's own agent, shown, and started with the resume prompt.
  // Nothing in Amp's documentation says agent.start fires for a message a plugin appends, so the context travels with
  // the prompt itself; if agent.start does fire for it, the thread is already marked as told.
  async function reopen(ctx, prompt) {
    let thread = null;
    try { thread = await (await ctx.thread.agent()).createThread({ show: true }); } catch (e) { log(e.message); }
    if (!thread?.id) return tell(ctx, 'Driftless: handoff done, but no new thread could be created. Start one and say "resume".');
    const s = await start(thread.id, null);
    s.told = true;
    try {
      await thread.appendUserMessage({ type: 'user-message', content: s.context ? `${prompt}\n\n${s.context}` : prompt });
    } catch (e) {
      s.told = false; // nothing reached it: the user's own first message there brings the context
      log(e.message);
      tell(ctx, 'Driftless: handoff done and a fresh thread created, but it could not be started. Say "resume" there.');
    }
  }

  amp.on('agent.start', async (event, ctx) => {
    try {
      const s = await start(event.thread.id, ctx.thread);
      if (!s.child && !s.noted) { s.noted = true; seen('amp', 'session', { by: 'agent.start', context: !!s.context }); }
      if (s.note) { tell(ctx, s.note); s.note = null; }
      if (s.child || !s.context || s.told) return;
      s.told = true;
      return { message: { content: s.context } };
    } catch (e) { log(e.message); } // a handler that fails would fail the user's prompt
  });

  amp.on('agent.end', async (event, ctx) => {
    try {
      const id = event.thread.id;
      const s = sessions.get(id);
      if (s?.child) return;
      if (!s || s.context === undefined) return void seen('amp', 'stray', { by: 'agent.end' }); // not a thread this plugin saw start
      if (!s.cwd) return;
      const used = measured(event.messages);
      if (used.length) {
        const last = used[used.length - 1].usage;
        if (s.first == null) s.first = await firstTokens(ctx.thread, contextTokens(used[0].usage));
        Object.assign(s, { last: contextTokens(last), model: last.model || s.model });
      }
      seen('amp', 'turn', { by: `agent.end, ${event.status}`, tokens: s.last ?? null });
      if (event.status !== 'done') return; // stopped by the user, or failed: nothing is asked of a turn that did not end
      const out = runHook('stop', {
        cwd: s.cwd, session_id: id, pid: process.pid,
        context_tokens: s.last, first_tokens: s.first, model: s.model, stop_hook_active: !!s.asked,
      }, 'amp');
      s.asked = false;
      if (!out) return;
      // Amp sends the agent back to work itself, and stops doing so after five plugin turns in a row.
      if (out.decision === 'block') { s.asked = true; tell(ctx, out.systemMessage); return { action: 'continue', userMessage: out.reason }; }
      if (out.reopen_prompt) { tell(ctx, out.stopReason); return void await reopen(ctx, out.reopen_prompt); }
      tell(ctx, out.continue === false ? out.stopReason : out.systemMessage);
    } catch (e) { log(e.message); }
  });

  // The handoff, away from the thread that asks for it: the thread's own agent (same mode, same model) in a child
  // thread, with the instructions every harness shares. The child is marked before its first message, so it never
  // counts as a session of its own whatever Amp says of its parent. Registered apart: an Amp that takes no tools from
  // plugins still gets everything else, and the handoff request falls back to the steps of agents/handoff.md.
  let tool = true;
  try {
    const instructions = fs.readFileSync(HANDOFF_FILE, 'utf8').replace(/^---[\s\S]*?---\s*/, '');
    amp.registerTool({
      name: HANDOFF_TOOL,
      title: 'Driftless handoff',
      defer: false, // asked for when the context is already large: no search for it then
      description: 'Runs the Driftless handoff in a subagent: it updates the project documents and writes .driftless/handoff.json. Call it only when Driftless asks for a handoff or the user says "handoff".',
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'The project folder.' },
          session_id: { type: 'string', description: 'This session id, as Driftless gave it.' },
          summary: { type: 'string', description: 'What was done, what was decided, what is in progress, the exact next step, anything still running; and whether the user is stopping for now.' },
        },
        required: ['folder', 'session_id', 'summary'],
      },
      async execute(input, ctx) {
        const thread = await (await ctx.thread.agent()).createThread({ parentThreadID: ctx.thread.id });
        at(thread.id).child = true;
        const cancel = () => { Promise.resolve().then(() => thread.cancel()).catch(() => {}); };
        ctx.signal?.addEventListener('abort', cancel, { once: true });
        try {
          const reply = thread.waitForResponse({ timeoutMs: HANDOFF_MINUTES * 60_000 }); // asked first: the turn may be quick
          reply.catch(() => {});
          await thread.appendUserMessage({
            type: 'user-message',
            content: [instructions.trim(), '',
              `Project folder: ${input.folder}`,
              'Session transcript: none (Amp gives no file: rely on the summary)',
              `Session id: ${input.session_id}`,
              'Summary of the session:', String(input.summary ?? '')].join('\n'),
          });
          return textOf(await reply) || 'The handoff subagent ended without a report: check that .driftless/handoff.json is written.';
        } catch (e) {
          throw new Error(`The handoff subagent did not finish (${e.message}). If ${path.join(String(input.folder), '.driftless', 'handoff.json')} is not written, follow ${HANDOFF_FILE} yourself.`);
        } finally {
          ctx.signal?.removeEventListener('abort', cancel);
        }
      },
    });
  } catch (e) { tool = false; log(`no handoff tool: ${e.message}`); }
  seen('amp', 'loaded', { api: "Amp's plugin API", tool });
}
