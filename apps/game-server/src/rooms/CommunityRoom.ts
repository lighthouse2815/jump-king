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
  private lastInputs = new Map<string, PlayerInputMessage>();

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
      // Bound the queue size: Drop oldest to catch up if we get a huge burst
      if (queue.length > 5) {
        queue.splice(0, queue.length - 5);
      }
      queue.push({
        left: input.left,
        right: input.right,
        jump: input.jump,
        seq: input.seq
      });
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
      this.lastInputs.delete(client.sessionId);
    }
  }

  update(deltaTime: number) {
    const dt = this.fixedTimeStep / 1000;

    // Apply inputs & Physics step
    this.playerControllers.forEach((controller, sessionId) => {
      const queue = this.inputQueues.get(sessionId) || [];
      const body = this.playerBodies.get(sessionId);
      const playerState = this.state.players.get(sessionId);
      
      let input;
      if (queue.length === 0) {
        // Jitter buffer empty: duplicate last input
        input = this.lastInputs.get(sessionId) || { left: false, right: false, jump: false, seq: 0 };
      } else {
        // Shift exactly ONE input per fixed timestep
        input = queue.shift()!;
        this.lastInputs.set(sessionId, input);
        if (playerState) {
          playerState.lastProcessedInputSeq = input.seq;
        }
      }

      controller.tick(input);
      if (body) {
        this.physicsWorld.tickBody(body);
      }
    });

    // Sync state
    this.state.players.forEach((player, sessionId) => {
      const body = this.playerBodies.get(sessionId);
      const controller = this.playerControllers.get(sessionId);
      if (body && controller) {
        player.x = body.position.x;
        player.y = body.position.y;
        player.velX = body.velocity.x;
        player.velY = body.velocity.y;
        player.isGrounded = body.isGrounded;
        player.prevJump = controller.prevJump;
        player.chargeTicks = controller.chargeTicks;
        player.direction = controller.direction;
      }
    });
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
