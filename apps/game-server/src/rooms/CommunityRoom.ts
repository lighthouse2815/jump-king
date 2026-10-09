import { Room, Client } from "@colyseus/core";
import { GameState, PlayerState, PlayerInputMessage } from "@jump-king/protocol";
import { PhysicsWorld, Body, PlayerController } from "@jump-king/physics";

export class CommunityRoom extends Room<GameState> {
  maxClients = 20;
  private physicsWorld!: PhysicsWorld;
  
  // We need to map Colyseus clients to our Physics Engine bodies
  private playerBodies = new Map<string, Body>();
  private playerControllers = new Map<string, PlayerController>();
  private inputs = new Map<string, PlayerInputMessage>();

  // Simulation tick rate
  private fixedTimeStep = 1000 / 60;
  private tickInterval: NodeJS.Timeout | null = null;

  onCreate(options: any) {
    this.setState(new GameState());

    this.physicsWorld = new PhysicsWorld();

    // Map: same as client for now
    this.createPlatform(0, 580, 800, 20); // Ground
    this.createPlatform(300, 450, 200, 20); // Platform 1
    this.createPlatform(100, 300, 150, 20); // Platform 2
    this.createPlatform(500, 150, 200, 20); // Platform 3
    this.createPlatform(300, -50, 150, 20); // Platform 4
    this.createPlatform(100, -250, 150, 20); // Platform 5
    this.createPlatform(-20, -1000, 20, 1600); // Left wall
    this.createPlatform(800, -1000, 20, 1600); // Right wall

    this.onMessage("input", (client, input: PlayerInputMessage) => {
      this.inputs.set(client.sessionId, input);
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
      this.inputs.delete(client.sessionId);
    }
  }

  update(deltaTime: number) {
    const dt = this.fixedTimeStep / 1000;

    // Apply inputs & Physics step
    this.playerControllers.forEach((controller, sessionId) => {
      const input = this.inputs.get(sessionId) || { left: false, right: false, jump: false, seq: 0 };
      controller.update(input, dt);
    });

    this.physicsWorld.step(dt);

    // Sync state
    this.state.players.forEach((player, sessionId) => {
      const body = this.playerBodies.get(sessionId);
      const controller = this.playerControllers.get(sessionId);
      if (body && controller) {
        player.x = body.position.x;
        player.y = body.position.y;
        player.chargeTime = controller.chargeTime;
        player.direction = controller.direction;
      }
    });
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
