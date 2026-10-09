import { db } from '../db';
import { raceMatches, raceParticipants, users } from '../db/schema';
import { Room, Client } from "@colyseus/core";
import { GameState, PlayerState, PlayerInputMessage } from "@jump-king/protocol";
import { MAP_1 } from '@jump-king/maps';
import { PhysicsWorld, Body, PlayerController } from "@jump-king/physics";

export class RaceRoom extends Room<GameState> {
  maxClients = 8;
  private physicsWorld!: PhysicsWorld;
  
  private playerBodies = new Map<string, Body>();
  private playerControllers = new Map<string, PlayerController>();
  private inputs = new Map<string, PlayerInputMessage>();

  private fixedTimeStep = 1000 / 60;
  private timer: any;
  private countdownTimer: any;

  onCreate(options: any) {
    this.setState(new GameState());

    this.physicsWorld = new PhysicsWorld();
    MAP_1.forEach(p => this.createPlatform(p.x, p.y, p.w, p.h));

                        // Finish line platform
    
        
    this.onMessage("input", (client, input: PlayerInputMessage) => {
      if (this.state.status === "RUNNING") {
        this.inputs.set(client.sessionId, input);
      }
    });

    this.onMessage("ready", (client, isReady: boolean) => {
      if (this.state.status === "WAITING") {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.isReady = isReady;
          this.checkAllReady();
        }
      }
    });

    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.fixedTimeStep);
  }

  private checkAllReady() {
    let allReady = true;
    let count = 0;
    this.state.players.forEach(p => {
      count++;
      if (!p.isReady) allReady = false;
    });

    if (allReady && count >= 2) {
      this.startCountdown();
    }
  }

  private startCountdown() {
    this.state.status = "COUNTDOWN";
    this.state.countdown = 3;
    
    this.countdownTimer = this.clock.setInterval(() => {
      this.state.countdown -= 1;
      if (this.state.countdown <= 0) {
        this.countdownTimer.clear();
        this.startGame();
      }
    }, 1000);
  }

  private startGame() {
    this.state.status = "RUNNING";
    this.state.startTime = Date.now();
  }

  private createPlatform(x: number, y: number, w: number, h: number) {
    const body = new Body(x, y, w, h, true);
    this.physicsWorld.addBody(body);
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined race!");
    const player = new PlayerState();
    player.id = client.sessionId;
    player.nickname = options.nickname || "Racer";
    player.x = 400 + Math.random() * 40 - 20; // Slight random offset
    player.y = 500;
    
    this.state.players.set(client.sessionId, player);

    const body = new Body(player.x, player.y, 20, 30);
    this.physicsWorld.addBody(body);
    this.playerBodies.set(client.sessionId, body);
    this.playerControllers.set(client.sessionId, new PlayerController(body));
  }

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
    const body = this.playerBodies.get(client.sessionId);
    if (body) {
      this.physicsWorld.bodies = this.physicsWorld.bodies.filter(b => b !== body);
      this.playerBodies.delete(client.sessionId);
      this.playerControllers.delete(client.sessionId);
      this.inputs.delete(client.sessionId);
    }
  }

  update(deltaTime: number) {
    if (this.state.status !== "RUNNING") return;

    const dt = this.fixedTimeStep / 1000;

    this.playerControllers.forEach((controller, sessionId) => {
      const player = this.state.players.get(sessionId);
      if (player && player.hasFinished) return; // Stop simulating finished players
      
      const input = this.inputs.get(sessionId) || { left: false, right: false, jump: false, seq: 0 };
      controller.tick(input);
    });

    this.physicsWorld.tick();

    // Sync state and check win condition
    let allFinished = true;
    let someoneActive = false;

    this.state.players.forEach((player, sessionId) => {
      someoneActive = true;
      if (player.hasFinished) return;
      allFinished = false;

      const body = this.playerBodies.get(sessionId);
      const controller = this.playerControllers.get(sessionId);
      if (body && controller) {
        player.x = body.position.x;
        player.y = body.position.y;
        player.chargeTicks = controller.chargeTicks;
        const input = this.inputs.get(sessionId);
        if (input) player.lastProcessedInputSeq = input.seq;
        player.direction = controller.direction;

        // Win condition: reach finish platform (y < -250)
        if (player.y <= -250) {
          player.hasFinished = true;
          player.finishTime = Date.now() - this.state.startTime;
        }
      }
    });

    if (allFinished && someoneActive) {
      this.state.status = "FINISHED";
    }
  }

  async onDispose() {
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

    if (this.countdownTimer) this.countdownTimer.clear();
  }
}
