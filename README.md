# Jump King Online

A server-authoritative multiplayer 2D precision platformer inspired by Jump King.

## Architecture
- **Frontend:** React, Vite, Phaser, Tailwind
- **Backend:** Node.js, Colyseus, PostgreSQL (Drizzle ORM)
- **Shared:** Custom 2D physics engine for deterministic server-client simulation.

## How to run
1. \`pnpm install\`
2. \`pnpm run build\`
3. \`docker-compose up -d db\`
4. \`pnpm run dev\`

Visit \`http://localhost:3000\`
