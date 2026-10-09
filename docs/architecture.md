# Jump King Online Architecture

## Monorepo Structure (pnpm workspaces)

- `apps/web`: React + Vite frontend (UI, HUD, lobbies). Includes Phaser game instance.
- `apps/game-server`: Node.js + Colyseus backend for authoritative multiplayer physics.
- `packages/physics`: Shared 2D physics engine.
- `packages/protocol`: Shared typings and Colyseus schemas.
- `packages/game-config`: Game constants (gravity, jump velocities, map sizing).
- `packages/maps`: Map data and collision geometries.

## Key Principles
1. **Server-Authoritative**: Backend dictates valid state. Clients predict and reconcile.
2. **Deterministic Physics**: The `physics` package is shared between client (Phaser integration) and server (headless loop).
3. **Strict Validation**: All network inputs validated.
4. **Offline First**: Base movement, jump, and collision must feel perfect offline before multiplayer scaling.
