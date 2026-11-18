// Driftless for Kilo Code: Kilo's CLI is a fork of OpenCode and loads the same kind of plugin, in its terminal UI and
// in the server its VS Code extension starts. So this is OpenCode's plugin (opencode/driftless.js, the 1.x half) under
// Kilo's name, with what Kilo says its own way:
//
//   the plugin         a default export { id, server } and nothing else: the id is required of a local file
//   the handoff agent  what it may use is a "permission" map, not a switch per tool
//   Kilo's server      asks for the user's password when one is set (KILO_SERVER_PASSWORD): the request that brings
//                      the fresh session to the front carries it, as Kilo's own client does
//   the end of a turn  two events in a row, "session.status" idle and the deprecated "session.idle": either is taken,
//                      once (in the shared plugin, so for OpenCode too)
//   inside an editor   no terminal UI shows a toast or a session: the fresh session is created and started, the handoff
//                      request tells the model to say where it is, and what the core says to the user goes to Kilo's log.
//                      An editor says who it is (KILO_CLIENT) and starts "kilo serve"; "kilo serve" by hand is the same
//                      thing without the name, and the shared plugin reads it in the command line (startedAs)
//
// Written from Kilo's documentation (kilo.ai/docs: plugins, CLI, custom modes) and from its source at 7.8.28
// (packages/plugin, packages/sdk, packages/opencode/src/plugin, packages/kilo-vscode): never run in Kilo. test/ drives
// it with a stand-in.
import { serverFor, basicAuth } from '../opencode/driftless.js';

const server = serverFor('kilo', {
  agentAccess: { permission: { bash: 'deny', webfetch: 'deny' } },
  headers: basicAuth('KILO', 'kilo'),
  // Kilo's own command line leaves KILO_CLIENT unset ("cli"); whoever else starts its server says who it is ("vscode",
  // "jetbrains", and "acp" for an editor that speaks ACP), and has no terminal UI.
  unseen: () => (process.env.KILO_CLIENT || 'cli') !== 'cli',
  interactiveRun: true, // "kilo run --interactive" stays open, as --mini does
});

export default { id: 'driftless', server };
