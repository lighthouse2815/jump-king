import * as Colyseus from 'colyseus.js';
import { GameState, PlayerInputMessage } from '@jump-king/protocol';

export class NetworkManager {
  public client: Colyseus.Client;
  public room: Colyseus.Room<GameState> | null = null;
  public sessionId: string = '';

  constructor() {
    this.client = new Colyseus.Client('ws://localhost:2567');
  }

  async connectToCommunityTower() {
    try {
      this.room = await this.client.joinOrCreate<GameState>('community_tower', { nickname: 'Player' });
      this.sessionId = this.room.sessionId;
      console.log('Joined community tower, sessionId:', this.sessionId);
    } catch (e) {
      console.error('Join error', e);
    }
  }

  async createRaceRoom() {
    try {
      this.room = await this.client.create<GameState>('race_arena', { nickname: 'Host' });
      this.sessionId = this.room.sessionId;
      return this.room.id;
    } catch (e) {
      console.error('Create race error', e);
      return null;
    }
  }

  async joinRaceRoom(roomId: string) {
    try {
      this.room = await this.client.joinById<GameState>(roomId, { nickname: 'Challenger' });
      this.sessionId = this.room.sessionId;
      return true;
    } catch (e) {
      console.error('Join race error', e);
      return false;
    }
  }

  sendInput(input: PlayerInputMessage) {
    if (this.room) {
      this.room.send('input', input);
    }
  }

  sendReady(isReady: boolean) {
    if (this.room) {
      this.room.send('ready', isReady);
    }
  }
}
