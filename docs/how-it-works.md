# How it works, in detail

[← Back to the README](../README.md)

## When it hands off

**By default, when it pays.** Every request re-reads the context from the cache: a little money each time.
A fresh start costs once: the handoff, the new session's first requests, what it has to read again. Driftless
keeps both figures with the prices of your model (`data/pricing.json`) and hands off when what you have already paid to
carry the context reaches the cost of a fresh start. It is the classic rent-or-buy rule: it needs no tuning, cannot be
worse than twice the best possible choice, and leaves alone a short session that is about to end.

The cost of a fresh start is built from its parts, each at the price of the model that pays it: the handoff agent's
own run (measured on 38 handoffs: about 39,000 tokens written to the 5-minute cache, 137,000 read, 7,200 of output),
the session's three requests around it (the launch, the line while the agent works, the closing one: each reads the
whole context again), the new session's start and what it reads again. On Opus 5.5 with the agent on Sonnet 5.5 that
is about $0.80 for a session that restarts at 80,000 tokens. What your own rules ask at every handoff on top of
that is yours, and is not in the figure.

The price list is a file, read from the public pages on the date it carries (`as_of`). A release it has not heard of
(say a 5.3 when it stops at 5.2) is weighed with the prices of the newest release it knows of that family, not of the
first; a new major version, or a model of another family, has no price and gets the plain threshold below.

On the author's history it stays within 1% of the best fixed cap chosen with hindsight, on every price list tried.
A well-chosen fixed cap is statistically as good: the point is not having to choose it, for each model, again.

| Rule | What it does |
|---|---|
| Fresh start cheaper than carrying on | Hand off. Dearer cache reads hand off sooner, cheaper ones later |
| A price jump ahead (Haiku 5.5 at 100k, GPT-5.6 and GPT-6 at 272k) | Hand off at 60% of the jump, if a fresh start lands below that |
| 260,000 tokens, or 80% of the context window if lower | Hand off whatever the sums say |
| A tool that does not report every request (Codex, Cursor, OpenCode) | A threshold computed once from the prices: `S + √(2·H·g / r)` |
| A model without a price | 250,000 tokens, or 80% of the window if lower |

**Or at a cap you choose**, which always wins over the rule:

| Option | Example | Meaning |
|---|---|---|
| `token_cap` | `250000` | Hand off at this many tokens. |
| `cap_percent` | `34` | Hand off at this share of the model's context window. |
| both | `34` + `250000` | The lower of the two wins: the token cap is an absolute ceiling. |

**In the middle of a turn, too (Claude Code).** The end of a turn is the natural moment to hand off, but one turn can grow
by hundreds of thousands of tokens. So after every tool step a hook compares the context with the 260,000 above, or with your
cap: past it, the agent is told to finish the step in progress and hand off, leaving what remains as the next step of the
fresh session. About 10% further on (285,000 by default) the request is repeated at every step, firmer. It stays a request:
a hook could stop the agent's loop, but nothing would then run the handoff until someone typed, so a model that ignored
every request could still go past it. This is a limit on size, not on cost, and it does not depend on the prices.

**Not in a one-shot run (`claude -p`).** `claude -p "..."` answers one prompt and leaves, and its last message is what the
script that called it gets. A handoff asked for there is run inside the same execution (seen live): the script is handed
"handoff done" in place of its answer, pays for the handoff, and nobody is there to go on in a fresh session; asked in the
middle of a long job, it would cut the job short. So a one-shot run is asked nothing, at its end or half way. It still gets
the project's context at its start, and the end of its conversation is kept for the session that comes next, which is told
the one before ended without a handoff. A program that keeps the process open and feeds it turns
(`--input-format stream-json`) and the Agent SDK are asked as any session, with no window to open: you resume by hand. If a
program of yours runs `claude -p` once per message and shows every message to a person, `"one_shot_handoff": true` in
`.driftless/config.json` asks there too.

**Nor in the other tools' one-prompt modes.** They work the same way, read in the source of Codex, Gemini CLI and Qwen
Code and in the documentation of Copilot CLI, Cursor, Amp, Devin and Kiro, and never run live. In the three read at the source, a stop
hook that sends the agent back keeps the run going inside the same process, and the handoff ends up in what the caller
gets: the last message of the turn in `codex exec`, both answers one after the other in `gemini -p` (in its JSON output,
only the text after the last tool call), the last assistant message in `qwen -p`. None of them says its mode in what
it hands a hook or a plugin, so Driftless reads it where it is: on the command line of the tool's own process, once,
when a handoff would be asked for. `"one_shot_handoff": true` asks there too.

| Tool | Asked nothing when it was started with | Headless too, and not recognised |
|---|---|---|
| Codex | `codex exec` (or `e`), `codex review`, the `codex-exec` program; its TypeScript SDK runs one `codex exec` per turn | — |
| Gemini CLI | `-p` / `--prompt`, or in a CI job (`CI` or `GITHUB_ACTIONS` set to `true`); never with `-i` or `--acp` | a piped stdin or a redirected stdout, without `-p` |
| Qwen Code | `-p` / `--prompt`, or a prompt among the arguments without `-i`; never with `--input-format stream-json` (its SDKs) | a prompt piped in with no argument; a prompt right after a switch that takes no value (`qwen --yolo "fix it"`) |
| Copilot CLI | `-p` / `--prompt` | a prompt piped in with no switch |
| Cursor | `agent -p` / `--print` | print mode inferred from a piped stdin or a redirected stdout |
| Amp | `amp -x` / `--execute`, unless a program feeds it messages (`--stream-json-input`) | execute mode turned on by a redirected stdout alone |
| Devin | `devin -p` / `--print`; never `devin acp`, the server an editor talks to | none documented |
| Kiro | `kiro-cli chat --no-interactive` (its hooks are loaded there since CLI 2.27.1, on its V3 harness) | none documented |

A run that is not recognised is asked as a session is: what Driftless did everywhere before. `opencode run` and `kilo run`
are covered by their plugin (above; not in OpenCode 2, where the plugin cannot see how a session was started). Devin and Kiro are asked through the agent's own `step` (above): there such a run is
told at its start that nothing is asked of it, and a `step` it runs all the same asks nothing. On macOS the arguments of a
process come as one line, where the words of a prompt cannot be told from switches: only the switches before the prompt
are read there.

**Inside subagents, too (Claude Code).** A subagent can grow by hundreds of thousands of tokens on its own. After each of its
tool steps Driftless reads its transcript: past 260,000 tokens it is told once to finish the step in progress and reply with
what it did, what it found and what is left; past 285,000 it is told again. The main thread is then told to launch a fresh
agent with only what is left, or to finish it itself. By default that size guard is all: the cost rule of the main thread,
replayed on the author's subagents with what a successor really has to find again, stopped 165 of them for a 29.6% saving
on the whole bill, against 77 for 29.8% with the guard alone, so its extra stops interrupted work for nothing.
`"subagent_budget": "rule"` in `.driftless/config.json` adds it back, `false` switches the budget off. A fork starts from
its parent's context, so the guard does not stop it: a fresh fork could not start lower, and stopping it would pay for that
context twice. The handoff agent is never stopped. The note tells the agent it comes from your own hooks: without that,
Haiku took it for an injection from the file it was reading and ignored it (seen live).

The fresh session keeps the model and effort of the one that handed off; `model` and `effort` in
`.driftless/config.json` set them for the sessions to come. A fresh start is the moment to change them: the prompt
cache belongs to one model, so a change in mid-session pays for the whole context again.

Set the caps when the plugin asks, or per project in `.driftless/config.json`. Hooks are not told the
context window, so Driftless infers it: `context_window` in the project config, then
`CLAUDE_CODE_MAX_CONTEXT_TOKENS`, then `CLAUDE_CODE_DISABLE_1M_CONTEXT`, then a context already past
200k, then the model family (1M for the Claude 5 family and Opus 4.7+), else 200k.

**Back after a long pause: a cold restart (Claude Code, off by default).** The prompt cache of a session lives an hour
from its last use. Come back after lunch or the next morning and your first message re-sends the whole context at the
write price: on the author's history, 81% of the main thread's cache rewrites were exactly that, mostly overnight, at
about 235,000 tokens. With `"cold_restart": true` in `.driftless/config.json` (or a number of minutes, at least 5),
a message sent after such a pause to a session whose context is well past a fresh start (30,000 tokens more) does not
go to that session. Driftless writes the end of the conversation (what you wrote, what the model answered, one line per
tool, about 8,000 tokens at most) and your message to `.driftless/cold-restart.md`, and opens a fresh session that
reads it with the resume point and answers your message. No handoff agent runs: it would have to read the cold context
first, the very cost being avoided, so the project documents are as the session kept them while it worked. Commands
(`/...`), plan mode, turns you did not write (a background task that reports, a message from another session, a
scheduled task) and a fresh session that would have to be opened by hand are left alone. Measured on the author's
history: 0.6 points of the whole bill (0.4-0.8); seen live once, on a session idle for ten hours (161,000 tokens not
sent again).

**A session that ends with no handoff loses nothing (Claude Code).** The window closed, the machine shut down, the
process was killed: the project documents then miss what the session did since they were last written. At every answer
of the session that drives, Driftless copies the end of the conversation (the same extract as the cold restart, tool
results left out; about 15 ms on a 6 MB transcript, no tokens) to `.driftless/snapshot.md`, which a `.gitignore` of its
own keeps out of git. The next session is pointed to it only when the one before ended without a handoff, and not after
`/clear`. Your documents are never written by it.

**A status line (Claude Code).** Without looking at `/context`, the bar under the prompt says where the session stands:

```
Driftless · ctx 142k/260k (55%) · cache 37m · saved $67.82
```

The context against the limit Driftless hands off at (your cap, or the guard: with no cap the rule may hand off before it),
the minutes left before the prompt cache goes cold (a message after that re-sends the whole context at the write price), and
the saving counted so far on this project. It also says `handoff due`, `handing off` or `another session drives`. It costs
no tokens: Claude Code hands the context and the cache on stdin, and Driftless reads only its own small files (~0.1 s,
re-run at every answer and once a minute). A plugin cannot declare a status line, so Driftless writes it in the project's
`.claude/settings.local.json` at the first session there (recorded like the diet: `diet undo` takes it back) and in the
settings of the sessions it opens. **Never over a status line of yours**, in your user, project or local settings: to
show Driftless' part in yours, call `node "<plugin>/scripts/driftless.mjs" statusline` from your script with the same
stdin (ask the agent for "the Driftless status line": `statusline on` prints the command with the real path). "No Driftless
status line here" (`statusline off`) removes it from a project, `statusline on` brings it back. The VS Code panel draws no status line
command, so there a hooks module of the plugin (`hooks/panel-status.mjs`) pins the same line, without the cache minutes
(the panel has its own cache clock); in the terminal the module stays silent and the bar above is the one you see. The
panel draws a plugin's line as plain text, under a "driftless plugin" label it adds itself.

Colors, in the terminal: none by default, your theme's. To choose them, add to the project's `.driftless/config.json`
`"bar_colors": { "background": "#rrggbb", "label": "#rrggbb", "context": "#rrggbb", "alert": "#rrggbb", "muted": "#rrggbb" }`
(any of them): `label` the name, `context` the context and the saving, `alert` another session, a handoff, a cold cache,
`muted` the cache minutes and the dots. Anything but a hex color is ignored.

## Opened somewhere else

Driftless finds the project from the folder a session starts in, walking up. An editor open on the folder
that holds your projects, or on another one, starts sessions outside any project: Driftless then asks, with
the projects inside that folder first, and you can

- **work on one from this window** (`attach`): the session takes it as if it had started there, and keeps
  it wherever its working folder goes, `/clear` included;
- **link the folder to it** (`link <project> <folder>`): every session started in that folder starts on that
  project, without asking. Only that folder, not the ones below; `unlink` undoes it.

The plugin has to be loaded there too: installed for your user, or for that folder.

## Native compaction

Driftless replaces it. In Claude Code the `PreCompact` hook blocks automatic and idle compaction, which is on by default
above 200k after an hour away; a `/compact` you type still works, and right at the context limit compaction goes through,
because a failed request would be worse. In the other tools the handoff comes first at 80% of the window: Driftless does not
change their settings.
