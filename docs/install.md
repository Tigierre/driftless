# Install, tool by tool

[← Back to the README](../README.md)

What you get depends on what the tool lets Driftless hang on to:

- **Level 1, hooks.** The tool runs Driftless when a session starts and when a turn ends. The session starts with the
  project's context, the size of the context is watched, the handoff is asked for by itself, and the fresh session
  opens by itself wherever the tool can open one. Where the hooks do not say the size of the context (Devin, Kiro), the
  handoff is asked for at the end of each step of the resume point instead, and the rest is the same.
- **Level 2, no hooks.** The method without the automation: the agent runs two commands because `AGENTS.md` tells it
  to. Nothing measures the context, and you start the next session.

| Tool | Level | Install | Tried live |
|---|---|---|---|
| Claude Code | 1 | plugin | **yes**: on Windows, at every change |
| Codex | 1 | `install codex` | no |
| Cursor | 1 | `install cursor` | no |
| OpenCode | 1 | `install opencode` | no (one early try, before the economic rule) |
| Kilo Code | 1 | `install kilo` | no |
| Amp | 1 | `install amp`, or `install amp <project folder>` | no |
| Qwen Code | 1 | `install qwen` | no |
| Gemini CLI | 1 | `install gemini` | no |
| Copilot CLI | 1 | `install copilot` | no |
| Devin | 1, no measure | `install devin` | no |
| Kiro | 1, no measure | `install kiro` (CLI), `install kiro <project folder>` (IDE) | no |
| Any other agent that reads `AGENTS.md` | 2 | `install generic <project folder>` | no |

"No" means written from the tool's own documentation and run in the tests on input in the documented shape, never in
the tool itself. If you use one of them, see [Help wanted](../README.md#help-wanted). The details, tool by tool, follow.

**Claude Code** — as a plugin:

```
/plugin marketplace add Tigierre/driftless
/plugin install driftless@driftless
```

To try it on one project only, from that project's folder (a local clone works as the marketplace, and runs from where it is):

```
claude plugin marketplace add Tigierre/driftless --scope local
claude plugin install driftless@driftless --scope local
```

**Codex, Cursor, OpenCode** — clone the repository (Node.js 20+), then once per tool (`<clone>` is the folder you cloned it
into; keep it, the hooks run from there):

```
node <clone>/scripts/driftless.mjs install codex      # hooks in ~/.codex/hooks.json + handoff agent
node <clone>/scripts/driftless.mjs install cursor     # hooks in ~/.cursor/hooks.json + handoff agent
node <clone>/scripts/driftless.mjs install opencode   # plugin in ~/.config/opencode/plugins/
```

`uninstall <tool>` removes exactly what `install` added; your other hooks stay as they are.

| | Claude Code | Codex | Cursor | OpenCode |
|---|---|---|---|---|
| Context at session start | ✅ | ✅ | ✅ | ✅ (system prompt) |
| Context measured | real tokens | real tokens (session log) | **estimated** from the transcript | real tokens |
| Handoff asked by itself | ✅ | ✅ | ✅ (follow-up message) | ✅ |
| Fresh session by itself | where you work: VS Code panel, desktop app or terminal | from a terminal: new terminal window | from a terminal: new terminal window, **Cursor CLI** | **same window**, new session |
| One-time step | trust the projects folder | approve the hooks once (`/hooks`) | install the Cursor CLI, `agent login`, reload Cursor | — |
| Tried live | on Windows, at every change; macOS never | never | never | no (one early try, before the economic rule) |

- **Codex** reviews new hooks before running them: approve Driftless' two hooks once with `/hooks`. Until you
  do, Codex skips them without a word, and an install that looks done does nothing. `node <clone>/scripts/driftless.mjs
  doctor codex` asks Codex itself (its app server's `hooks/list`: no model request, no login) and says, hook by
  hook, whether it runs, waits for your approval, changed since you approved it, or is switched off. Driftless
  only asks: it never writes the approval for you. The approval is kept in Codex's own configuration, hook by
  hook, and `codex exec` reads the same one: hooks you approved once in a session run in your scripts too, until
  the hook's command changes, and hooks you did not approve are skipped there just as silently. For a machine
  where nobody ever opens a Codex session (CI), Codex has a switch of its own for one invocation,
  `--dangerously-bypass-hook-trust`, meant for automation that already vets where its hooks come from: the
  choice is yours, and Driftless never sets it. Read in Codex's source, not seen live. Codex may also ask to
  trust each new project folder, and its sandbox may ask before Driftless creates a project outside the current
  folder or opens a window (no hook runs in a read-only sandbox). A session in no-approval mode hands off to one
  in the same mode.
- **Cursor**'s editor offers no way to open a chat with a prompt: a handoff from the editor's chat ends with
  the project released and a line telling you to open a new chat. From Cursor's CLI (`agent`, installed and
  logged into once) the fresh session starts in a new terminal window. The same holds for Codex's editor
  extension. Cursor reports context usage only at compaction, so Driftless estimates it from the
  transcript size (keep transcripts on): set a slightly lower cap, and `context_window` in
  `.driftless/config.json` if you use `cap_percent`.
- **Codex and Cursor** are built from their documentation and covered by the smoke tests, but have never been
  run live: the author works on Claude Code only. Cursor's estimate has never been calibrated on a real transcript.
  See [Help wanted](../README.md#help-wanted).
- **OpenCode** runs Driftless in-process (no Node needed for the hooks) and opens the fresh session in the
  same window. It was tried live once, before the economic rule, and not since. A password you set on its server
  (`OPENCODE_SERVER_PASSWORD`) travels with the request that brings the fresh session to the front. The handoff
  agent has no shell and no web, said as a `permission` map (and as `tools`, for an OpenCode older than 1.1.1).
- **OpenCode started without its terminal UI** says so in its command line, and the plugin reads it there. Under
  `opencode serve` and `opencode web` (a browser or another program's client is in front) and in the `--mini`
  interface nothing shows a session or a toast: the fresh session is created and started under the name
  "Driftless: resume", the agent tells you it is in the session list, and what Driftless would say on screen goes
  to OpenCode's log. A one-shot `opencode run` leaves when its turn ends: the session gets the project's context
  at its start and **no handoff is asked there**, since the process would not wait for it. Read in OpenCode's
  source at 1.19.5, not seen live.
- **A session that was there before OpenCode started** (one you go back to after a restart, `--continue`) is never
  announced to a plugin: OpenCode 1.x says a session started only when it makes one. Driftless takes it at its first
  request instead, asks OpenCode whose session it is, and gives it the project's context in the system prompt of
  that same request; a subagent's session never drives the project. Where OpenCode does not answer within three
  seconds the session is left as it was, and `doctor opencode` says so. The same holds for Kilo Code. Read in the
  source of both, tried on a stand-in, not seen live.
- **OpenCode 2** has another plugin API, and the same file serves it. The project's context joins the system prompt
  of each request, the context is read from each step the model ends, and a turn's end is the hook OpenCode runs just
  before a session goes idle: the handoff is asked there and done in the same run of the session. The handoff agent
  is added through OpenCode's agent editor, without shell, web, subagents or questions, said as its permission rules.
  A cap given as a percentage is taken on the context window OpenCode says for the model. The fresh session is made
  in the project's folder and started; **nothing brings it to the front** (a server plugin has no way to show a
  session or a toast), so the agent tells you it is in the session list, named "Driftless: resume". And **a one-shot
  `opencode run` is not told apart** there: in OpenCode 2 the plugin lives in the server, a process of its own, and a
  session does not say who drives it, so a run that goes over the cap is asked for the handoff like any session.
  Read in OpenCode's source at `@opencode/plugin` 2.3.0, tried on a stand-in, **never run in OpenCode 2**.
- **OpenCode, Kilo Code and Amp: `doctor` says what the tool has told the plugin.** These three load one plugin
  file and call it, and none of them has a command that says whether a plugin's handlers run: an install can look
  done and do nothing. So the plugin writes down what it is told: that it was loaded, that a session started, that
  a turn ended and with what size of context. `node <clone>/scripts/driftless.mjs doctor opencode` (or `kilo`, or
  `amp [project folder]`) reads it back: which of the three has come since the install, what to do about the one
  that has not, and exit 0 when all three have. It also says when the installed file points to where Driftless no
  longer is. The notes are one small file a tool, `~/.driftless/seen-<tool>.json`: times, counts, the process,
  how the tool was started, versions. No folder, no session id, nothing of the conversation, so the doctor's
  output can go into an issue as it is. A new install starts them again. What the doctor cannot say is whether
  the handoff and the fresh session work there: that shows at the first handoff. Tried on the stand-ins, not
  seen live.
- **Cursor, Qwen Code, Gemini CLI, Copilot CLI, Devin and Kiro: `doctor` says which hooks the tool has run.**
  Their hooks are commands, and none of the six has a command of its own that says whether it runs them (Codex
  has one, and is asked). So each of Driftless' two hooks notes that it ran, in the same kind of file: the start
  of a session and whether Driftless had a project's context to give it, the end of a turn and the size of the
  context where one could be read. `node <clone>/scripts/driftless.mjs doctor cursor` (or `qwen`, `gemini`, `copilot`,
  `devin`, `kiro [project folder]`) reads it back: whether the hooks are still in the tool's file and still name
  where Driftless is, which of them has run since the install, what to do about the one that has not, and exit 0
  when the tool runs both and they find what Driftless works from. It says "estimated" where the size comes from
  the transcript's size (Cursor, Copilot CLI), and asks for no size in Devin and Kiro, whose hooks give none.
  Where the tool's own documentation gives a reason for hooks that never run, the doctor repeats it (Gemini CLI
  in a folder it does not trust, the Kiro IDE and the user's hooks folder). The notes hold what the others hold
  and no more: times, counts, the process, the hook's event name, versions. Tried on the test bench, which runs
  the hooks as `install` wrote them: no tool has run them yet.
- **Claude Code** is tried live on Windows (VS Code panel, terminal) at every change. macOS has never been tried, Linux
  only in a container without a model; the smoke tests run on Linux, macOS and Windows at every push. Installing from a clone of this
  repository into an empty profile has been tried once, on Windows, up to a real handoff, but with the author's login
  (so not a true first run); installing from GitHub has not been tried.

**Kilo Code** — OpenCode's plugin under Kilo's name, and **never run live**. Kilo's CLI is a fork of OpenCode and
loads the same kind of plugin, so `kilo/driftless.js` is that plugin with what Kilo says its own way. Written from
Kilo's documentation (kilo.ai/docs) and from its source at 7.8.28, and tried on a stand-in for its plugin loader.

```
node <clone>/scripts/driftless.mjs install kilo   # ~/.config/kilo/plugin/driftless.js
```

Then restart Kilo's CLI, or the editor its extension runs in: Kilo loads plugins when it starts.

| | Kilo's terminal UI | Kilo in VS Code or a JetBrains IDE, `kilo serve`, `kilo acp`, `--mini` | `kilo run` |
|---|---|---|---|
| Context at session start | ✅ in the system prompt | ✅ in the system prompt | ✅ in the system prompt |
| Context measured | real tokens | real tokens | real tokens |
| Handoff asked by itself | ✅ at the end of a turn | ✅ at the end of a turn | ❌ the process ends with the turn |
| Handoff subagent | ✅ `driftless-handoff` | ✅ `driftless-handoff` | there, if you ask for a handoff yourself |
| Fresh session by itself | ✅ same window, brought to the front | ✅ created and started: you pick it from the session list | ❌ |
| Tried live | never | never | never |

- **One plugin for the CLI and for the extensions.** Kilo's documentation says a plugin works in both, since the
  extension runs the CLI's server. Inside VS Code or a JetBrains IDE no terminal UI shows a session or a toast: the
  fresh session is created and started under the name "Driftless: resume", the agent tells you it is in the session
  list, and what Driftless would say on screen goes to Kilo's log. The plugin knows it from who started the server
  (`KILO_CLIENT`: `vscode`, `jetbrains`, `acp`) and from Kilo's own command line: `kilo serve` by hand is what an
  editor starts, without the name, and is served the same; so is the split-footer interface (`kilo --mini`,
  `kilo run --interactive`), which stays open but shows one session and no toast.
- **`kilo run` with one prompt gets the context and no handoff.** It leaves when its session has nothing left
  running: a handoff asked at the end of that turn would start a turn the process may not wait for, and a fresh
  session nobody is there to go on in. `kilo run` attached to a server or a daemon is that server's business: the
  plugin runs there.
- **Read in the source, not in the documentation.** The shape of the events, the request that brings a session to
  the front in the terminal UI (`POST /tui/select-session`), the variable that says who started the server
  (`KILO_CLIENT`) and what each command does when a turn ends are not documented: they are read in Kilo's source
  at 7.8.28, and may change.
- **The end of a turn** comes as two events, `session.status` with an idle status and `session.idle`, which the
  source marks as deprecated. Driftless takes either and asks once.
- **A session you go back to after restarting Kilo** gets the project's context at its first request, as in
  OpenCode (see above): Kilo announces a session only when it makes one.
- **A password on Kilo's server** (`KILO_SERVER_PASSWORD`, which the VS Code extension sets) travels with the
  request that shows the fresh session, as in Kilo's own client.
- **The handoff agent** is added through the plugin's `config` hook, with Kilo's `permission` map: no shell, no
  web. An agent of yours named `driftless-handoff` keeps what you set.
- **One file.** `install kilo` writes it in the user's plugin folder (under `KILO_CONFIG_DIR` or
  `$XDG_CONFIG_HOME/kilo` where one is set) and touches nothing else; `uninstall kilo` removes it. `KILO_PURE=1`
  skips it, as it skips every plugin.

**Amp** — a plugin, as for OpenCode, and **never run live**: written from Amp's plugin API page
(ampcode.com/manual/plugin-api) and tried on a stand-in for that API.

```
node <clone>/scripts/driftless.mjs install amp                    # every workspace: ~/.config/amp/plugins/driftless.ts
node <clone>/scripts/driftless.mjs install amp <project folder>   # one project: <project>/.amp/plugins/driftless.ts
```

Then run `plugins: reload` from Amp's command palette, or restart Amp.

| | Amp |
|---|---|
| Context at session start | ✅ with the thread's first prompt: added to your message, not displayed |
| Context measured | real tokens (the usage Amp records with each answer) |
| Handoff asked by itself | ✅ at the end of a turn, as a follow-up message that sends the agent back to work |
| Handoff subagent | a tool, `driftless_handoff`: the thread's own agent, same model, in a child thread |
| Fresh session by itself | ✅ a new thread in the same client, brought to the front where the client can |
| Compaction | cannot be blocked by a plugin |
| Tried live | never |

- **In-process, under Bun.** Amp runs its plugins with Bun. Driftless' core is written for Node and uses only Node's
  built-in modules, which Bun says it supports: that has never been tried in Amp.
- **The fresh thread's first message shows the project's context.** In a thread you start, the context is added to
  your first prompt out of sight. Amp's documentation does not say that this happens for a message a plugin sends,
  so in the thread Driftless opens the context travels in the message itself, in full view.
- **Token figures.** The context is the input, the cache read and the cache written of the last answer, as Amp
  reports them. With a provider that counts its cached tokens inside the input the figure reads high: the handoff
  is asked early, never late. The plugin API does not say the size of the window: a model Driftless has no price
  for uses the plain threshold (250,000 tokens or 80% of the window, taken as 200,000 unless `context_window` in
  `.driftless/config.json` says otherwise).
- **Amp's own limits stay.** Amp stops a plugin from sending the agent back to work after five turns in a row;
  Driftless asks once per end of turn and does not raise that. Amp compacts a thread by itself near its limit (90%
  of the window by default) and no plugin can stop it: set a lower `token_cap` if it gets there first.
- **A thread with a parent never drives the project**: subagents, and the child thread of the handoff tool, get no
  context and are never asked to hand off. A turn you stop, or one that fails, is not asked either.
- **Two places, because Amp documents two.** The file written in a project names where Driftless is installed on
  this machine: it is for you, not for the repository. Driftless writes that one file and touches no other;
  `uninstall amp [folder]` removes it. Amp opened without a workspace: Driftless does nothing.

**Qwen Code, Gemini CLI, Copilot CLI** — the same way, and **never run live**: written from each tool's hook
documentation and tried only on payloads in the documented shape.

```
node <clone>/scripts/driftless.mjs install qwen       # hooks in ~/.qwen/settings.json + handoff agent
node <clone>/scripts/driftless.mjs install gemini     # hooks in ~/.gemini/settings.json + handoff agent
node <clone>/scripts/driftless.mjs install copilot    # ~/.copilot/hooks/driftless.json + handoff agent
```

| | Qwen Code | Gemini CLI | Copilot CLI |
|---|---|---|---|
| Context at session start | ✅ | ✅ | ✅ |
| Context measured | real tokens (the stop hook reports them) | real tokens (session file) | **estimated** from the transcript |
| Handoff asked by itself | ✅ | ✅ (`AfterAgent`) | ✅ (`Stop`) |
| Fresh session by itself | from a terminal: `qwen -i`, same approval mode | from a terminal: `gemini -i`, your default approval mode | from a terminal: `copilot -C … -i`, your default permissions |
| Compaction | cannot be blocked by a hook | cannot be blocked by a hook | cannot be blocked by a hook |
| Context window | the stop hook reports it | 1,048,576 tokens (256,000 on Gemma 4), as Gemini CLI counts it | not said: taken as 200,000 |
| One-time step | none: hooks are on by default, only a project's own ask for approval | trust the folder: Gemini CLI runs hooks, yours included, only in a folder it trusts | none: only a repository's hooks need admission |
| Tried live | never | never | never |

- **Qwen Code and Gemini CLI** keep their hooks in your settings file: Driftless adds its two entries under `hooks` and
  touches nothing else there. A settings file with comments in it is not valid JSON, and Driftless will not write to
  it: it says so and stops. The file is written back as plain JSON, two spaces deep.
- **Gemini CLI runs no hook in a folder it does not trust**, the ones in your own settings included (read in its
  source, 0.68.0: every hook from the settings is loaded only `if (this.config.isTrustedFolder())`). Driftless is silent
  there until you trust the folder; headless, Gemini CLI itself refuses to start in one (exit code 55). In the server an
  editor talks to (`gemini --acp`) the hook at the session's start never runs: the session neither gets the project's
  context nor takes the project, so Driftless does nothing there. Its SDK and its A2A server run no hooks at all.
- **Gemini CLI says a turn was sent back only until the agent uses a tool** (`stop_hook_active`, read in its source):
  a handoff asked for and not done would be asked for again at every stop of the same turn. Driftless counts its own
  requests: one request and one reminder in a turn, in every tool, then the turn is let end and the next one is asked.
- **Their own compaction stays on**, and no hook of theirs can stop it: if the tool compacts before Driftless asks for
  the handoff, set a lower `token_cap` (or `cap_percent` with `context_window`) in `.driftless/config.json`.
- **Models without a price** in `data/pricing.json` (all of these today) use the plain threshold: 250,000 tokens or 80%
  of the context window, whichever is lower. Qwen Code reports its window. Gemini CLI's is the one it counts with
  itself, 1,048,576 tokens (256,000 on the Gemma 4 models): the handoff is asked at 250,000 (204,800 on Gemma 4), well
  before Gemini CLI compresses, by default at half the window (`model.compressionThreshold`). Copilot CLI's hooks say
  neither the model nor the window, which varies by model: it is taken as 200,000, so the handoff is asked at 160,000,
  unless `context_window` says otherwise; Copilot CLI compacts by itself at about 80% of the real one.

**Devin** — the same way, and **never run live**: written from its hook documentation, which says the same events
fire in its CLI, in Devin Desktop and in its cloud sessions.

```
node <clone>/scripts/driftless.mjs install devin      # hooks in ~/.config/devin/config.json (%APPDATA%\devin on Windows) + handoff agent
```

| | Devin |
|---|---|
| Context at session start | ✅ |
| Context measured | **no**: its hooks give neither a token figure nor the path of a transcript |
| Handoff asked by itself | at the end of each step of the resume point: the agent runs `step`, as the start of the session tells it |
| Fresh session by itself | from a terminal: `devin -- …`, your default permission mode; from Devin Desktop: no, you open a new chat |
| Compaction | cannot be blocked by a hook |
| Tried live | never |

- **No measure, so no cap:** `token_cap` and `cap_percent` have nothing to be compared with there. What decides is the
  resume point: a step done, a handoff. Once the handoff is written, Devin's own stop hook releases the project and
  opens the fresh session; the agent runs nothing more.
- It rests on the agent running `step` when a step is done. One that does not is never asked to hand off: say
  "handoff" yourself, and the rest still happens by itself.
- Driftless adds its two entries under `hooks` in your Devin config and touches nothing else there; `/hooks` in Devin
  lists what it loaded. Devin asks once whether to trust a folder it has not seen.

**Kiro** — the same way as Devin, and **never run live**: written from its hook documentation, which gives one hook
file format for its IDE, its CLI (V3) and its web sessions.

```
node <clone>/scripts/driftless.mjs install kiro                    # the CLI: ~/.kiro/hooks/driftless.json ($KIRO_HOME if set) + handoff agent
node <clone>/scripts/driftless.mjs install kiro <project folder>   # the IDE: <project>/.kiro/hooks/driftless.json + handoff agent
```

| | Kiro |
|---|---|
| Context at session start | ✅ the hook's plain output is added to the agent's context |
| Context measured | **no**: its hooks give neither a token figure nor the path of a transcript |
| Handoff asked by itself | at the end of each step of the resume point: the agent runs `step`, as the start of the session tells it |
| Fresh session by itself | from a terminal: `kiro-cli chat …`, your default permissions; from the IDE: no, you open a new chat |
| Compaction | not touched (see below) |
| Tried live | never |

- **Two places, because Kiro documents two.** Its CLI reads hooks for every workspace from `~/.kiro/hooks/`; for its
  IDE only the project's `.kiro/hooks/` is documented. The file written in a project names where Driftless is
  installed on this machine: it is for you, not for the repository.
- **No measure, so no cap**, as for Devin: what decides is the resume point. Once the handoff is written, Kiro's own
  stop hook releases the project and opens the fresh session; the agent runs nothing more.
- **Its stop hook cannot send the agent back to work.** A turn that ends with the handoff asked and not written is
  not asked again at the stop: the request `step` printed stays in the conversation, and the next `step` makes it
  again. What a stop hook receives is not listed in Kiro's documentation: one that does not name its session is
  taken as the session that started in that project.
- **Not used, on purpose:** the `agent` action (a prompt at every end of turn starts a new agent loop each time, and
  costs credits) and the compaction triggers (`PreCompact` can cancel a compaction, but they are recent, and what an
  older Kiro does with a file that names a trigger it does not know is not documented).
- Driftless writes one hooks file of its own and touches no other; `uninstall kiro [folder]` removes it.

**Any other agent that reads `AGENTS.md`** (Zed, Aider with `--read AGENTS.md`, Goose, Crush, and whatever comes
next) — the method without the automation, and **never run live**:

```
node <clone>/scripts/driftless.mjs install generic <project folder>
```

It makes the folder a Driftless project (the three documents) and writes an `AGENTS.md` there that tells the agent to
run two commands itself: `begin` at the start of a session (it prints the goal, the resume point and the design index)
and `step` when a step of the resume point is done (it asks for the handoff; run again once the handoff is written, it
releases the project).

| | An agent without hooks |
|---|---|
| Context at session start | when the agent runs `begin`, as `AGENTS.md` tells it |
| Context measured | **no**: nothing there can measure it |
| Handoff asked by itself | **no**: asked at the end of each step of the resume point, when the agent runs `step` |
| Fresh session by itself | **no**: you start the next session and say "resume" |
| Tried live | never |

- **Your `AGENTS.md` is yours.** Driftless writes the file only where there is none. Where you already have one it
  shows the lines and you add them. If you would rather have Driftless add them, say so:
  `install generic <folder> --append` puts them at the end of your file, between `<!-- driftless:begin -->` and
  `<!-- driftless:end -->`, in the file's own line breaks, and changes nothing else in it. Run again after an
  update, it brings the block up to date where it is.
- `uninstall generic <folder>` removes the file only if it is still exactly what Driftless wrote. From a file of
  yours it takes the block out and leaves the rest as it was, to the byte. If the two marks are no longer one pair in
  order (one deleted, one pasted twice), Driftless does not guess: it writes nothing and tells you.
- It all rests on the agent doing what `AGENTS.md` says. An agent that skips `begin` works without the project's
  context; one that skips `step` is never asked to hand off.
- In a tool where Driftless has hooks (the tables above), the hooks win: `begin` and `step` see that a session with
  hooks drives the project and step aside (in Devin and Kiro, `step` is the way the handoff is asked for, and works as
  told).
