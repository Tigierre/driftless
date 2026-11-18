// A stand-in for "codex app-server", for the doctor: it answers the three messages the doctor sends, in the shape Codex
// documents (openai/codex, codex-rs/app-server-protocol: HooksListParams, HooksListResponse, HookMetadata; camelCase on
// the wire, JSON lines on the standard streams, requests refused before "initialize"). It reads the hooks file of
// CODEX_HOME the way Codex would and gives each hook the trust the test asks for. No model, no network.
//   CODEX_STAND_IN = trusted | untrusted | modified | off | stop-untrusted | unlisted | old | mute
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

const mode = process.env.CODEX_STAND_IN || 'untrusted';
const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const file = path.join(home, 'hooks.json');
const say = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const wire = (event) => event[0].toLowerCase() + event.slice(1); // SessionStart -> sessionStart
const state = (event) => event.replace(/[A-Z]/g, (c, i) => (i ? '_' : '') + c.toLowerCase()); // SessionStart -> session_start

function hooks() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* no hooks file */ }
  const out = [];
  for (const [event, groups] of Object.entries(cfg.hooks || {})) {
    groups.forEach((g, gi) => (g.hooks || []).forEach((h, hi) => {
      const trust = mode === 'stop-untrusted' ? (event === 'Stop' ? 'untrusted' : 'trusted') : mode === 'off' ? 'trusted' : mode;
      out.push({
        key: `${file}:${state(event)}:${gi}:${hi}`, eventName: wire(event), handlerType: 'command', command: h.command, async: false,
        matcher: g.matcher ?? null, timeoutSec: h.timeout ?? 600, statusMessage: null, additionalContextLimit: h.additionalContextLimit ?? null,
        sourcePath: file, source: 'user', pluginId: null, environmentId: null, displayOrder: out.length,
        enabled: mode !== 'off', isManaged: false, currentHash: 'sha256:' + '0'.repeat(64), trustStatus: trust,
      });
    }));
  }
  return out;
}

let ready = false;
process.argv.includes('app-server') || process.exit(64);
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  let m;
  try { m = JSON.parse(line); } catch { return; }
  if (mode === 'mute') return; // a server that never answers, and stays when its input closes
  if (m.method === 'initialize') { ready = true; return say({ id: m.id, result: { userAgent: 'codex-stand-in/0' } }); }
  if (m.method === 'initialized') return;
  if (!ready) return say({ id: m.id, error: { code: -32600, message: 'Not initialized' } });
  if (m.method !== 'hooks/list' || mode === 'old') return say({ id: m.id, error: { code: -32601, message: `Method not found: ${m.method}` } });
  say({ method: 'stand-in/notification', params: {} }); // a notification in between, as a real server may send
  const cwd = m.params?.cwds?.[0] || process.cwd();
  if (mode === 'unlisted') return say({ id: m.id, result: { data: [{ cwd, hooks: [], warnings: [], errors: [{ path: file, message: 'unknown field `modules`' }] }] } });
  say({ id: m.id, result: { data: [{ cwd, hooks: hooks(), warnings: [], errors: [] }] } });
});
// Like the real one, it stays until its input closes.
if (process.env.CODEX_STAND_IN_PID) fs.writeFileSync(process.env.CODEX_STAND_IN_PID, String(process.pid));
if (mode === 'mute') setInterval(() => {}, 1000);
else process.stdin.on('end', () => process.exit(0));
