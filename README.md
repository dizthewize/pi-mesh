# pi-mesh

Zero-daemon agent mesh for Pi. Agents in different sessions discover each other, reserve files, claim tasks from a shared board, and send messages — all via a shared `~/.pi/agent/mesh/` directory.

## Install

```bash
pi package add pi-mesh
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | A Pi session participant with a themed name (e.g. `swift-raven-42`) |
| **Task Board** | Shared queue with priority-sorted open tasks |
| **Reservation** | File-level locks preventing cross-agent collisions |
| **Inbox** | Agent-to-agent messaging (DM, broadcast, challenge) |
| **Project State** | Unified cross-extension state bus per project |
| **Contract Sync** | Agents signal interface readiness for cross-component alignment |

## Quick Start

```typescript
// Join the mesh
pi_mesh({ action: "join" })

// Claim a task
pi_mesh({ action: "claim", taskId: "MESH-001" })

// Reserve files
pi_mesh({ action: "reserve", paths: ["src/auth/"], ttl: 600 })

// Send a message
pi_mesh({ action: "send", to: "swift-raven-42", message: "auth done" })

// Check inbox
pi_mesh({ action: "inbox" })

// Mark task done
pi_mesh({ action: "task_done", taskId: "MESH-001", summary: "Created auth types" })

// Leave
pi_mesh({ action: "leave" })
```

## All Actions

### Registry
| Action | Params | Description |
|--------|--------|-------------|
| `join` | `name?` | Register in mesh |
| `leave` | — | Unregister |
| `list` | — | Show active agents |
| `status` | — | Show own status |
| `rename` | `name` | Change agent name |

### Messaging
| Action | Params | Description |
|--------|--------|-------------|
| `send` | `to`, `message` | DM another agent |
| `broadcast` | `message` | Message all agents |
| `challenge` | `to`, `message`, `taskId?` | Urgent challenge |
| `inbox` | — | Check messages |

### Reservations
| Action | Params | Description |
|--------|--------|-------------|
| `reserve` | `paths`, `ttl?` | Lock files |
| `release` | `paths?` | Unlock files (empty = all) |

### Task Board
| Action | Params | Description |
|--------|--------|-------------|
| `claim` | `taskId` | Claim task, auto-dispatch if `roleId` set |
| `unclaim` | `taskId` | Release claim |
| `task_list` | `status?`, `priority?`, `tag?` | Show tasks |
| `task_show` | `taskId` | Task details |
| `task_done` | `taskId`, `summary?` | Mark complete |

### Project State
| Action | Params | Description |
|--------|--------|-------------|
| `project_state_get` | `ext?` | Read extension state slice |
| `project_state_set` | `ext`, `data` | Write extension state slice |

### Contract Sync
| Action | Params | Description |
|--------|--------|-------------|
| `contract_provide` | `item`, `signature?` | Signal interface ready |
| `contract_need` | `item` | Wait for interface |
| `contract_list` | — | Show all contracts |

## Contract Sync Example

```typescript
// Database agent finishes types
pi_mesh({ action: "contract_provide", item: "auth-types", signature: "User, Session, Token" })

// Backend agent waits
pi_mesh({ action: "contract_need", item: "auth-types" })
// → { agentId: "db-agent", name: "keen-deer", signature: "...", ts: "..." }

// Frontend agent lists what's ready
pi_mesh({ action: "contract_list" })
// → { "auth-types": {...}, "auth-api": {...} }
```

## Project State Example

```typescript
// pi-workflows writes progress
pi_mesh({ action: "project_state_set", ext: "pi-workflows", data: { wave: 2, status: "complete" } })

// ship-fix reads it
pi_mesh({ action: "project_state_get", ext: "pi-workflows" })
// → { wave: 2, status: "complete" }
```

## Storage

```
~/.pi/agent/mesh/
├── registry/           # Agent heartbeat entries
├── inbox/              # Message files
├── reservations/       # File locks
├── tasks/              # Task board (board.json)
├── claims/             # Task claim records
├── projects/           # Unified project state
│   └── <hash>/
│       └── state.json  # { extensions: { name: data } }
└── .lock               # POSIX flock for atomic ops
```

## Inline Dashboard

`/mesh` renders a compact status block showing the entire mesh state.

![pi-mesh dashboard](docs/dashboard.png)

```
Mesh: 3/4 agents │ 2○ 1● 1✓ 0✗ │ 2 reservations
──────────────────────────────────────────────────────────
Agent             Status    CWD                   Seen
● swift_fox       working   /home/u/p/web         12s ago
● calm_owl        idle      /home/u/p/api         45s ago
○ bold_hawk       idle      /home/u/p/web         >2m (stale)
──────────────────────────────────────────────────────────
🔴 MESH-001  Create auth types   claimed   swift_fox
🟡 MESH-002  Implement service   open      —
⚪ MESH-003  Setup database      complete  calm_owl
──────────────────────────────────────────────────────────
Reservations:
  swift_fox → types.ts, auth.ts (1m23s)
  bold_hawk → handlers.ts (45s)
──────────────────────────────────────────────────────────
Messages:
  +12s  → [swift_fox] Started on MESH-001
  +45s  ✦ [calm_owl] Standup done
──────────────────────────────────────────────────────────
Contracts: auth-types, service-interface
```

| Command | Description |
|---------|-------------|
| `/mesh status` | Show mesh dashboard (markdown) |
| `/mesh clear` | Prune stale agents + expired reservations |

## Live TUI Widget

The ambient widget **auto-appears** when mesh agents are working:

```
┌─ Mesh: 3 peers │ ●2 ○1 ──────────────────────────────────────┐
│  ● backend-ecommerce  TASK-001  handlers.ts  2m13s             │
│  ● backend-seo        TASK-002  schema.ts    7m48s             │
│  ○ bold_hawk          +1 more idle                             │
└─────────────────────────────────────────────────────────────────┘
```

- **Auto-shows** when ≥1 agent has `status: "working"`
- **Polls** mesh filesystem every 2 seconds
- **Auto-dismisses** when all agents idle for >5 minutes
- Shows task IDs, reserved files, live durations

## Command

```
/mesh     # Show mesh dashboard (peers, tasks, reservations, inbox)
```

## Inter-Extension Bridges

`pi-mesh` exposes EventBus endpoints for automated use by other extensions:

| Channel | Direction | Description |
|---------|-----------|-------------|
| `mesh:setProjectState:request` | in | Write extension state to project bus |
| `mesh:provideContract:request` | in | Signal contract readiness |
| `mesh:send:request` | in | Send DM on behalf of another extension |
| `mesh:task_dispatch` | out | Emitted when `claim` auto-detects `roleId` |

**Used by:** `pi-dark-factory` (state sync), `pi-workflows` (broadcast status).

## Command Reference

```
/mesh list              # List active agents
/mesh inbox             # Check unread messages
/mesh status            # Show own status
```
