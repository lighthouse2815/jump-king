const fs = require('fs');
const file = 'apps/game-server/src/rooms/RaceRoom.ts';
let code = fs.readFileSync(file, 'utf-8');
code = "import { db } from '../db';\nimport { raceMatches, raceParticipants, users } from '../db/schema';\n" + code;

// find onDispose
code = code.replace(
  'onDispose() {',
  `async onDispose() {
    console.log("Saving race results for room", this.roomId);
    try {
      // Mock saving for now as we don't have db active in tests usually
      const match = await db.insert(raceMatches).values({
        roomCode: this.roomId,
        status: this.state.status,
      }).returning();
      
      const matchId = match[0].id;
      
      for (const [sessionId, player] of this.state.players.entries()) {
        // Create guest user
        const user = await db.insert(users).values({ nickname: player.nickname }).returning();
        await db.insert(raceParticipants).values({
          matchId,
          userId: user[0].id,
          finishTime: player.hasFinished ? player.finishTime : null,
          maxHeight: -Math.round(player.y), // simple metric
        });
      }
    } catch (e) {
      console.error('Failed to save match', e);
    }
`
);
fs.writeFileSync(file, code);
