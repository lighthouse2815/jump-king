import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") id: string = "";
  @type("string") nickname: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") chargeTime: number = 0;
  @type("int8") direction: number = 1;
}

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}

// Input messages sent by client
export interface PlayerInputMessage {
  left: boolean;
  right: boolean;
  jump: boolean;
  seq: number; // For prediction reconciliation
}
