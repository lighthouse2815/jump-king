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
  private inputQueues = new Map<string, PlayerInputMessage[]>();
  private participants = new Map<string, { nickname: string, hasFinished: boolean, finishTime: number | null, maxHeight: number }>();
  private resultsSaved = false;

  private fixedTimeStep = 1000 / 60;
  private timer: any;
  private countdownTimer: any;

  onCreate(options: any) {
    this.setState(new GameState());

    this.physicsWorld = new PhysicsWorld();
    MAP_1.forEach(p => this.createPlatform(p.x, p.y, p.w, p.h));

    this.onMessage("input", (client, input: any) => {
      if (typeof input !== 'object' || input === null) return;
      if (typeof input.left !== 'boolean' || typeof input.right !== 'boolean' || typeof input.jump !== 'boolean' || typeof input.seq !== 'number') return;
      if (this.state.status !== "RUNNING") return;
      const player = this.state.players.get(client.sessionId);
      if (player?.hasFinished) return;
      
      let queue = this.inputQueues.get(client.sessionId);
      if (!queue) {
        queue = [];
        this.inputQueues.set(client.sessionId, queue);
      }
      if (queue.length < 60) {
        queue.push({
          left: input.left,
          right: input.right,
          jump: input.jump,
          seq: input.seq
        });
      }
    });

    this.onMessage("ready", (client, isReady: any) => {
      if (typeof isReady !== 'boolean') return;
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
    this.participants.set(client.sessionId, {
      nickname: player.nickname,
      hasFinished: false,
      finishTime: null,
      maxHeight: 0
    });

    const body = new Body(player.x, player.y, 20, 30);
    this.physicsWorld.addBody(body);
    this.playerBodies.set(client.sessionId, body);
    this.playerControllers.set(client.sessionId, new PlayerController(body));
    this.inputQueues.set(client.sessionId, []);
  }

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
    const body = this.playerBodies.get(client.sessionId);
    if (body) {
      this.physicsWorld.bodies = this.physicsWorld.bodies.filter(b => b !== body);
      this.playerBodies.delete(client.sessionId);
      this.playerControllers.delete(client.sessionId);
      this.inputQueues.delete(client.sessionId);
    }
  }

  update(deltaTime: number) {
    if (this.state.status !== "RUNNING") return;

    const dt = this.fixedTimeStep / 1000;

    this.playerControllers.forEach((controller, sessionId) => {
      const player = this.state.players.get(sessionId);
      if (player && player.hasFinished) return; // Stop simulating finished players
      
      const queue = this.inputQueues.get(sessionId) || [];
      const body = this.playerBodies.get(sessionId);
      
      if (queue.length === 0) {
        controller.tick({ left: false, right: false, jump: false, seq: 0 });
        if (body) this.physicsWorld.tickBody(body);
      } else {
        while (queue.length > 0) {
          const input = queue.shift()!;
          controller.tick(input);
          if (body) {
            this.physicsWorld.tickBody(body);
          }
          if (player) {
            player.lastProcessedInputSeq = input.seq;
          }
        }
      }
    });

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
        player.direction = controller.direction;

        // Win condition: reach finish platform (y < -250)
        if (player.y <= -250) {
          player.hasFinished = true;
          player.finishTime = Date.now() - this.state.startTime;
          const participant = this.participants.get(sessionId);
          if (participant) {
            participant.hasFinished = true;
            participant.finishTime = player.finishTime;
          }
        }
        
        const participant = this.participants.get(sessionId);
        if (participant) {
          const height = -Math.round(player.y);
          if (height > participant.maxHeight) {
            participant.maxHeight = height;
          }
        }
      }
    });

    if (allFinished && someoneActive && !this.resultsSaved) {
      this.state.status = "FINISHED";
      this.saveResults();
    }
  }

  async saveResults() {
    if (this.resultsSaved) return;
    this.resultsSaved = true;
    console.log("Saving race results for room", this.roomId);
    
    try {
      const match = await db.insert(raceMatches).values({
        roomCode: this.roomId,
        status: this.state.status,
      }).returning();
      
      const matchId = match[0].id;
      
      for (const [sessionId, p] of this.participants.entries()) {
        let userResult = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.nickname, p.nickname)
        });
        
        if (!userResult) {
          const inserted = await db.insert(users).values({ nickname: p.nickname }).returning();
          userResult = inserted[0];
        }
        
        await db.insert(raceParticipants).values({
          matchId,
          userId: userResult.id,
          finishTime: p.hasFinished ? p.finishTime : null,
          maxHeight: p.maxHeight,
        });
      }
      console.log("Race results saved successfully.");
    } catch (e) {
      console.error('Failed to save match', e);
    }
  }

  async onDispose() {
    if (this.state.status === "RUNNING") {
      await this.saveResults();
    }
    if (this.countdownTimer) this.countdownTimer.clear();
  }
}
