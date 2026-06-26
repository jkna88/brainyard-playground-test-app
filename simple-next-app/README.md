# Brainyard Chat

A [Next.js](https://nextjs.org) chat UI for the **Brainyard `by` CLI**. There is no separate
AI backend — the CLI is the backend. Sessions are created by shelling out to `by`, but live
interaction with a session goes **directly over its `ask.sock`** (a per-session AF_UNIX
socket speaking newline-delimited EDN), not through a `by` subprocess.

- `GET  /api/sessions` → `by sessions list --live --json` (only sessions with a live owner)
- `POST /api/sessions` → starts a real session owner with `by run` (see below)
- `POST /api/chat` → Attach on: `{:op :ask}` over the socket; Attach off: `by ask -p free-llm`
- `GET  /api/sessions/[id]/status` → `{:op :status}` (idle/running, model, queued)
- `POST /api/sessions/[id]/cancel` → `{:op :cancel}` (stop the running turn)
- `GET  /api/sessions/[id]/stream` → SSE over `{:op :subscribe [:display]}` (live output)
- `POST /api/sessions/[id]/inject` → `{:op :inject}` (memory / artifact / turn sinks)

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
3. Toggle **Attach** on to send into that session's context (over `ask.sock`); off sends a
   free one-shot prompt (`by ask -p free-llm`).

## Live session features (the `ask.sock` protocol)

When a session is attachable (its `ask-socket-path` is bound), the app talks to it directly
over the socket — see Brainyard's `ask-attach-channel.md` / `session-channel-extensions.md`:

- **Send (`:ask`)** — Attach messages are injected into the live session's turn queue, so the
  answer sees its full context (memory, working dir, task roster). No `by` subprocess.
- **Status chip (`:status`)** — a live `Idle/Running · model · queued` indicator, polled while
  a turn runs.
- **Stop (`:cancel`)** — a Stop button cancels the in-flight turn (same path as Ctrl-C; the
  agent stops at the next iteration boundary).
- **Live output (`:subscribe [:display]`)** — while an attach turn runs, the session's rendered
  output is streamed over SSE (ANSI-stripped) into a terminal-style bubble, then replaced by
  the clean answer. Most useful on multi-step / tool-using turns.
- **Remember (`:inject :as :memory`)** — a bookmark on assistant messages saves the text to the
  project's `.brainyard/memory/`. The inject route also exposes the `:artifact` and `:turn`
  (fire-and-forget event trigger) sinks for external connectors.

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
  api/chat/route.ts            # POST → :ask over socket (attach) or by ask (free)
  api/sessions/route.ts        # GET → list live; POST → spawn a by run owner (tmux)
  api/sessions/[id]/status     # GET → {:op :status}
  api/sessions/[id]/cancel     # POST → {:op :cancel}
  api/sessions/[id]/stream     # GET → SSE over {:op :subscribe [:display]}
  api/sessions/[id]/inject     # POST → {:op :inject} (memory/artifact/turn)
  chat/page.tsx                # chat orchestrator (state, fetch, attach gating, streaming)
components/chat/               # SessionSelector, ChatContainer, MessageBubble, ChatInput
lib/by.ts                      # BY_BIN, listLiveSessions, resolveAskSocketPath
lib/ask-socket.ts              # ask.sock client: ask/status/cancel/subscribe/inject
lib/edn.ts                     # minimal EDN reader + string escaper for the wire
lib/ansi.ts                    # strip ANSI from :display chunks
lib/chat-store.ts              # useReducer state + localStorage persistence
types/chat.ts                  # Session, Message, BySessionRow
```

## Deploying

Because the server launches `by run` under tmux, this app must run on a host where both `by`
and `tmux` are installed and on the server process's `PATH` (set `BY_BIN` if needed). It does
**not** run on serverless platforms that disallow long-lived child processes.

## Testing

Web UI tests use the **`agent-browser` CLI** (headless Chromium) — not Playwright.
`agent-browser` is pre-installed in the Brainyard Playground container (v0.30.1)
and is also available via `npm install -g agent-browser`.

### Basic test workflow

```bash
# 1. Ensure the dev server is running
npm run dev

# 2. Open the chat page in headless Chrome
agent-browser open http://localhost:3000/chat

# 3. Inspect the page with an accessibility snapshot
agent-browser snapshot

# 4. Click an element by its `ref` (shown in snapshot output)
agent-browser click @e3

# 5. Evaluate JavaScript in the page context
agent-browser eval "document.querySelector('[role=alert]')?.innerText"
