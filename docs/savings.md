# Does it save you anything? Ask your own history

[← Back to the README](../README.md)

In Claude Code, ask the agent: "does Driftless pay off here?", or "on all my projects?". From a clone, in the project's folder:

```
node <clone>/scripts/driftless.mjs audit           # this project (Claude Code transcripts)
node <clone>/scripts/driftless.mjs audit --all     # every project on this machine
```

`audit` replays your sessions under each policy at today's list prices and tells you what each would have cost, with a
95% interval (paired bootstrap), where the money goes (tool results, tool inputs, session start, thinking, text, prompts; main
thread and subagents apart, Bash alone), which subagents ran past 300,000 tokens, how few pieces of work make the saving,
and which cache lifetime suits your pauses. It warns you when more than 5% of the spend does not add up. It spends no
tokens and sends nothing anywhere. **On short sessions it will tell you Driftless does not save money**: on the author's
history the gain is about 0% under 100 requests and about a third above that.

The table in [What it saves](../README.md#what-it-saves) is this replay on the author's history. With little history your own figure can
land anywhere from near zero to a third: `audit` tells you yours.

**You don't have to ask.** In Claude Code, each session that ends is added to `.driftless/savings.json` with the same code as the
replay: real spend and handoffs against the same work with no fresh start and no diet. When the saving reaches $0.10, one line at session
start says it. The first figure above zero needs a fresh start to compare with. It leaves out the gain from the limit on command
output, so it errs low. These are list prices: on a subscription read them as usage, whose exact weights are not published.

Before there is anything to count, your past work says what to expect: once a week, session start launches `audit --all --refresh`,
a short background process that runs on this machine and writes only `~/.driftless/history.json`. One line shows the result at most once
a day, with at least 5 pieces of work and only if the saving is beyond doubt.
