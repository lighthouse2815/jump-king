import { Schema, type, MapSchema } from "@colyseus/schema";
export * from './original';

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") nickname: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("int32") chargeTicks: number = 0;
  @type("int8") direction: number = 1;
  @type("boolean") isReady: boolean = false;
  @type("boolean") hasFinished: boolean = false;
  @type("number") finishTime: number = 0;
  @type("number") lastProcessedInputSeq: number = 0;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  
  // Race specific
  @type("string") status: "WAITING" | "COUNTDOWN" | "RUNNING" | "FINISHED" = "WAITING";
  @type("number") countdown: number = 3;
  @type("number") startTime: number = 0;
}

export interface PlayerInputMessage {
  left: boolean;
  right: boolean;
  jump: boolean;
  seq: number;
}
