const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');

  // Replace inputs map type
  code = code.replace(
    /private inputs = new Map<string, PlayerInputMessage>\(\);/,
    `private inputs = new Map<string, PlayerInputMessage[]>();`
  );

  // Replace onMessage to push to queue
  code = code.replace(
    /this\.inputs\.set\(client\.sessionId, \{/g,
    `if (!this.inputs.has(client.sessionId)) this.inputs.set(client.sessionId, []);\n      this.inputs.get(client.sessionId)!.push({`
  );
  code = code.replace(
    /seq: input\.seq\n      \}\);/g,
    `seq: input.seq\n      });`
  );

  // Replace update() logic to process ALL inputs in the queue
  const updateLoopRegex = /this\.playerControllers\.forEach\(\(controller, sessionId\) => \{([\s\S]*?)controller\.tick\(input\);\n    \}\);/m;
  
  if (file.includes('CommunityRoom')) {
    const newUpdateLoop = `this.playerControllers.forEach((controller, sessionId) => {
      const queue = this.inputs.get(sessionId) || [];
      if (queue.length > 0) {
        // Process all pending inputs for this player
        for (const input of queue) {
          controller.tick(input);
          
          // We must also tick physics for this player's body here?
          // No, wait. If we process 5 inputs for this player, we must step their physics 5 times!
          // But physicsWorld.tick() steps EVERYONE. 
          // If we step physicsWorld 5 times, other players move 5 times too!
        }
      }
    });`;
    // WAIT! If we tick physicsWorld, it ticks everyone.
  }

  // fs.writeFileSync(file, code);
}

// fix('apps/game-server/src/rooms/CommunityRoom.ts');
// fix('apps/game-server/src/rooms/RaceRoom.ts');
