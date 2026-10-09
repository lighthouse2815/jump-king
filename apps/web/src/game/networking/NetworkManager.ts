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
      console.log('Joined successfully, sessionId:', this.sessionId);
    } catch (e) {
      console.error('Join error', e);
    }
  }

  sendInput(input: PlayerInputMessage) {
    if (this.room) {
      this.room.send('input', input);
    }
  }
}
