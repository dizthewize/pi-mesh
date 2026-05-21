# Mesh Team Workflow Example

Three agents collaborating on a feature:

## Agent A — Database Designer
```typescript
pi_mesh({ action: "join", name: "db-architect" })
pi_mesh({ action: "contract_provide", item: "user-schema", signature: "{ id, email, oauth_provider, created_at }" })
pi_mesh({ action: "reserve", paths: ["src/db/schema.sql", "migrations/"], ttl: 600 })
// ...implements schema...
pi_mesh({ action: "task_done", taskId: "MESH-001", summary: "Schema ready" })
pi_mesh({ action: "leave" })
```

## Agent B — Backend Developer
```typescript
pi_mesh({ action: "join", name: "api-builder" })
// Wait for schema contract
pi_mesh({ action: "contract_need", item: "user-schema" })
// → { agentId: "db-architect", name: "keen-deer", signature: "..." }
pi_mesh({ action: "reserve", paths: ["src/routes/", "src/services/"], ttl: 600 })
// ...implements endpoints...
pi_mesh({ action: "contract_provide", item: "auth-api", signature: "POST /auth/{provider}/callback → JWT" })
pi_mesh({ action: "task_done", taskId: "MESH-002", summary: "OAuth endpoints ready" })
pi_mesh({ action: "leave" })
```

## Agent C — Frontend Developer
```typescript
pi_mesh({ action: "join", name: "ui-builder" })
pi_mesh({ action: "contract_need", item: "auth-api" })
// ...implements login buttons and callback handling...
pi_mesh({ action: "task_done", taskId: "MESH-003", summary: "UI integrated" })
pi_mesh({ action: "leave" })
```

## Mesh Task Board Setup (done by any agent)
```typescript
pi_mesh({ action: "claim", taskId: "MESH-001" })  // db-architect
pi_mesh({ action: "claim", taskId: "MESH-002" })  // api-builder
pi_mesh({ action: "claim", taskId: "MESH-003" })  // ui-builder
```

## Communication Flow

```
Agent A → contract_provide("user-schema") ───────┐
                                                    │
Agent B → contract_need("user-schema") ←───────────┤
          contract_provide("auth-api") ────────────┐
                                                    │
Agent C → contract_need("auth-api") ←─────────────┘
```
