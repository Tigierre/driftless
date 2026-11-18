---
name: driftless
description: Driftless project method - start a new project (folder + North Star interview), resume or open an existing one in a fresh window, run a handoff by hand, stop Driftless from asking in a folder, switch Driftless off and on, say whether it pays off, show or change the diet and its status line. Use when the user asks to create, open, resume or hand off a project, to stop or pause Driftless, whether it saves anything, about the diet or the status line, or when Driftless' session-start message asks you to.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/driftless.mjs" *)
---

Driftless keeps every project in three documents and hands off before the context grows stale.

- **NORTHSTAR.md** — the user's goal in their words. Written with the user, confirmed by the user,
  changed only when the user explicitly asks.
- **DESIGN.md** — durable source of truth by topic, kept as-is. Its `## Index` arrives at session
  start: read only the sections the task needs, never the whole file by reflex.
- **LOGBOOK.md** — last 3 tasks in detail, older ones one line each, and the Resume point.

Commands: `<script>` is `${CLAUDE_PLUGIN_ROOT}/scripts/driftless.mjs`. Run each exactly as shown, `node "<script>" <command>`
with the path in double quotes: that form, and only that one, runs without a permission prompt.
- New project: `node "<script>" init "<folder>"`, then interview the user for the North Star (goal in
  one sentence, why, how they will know it is reached, non-negotiables, what they do not want),
  write it, have them confirm it, set the logbook's Resume point to the first concrete step toward the
  goal, then `node "<script>" open "<folder>"` (the fresh session keeps this session's permission mode).
- Resume / open a project in a fresh window: `node "<script>" open "<folder>"`.
- Work on a project from this window, though it was opened elsewhere (an editor open on the folder above, or on another
  one): `node "<script>" attach "<folder>"`, then follow what it prints. Every hook of this session then works on that project.
- This folder always belongs to a project (sessions started here start on it): `node "<script>" link "<project>" "<folder>"`;
  `unlink "<folder>"` undoes it. Only that folder, not the ones below it.
- Not a project, stop asking here: `node "<script>" ignore "<folder>"`.
- Status of the current project: `node "<script>" status`.
- Stop Driftless (the user says "stop Driftless", "turn it off", "pause it"): `node "<script>" off` for this
  project, `node "<script>" off --global` everywhere; `on` / `on --global` switch it back on. Effective from the
  next answer; a handoff already asked for is dropped. It does not uninstall anything.
- Does it pay? `node "<script>" audit` (add `--all` for every project) replays the history under each policy, at no cost.
- No Driftless status line in this project: `node "<script>" statusline off`; `statusline on` brings it back. From the next session.
- Diet (smaller fixed cost at every start): every session Driftless opens already hides what this machine never used, for that
  session only. `node "<script>" diet` reports it (`hidden_at_next_start`) and what this project is unlikely to need (`rarely_used`);
  `diet keep "<name>"` brings one back from the next session, `diet auto off|on` stops or resumes this per project. If the user asks
  for more, `diet apply "connectors,skill:<name>,agent:<name>,tool:<name>"` writes `.claude/settings.local.json`; `diet undo` restores it.
- Handoff by hand: run the `driftless:handoff` agent with the project folder, the session id and
  your summary of the session. A handoff the user asks for releases the project and opens nothing; tell the agent
  "reopen: true" if the user wants to go on in a fresh window. The user stopping for now ("handoff for today", "I'm
  done") during a handoff Driftless asked for: tell the agent "reopen: false". Driftless stays on either way.
- "Not now" to a handoff Driftless asked for: `node "<script>" later`. The request comes back once the context has
  grown by another 50,000 tokens; the next session starts clean.

Before starting any work, check it serves the North Star; if it does not, say so in one line and
ask before proceeding.
