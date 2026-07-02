import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parseEdn } from '@/lib/edn';
import { resolveSessionProjectDir } from '@/lib/by';
import type { TrajectoryTurn } from '@/types/chat';

// GET /api/sessions/<id>/trajectory — read the session's per-turn trajectory.
// The file is newline-delimited EDN (one `pr-str` map per turn) written by the
// `by` owner under <cwd>/.brainyard/sessions/<id>/trajectory.edn.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // Path-traversal guard: session ids are opaque slugs, never contain separators.
  if (!/^[\w.-]+$/.test(id) || id.includes('..')) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  // Sessions store their data under <project-dir>/.brainyard/sessions/<id>/,
  // where project-dir is the git root above the session's working-dir — not
  // necessarily this server's cwd. Resolve it authoritatively; fall back to cwd.
  const projectDir = (await resolveSessionProjectDir(id)) ?? process.cwd();
  const file = path.join(projectDir, '.brainyard', 'sessions', id, 'trajectory.edn');

  let raw: string;
  try {
    raw = await readFile(file, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ turns: [] });
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const turns: TrajectoryTurn[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed = parseEdn(line);
      if (parsed && typeof parsed === 'object') turns.push(parsed as TrajectoryTurn);
    } catch {
      // Skip a malformed line rather than failing the whole trajectory.
    }
  }

  return NextResponse.json({ turns });
}
