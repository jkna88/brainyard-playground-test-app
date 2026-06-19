# Brainyard Chat

A [Next.js](https://nextjs.org) chat UI for the **Brainyard `by` CLI**. The browser talks
to two API routes that shell out to `by`; there is no separate AI backend — the CLI is the
backend.

- `GET /api/sessions` → `by sessions list --live --json` (only sessions with a live owner)
- `POST /api/sessions` → starts a real session owner with `by run` (see below)
- `POST /api/chat` → `by ask --attach <id>` (Attach on) or `by ask -p free-llm` (Attach off)

## Prerequisites

This app spawns and drives the `by` CLI, so the machine running the **Next.js server** needs:

| Requirement | Why |
| --- | --- |
| `by` on `PATH` (or `BY_BIN` set) | All API routes shell out to it. |
| `tmux` on `PATH` | `POST /api/sessions` launches the session owner inside tmux (see below). |
| Node.js 20+ | Next.js 16 / React 19. |

Set `BY_BIN` if `by` is **not** at the default `/usr/local/bin/by` (e.g. a per-user install):

```bash
export BY_BIN="$HOME/.local/bin/by"
```

### Why a session needs `by run`

`by ask --attach <id>` can only reach a session that has a **live owner process** holding it
open (it binds the session's `ask.sock` and stamps its PID). That owner is `by run` — an
interactive TUI that blocks for its whole lifetime, so the API can't simply `await` it.
`POST /api/sessions` launches it detached inside **tmux**, which supplies the PTY the TUI
needs and daemonizes it: `tmux new-session -d` returns immediately while `by run` keeps
running as the owner. The route then polls `by sessions list --live --json` until the new
session registers, labels it, and returns it.

The UI marks live (attachable) sessions with `●` and disables the **Attach** toggle for any
session without a live owner.

> **macOS path-length note:** the per-session `ask.sock` is an AF_UNIX socket, and macOS caps
> socket paths at 104 bytes. A very long project path can push `<project>/.brainyard/sessions/<id>/ask.sock`
> over that limit; current `by` builds relocate the socket to `$TMPDIR` to avoid this.

## Getting Started

```bash
npm install
BY_BIN="$HOME/.local/bin/by" npm run dev   # omit BY_BIN if by is at /usr/local/bin/by
```

Open [http://localhost:3000](http://localhost:3000), then go to **/chat**:

1. Click **+ New** to create a session (spawns a `by run` owner — takes a couple of seconds).
2. Pick a `●` live session and type a message.
3. Toggle **Attach** on to send into that session's context (`by ask --attach`); off sends a
   free one-shot prompt (`by ask -p free-llm`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build. |
| `npm run lint` | Run ESLint. |

## Project structure

```
app/
  api/chat/route.ts      # POST → by ask (attach or free prompt)
  api/sessions/route.ts  # GET → list live sessions; POST → spawn a by run owner
  chat/page.tsx          # chat orchestrator (state, fetch, attach gating)
components/chat/         # SessionSelector, ChatContainer, MessageBubble, ChatInput
lib/chat-store.ts        # useReducer state + localStorage persistence
types/chat.ts            # Session, Message, BySessionRow
```

## Deploying

Because the server launches `by run` under tmux, this app must run on a host where both `by`
and `tmux` are installed and on the server process's `PATH` (set `BY_BIN` if needed). It does
**not** run on serverless platforms that disallow long-lived child processes.
