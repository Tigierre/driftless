# Safety

[← Back to the README](../README.md)

## What the fresh session is allowed to do

**The fresh session inherits the permission mode of the session that handed off, except bypass.** If you work with
`--dangerously-skip-permissions` (or `bypassPermissions`), the session Driftless opens for you starts in `acceptEdits`:
it edits files without asking and asks before anything else, because nobody is watching it start. To let it bypass
permissions too, turn on the plugin option **Fresh session keeps bypass** (`carry_bypass`), or set
`DRIFTLESS_CARRY_BYPASS=1` for the other agents (Codex's `--dangerously-bypass-approvals-and-sandbox`, Qwen Code's `yolo`
follow the same rule). It is an opt-in on your machine: a project cannot turn it on. Every other mode is carried as it
is (a fresh session that falls back to a stricter default stalls on the first tool). Plan mode is the one exception: the
fresh session is there to do the next step, so it starts in your default mode instead.

To make fresh sessions start stricter than the session before, set the mode in the project's `.driftless/config.json`:

```json
{ "permission_mode": "acceptEdits" }
```

**It can only tighten, never loosen.** `.driftless/config.json` is part of the project: clone a repository and that
file is somebody else's. So the mode it names is used when it is as strict as the mode of the session that hands off,
or stricter (`plan` and `dontAsk`, then `default`, `acceptEdits`, `auto`, `bypassPermissions`); a looser one is left
aside and the fresh session keeps the mode you were working in. A repository cannot give itself more than you gave the
session. For the same reason `model`, `effort` and the project's `name` reach the command line of the fresh session
only as plain words: anything with quotes, spaces or shell signs in it is dropped. The folder's own name cannot be
dropped, so it is written so that it is read as a name and nothing else: on Windows, where an npm install of an agent
is a `.cmd` file that `cmd.exe` runs, a folder called `a&calc` opens as a folder. Nor is a program at the root of a
project ever taken for your agent: Windows' `where` and `cmd.exe` look in the current folder before PATH, so Driftless
runs `where` from the system folder, and `doctor codex` starts Codex without a shell, telling `cmd.exe` not to look in
the folder. (An npm shim that starts `node` by its bare name, as npm's does when no `node.exe` sits beside it, still
looks there first in the fresh session, exactly as when you type the agent's name in that folder yourself.) While a session is in
**plan mode** Driftless asks for no handoff, because a handoff has to write the project documents: it says so once, and
asks at the first answer after plan mode.

**What a folder brings in `.driftless/` is not taken for yours.** Which session drives the project, and whether
Driftless asked it for a handoff, live in `.driftless/state.json` and `.driftless/baton.json`, inside the project. Both
carry a seal only your machine can make (an HMAC under a key in `~/.driftless/key`, which never goes into a project): a
copy that came with a clone, a pull or an archive has no valid seal and counts as no file. So a repository cannot have a
fresh session opened in it, nor turn your sessions away by naming a process that is always alive. A `handoff.json` that
names no session can end the turn of the session that drives, never open a new one: Driftless reopens only for a
handoff it asked that session for, or for one that names the session. One limit: the seal is made from the session id,
not from the folder, so a project you move keeps its state; for the same reason a `state.json` or `baton.json` you
publish yourself (Driftless keeps them out of git, see below, but not one you add by force) could be copied into
another repository and count there.

**What it reads into the context stays inside the project, and its own words stay its own.** At every start Driftless
reads your three documents into the session. A document is a file of the project: a name in `config.json` that leads
out of it (`../../.aws/credentials`) is not used, the default document is, and a document that is a link to a file
outside the project is not read (the session is told so). `init` writes the documents only inside the project, never
through a link that came with the folder. What Driftless repeats in its own voice from a project's files (the project's
name, the documents' names, the cap, the diet it noted) is plain words on one line and numbers: a name with line breaks
or signs in it is said as plain words, a document name that is not a plain name is not used, and a cap that is not a
number is no cap. What the documents say is the project's, as when you open them: Driftless gives it under their names.

**What it writes in `.driftless/` stays out of git, all but `config.json`.** Which session drives and where its
transcript is, the copy of the conversation, the diet (names of your skills and agents), the savings and, with
`"debug"`, the whole input of each hook belong to this machine: `.driftless/.gitignore` keeps everything but
`config.json` (the project's settings) and itself out of git. Driftless checks that file by its content before it writes
in the folder, and keeps its lines last, because in a `.gitignore` the last rule that matches wins: a folder that comes
with a `.gitignore` of its own keeps its lines, with Driftless' after them. `~/.driftless` (the seal's key, the registry
of projects) gets the same file, for a home kept in git. One limit: git goes on tracking a file it already tracks; if a
repository came with one of these files, or you added one before, `git rm --cached .driftless/<file>` takes it out.

**A folder above is your project only if it is yours.** A session started in a folder looks up for the project it
belongs to. On a machine shared with others anyone can make `/tmp/.driftless` or `C:\.driftless`, and a session started
below would take that for its project: its documents in the context, its settings for the fresh session. So the folder
you start in is always the project (you chose to work there, as in a clone), but a folder above counts only if you
already know it as a project here (`init`, or a session started in it), or, on Linux and macOS, if its `config.json`
belongs to you and it is not the root of the disk. Windows does not tell Node who owns a file, so there only the first
rule holds, and it has a price: a repository you clone and open for the first time in a subfolder is not taken for a
project until you start one session at its root, or run `open` or `attach` there.

**A file of yours stays as you made it.** Driftless never writes over a file of yours it cannot read whole: a settings
or hooks file that is not valid JSON is left as it is, and the command says so. The project's own `config.json` is one
of them: with a comma too many, none of its settings apply, and nothing writes over it, or a stricter permission mode
it held would be lost without a word. Until you fix it, every session start tells you so, the fresh session asks for
permissions, and Driftless writes nothing into your settings by itself (the diet, the status line: the broken file may
be the one that said no to them). When it does write a file of yours (`.claude/settings.local.json`, an agent's hooks
file, `AGENTS.md`, `config.json`), it writes it where it is: a file that is a link (settings kept in a dotfiles folder)
is changed through the link, and the link stays; a link inside a project that leads out of it is not written through,
since a clone could point it at a file in your home. The file keeps its permissions (a settings file of `0600` stays
`0600`), and a change that changes nothing writes nothing, not even the same content laid out again.

**The skill runs only Driftless' own script without asking.** The `driftless` skill lets Claude run its commands
without a permission prompt, for the turn that uses it. The rule names the plugin's own folder,
`node "${CLAUDE_PLUGIN_ROOT}/scripts/driftless.mjs" …`, and the skill tells Claude to run the commands in that form:
a `node` command that only mentions `driftless.mjs` (another script before it, `node -e`, a `scripts/driftless.mjs`
that came with a clone) asks, as any command does.
