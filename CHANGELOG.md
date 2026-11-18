# Changelog

## Unreleased
- **The tests run on every push and pull request.** The repository is public, so GitHub Actions minutes are free:
  `.github/workflows/test.yml` goes back to `push` and `pull_request` (six jobs: Linux, macOS and Windows, Node 18
  and 22), and can still be started by hand. The job token stays read-only.
- **The tests no longer take the CI job for the user's.** On GitHub Actions three Gemini CLI cases failed: the bench passed
  `GITHUB_ACTIONS=true` on to the hook, which Gemini CLI reads as "nobody at the keyboard". The bench now leaves it out, as it
  already did with `CI`, and one failing system no longer cancels the other five (`fail-fast: false`).
- **The page looks half a coder's screen, half a sea chart.** `docs/index.html` now has a pale sea-chart theme by day
  and a night-sea theme by lantern light, with an amphitheatre at night on the horizon (`docs/arena-light.webp` and
  `docs/arena-dark.webp`, 12 and 16 KB, blurred and blended in only as far as every text colour keeps 4.5:1 on every
  pixel), and a new mark, a sail seen through a porthole (`docs/icon.svg`, with `icon.png` and `icon-32.png` rendered
  from it). The link preview (`docs/social.png`) is drawn in the same day theme, and on a phone the page no longer
  slides sideways (the compass rose ran 78 px past the edge). The page's graph-paper grid doubles as a map grid. Monospace
  is used for the machinery, an old-world serif for the headings, and a line of rope under each heading. The five steps
  are a route on the map, with the X where it lands, and a compass rose sits faintly behind the opening lines. Each
  section opens with a line from the ship's log, written like a code comment (`// 03 · the voyage`), hidden from screen
  readers. No word of the text changed, nothing is loaded from elsewhere, and every colour pair is still at least 4.5:1.
- **Commands you can reach: ask the agent, or run them from your clone.** The README and `docs/` gave `off`, `on`,
  `audit`, `diet`, `statusline` and `status` as `node scripts/driftless.mjs …`, which works only from inside a clone, and
  there it acts on the clone, not on your project: these commands act on the folder they run in. Whoever installed the
  Claude Code plugin has no `scripts/` at hand. Now the docs say what to tell the agent ("stop Driftless", "does Driftless
  pay off here?", "no Driftless status line here"), and for a clone `node <clone>/scripts/driftless.mjs …`, run in the
  project's folder. The skill also turns the status line off and on, and its description names the audit, the diet and
  the status line, so that asking is enough.
- **README: a front door, the detail in `docs/`.** The README had grown to 67 KB, with the install section alone
  running for 350 lines before a reader got to how it works. It now says, in about 17 KB and in this order, what
  Driftless is, how to install it (Claude Code first, then the one trust step that lets the first fresh session open
  without a question, then the other tools in one table), how it works with the threshold in tokens or percent and the
  status line, what it saves and how to ask your own history, how to stop it, safety and the diet in short, and the
  limits. The detail moved word for word to `docs/install.md` (tool by tool), `docs/how-it-works.md` (when it hands
  off, opened somewhere else, native compaction), `docs/savings.md`, `docs/safety.md` and `docs/diet.md`, each with
  a link back; nothing was cut.
- **Security: a file of yours stays as you made it, a folder above is your project only if it is yours, and the skill
  runs only Driftless' own script without asking.** A project's `config.json` with a comma too many was replaced in
  silence by the next command that set something (`off`, `diet hand`, `statusline`), losing, for one, a stricter
  `permission_mode`; meanwhile session starts wrote the status line into your settings, though the broken file may have
  said `"status_line": false`. Settings and hooks files were written again with their permissions reset (`0600` became
  `0644`), a settings file that was a link became a plain file, and a file was rewritten even when nothing in it changed.
  Looking up for its project, a session took any folder above with a `.driftless/config.json`, up to the root of the
  disk: on a shared machine, someone else's `/tmp/.driftless` or `C:\.driftless`. The skill let Claude run without
  asking any `node` command that mentioned `driftless.mjs`. Now a config that does not read is never written over, every
  start says so, the fresh session asks for permissions and nothing is written into your settings by itself until it is
  fixed; a file of yours is written through its link (not through one that leads out of the project), keeps its
  permissions and is not written for nothing; a folder above counts only if you know it as a project here or, on Linux
  and macOS, it is yours (on Windows, the first only: a clone opened first in a subfolder is a project once you start a
  session at its root, or run `open` or `attach` there); the skill's rule names the plugin's own script. The CI job reads
  the repository and nothing more, runs actions pinned to a commit, and keeps no credentials. Five tests, which fail on
  the code before; with any of eighteen behaviours taken out, one of them falls.
- **Security: what Driftless writes in `.driftless/` stays out of git, all but `config.json`.** Its `.gitignore` named
  only the two copies of the conversation, and was written only when there was none: with `"debug"` on, the whole input
  of each hook (`debug-*.json`), the state with the transcript's path, the baton, the diet with the names of private
  skills and agents, and the savings went into git with a plain `git add`; a clone that came with a `.gitignore` of its
  own (`!snapshot.md`) took the conversation copy back in (both seen on the test bench, with git). Now the `.gitignore`
  keeps all but `config.json` and itself out, it is checked by its content before Driftless writes in the folder, and
  Driftless' lines come last, after any the folder brought, since the last rule that matches wins. The lines an earlier
  version wrote are replaced; `~/.driftless` gets the same file. A file git already tracks stays tracked:
  `git rm --cached .driftless/<file>`. One test, which fails on the code before; with any of ten behaviours taken out,
  it falls.
- **Security: what a folder's `.driftless/` and documents say reaches the context as plain words, and nothing outside
  the project.** A clone could bring a `config.json` naming a document outside the project (`"goal": "../../.aws/credentials"`
  put 3,000 characters of that file in the session as the goal), a document that is a link to a file outside it, or a
  link that leads nowhere, through which `init` wrote a template outside the project (seen on the test bench, on
  Linux). Its project name, document names and `cap_percent` reached the session's context as written, line breaks
  included, in Driftless' own words, and the name went on to `~/.driftless/projects.json` and into the context of other
  folders; an `auto-diet.json` dated in the future passed for one Driftless had just written and a `diet.json` note was
  repeated as it was. Now a document is a plain name inside the project (else the default document), a document that
  leads outside is not read (the session is told), `init` writes only inside the project and never through a link,
  names are said as plain words on one line, a cap is a number, and from the diet files only counts and numbers are
  said, from a file dated no later than now. One test, which fails on the code before; with any of twelve behaviours
  taken out, it falls. Ten ways tried before the change: nine were open on Linux, seven on Windows (no links there
  without a privilege), all closed after.
- **Security, Windows: a program at the root of a project is no longer taken for your agent.** Windows' `where` lists
  the current folder before PATH, and hooks and commands run in the project: a `codex.exe` at the root of a cloned
  repository came before the npm shim on PATH and would have been started as the fresh session, and `doctor codex`,
  which started Codex through a shell, ran a `codex.cmd` from the folder (seen on the test bench). `where` now runs
  from the system folder; `doctor codex` starts Codex the way the fresh session is started, without a shell, and tells
  `cmd.exe` not to look in the folder, so an npm shim that starts `node` by its bare name does not take one from there
  either. What is left is said in the README: in the fresh session such a shim still looks in the project folder
  first, as it does when you start the agent there yourself. The test bench no longer inherits
  `NoDefaultCurrentDirectoryInExePath` from the shell that runs it (Claude Code sets it for its own commands), which
  hid the folder from `cmd.exe`. One test, which fails on the code before; with any of four behaviours taken out, it
  falls (a fifth, the shell, is covered twice: by its removal and by the variable).
- **Security: the `.driftless/` that comes with a folder can no longer open a session or turn yours away.** A clone, a
  pull or an archive can bring a project's `state.json`, `baton.json` and `handoff.json`, written somewhere else. Five
  ways were seen on the test bench: with Codex, Cursor, Gemini, Qwen and Copilot a baton held by a process that is
  always alive, a state without a session and a `handoff.json` asking to reopen opened a fresh session in the clone at
  the first stop; Codex did it from its stop alone, Kiro from a state naming another session; in Claude Code the same
  baton turned every session away, for good; and a `handoff.json` without a session that arrived while a session drove
  opened a fresh one. State and baton now carry a seal, an HMAC of the session id under a key made once in
  `~/.driftless/key`: one without a valid seal counts as no file, and the baton is held only while a live process holds
  it in a baton written here. A `handoff.json` that names no session can end the turn of the session that drives,
  never reopen, unless Driftless had asked that session for the handoff. `status` says whether state and baton are
  sealed. The state written before this version has no seal: a session in flight when you update starts counting again.
  One test, which fails on the code before; with any of fourteen behaviours taken out, it falls.
- **Security, Windows: the name of a folder can no longer run a command when the agent is an npm install.** An npm
  install of a CLI (Codex, Copilot, Gemini, Qwen, Cursor's agent, Claude Code itself) is a `.cmd` shim, which only
  `cmd.exe` runs, and Driftless started it through a line of PowerShell. Opening the fresh session in a project folder
  named `a&mkdir;x&` ran `mkdir x`; a typographic quote (`’`) in the name closed PowerShell's string and ran what came
  after it; `%USERNAME%` in the name was filled in. All three seen live, through `open`, with a stand-in shim in npm's
  own format. There is no PowerShell in between any more: the line is written the way `cmd.exe` reads it (every item
  in double quotes, a quote doubled, a `%` defused, as Rust's standard library does since CVE-2024-24576) and Node
  hands it over to the letter. Windows Terminal fills in `%VARIABLES%` by itself, in the folder and in every argument:
  with a `%` anywhere the window is a console of the program's own. A line break cannot be written on such a line, so
  an argument with one is refused and the handoff says how to resume by hand. A `.cmd` named by its full path gets the
  same line as one found on PATH. One test, which also runs a shim for real on Windows; with any of seventeen
  behaviours taken out, it falls.
- **Security: a project's config can no longer loosen the fresh session, or put anything but plain words on its
  command line.** `.driftless/config.json` comes with a clone, so it may be somebody else's. Its `permission_mode`
  could raise the mode of the session Driftless opens (`bypassPermissions` from a repository you had just cloned): it
  can now only make it stricter than the session that hands off, and a mode nobody knows is no mode. Its `model`,
  `effort` and `name` went to the command line as they were, and on Windows, where an npm install is started through
  a shell, a value like `sonnet&calc.exe` could run a command: they are now used only when they are one plain word (the name:
  letters, digits and plain punctuation), else dropped. Found by a security review of the whole code; the rest of its
  findings are being worked through and are not fixed yet. One test; with any of eight behaviours taken out, it falls.
- **The page has a face.** A mark (`docs/icon.svg`, also the page's icon and at the top of the README),
  a top bar, the loop as five steps (watch, hand off, write down, reopen, resume) that stack on a phone, the status
  line as the terminal shows it, and a link preview (`docs/social.png`, drawn from `docs/social.svg`). The three
  figures in evidence say less each; what they left out is in the sentence and the table under them. Nothing is loaded
  from anywhere else: no fonts, no scripts, no trackers.
- **Test bench: a case no longer borrows the terminal of whoever runs it.** Run in a Linux container, the whole
  suite had one case down: Codex's fresh session was not opened. Not a difference between Windows and Linux: outside
  a terminal Codex gets no window, as meant, and the case counted on the `TERM` of the shell that ran the suite. The
  bench now takes the terminal's variables out of every case, and a case that needs a terminal says so. The suite is
  green in the container too.
- **Level 2: an `AGENTS.md` you already have can take Driftless' lines, when you ask.** It was never written to: the
  lines were shown, and adding them was yours. That stays the default. `install generic <folder> --append` now puts
  them at the end of your file, between `<!-- driftless:begin -->` and `<!-- driftless:end -->`, in the file's own
  line breaks (LF or CRLF), and nothing else in the file changes by a byte. Run again, it says the block is there, or
  brings an older block up to date where it sits. `uninstall generic` takes the block out and the file is yours again
  to the byte, with or without a line break at its end. Marks that are not one pair in order are not guessed at:
  nothing is written, nothing is taken out. One test; with any of fourteen behaviours taken out, it falls.
- **The cost of a fresh start is built from its parts, each at the price of the model that pays it.** It was one
  bundle of tokens measured once (68,000 written, 755,000 read, 19,000 of output), all weighed at the handoff
  agent's prices and at the long-cache price a subagent never gets. Read again on 38 handoffs of the author's
  history, a handoff has two payers. The agent's own run: about 39,000 tokens written to the 5-minute cache, 137,000
  read and 7,200 of output, at the agent's prices. And the session's requests around it, at the session's prices:
  the launch, the line while the agent works in the background, the closing one; each reads the whole context again,
  and together they write about 5,800 tokens and answer 4,100. On Opus 5.5 with the agent on Sonnet 5.5 a fresh start
  from 80,000 tokens was put at $0.98 and is $0.80; on a session that runs on Sonnet itself, $0.76 and $0.49. The
  rule asks a little sooner, and on a model whose answers are dear (Fable 5.2) the session's share now counts as
  such. The rule weighs the launch at the size the session restarts from, not at the size it stands at: what the
  launch reads above that grows by the same amount at every request one waits, so it is paid whenever one stops and
  does not move the best moment. `audit` decides the same way and charges each handoff of its replay where it was
  launched from. What a user's own rules ask at every handoff (on the author's machine, two or three requests more)
  is not in the figure. Three tests; with any of eight behaviours taken out, one falls.
- **Claude Fable 5.2 was weighed with the prices of Fable 5: cache reads five times dearer than they are.** The price
  list stopped at Fable 5.1, and a model id is matched by the longest name it contains: `claude-fable-5-2` contains
  `claude-fable-5` and not `claude-fable-5-1`, so it took the first release's prices ($1 per million tokens read,
  against $0.20). For three days of sessions on 5.2 the cost of carrying the context was counted five times over,
  in the rule and in the savings counter. Two changes: Fable 5.2 and the Mythos models are on the list (read on the
  public page on 2026-11-15), and a release the list has not heard of now takes the prices of the newest release it
  knows of the same family and major version, not of the first. A date at the end of a model id is not a release,
  and a new major version stays without a price (the plain threshold). One test; without the row, and without the
  rule, it falls.
- **OpenCode 2.x, read again in its source (`@opencode/plugin` 2.3.0): three things the plugin had wrong.** The 2.x
  half was written from the documentation and the event schema at 2.2.7. Ten things it takes for granted were read
  again in the source of the plugin package, the client, the schema and the core. Seven hold as written: the
  default export with `id` and `setup`, the `plugins` folder, the `context` hook and its `system` parts, the
  `experimental.idle` hook and its list of work still running, `session.synthetic` going on in the same run of the
  session, `session.get` and `session.prompt`, and the `session.step.ended` event with its tokens. Three did not:
  - **The model's context window was never read.** `model.list()` answers `{ location, data }`, the one answer the
    plugin uses that the host does not unwrap, and the plugin looked for `items`: a cap given as a percentage was
    taken on the window Driftless assumes when it is not told one. It is read from `data` now.
  - **The handoff agent was not added.** The plugin took it that a 2.x plugin can only update and remove agents. The
    editor's `update` makes the agent when it is not there, as OpenCode's own plugins do: `driftless-handoff` is now
    added as a subagent with the shared instructions, and shell, web fetch, web search, subagents and questions
    denied as permission rules after the host's defaults (the last rule that matches wins).
  - **The fresh session was made without a folder**, which for the server is the folder it was started in, not the
    project's. It is made in the folder of the session that handed off.
  One limit is now said instead of assumed: in OpenCode 2 the plugin lives in the server process (`serve`, as the
  background service or as the private server of `--standalone`), so it cannot tell a one-shot `opencode run` from
  a session someone is in front of, and such a run is asked for the handoff like any other. A server plugin still
  has no way to show a session or a toast. Tried on the stand-in, which now answers as the source says (five
  behaviours taken out, each makes a test fail); never run in OpenCode 2.
- **`doctor` for Cursor, Qwen Code, Gemini CLI, Copilot CLI, Devin and Kiro: which hooks the tool has run.** Their
  hooks are commands and none of the six says whether it runs them, so an install could look done and do nothing
  with no way to tell. Each of the two hooks now notes that it ran, in `~/.driftless/seen-<tool>.json`: the start of
  a session and whether Driftless had a project's context to give, the end of a turn and the size of the context
  where one could be read. `doctor <tool>` reads it back: hooks still in the tool's file and still naming where
  Driftless is, which has run since the install, what to do about the one that has not, exit 0 when both run and
  find what Driftless works from. An estimate is called one (Cursor, Copilot CLI); Devin and Kiro are asked for no
  size; a turn the user stopped in Cursor notes nothing; a session that does not drive the project is told apart
  from a size that could not be read. `install` names the doctor and starts the notes again, `uninstall` removes
  them. Codex is asked itself, as before, and Claude Code's hooks note nothing. The notes hold times, counts, the
  process, the hook's event name and versions: no folder, no session id, nothing of the conversation. Tried on the
  test bench: no tool has run them yet.
- **Codex: the approval of the hooks holds for `codex exec` too, said in the README.** Read in Codex's source
  (`7194b21`): the approval is kept in Codex's own configuration, hook by hook, and a run of `codex exec` reads the
  same one as a session. Hooks approved once with `/hooks` run in scripts too, until the hook's command changes; hooks
  not approved are skipped there without a word. For a machine where nobody opens a session Codex has a switch of its
  own for one invocation (`--dangerously-bypass-hook-trust`): Driftless never sets it and never writes an approval.
  Also read there: the session log is already complete when the stop hook runs, so the wait added for Claude Code is
  not needed, and a resumed session says `resume` at its start and keeps what was measured. Documentation only, no
  code changed; not seen live.
- **Devin and Kiro: a run of one prompt is asked nothing either.** `devin -p` (or `--print`) and
  `kiro-cli chat --no-interactive` answer one instruction and leave; read in Devin's command reference and in Kiro's
  "Headless mode" page, which says its hooks are loaded in such a run since CLI 2.27.1 on its V3 harness. In these
  two tools nothing measures the context and the handoff is asked for by the agent's own `step`: a run of one prompt
  was told at its start to run it, and the handoff would have taken the place of the answer the script waits for.
  Now its start says that nothing is asked and that `step` is not to be run, and a `step` run all the same asks
  nothing. `devin acp` and a session started with a first prompt are asked as before; `"one_shot_handoff": true`
  asks there too. Written from the documentation and tried on stand-in processes: never run live.
- **The other tools: a run of one prompt keeps its answer too.** `codex exec`, `gemini -p`, `qwen -p`,
  `copilot -p`, Cursor's `agent -p` and `amp -x` answer one prompt and leave, as `claude -p` does. Read in the
  source of Codex (`7194b21`), Gemini CLI (0.68.0) and Qwen Code (0.27.3): their hooks run there, a stop hook that
  sends the agent back keeps the run going inside the same process, and the caller is handed the handoff with its
  answer or in place of it (the last message of the turn in `codex exec`; both answers one after the other in
  `gemini -p`, and in its JSON output only the text after the last tool call; the last assistant message in
  `qwen -p`). Copilot CLI, Cursor and Amp document the mode and not what a run sent back prints. None of the six
  says its mode in what it hands a hook or a plugin: it is on the command line of the tool's own process, which
  Driftless now reads once, when a handoff would be asked for, and such a run is asked nothing. Not a program that
  feeds the tool its turns (Qwen Code's SDKs, `amp --stream-json-input`), not the servers an editor talks to, not
  `gemini -i`; Codex's TypeScript SDK runs one `codex exec` per turn and is one. `"one_shot_handoff": true` asks
  there too. Where a tool goes headless with no switch (a piped stdin, a redirected stdout) nothing says it and the
  run is asked as before: the README lists it tool by tool. Written from sources and documentation and tried on
  stand-in processes started with each tool's arguments: never run live.
- **A handoff is asked for at most twice in a turn.** Gemini CLI says a turn was sent back (`stop_hook_active`) only
  until the agent uses a tool: read in its source, a handoff asked for and not done would have been asked for again at
  every stop of the same turn, up to Gemini CLI's own limit of a hundred turns. Driftless now counts its own requests
  in every tool: the request, one reminder, then the turn is let end and the user's next turn is asked again. A handoff
  agent launched in answer starts the count again, so one that then writes nothing is still asked about and said.
- **Gemini CLI: what its source says of hooks, corrected in the README.** It runs no hook in a folder it does not
  trust, the ones in your own settings included (the README said only a project's own were checked); in the server
  an editor talks to (`--acp`) the hook at the session's start never runs, so Driftless does nothing there; its SDK
  and its A2A server run no hooks. Its session file already holds the answer that ended the turn when the hook runs
  (written before it, in one go): the wait added for Claude Code is not needed there.
- **Claude Code: a one-shot run (`claude -p`) keeps its answer, and the stop hook measures the turn where it ended.**
  Two things seen live on 2.1.323, running `claude -p` in a project with a low cap. A handoff asked for there is not
  cut off: it is run inside the same execution, and the run ends with "handoff done" as its last message. That last
  message is what a script gets from `claude -p` (the text on stdout, `result` in `--output-format json`): it lost
  its answer, and paid for the handoff (0.07 → 0.17 $, 9 → 47 s on the run measured), with nobody there to go on in a
  fresh session. A one-shot run is now asked nothing, at its end or half way through a long job: it still gets the
  project's context at its start, and the end of its conversation is kept for the session that comes next. A process
  that is fed its turns (`--input-format stream-json`, read once on Claude Code's command line when a handoff would
  be asked for) and the Agent SDK are asked as before; `"one_shot_handoff": true` in `.driftless/config.json` asks in
  a one-shot run too. The second: Claude Code starts the stop hook before the answer that ended the turn is in the
  transcript, and writes it some tens of milliseconds later. When the hook read first, it measured the request
  before: 54,209 tokens where the turn had ended at 117,738, and no handoff was asked for. The stop hook is told
  that answer; the measure now waits for it in the transcript, for 300 ms at most, and takes what is there if it
  never comes. In a session with more turns the late line only put the request off by one turn.
- **Claude Code: a turn you did not write no longer takes the project, and a handoff says what it leaves running.**
  Claude Code runs the prompt hook for more than what you type: a background agent or shell that reports, a message
  from another session, a scheduled task that fires (`/loop`, a reminder). Nothing in what the hook receives says
  which, and Driftless took each for a message of yours. A chat that had handed the project on, brought back by the
  editor, took the project back when something it had left running reported; with `cold_restart` on, a report or an
  hourly task arriving after the pause was carried to a fresh session as "your message". Driftless now tells them by
  what Claude Code sends (read live on 2.1.323): a prompt that is wholly a `<task-notification>` or a
  `<cross-session-message>` block, or the words of one of the session's scheduled tasks, which the stop hook lists
  (Driftless keeps a fingerprint of each, not its words; a loop without a prompt is known by Claude Code's own
  text). Such a turn takes no project and starts no cold restart; the same block quoted inside a message of yours is
  still yours. And when a session hands off with background tasks or scheduled tasks still there, Driftless names
  them to the model with the request (stop what need not go on, name the rest in the resume point) and to you when
  the session ends: they belong to the old session and will wake it. A session that was new when it started still
  takes the project at its first tool call, as before. A scheduled prompt past 1,000 characters is matched by its
  start, the way the hooks page says the stop hook cuts it (not seen live); the output of Code Mode was not tried.
  The cold restart has now been seen live once: a session idle for ten hours, 161,000 tokens not sent again.
- **Gemini CLI: the context window is the one it counts with, not 200,000.** No hook of Gemini CLI says the window,
  and Driftless took it as 200,000: the handoff was asked at 160,000 tokens, on a window of a million. It is now
  1,048,576 tokens, and 256,000 for the Gemma 4 models, as in Gemini CLI's own table: with no price for the model
  the handoff is asked at 250,000 (204,800 on Gemma 4), still well before Gemini CLI compresses at half the window.
  `context_window`, `token_cap` and `cap_percent` in `.driftless/config.json` win as before. Copilot CLI stays at
  200,000: its hooks say neither the model nor the window, which varies by model, and it compacts by itself at about
  80% of the real one. The README and the page now say the one-time step of Qwen Code, Gemini CLI and Copilot CLI:
  none for hooks in your own settings; only a project's or a repository's own hooks ask for approval.
- **OpenCode 1.x and Kilo Code: a session resumed after a restart gets the project's context.** Both announce a
  session to a plugin only when they make one. A session that was there before the tool started (reopened after a
  restart, `--continue`) was never announced: Driftless did not give it the project's context, though it still asked
  it for the handoff over the threshold. Now the session's first request is enough: the plugin asks the tool whose
  session it is, once, and the context goes into the system prompt of that same request. A subagent's session is
  told apart and never drives the project. Where the tool fails to answer, or has not answered after three
  seconds, nothing is assumed: the session is left as it was, and `doctor` counts the end of its turns apart, as
  before. A session announced after its first request, or while the tool is being asked, starts once. `doctor
  opencode|kilo|amp` now says how the start of a session came (`session.created`, `its first request`, `context`,
  `agent.start`). Read in the source of OpenCode 1.19.5 and Kilo 7.8.28, tried on a stand-in, not seen live.
- **OpenCode, Kilo Code and Amp: `doctor` says what the tool has told the plugin.** Where Driftless runs as a plugin
  inside the tool, an install could look done and do nothing, and nothing said so: none of the three has a command
  that tells whether a plugin's handlers are called. The plugin now writes down what it is told (it was loaded; a
  session started; a turn ended, and with what size of context; a turn ended in a session the tool never announced),
  in `~/.driftless/seen-<tool>.json`, and `doctor opencode|kilo|amp [folder]` reads it: which of the three things
  Driftless works from has come since the install, what to do about the one that has not, exit 0 when all have. It
  also says when the installed file points to where Driftless no longer is and, for Amp, when the handoff tool was
  not taken. The notes hold times, counts, the process, how the tool was started and versions: no folder, no
  session id, nothing of the conversation. `install` and `uninstall` start them again. What the plugins do is
  otherwise unchanged. Tried on the stand-ins, not seen live.
- **Codex: the context is the figure Codex counts itself.** Driftless read, in Codex's session log, the input of the
  last response. Codex's own count is that input and the answer, which the next request carries: Driftless read less
  than Codex shows, by the size of the last answer. After it compacts the conversation, Codex logs its estimate of
  what is left and puts the input at 0: Driftless skipped that line and kept the size from before the compaction,
  and could ask for a handoff the compaction had just made pointless. It now reads Codex's figure in both cases. When
  a request overflows the window, Codex logs a last usage that is not a size (what the session's total left of the
  window): Driftless now reads a full window there. Codex's logs compressed after a week (`.jsonl.zst`, a feature
  off by default) needed nothing: Codex unpacks a log before it writes to it again, and Driftless reads at the end
  of a turn. Read in Codex's source (commit `69231e1`), tried on the bench, not seen live.
- **OpenCode, Kilo Code and Amp: a session that took the project with `attach` keeps it.** The baton names the
  process of the session that holds the project, and a second session is kept out while that process lives. Where
  the core runs inside the tool, the plugin says the tool's process at every hook; `attach` is a command the model
  runs from a shell, where nobody says it, so the baton named the shell, gone as soon as the command had run. A
  second session opened in the project then took it "without handover", and the first went on working with a stop
  hook that stayed silent. Now the end of every turn puts the process the hook says on the baton. What is left is
  the turn `attach` runs in. The three rows get no process name to look up the tree for, as Codex and Cursor
  have: the names of their programs could not be checked without running them. Tried on the bench, not seen live.
- **OpenCode 1.x and Kilo Code: started without the terminal UI, the plugin no longer behaves as if it were there.**
  The plugin runs in the process that serves the sessions, and reads how the host was started in its command line.
  A one-shot `run` leaves when its turn ends (OpenCode at the idle event, Kilo once the session has nothing left
  running): the handoff request sent at that moment started a turn OpenCode did not wait for and Kilo might not, and
  after it a fresh session nobody was there to go on in. Now the session gets its context at the start and nothing is asked
  there. Under `serve`, `web` and `acp`, and in the split-footer interface (`--mini`; in Kilo also
  `run --interactive`, which OpenCode 1.19.5 lists and does not read), nothing shows a toast or a session: the
  request that brought the fresh session to the front went to nobody and the user was told nothing. Now the
  handoff request tells the model to say the fresh session is in the session list, and what the core says to the
  user goes to the host's log, as inside VS Code. For Kilo this covers its JetBrains plugin too, which starts
  `kilo serve` with `KILO_CLIENT=jetbrains`. Read in the source of both (OpenCode 1.19.5, Kilo 7.8.28), tried on
  the stand-ins, not seen live. OpenCode 2.x is unchanged and was not read for this.
- **OpenCode 1.x: the handoff agent's limits are said the way OpenCode reads them.** The plugin gave the agent a
  `tools` map (no shell, no web). OpenCode turns `tools` into permissions when it parses its config files, before a
  plugin's hook runs, and reads only `permission` of an agent a plugin adds (its source at 1.19.5): the limits were
  not applied. The agent now carries a `permission` map as well. Read in the source, not seen live.
- **OpenCode 1.x: a password on its server no longer keeps the fresh session out of sight.** The request that brings
  the fresh session to the front of the terminal UI goes to OpenCode's own server, and went without credentials: with
  `OPENCODE_SERVER_PASSWORD` set, which OpenCode documents, the server would refuse it, and the session would be
  created and started but not shown. The request now carries HTTP basic auth, with the user `opencode` or
  `OPENCODE_SERVER_USERNAME`. Read in OpenCode's server documentation, not seen live.
- **Kilo Code (never run live):** a new row in the adapter table and a plugin, `kilo/driftless.js`: OpenCode's 1.x
  plugin under Kilo's name, since Kilo's CLI is a fork of OpenCode. Written from Kilo's documentation and from its
  source at 7.8.28, and tried on a stand-in for its plugin loader. What Kilo says its own way: the installed file
  exports `{ id, server }` by default and nothing else; the handoff agent's access is a `permission` map; the
  request that shows the fresh session in the terminal UI carries the server's password when one is set
  (`KILO_SERVER_PASSWORD`). Inside the VS Code extension (`KILO_CLIENT`) there is no terminal UI: the fresh session
  is created and started, the handoff request tells the model to say it is in the session list, and what the core
  says to the user goes to Kilo's log. `install kilo` writes one file in `~/.config/kilo/plugin/` (under
  `KILO_CONFIG_DIR` or `$XDG_CONFIG_HOME/kilo` where one is set).
- **OpenCode 1.x and Kilo Code: the end of a turn is also taken from `session.status`.** The host publishes an idle
  `session.status` and then `session.idle`, which Kilo's source marks as deprecated, in a file it takes from
  OpenCode. The plugin now takes either and counts the second of the pair as the same end of turn: a host that drops
  `session.idle` is still served, and one that sends both is asked once. `opencode/driftless.js` now exports
  `serverFor(harness, host)`, which Kilo's plugin is built on; nothing else changes for OpenCode.
- **Claude Code: the project goes to the session the user writes in, not to the one that opened first.** When the
  editor reopens, VS Code's panel starts sessions it drops within seconds and brings back the tabs that were open.
  Each ran the start hook, and the first took the baton and the state: the session the user was really in was told
  "another live session holds the baton" when nobody else was there, and its stop hook stayed silent, so no handoff
  was asked (seen live three times). Now a session that starts is given the project's context and takes nothing,
  unless it holds the baton already (the driving session opened again, `/clear` in it). The user's first message
  there takes the project if no live session holds it; so does the first tool batch or stop of a session that was
  new at its start. A chat that handed the project on no longer takes it back by being opened again, or by a turn
  nobody asked for. A session kept out by a live one is told once, and takes the project by itself, with its
  context, at the user's next message once that session has ended (it took the `attach` command before). The
  status line no longer says `another session drives` to a session that waits with nobody at the wheel. Measured
  live on Claude Code 2.1.322: a new session's transcript is not there at its start nor at its first prompt, a
  resumed one's is; `UserPromptSubmit` also runs for `claude -p`. Other tools are unchanged. With `"debug": true`
  every session start is kept in its own `debug-session-start-<id>.json`.
- **Amp (never run live):** a new row in the adapter table and a plugin, `amp/driftless.js`, written from Amp's
  plugin API page and tried on a stand-in for that API. As in OpenCode the core runs in-process. The thread's first
  prompt gets the project's context (added to the user's message, not displayed); at the end of a turn the context is
  read from the usage Amp records with each answer, and the handoff is asked by continuing the turn; once it is
  written, a fresh thread is created on the thread's own agent, shown, and started with the resume prompt and the
  context. A tool, `driftless_handoff`, runs the handoff in a child thread of the same agent, so the handoff does not
  pay for the context it is there to shed. Threads with a parent never drive the project; a turn the user stopped is
  not asked. `install amp` writes one file in `~/.config/amp/plugins/`, `install amp <project folder>` in the
  project's `.amp/plugins/`. Amp's own compaction and its limit of five plugin turns in a row are left as they are.
- **`install`: the plugin file is the row's.** A row of the adapter table whose harness loads a plugin now says the
  text of the file it installs (OpenCode's is unchanged) and what to do next; a row's handoff line may name the
  place Driftless is installed.
- **Kiro (never run live):** a new row in the adapter table, written from Kiro's hook documentation and tried on
  payloads in the documented shape. `install kiro` writes a hooks file of Driftless' own in Kiro's `v1` format
  (`~/.kiro/hooks/driftless.json`, which its CLI V3 reads for every workspace) and the handoff agent;
  `install kiro <project folder>` writes the same file in the project's `.kiro/hooks/`, the only place its IDE is
  documented to read hooks from. Kiro's hooks say the session and the folder and nothing of the context's size, so,
  as for Devin, nothing is measured and the session is told at its start to run `step` when a step of the resume
  point is done. A hook speaks to Kiro in plain text, added to the agent's context. Its stop hook cannot send the
  agent back to work: a turn that ends with the handoff asked and not written is not asked again at the stop (the
  next `step` asks). Once the handoff is written the stop hook releases the project and opens the fresh session
  with `kiro-cli chat` from a terminal; from the IDE it says to open a new chat. A stop that does not name its
  session (what it receives is not documented) is taken as the session that started in that project under Kiro. The
  `agent` action and the compaction triggers are not used.
- **`install`: a hooks file can be a list.** A row of the adapter table may now ask for one list of named hooks,
  each with its trigger (Kiro's format), next to the two shapes there were; and the files it writes may depend on a
  folder given to `install`.
- **Devin (never run live):** a new row in the adapter table, written from Devin's hook documentation and tried on
  payloads in the documented shape. `install devin` adds the session start and the `Stop` hook under `hooks` in Devin's
  user config (`~/.config/devin/config.json`, `%APPDATA%\devin\config.json` on Windows) and writes the handoff agent.
  Devin's hooks say the session and the turn, not the folder (read from `DEVIN_PROJECT_DIR`), and nothing says the
  size of the context: no token figure, no transcript. So nothing is measured and no cap applies; the session is told
  at its start to run `step` when a step of the resume point is done, which asks for the handoff. From there it is as
  everywhere: the stop hook sees the handoff written, releases the project and opens the fresh session with `devin --`
  from a terminal; from Devin Desktop it says to open a new chat. The hooks print only what Devin documents (a
  decision with its reason, or context).
- **`step` where a tool's hooks drive:** it used to answer "nothing to do" for any session with hooks. It still does,
  except where that tool cannot measure the context: there the state says which tool it is, so the plain command of
  an `AGENTS.md` works too. "Not now" in such a session waits for the next step, not for a token figure.
- **A session that starts again is still that session.** When VS Code's panel opened the session the headless resume
  had started, the second start wrote the state from nothing: the diet of that start went uncounted in the saving, and
  a "not now" was forgotten. The same session id now keeps what was measured of it (the diet, the last context size,
  "not now", when it started); another session starts from nothing, as before.
- **The whole-bill figure is 27.0% to 31.3%, 29.5% in the middle** (the table said 29.6% to 32.3%, the headline still
  26% to 29%). The replay counted the cap on command output without the re-reads the model makes after a cut: with
  them, measured, that cap saves less than half of what was counted. Headline, table and page now say the same figure.
- **README and page: one table of what each tool gets, and whether it was ever tried live.** Two levels (1, hooks: the
  automation; 2, no hooks: the method, run by the agent because `AGENTS.md` says so) and eight rows, in front of the
  install instructions. "Tried live" is yes for Claude Code only, and "no" is spelled out: written from the tool's
  documentation, run in the tests on input in the documented shape. The page now names Qwen Code, Gemini CLI, Copilot
  CLI, `doctor codex` and the agent without hooks, which it did not. "Help wanted" covers every tool but Claude Code,
  asks for the output of `doctor codex` too, and asks at level 2 whether the agent ran `begin` and `step` unprompted.
- **An agent without hooks (never run live):** `install generic <folder>` makes the folder a Driftless project and
  writes an `AGENTS.md` that tells the agent to run two commands itself: `begin` at the start of a session (the goal,
  the resume point, the design index) and `step` when a step of the resume point is done. Nothing measures the context
  there, so the handoff is asked a step at a time; `step` run again after the handoff is written releases the project,
  and the user starts the next session. Nothing is promised that cannot be kept: no measure, no session opened. An
  `AGENTS.md` that already exists is never written to (the lines to add are shown), and `uninstall generic` removes
  only a file that is still as Driftless wrote it. Where a tool with hooks already drives the project, `begin` and
  `step` step aside.
- **README:** installing from a clone into an empty profile has been tried up to a real handoff; the line said "up to
  the login".
- **`doctor codex` (never run against a real Codex):** Codex skips without a word a hook its user has not approved,
  so an install could look done and do nothing. The new command asks Codex itself, through its app server
  (`initialize`, `initialized`, `hooks/list`: no model request, no login), and says of each Driftless hook whether
  Codex runs it, waits for approval, wants it again after a change, has it switched off or does not list it, with
  the one thing to do (`/hooks`). Exit 0 only when Codex says it runs both. Driftless never writes the approval
  itself (`trusted_hash`): that is Codex's question to its user. Written from Codex's protocol source (0.167.2) and
  tried on a stand-in that answers in that shape; a Codex too old to know the question, one that is not on PATH and
  one that never answers are each said so, and no process is left behind. `install codex` now points to it.
- **Qwen Code, Gemini CLI and Copilot CLI (never run live):** three new rows in the adapter table, written from each
  tool's hook documentation and tried on payloads in the documented shape. `install qwen|gemini|copilot` wires the
  session start and the end-of-turn hook (`Stop`, `AfterAgent`, `Stop`) and writes the handoff agent in each tool's
  format. Qwen Code reports the context in its stop hook (tokens, window, share in use); Gemini CLI's is read from its
  session file, JSON lines or the older single document; Copilot CLI documents neither, so it is estimated from the
  transcript's size. The fresh session opens with `qwen -i` (same approval mode), `gemini -i`, `copilot -C … -i`.
  Copilot CLI gets a hooks file of its own (`~/.copilot/hooks/driftless.json`, removed whole at uninstall); the other
  two keep hooks in the user's settings file, where Driftless adds and removes only its own entries.
- **Uninstall touches only what Driftless wrote:** under `hooks`, anything that is not a group holding a hook of ours
  stays as it was (a list of something else, a group left empty). Before, such a list was rewritten as empty groups.
- **A harness that needs JSON on stdout gets it in its own words:** the answer kept for the end of the run (Codex,
  Gemini CLI) skipped the harness' own output format.
- **One table of adapters:** the core asked "which harness is this?" in 43 places; it now asks the harness' row what it
  does and what it lets Driftless do, and `install` reads the same row. A new harness is a new row. No behaviour changed.
- **OpenCode 2.x:** the plugin was written for the 1.x API, which 2.x does not run. One file now serves both
  generations. Written from OpenCode's documentation and schema and driven by a stand-in host in the tests; never run
  in OpenCode 2.x. Where 2.x cannot bring the fresh session to the front, the handoff request says so.
- **Cursor, from what others' code shows:** the transcript is found by conversation id when the hook gives no path
  (the CLI never does); `input_tokens` in the stop payload can only lower the size estimate; the editor's model
  `default` gives way to `model_id`.
- **No reopen promised where none can happen:** where Driftless cannot open a session (the SDK, `claude -p`, an editor
  chat of another agent) the session start and the handoff request used to say the project "reopens by itself"; the
  agent repeated it to the user, and only the last message told the truth. Both now say how to go on by hand.
- **A status line (Claude Code):** `Driftless · ctx 142k/260k (55%) · cache 37m · saved $67.82`, the context against the
  handoff limit, the minutes left on the prompt cache, the saving so far, and `handoff due` / `handing off` / `another
  session drives`. No tokens: the context and the cache come from Claude Code on stdin (~0.1 s, every answer and once a
  minute). A plugin cannot declare one, so it is written in the project's `.claude/settings.local.json` (recorded like the
  diet, taken back by `diet undo`) and in the settings of the sessions Driftless opens; never over a status line of the
  user's. `statusline off|on` per project. Path with forward slashes: Claude Code runs it through Git Bash on Windows.
  The VS Code panel draws no status line command: there a hooks module (`hooks/panel-status.mjs`, `$.ui.status`) pins
  the same line from `statusline panel`, every answer and once a minute, without the cache minutes; nothing outside a
  project or with the bar off; silent in the terminal. Plain text there: the panel offers plugins no colored band.
  Terminal colors on request: `bar_colors` in the project's config (background, label, context, alert, muted, each a
  `#rrggbb`), plain text by default.
- **A copy of the end of the conversation at every answer (Claude Code):** the stop hook of the session that drives
  writes it to `.driftless/snapshot.md` (tool results left out, ~15 ms on a 6 MB transcript, no tokens); a
  `.driftless/.gitignore` keeps it and `cold-restart.md` out of git. The next session is pointed to it only when the one
  before ended without a handoff (window closed, machine off), never after `/clear`. The user's documents are never written.
- **Cold restart, off by default (`"cold_restart": true` or minutes in `.driftless/config.json`):** a message sent to a
  session idle past its prompt cache, with a context well past a fresh start, goes on in a fresh session with the end of
  the conversation and the message itself (`.driftless/cold-restart.md`), instead of re-sending the whole context at the
  write price. No handoff agent; commands, plan mode and surfaces where nothing can be opened are left alone. Worth about
  0.6 points of the whole bill on the author's history; not tried live yet.
- **The whole-bill figure is now −29.6/−32.3%** (was −26.4/−29.1%): the replay priced a handoff with the
  first 3 handoffs ever measured, $1.08 on Opus 5.5; 17 real handoffs cost $0.19 for the agent (Sonnet, medium effort)
  plus $0.26 for the main thread's launch, $0.45 in all. No code changed: the handoff was already that cheap.
- **The fresh session says what it is for:** it is named "<project> · <next step>" (a few words the handoff agent
  writes with the handoff), not just after the project; plain words only, at most 40 characters; the project name when
  there is no title. Sessions are still told apart by their id.
- **Your own agents and skills are never hidden by the diet.** Like `CLAUDE.md`, they say how you work: the diet hides only
  a plugin's skills, connectors and built-in tools never used. You can still hide one of yours by name (`diet hide`, `diet
  apply`); what an earlier diet hid of yours comes back at the next session start. On the author's machine this puts about
  8,100 tokens back at every start (first live start: 59,044 tokens, as estimated), and the whole-bill figure goes from −27.7/−30.3% to −26.4/−29.1% on the same history.
- **The figure up front:** README and page open with the saving on the whole bill against never resetting, with every
  comparison right under it.
- **Help wanted for Codex, Cursor and OpenCode:** not tried live, and not going to be here; what to report if you try them.
- **Your settings are safe from the diet:** it adds to `.claude/settings.local.json` only what is missing and records it, so
  `diet undo` takes back only what it added: a `deny` or `skillOverrides` entry of yours stays, even when it hides the same
  thing. A settings or hooks file that is not valid JSON is never written over, in Claude Code, Codex or Cursor.
- **Shared files under a lock, written whole:** `sessions.json`, the registry, the baton, the state, the subagents' budget,
  the diet's lists. Twelve sessions starting at once lost five of their twelve entries; now none (tested).
- **Session start does the vital part first:** baton, binding and state before anything slow, and the slow part (the diet's
  scan, the saving count) within a time budget, so a start cut short no longer leaves the session blind.
- **No second window after a stop cut short,** and one history replay in the background at a time.
- **No question when nobody is at the keyboard:** `claude -p`, the SDK or a CI job outside a project are not asked "new,
  resume or ignore".
- **Plan mode:** no handoff is asked for while a session is planning (it could not write the documents); it is said once and
  asked at the first answer after it. The fresh session never starts in plan mode; `permission_mode` in the project config
  fixes the mode fresh sessions start in.
- **Windows:** no `cmd.exe /c start` (a folder with `&` or `%` in its name could run something else); npm's `.cmd` shims found
  everywhere; `;` escaped for Windows Terminal.
- **The budget note is trusted by its channel only:** a file or web page titled like it carries no authority.
- **Subagents: the size guard alone by default.** Replayed with what a successor really has to find again (half of what the
  agent gathered, at least 10,000 tokens), the cost rule stopped 172 subagents for −27.3% on the whole bill, the guard alone
  79 for −27.5%. `"subagent_budget": "rule"` adds the rule back.
- **Honest numbers:** in `audit`, a session joins the one before only within 48 hours, the first turn a continued session spends
  reading its place again is left out of every replay, and a fresh start costs the mean rediscovery (4,927 tokens), not the
  median. README and page give every figure with what it is measured against.
- **Driftless says when it goes blind:** a transcript that has grown with no token usage in it (once per Claude Code
  version), no subagents folder where their transcripts should be, a handoff agent that wrote nothing in its time. Recorded in
  `~/.driftless/probe.json`, shown by `status`. The session context cut at the hook limit now says so.
- **The tab VS Code opens starts lighter:** the panel resumes the fresh session as a process of its own, without the
  settings of the headless resume, and was taken for that resume, so it had no diet at all, nor had its subagents. The diet
  now goes into the project's settings before the tab opens, and the tab says so once. Any other session started in the
  minutes after a commanded start is a session opened by hand.
- **Subagents get a budget:** past 260,000 tokens (or, with `"subagent_budget": "rule"`, past the cost rule), the
  agent is told to report what it did and what is left, and the main thread to hand the rest to a fresh agent. The note says
  it comes from your own hooks (without that, Haiku ignored it as an injection), and the main thread reads the agent's id
  where Claude Code puts it, a harness line a reply cannot forge. A fork, which starts from its parent's context, is not
  stopped by the 260,000 guard: replayed on the author's history, stopping forks cost three times as much.
- **Built-in tools in the diet:** weighed from the request shape Claude Code writes; one never used on the machine is hidden
  (Artifact alone is about 14,000 tokens). `diet hide` puts one off everywhere on your word.
- **One handoff at a time:** while the handoff agent was at work, maybe in the background, the end of the turn asked for a
  second one (seen live at 268,237 tokens). Driftless now waits for its result, up to 20 minutes.
- **One registry row per project on Windows:** VS Code writes `c:\`, a terminal `C:\`; the same project was listed twice.
- **Driftless on is the yes to the diet:** a session opened by hand no longer asks whether to write the diet into the
  project's settings: the first one writes it by itself and tells you what it hid and how many tokens it saves; `diet undo`
  takes it back for good. CLAUDE.md, memories and rules are never part of it.
- **The fresh session opens where you work:** from VS Code's extension, a new tab of the Claude Code panel in the same editor
  window, with the resume answer already there; from the desktop app, the app; from a terminal, a new terminal window. Never a
  terminal you do not use: from anywhere Driftless cannot open (the SDK, an editor chat of Codex or Cursor) the project is
  released and you are told to open a new chat. The link to the panel used to reach no window at all: the editor started to
  open it inherited `ELECTRON_RUN_AS_NODE` from the extension host and dropped it; and it went to whichever editor window was
  active, now `windowId` sends it to the session's own window (checked live). And the tab opened an empty chat instead of the
  resume: the panel does not list sessions started with `-p` (entrypoint `sdk-cli`), so the link found nothing to open; the
  headless resume now runs as `claude-vscode`, the session it continues in (checked live: the tab resumes it). Then the tab
  waited for you to type: now it goes on with the next step by itself. The panel's link cannot send a prompt, so the
  session-start hook gives the session Driftless just opened its first message (`initialUserMessage`), once and only while
  fresh (checked live: a resumed tab answered with nobody typing).
- **It knows which project it is on, wherever it starts:** a session started outside the project (VS Code open on the
  folder above, or on another one) can `attach` it from where it is, and keeps it by session id, `/clear` included; a folder can be
  `link`ed to a project once, and every session started there starts on it. The question at session start lists the projects
  inside the folder first. `status`, `later`, `off`, `audit` and `diet` work on the session's project, not only on the folder's.
- **`/clear` keeps the baton:** the new session id in the same process was taken for a second live session and told not to touch
  anything.
- **One project only:** `--scope local` installs the plugin for a single folder, every other project untouched; a session
  opened there by hand, in the terminal or in VS Code's panel, has Driftless too. When that folder enables this very copy
  from a directory marketplace, the fresh session is no longer started with `--plugin-dir`, which would only have turned
  the installed plugin into an "inline" one (checked live: never loaded twice).
- **Stopping for the day:** a handoff can end without a new window (`"reopen": false` in `handoff.json`, which the agent writes when
  you say you are done for now): the project is released and Driftless stays on. Before, the only way not to reopen was `off`,
  with `on` to remember afterwards. A handoff you ask for by hand ends there, unless you ask to go on in a fresh session.
- **Handoffs by hand release the project:** the agent did not know its own session id, so a handoff it ran without being asked
  was never recognised and the baton stayed held. Session start now gives the id, and a `handoff.json` without it, written
  while the session drives the project, counts as that session's. A handoff already acted on is not acted on again.
- **"Not now":** `later` drops a handoff Driftless asked for; it comes back once the context has grown by another 50,000 tokens,
  in that session only.
- **`audit` shows where the money goes:** spend by origin (tool results, tool inputs, session start, thinking, text, prompts), main
  thread and subagents apart, against what was really spent, with a warning when more than 5% does not add up; Bash and read-only
  commands; subagents past 300,000 tokens and by type; how much the best ten pieces of work make; the saving on the whole bill.
- **The saving says itself (Claude Code):** each finished session goes into `.driftless/savings.json` with the same code as the replay,
  and one line at session start reports it from $0.10 up. Until then, a line from your own past work, at most once a day.
- **One background process, declared:** once a week session start launches `audit --all --refresh`, which stays on this machine, writes
  `~/.driftless/history.json` and ends by itself.
- **Cut documents say so:** a document injected at session start and cut for length now names the file that holds the rest.
- **Automatic diet (Claude Code):** every session Driftless opens starts with settings for that session only: what this machine
  has never used is hidden, command output over 8,000 characters goes to a file. −18% on the author's start. Nothing of the
  user's is written, and no `CLAUDE.md`, memory, rule or description is touched. It comes back by itself when asked for;
  `diet keep` and `diet auto off` are the way out. The question at session start is gone: it could stall a chain with no one there.
- **A limit on size, in mid-turn too (Claude Code):** whatever the sums say, the handoff is asked for at 260,000 tokens (or at
  80% of the window if lower, or at your cap), at the end of a turn or between two tool steps, where the `PostToolBatch` hook finds it
  and asks to finish the step in progress. About 10% further on it insists at every step. It never stops the agent's loop: no stop
  hook runs after a stopped loop (measured), and the handoff would wait for someone to type.
- **Token estimates:** characters become tokens at the rate measured on Claude's usage (0.45 per character), not at the usual 4
  characters per token, which made the diet report about half of what it would save. Cursor's estimate uses it when the model is Claude.
- **The page and the README say what the percentages compare:** whole bill, manual handoffs, how few long pieces of work make
  the saving; which tools were ever tried live; and what the figures of speech stand for.
- **Economic rule by default:** with no cap set, Driftless hands off when carrying the context has cost as much as a fresh
  start, with the prices of the model in use (`data/pricing.json`), before a price jump, and always by 80% of the window. Tools
  that do not report every request use the threshold the prices imply. `token_cap` and `cap_percent` still win.
- **`audit`:** replays your own history under each policy, with a 95% interval, subagent share and cache lifetime. No tokens, nothing sent.
- **Native compaction is blocked in Claude Code** (`PreCompact`): automatic and idle. It was not before, despite the project's promise.
- **Diet:** decided on the whole machine's history (ten sessions at least), never-used items first, rarely used ones apart with a
  Beta-Bernoulli estimate. It used to go by three sessions of one project, which left needed items off too often.
- **Handoff agent on Sonnet** in Claude Code, instead of inheriting the session's model.
- **The fresh session keeps the model and effort** of the one that handed off, instead of falling back to the user's default;
  `model` and `effort` in the project config set them.
- **Codex, Cursor and OpenCode** besides Claude Code: one core, an adapter per tool, `install` / `uninstall`.
  OpenCode runs in-process and opens the fresh session in the same window.
- `off` / `on` (per project or `--global`): stop Driftless without uninstalling it; the agent knows the command.
- Explanation page in `docs/` (GitHub Pages) and a CI matrix (Linux, macOS, Windows; Node 18 and 22).
- Cap as a percentage of the context window (`cap_percent`), alone or with `token_cap` (the lower wins).
- Diet: report what this machine has installed and what to switch off; apply, undo.
- `DESIGN.md` index injected at session start and kept by the handoff.
- `CLAUDE_CONFIG_DIR` respected for transcripts and installed plugins.
- The fresh session keeps the permission mode of the session that opened it, `bypassPermissions` included
  (`open` reads it from that session's transcript): it no longer falls back to a default that may deny every tool.
- New project: the logbook's resume point is set to the first step toward the goal before the project opens.
- Trust once: `init` says when a new project's folder is not trusted yet; trusting the folder that holds
  the projects once covers every new project (README, "Trust once").
- Smoke tests (`npm test`), green on Windows and Linux with Node 18, 20 and 22.

## 0.1.0
- First prototype: session-start and stop hooks, handoff agent, skill, templates; fresh session in a new
  terminal window or the desktop app.
