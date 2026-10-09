# Development Guidelines

## Project Goals
- Build a server-authoritative multiplayer 2D precision platformer inspired by Jump King.

## Implementation Rules
1. Work in small, verifiable steps.
2. Code -> Test -> Commit -> Push for each task.
3. Don't mock critical paths; implement actual features.
4. Don't hide runtime errors or build errors.
5. Physics logic lives in `packages/physics` to be shared between Phaser (client) and Colyseus (server).

## Stack
- Frontend: React, Vite, Phaser, Tailwind
- Backend: Node.js, Colyseus, PostgreSQL (later)
- Config: pnpm workspaces
