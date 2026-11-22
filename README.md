<img src="docs/icon.svg" width="72" height="72" align="right" alt="">

# Driftless

[![test](https://github.com/Tigierre/driftless/actions/workflows/test.yml/badge.svg)](https://github.com/Tigierre/driftless/actions/workflows/test.yml)

**About 30% off the Claude Code bill on a real month of work: Driftless hands off before the context rots and reopens
the project in a fresh session, by itself, without drifting from what you set out to do.**

<img src="docs/handoff.gif" width="880" alt="A Claude Code session: the context climbs to 148k tokens; Driftless says a fresh start now costs less and asks for the handoff; the agent writes DESIGN.md and the resume point in LOGBOOK.md, never NORTHSTAR.md; a fresh session opens by itself and resumes from the resume point at 18k tokens.">
<sub>An illustration drawn from Driftless' real messages; the numbers in it are an example.</sub>

- **A changing of the guard, by itself.** When carrying the context costs more than a fresh start, the agent writes where
  things stand into the project's documents and the project reopens in a fresh session, which resumes from the resume
  point. No `/compact`, no `/clear`, nothing to type, no threshold to tune.
- **27% to 31% off the whole bill, subagents included**, replayed on the author's own month of work. Every comparison,
  the weak ones too, is in [What it saves](#what-it-saves). One command replays yours, locally, spending no tokens.
- **A Claude Code plugin**, with adapters for Codex, Cursor, OpenCode and seven more (only Claude Code is tried live:
  [help wanted](#help-wanted)). No server, no dependencies, nothing sent anywhere. Needs Node.js 20 or later.

```
/plugin marketplace add Tigierre/driftless
/plugin install driftless@driftless
```

Not sure yet? See first what it would have saved you on your own Claude Code history, without installing the plugin.
From a project folder you have worked in with Claude Code (`--all` for every project on this machine):

```
npx github:Tigierre/driftless audit
```

Every project lives in three documents with distinct jobs:

| Document | Job | Who changes it |
|---|---|---|
| `NORTHSTAR.md` | The goal, in your words: why, how you'll know, what you don't want | Only you |
| `DESIGN.md` | Durable source of truth, by topic, kept as-is, with an index at the top | The agent, at every handoff |
| `LOGBOOK.md` | Last 3 tasks in detail, older ones one line each, and the **Resume point** | The agent, while working |

## Why not `/compact`?

- **Where the memory lives.** `/compact` and auto-compact have the model summarize the conversation inside that one
  conversation; you don't choose what it keeps. A Driftless handoff writes where things stand into files in your project
  (`DESIGN.md` by topic, the resume point in `LOGBOOK.md`) that you can read, fix and commit, and that the next session,
  tomorrow's or another tool's, starts from.
- **The goal does not drift.** Summaries of summaries lose the why. `NORTHSTAR.md` is never rewritten by the agent: every
  session starts from your own words.
- **When.** Auto-compact steps in when the window is nearly full, when every request is at its most expensive. Driftless
  hands off when carrying the context has cost more than a fresh start would, so the moment is set by price, not by a
  fixed percentage.
- **`/clear` without forgetting.** A fresh session is cheap; losing what you did not write down is not. Driftless writes
  it down first, then opens the fresh session for you.

It does not claim to beat a well-timed manual `/compact` in dollars: [What it saves](#what-it-saves) compares with never
resetting, and against careful manual handoffs the gain is 3.5%. What it takes off you is watching the meter.

## Install

Driftless needs **Node.js 20 or later** on your PATH: every hook runs `node`, and Claude Code's native installer
does not bring it.

**Claude Code** — as a plugin:

```
/plugin marketplace add Tigierre/driftless
/plugin install driftless@driftless
```

To try it on one project only, run these from that project's folder (to run it from a clone of this repository instead,
give the clone's folder in place of `Tigierre/driftless`):

```
claude plugin marketplace add Tigierre/driftless --scope local
claude plugin install driftless@driftless --scope local
```

### Then trust your projects folder, once

Claude Code asks "Do you trust the files in this folder?" the first time it opens a folder. A new project
is a new folder, so its first fresh session would stop on that question. That is the one click Driftless
cannot take for you, and it should not: trust is a security decision. No setting or flag skips it.

Outside a git repository, trust covers subfolders. So keep your projects under one folder and trust that
folder once, right after installing (and set it as the plugin's **Projects folder**, `projects_root`, so new projects
are created there):

```
cd <the folder that holds your projects>
claude          # accept "trust this folder", then exit
```

From then on, every project Driftless creates there opens without asking. `init` tells you when a new
project is not covered yet. A project that is its own git repository is trusted at its repository root,
so it asks once, the first time.

### Other tools

Clone the repository (`git clone https://github.com/Tigierre/driftless.git`; Node.js 20+), then once per tool `node <clone>/scripts/driftless.mjs install <tool>`, where `<clone>`
is the folder you cloned it into; `uninstall <tool>` removes exactly what `install` added. Keep the clone: the hooks run from it.

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
the tool itself. If you use one of them, see [Help wanted](#help-wanted). What each tool gets, its one-time step and
its limits: [Install, tool by tool](docs/install.md).

## How it works

1. **Start.** In a folder that isn't a project, Driftless asks: new project, resume one, or just work here.
   A new project gets its folder, the three documents and a North Star interview. A folder that already keeps
   documents like them (a vision, a spec, handoff notes) keeps them: Driftless creates only what is missing, and asks
   you, for each one found, to keep it as it is or have it rewritten from scratch.
2. **Work.** Every session starts with the goal, the resume point and the design index already in
   context — and reads only the design sections it needs.
3. **Time to hand off.** Driftless keeps the account of what carrying the context has cost ([the rule](docs/how-it-works.md)). When
   it pays to start fresh, or at a cap you set, the agent is asked to run the `handoff` subagent: durable
   decisions go to `DESIGN.md`, the logbook is compressed, the resume point is rewritten with a course check
   against the North Star. In Claude Code this also happens in the middle of a long turn.
4. **Fresh session.** Driftless opens a fresh session in the project, where you were working — a new tab of
   the Claude Code panel in the same VS Code window, the desktop app, a new terminal window if you work in a
   terminal, a new session in the same window in OpenCode and Kilo Code, a new thread in Amp — whose first prompt is "resume
   this project from the resume point". Never a terminal you do not use: where it cannot open a session by itself,
   it says so and you open a new chat. The old session stops. If Claude Code says it still has background tasks
   or scheduled tasks, Driftless names them when it asks for the handoff and again when the session ends: they
   are the old session's, and will wake it.
5. **One driver.** A baton (`.driftless/baton.json`) keeps two live sessions from steering the same project. In
   Claude Code the project goes to the session you write in, not to the one that opened first: when the editor
   reopens and brings its tabs back, none of them takes the project until you send a message there. A session
   kept out by another takes the project by itself at your next message, once that other session has ended.
   A turn you did not write is not a message of yours: a background task that reports, a message from another
   session or a scheduled task that fires takes no project, so a chat that handed the project on does not take
   it back by being woken.
   The baton names the process of the session that holds it. In OpenCode, Kilo Code and Amp the plugin says that
   process at the end of every turn, so a session that took the project with `attach` (a command the model runs
   from a shell, which is gone at once) still holds it.

**The threshold, if you want one.** By default there is nothing to tune: Driftless hands off when carrying the context
has cost as much as a fresh start. To set your own limit, in `.driftless/config.json`:

| Option | Example | Meaning |
|---|---|---|
| `token_cap` | `340000` | Hand off at this many tokens. |
| `cap_percent` | `34` | Hand off at this share of the model's context window. |
| both | `34` + `340000` | The lower of the two wins: the token cap is an absolute ceiling. |

Or just ask the agent for a cap: it offers **260k, 340k or 400k** and runs `cap 340k` (`cap auto` goes back to the rule).
No cap goes past **400,000 tokens**, whatever a config or a percentage of a 1M window says.

In Claude Code a status line shows where the session stands, so you never need `/context`:

```
Driftless · ctx 142k/260k (55%) · cache 37m · saved $67.82
```

In detail (the rule and its guards, mid-turn and subagent handoffs, one-shot runs, cold restarts, sessions opened
outside a project, compaction): [How it works, in detail](docs/how-it-works.md).

## What it saves

Read each percentage against what it compares. The "before" is **never resetting**: each piece of work carried in one session
until it is done, with no handoff, no `/clear` and no compaction, on a 1M-token window (how the author works). On a 200k window
native compaction would step in first, so your "before" may cost less than this one. All figures come from one machine, one
person, one month, Opus 5.5, at list prices.

| Against | What | Saving |
|---|---|---|
| never resetting | everything built today: rule, size guards, diet, command output limit (replayed on 73 pieces of work, with the handoff priced at what 17 measured handoffs cost and the re-reads after a cut output counted; the lighter start estimated, quality not measured) | **27.0% to 31.3% of the whole bill** (29.5% in the middle) |
| never resetting | the rule alone, main thread (`audit --all`, run later on a larger history: 97 pieces of work) | 30.1% (95% interval 18.2% to 43.6%) |
| never resetting | the rule alone, whole bill with subagents | 19.3% |
| the same author's careful manual handoffs | the rule, main thread | 3.5%: the value is not having to watch a meter |
| short work, under 100 requests | the rule | about 0% |

Ten long pieces of work out of 73 make 85% of the saving; without them the rule saves about 10%. Your history is not the
author's: `audit` replays yours (see [Ask your own history](#ask-your-own-history)).

**The goal was 50% off the whole bill, subagents included, at the same model: it is not reached.** What is built today
gives the 27% to 31% above; the rest of the way was studied and no lever left at the same model is worth a release.

### Ask your own history

In Claude Code, ask the agent: "does Driftless pay off here?", or "on all my projects?". Without installing anything,
in the project's folder (Node.js 20+):

```
npx github:Tigierre/driftless audit           # this project (Claude Code transcripts)
npx github:Tigierre/driftless audit --all     # every project on this machine
```

From a clone, `node <clone>/scripts/driftless.mjs audit` does the same.

`audit` replays your sessions under each policy at today's list prices and says what each would have cost, with a 95%
interval. It spends no tokens and sends nothing anywhere. **On short sessions it will tell you Driftless does not save
money.** In Claude Code you don't even have to ask: the saving on each project is counted as you work and said at
session start. More: [Does it save you anything?](docs/savings.md)

## Stop it

**Stopping for the day is not switching off.** Tell the agent you are done for now ("handoff, I'm done for today"): it runs the
same handoff, the project is released, no new window opens, and Driftless is still on next time. A handoff you ask for by hand
ends there unless you ask to go on in a fresh session. If Driftless asks for a handoff at a bad moment, say "not now": the
request comes back once the context has grown by another 50,000 tokens (`later`), and the next session starts clean.

Driftless runs no service: it lives in the agent's hooks. What it starts on its own ends by itself: the weekly replay
([Does it save you anything?](docs/savings.md)), the count of a session's saving after it ends, and, in VS Code, the
headless start of the fresh session that the panel then opens. To stop it without uninstalling, tell the agent; it knows the command:

| Say | What happens |
|---|---|
| "stop Driftless" | this project: no context, no cap, no handoff, no fresh session |
| "stop Driftless everywhere" | every project, the new / resume question included |
| "turn Driftless back on" (here, or everywhere) | back on |
| "no Driftless status line here" | this project: no status line, from the next session (Claude Code) |

It takes effect from the next answer, drops a handoff already asked for and frees the baton. From a clone, in the project's
folder, the same is `node <clone>/scripts/driftless.mjs off`, `off --global`, `on [--global]`, `statusline off|on`; outside
Claude Code a session that starts with Driftless off no longer knows the command, so switch it back on that way.
`uninstall <tool>` removes Driftless from any other tool of the [table](#install); in Claude Code, `/plugin` disables or
uninstalls it.

## Safety, in short

Driftless runs as a hook of your agent, in folders you may have cloned from anyone. What it does about it, each point
in full in [Safety](docs/safety.md):

- **The fresh session inherits the permission mode of the session that handed off, except bypass:** nobody watches it
  start, so a session in bypass hands off to one in `acceptEdits`, unless you turn on the option `carry_bypass`. A
  project's `.driftless/config.json` can make it stricter, never looser; plan mode is never handed on.
- **What a cloned folder brings in `.driftless/` is not taken for yours:** the files that say which session drives
  carry a seal only your machine can make.
- **What it reads into the context stays inside the project:** a document that leads outside it is not read, and
  names from a project's files are said as plain words.
- **What it writes in `.driftless/` stays out of git**, all but `config.json`.
- **A folder above is your project only if it is yours** (on Windows, only if you already know it as a project).
- **A file of yours stays as you made it:** never written over when it does not read, written through its link, with
  its permissions, and not at all for nothing.
- **The skill runs only Driftless' own script without asking.**

## The diet: a smaller fixed cost at every start

Before you type anything, a session already carries tool schemas, connector names, skill and agent listings: tens of
thousands of tokens, most of which a given project never uses. In Claude Code, the sessions Driftless opens start
without what this machine has never used, and long command output goes to a file. Nothing of yours is touched: your
CLAUDE.md, memories, rules, agents and skills are never part of it unless you name them, and a hidden skill still works
as `/name`. How it decides, and how to see or undo it: [The diet](docs/diet.md).

## Requirements and limits

- Node.js 20+ on PATH — every hook is one script, `scripts/driftless.mjs` (OpenCode, Kilo Code and Amp run it in-process).
- The fresh session opens where the session that handed off was running. From the VS Code extension (or a
  fork that runs it): the resume runs headless, then a link opens it in a new tab of the panel, in the same
  editor window (found from the session's process and the editor's own logs), with the answer already there,
  and goes on with the next step by itself (the panel cannot send a prompt, so Driftless' session-start hook
  gives that one session its first message, once); if the headless resume fails, the tab opens with the
  resume prompt ready to send. From the desktop app: the
  app. From a terminal: a new terminal window — Windows Terminal or a console on Windows, Terminal on macOS,
  the system terminal emulator on Linux. Anywhere else (the SDK, a CI job), no window: you resume by hand; a one-shot
  `claude -p` is asked for no handoff at all.
  `"surface"` in `.driftless/config.json` (`vscode`, `desktop`, `terminal`, `none`) overrides the choice.
- To use the plugin in a second folder too, enable it in that folder's `.claude/settings.local.json`
  (`"enabledPlugins": { "driftless@driftless": true }`, plus the same `extraKnownMarketplaces` entry) rather
  than installing it again: a second `--scope local` install loads it once per session but lists it twice.
- Agents ask once whether to trust a folder they have never opened. See [Then trust your projects folder, once](#then-trust-your-projects-folder-once).
- Context is read from the session's own files (Claude Code, Codex, Gemini CLI), reported by the tool (OpenCode, Kilo Code, Amp, Qwen
  Code) or estimated from the transcript's size (Cursor, Copilot CLI); the files' formats are not documented. Devin
  and Kiro give nothing to measure.
- The diet is for Claude Code only. The sessions Driftless opens carry it for that session only; for the ones you open by
  hand, the first of them in a project writes it to the project's `.claude/settings.local.json` by itself and tells you
  (Driftless on is the yes; `diet undo` takes it back for good). Your CLAUDE.md, memories, rules, agents and skills are never
  part of it unless you name them.
  Not the desktop app. With `diet apply`, claude.ai connectors go all together.

## Help wanted

Only Claude Code is tried live. Every other row of the [table](#install) is **not tried**: built from the tool's
documentation and covered by the smoke tests. Codex, Cursor, Kilo Code, Amp, Qwen Code, Gemini CLI, Copilot CLI, Devin and Kiro
have never run Driftless, OpenCode only once, before the economic rule, and no real agent has ever followed the `AGENTS.md` of level 2.
The author works on Claude Code only, so none of it will be tried here. If you use one of them, please try it and open
an issue (**New issue → Tried on a tool** asks for all of it):

- the tool and its version, and your operating system;
- the output of `node <clone>/scripts/driftless.mjs status` and of `doctor <tool>`, both run in the project's folder (every tool
  of level 1 but Claude Code has one);
- what happened at the first handoff: was it asked for by itself, did the handoff agent run, did a fresh session open, and where;
- at level 2: did the agent run `begin` and `step` because `AGENTS.md` says so, or only when you told it to.

"It worked" is worth as much as a bug report.

## Development

```
npm test        # smoke tests, each hook and command in a throwaway home; no model, no windows
```

`DRIFTLESS_DRY_OPEN=1` records the fresh session in `.driftless/dry-open.json` instead of opening it.

## License

MIT. Security problems: see [SECURITY.md](SECURITY.md).
