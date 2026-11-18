# The diet: a smaller fixed cost at every start

[← Back to the README](../README.md)

Before you type anything, a session already carries tool schemas, connector names, skill and agent
listings — tens of thousands of tokens. Most of them a given project never uses.

**Automatic in every session Driftless opens (Claude Code).** It opens the fresh session, so it can open it lighter, with
settings for that session only: nothing of yours is written.

- **What this machine has never used is hidden:** a plugin's skills and the connectors no project ever called, once there are
  ten sessions of history to judge by. Anything written in the last 14 days stays: new is not the same as unused.
- **It comes back by itself:** a hidden skill still works if you type `/name`; an agent you hid that the model asks for is back
  from the next session, for good.
- **Long command output goes to a file:** over 8,000 characters the model gets a preview and the path, and reads what it
  needs. Your own `bashOutputMaxChars` or `BASH_MAX_OUTPUT_LENGTH` wins.
- **Built-in tools too:** each one is weighed from the request shape Claude Code writes on this machine (the Artifact tool
  alone is about 14,000 tokens), and one never used is denied. Nothing is guessed: with no request shape, no built-in tool is
  hidden. `diet hide "<a,b>"` puts one off everywhere on your word; `diet keep` brings it back.
- **What you wrote is not touched:** your own agents and skills (in `~/.claude`, or synced from your account) are never hidden
  by the diet, and no `CLAUDE.md`, memory or rule is edited, excluded or shortened; no description is cut. They say how you
  work. You can still hide one of yours by name (`diet hide`, `diet apply`); a diet from an earlier version that hid them gives
  them back at the next session start.

**Sessions you open yourself, and VS Code's panel.** A session you open by hand gets no settings from Driftless' command
line, and neither does the panel tab that resumes the fresh session in VS Code (it runs as a process of its own). With
Driftless on, the first session opened by hand in a project writes the diet into `.claude/settings.local.json` (personal, not
committed) and tells you what it hid and how many tokens it saves, from the next session; before VS Code opens the tab,
Driftless writes it there, so the tab already starts without them. `diet undo` takes it back for good; `diet hand off`
keeps it out from the start.

On the author's machine, in VS Code's panel on Opus 5.5, the start went from about 77,700 to 52,300 tokens (−33%) when the
diet still hid the user's own agents and skills too; leaving the author's 7 agents and 17 skills alone puts about 8,100 back,
so today's diet is about −22% there (estimated from their descriptions; the first live start with it measured 59,044 tokens, in line). The same settings reach
subagents: the first request of a general-purpose agent went from 35,543 to 30,740 tokens (−13.5%). With the output cap the model went back to the
file and found the right line 5 times out of 5, on Haiku and Opus; those were simple lookups, not a long debugging session.

Ask the agent ("what does the diet hide here?", "keep `<name>`", "no diet in this project"): it knows the commands. From a clone,
in the project's folder:

```
node <clone>/scripts/driftless.mjs diet                 # what is hidden, what else could be
node <clone>/scripts/driftless.mjs diet keep "<name>"   # never hide this one
node <clone>/scripts/driftless.mjs diet auto off        # this project starts with everything ("on" undoes it)
node <clone>/scripts/driftless.mjs diet apply "connectors,skill:<name>,agent:<name>,tool:<name>"   # more, by hand
node <clone>/scripts/driftless.mjs diet undo            # undo apply
```

`diet` also lists what other projects use but this one is statistically unlikely to need. That stays your call: `diet apply`
writes it to `.claude/settings.local.json`, personal and not committed. Going by one project's own short history is not enough:
on the author's sessions, "never used in the last 3 sessions here" left a needed item off in 27% of the sessions that followed.
Tools Driftless itself needs (Agent, Bash, Read, Write, Edit, AskUserQuestion…) are never denied.
