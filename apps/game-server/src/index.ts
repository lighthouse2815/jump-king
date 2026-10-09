import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import http from "http";
import cors from "cors";

const port = Number(process.env.PORT || 2567);
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.listen(port).then(() => {
  console.log(`[GameServer] Listening on Port: ${port}`);
});
