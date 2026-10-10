import { Room, Client } from "@colyseus/core";
import { GameState, PlayerState, PlayerInputMessage } from "@jump-king/protocol";
import { MAP_1 } from '@jump-king/maps';
import { PhysicsWorld, Body, PlayerController } from "@jump-king/physics";

export class CommunityRoom extends Room<GameState> {
  maxClients = 20;
  private physicsWorld!: PhysicsWorld;
  
  // We need to map Colyseus clients to our Physics Engine bodies
  private playerBodies = new Map<string, Body>();
  private playerControllers = new Map<string, PlayerController>();
  private inputQueues = new Map<string, PlayerInputMessage[]>();

  // Simulation tick rate
  private fixedTimeStep = 1000 / 60;
  private tickInterval: NodeJS.Timeout | null = null;

  onCreate(options: any) {
    this.setState(new GameState());

    this.physicsWorld = new PhysicsWorld();
    MAP_1.forEach(p => this.createPlatform(p.x, p.y, p.w, p.h));

    // Map: same as client for now
                                
    this.onMessage("input", (client, input: any) => {
      // Validate input shape
      if (typeof input !== 'object' || input === null) return;
      if (typeof input.left !== 'boolean' || typeof input.right !== 'boolean' || typeof input.jump !== 'boolean' || typeof input.seq !== 'number') {
        return;
      }
      
      let queue = this.inputQueues.get(client.sessionId);
      if (!queue) {
        queue = [];
        this.inputQueues.set(client.sessionId, queue);
      }
      // Bound the queue size to prevent memory leaks / malicious flooding
      if (queue.length < 60) {
        queue.push({
          left: input.left,
          right: input.right,
          jump: input.jump,
          seq: input.seq
        });
      }
    });

    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.fixedTimeStep);
  }

  private createPlatform(x: number, y: number, w: number, h: number) {
    const body = new Body(x, y, w, h, true);
    this.physicsWorld.addBody(body);
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    const player = new PlayerState();
    player.id = client.sessionId;
    player.nickname = options.nickname || "Guest";
    
    // Spawn point
    player.x = 400;
    player.y = 500;
    
    this.state.players.set(client.sessionId, player);

    // Add to physics
    const body = new Body(player.x, player.y, 20, 30);
    this.physicsWorld.addBody(body);
    this.playerBodies.set(client.sessionId, body);
    this.playerControllers.set(client.sessionId, new PlayerController(body));
    this.inputQueues.set(client.sessionId, []);
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);
    
    const body = this.playerBodies.get(client.sessionId);
    if (body) {
      // Remove from world
      this.physicsWorld.bodies = this.physicsWorld.bodies.filter(b => b !== body);
      this.playerBodies.delete(client.sessionId);
      this.playerControllers.delete(client.sessionId);
      this.inputQueues.delete(client.sessionId);
    }
  }

  update(deltaTime: number) {
    const dt = this.fixedTimeStep / 1000;

    // Apply inputs & Physics step
    this.playerControllers.forEach((controller, sessionId) => {
      const queue = this.inputQueues.get(sessionId) || [];
      const body = this.playerBodies.get(sessionId);
      
      if (queue.length === 0) {
        // No input this tick, simulate with a neutral/last input if desired, 
        // but for deterministic platformers, we just don't tick or use a zero input.
        // Let's use a zero input.
        controller.tick({ left: false, right: false, jump: false, seq: 0 });
        if (body) this.physicsWorld.tickBody(body);
      } else {
        // Process all pending inputs for this player
        while (queue.length > 0) {
          const input = queue.shift()!;
          controller.tick(input);
          if (body) {
            this.physicsWorld.tickBody(body);
          }
          // Update the player's last processed seq
          const playerState = this.state.players.get(sessionId);
          if (playerState) {
            playerState.lastProcessedInputSeq = input.seq;
          }
        }
      }
    });

    // We no longer call this.physicsWorld.tick() for all bodies at once,
    // because we integrated them per-input above. 
    // If there were NPCs, we would tick them here.

    // Sync state
    this.state.players.forEach((player, sessionId) => {
      const body = this.playerBodies.get(sessionId);
      const controller = this.playerControllers.get(sessionId);
      if (body && controller) {
        player.x = body.position.x;
        player.y = body.position.y;
        player.chargeTicks = controller.chargeTicks;
        player.direction = controller.direction;
      }
    });
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
