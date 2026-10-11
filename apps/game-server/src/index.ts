import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { CommunityRoom } from './rooms/CommunityRoom';
import { RaceRoom } from './rooms/RaceRoom';
import { OriginalRoom, OriginalRaceRoom } from './rooms/OriginalRoom';
import path from 'node:path';

const port = Number(process.env.PORT || 2567);
const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_request, response) => response.json({ status: 'ok' }));

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define('community_tower', CommunityRoom);
gameServer.define('race_arena', RaceRoom);
gameServer.define('original_tower', OriginalRoom).filterBy(['campaign']);
gameServer.define('original_race', OriginalRaceRoom);

const webBuild = path.resolve(__dirname, '../../web/dist');
app.use(express.static(webBuild));
app.get(
  ['/', '/play', '/community', '/race', '/race/:roomId'],
  (_request, response) => response.sendFile(path.join(webBuild, 'index.html'))
);

gameServer.listen(port).then(() => {
  console.log(`[GameServer] Listening on Port: ${port}`);
});
