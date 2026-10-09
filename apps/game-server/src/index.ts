import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import http from "http";
import cors from "cors";
import { CommunityRoom } from "./rooms/CommunityRoom";
import { RaceRoom } from "./rooms/RaceRoom";

const port = Number(process.env.PORT || 2567);
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define("community_tower", CommunityRoom);
gameServer.define("race_arena", RaceRoom);

gameServer.listen(port).then(() => {
  console.log(`[GameServer] Listening on Port: ${port}`);
});
