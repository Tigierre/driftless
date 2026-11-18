// Driftless' status line in the VS Code panel (and the other app surfaces). The panel draws no status line command, only
// the statuses plugin modules pin with $.ui.status: this module pins there the line the terminal bar shows, computed by
// the same script ("statusline panel"). In the terminal it stays silent: the bar written in the project settings is there.
// Zero tokens: the context comes from $.session.usage(), the rest from Driftless' own small files. No cache minutes: the
// module is not told when the cache expires, and the panel has its own cache clock.

const EVERY_MS = 60_000;

export async function paint($) {
  try {
    const surfaces = await $.session.surfaces();
    if (!surfaces.some((s) => s !== 'terminal')) return $.ui.status(undefined);
    const [session_id, cwd, usage] = await Promise.all([$.session.id(), $.session.cwd(), $.session.usage()]);
    const c = usage?.context || {};
    const input = {
      session_id,
      cwd,
      context_window: {
        context_window_size: c.window ?? null,
        used_percentage: c.percent ?? null,
        current_usage: c.tokens ? { input_tokens: c.tokens } : null,
      },
    };
    const r = await $.process.run(['node', `${$.plugin.root}/scripts/driftless.mjs`, 'statusline', 'panel'],
      { stdin: JSON.stringify(input), timeoutMs: 10_000 });
    const line = r.exitCode === 0 ? r.stdout.trim() : '';
    $.ui.status(line || undefined);
  } catch {
    $.ui.status(undefined);
  }
}

export const register = (on) => {
  let ticking = false;
  on('session.start', async ($, e, next) => {
    const r = await next(e);
    paint($);
    if (!ticking) {
      ticking = true;
      $.clock.every(EVERY_MS, () => paint($));
    }
    return r;
  });
  on('turn.complete', async ($, e, next) => {
    const r = await next(e);
    paint($);
    return r;
  });
};
