# Changelog

## 0.2.0 — 2026-11-22

- **Documents already there:** `init` in a folder that already holds a goal or vision, a design doc or spec, a logbook
  or handoff notes analyses them first (by name and by what they hold; never `CLAUDE.md`, `AGENTS.md` or a README),
  creates only the missing ones and writes over none. Until the user chooses, Driftless works with each one as it is,
  and every session start asks: keep it (`docs <folder> keep <part> <file>`), rewrite it from scratch with the template
  (`rewrite`, the old text saved in `.driftless/replaced/`), or use a new one (`new`). A session started in such a folder
  suggests making it the project.
- **Cap in three cuts:** `cap 260k|340k|400k` (or `cap auto`) chooses where the handoff comes in a project; the agent
  offers it when a project is created. No cap goes past 400,000 tokens: not `token_cap`, not `cap_percent` of a 1M
  window, not the plugin's setting (now at most 400000).
- **README:** a shorter opening (three points and the install commands) under an animation of the handoff, drawn from
  Driftless' real messages (`docs/handoff.gif`).
- **`npx github:Tigierre/driftless audit`:** see what Driftless would have saved on your own Claude Code history
  without installing the plugin (`package.json` gains a `bin`).
- **README:** a first line that says what it saves, and a "Why not `/compact`?" section.

## 0.1.0 — 2026-11-18

First public release.

- **Hands off by itself.** Driftless keeps the account of what carrying the context costs and, when a fresh start costs
  less (or at a cap you set, in tokens or as a share of the window), asks the agent to write the handoff into the
  project's documents. Then it opens a fresh session in the project, where you were working: a new tab of the Claude
  Code panel in VS Code, the desktop app, or a new terminal window. No compaction, no `/clear`, nothing to type.
- **Three documents with distinct jobs:** `NORTHSTAR.md` (the goal, changed only by you), `DESIGN.md` (durable source of
  truth, by topic) and `LOGBOOK.md` (last three tasks in detail, older ones one line each, and the resume point).
- **One driver per project:** a baton keeps two live sessions from steering the same project.
- **Status line** in Claude Code: context, cache time left and the saving so far, so you never need `/context`.
- **The diet:** sessions start without the tools, connectors and listings this machine has never used. Your
  `CLAUDE.md`, memories, rules, agents and skills are never touched.
- **`audit`** replays your own Claude Code history under each policy at today's prices, locally, spending no tokens.
  On the author's month of work: 27% to 31% off the whole bill, subagents included. The 50% goal is not reached.
- **Adapters** for Codex, Cursor, OpenCode, Kilo Code, Amp, Qwen Code, Gemini CLI, Copilot CLI, Devin and Kiro, and the
  method alone for any agent that reads `AGENTS.md`. Only Claude Code is tried live: help wanted.
- **Safety:** state files carry a seal only your machine can make; a project's config can make the fresh session stricter,
  never looser; bypass is carried into the fresh session only if you turn on `carry_bypass`; programs are started without
  a shell. No dependencies, no server, nothing sent anywhere.
- **Tests** on Linux, macOS and Windows, Node 20 and 22, at every push.
