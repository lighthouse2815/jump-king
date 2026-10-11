import * as Colyseus from 'colyseus.js';
import {
  GameState,
  PlayerInputMessage,
  OriginalTowerState,
} from '@jump-king/protocol';

export const multiplayerEnabled =
  import.meta.env.VITE_MULTIPLAYER_DISABLED !== 'true' ||
  Boolean(import.meta.env.VITE_SERVER_URL);

export class NetworkManager {
  public client: Colyseus.Client;
  public room: Colyseus.Room<GameState> | null = null;
  public sessionId: string = '';
  public originalRoom: Colyseus.Room<OriginalTowerState> | null = null;

  constructor() {
    let endpoint = import.meta.env.VITE_SERVER_URL;
    if (!endpoint) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const development = ['3000', '4173'].includes(window.location.port);
      const port = development
        ? ':2567'
        : window.location.port
          ? ':' + window.location.port
          : '';
      endpoint = `${protocol}//${host}${port}`;
    }
    this.client = new Colyseus.Client(endpoint);
  }

  private getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('userId', userId);
    }
    return userId;
  }

  async createOriginalRaceRoom(campaign = 'original') {
    if (this.originalRoom) await this.originalRoom.leave();
    this.originalRoom = await this.client.create<OriginalTowerState>(
      'original_race',
      { campaign, nickname: 'Host', userId: this.getUserId() }
    );
    return this.originalRoom.roomId;
  }

  async connectToCommunityTower() {
    try {
      this.room = await this.client.joinOrCreate<GameState>('community_tower', {
        nickname: 'Player',
        userId: this.getUserId(),
      });
      this.sessionId = this.room.sessionId;
      console.log('Joined community tower, sessionId:', this.sessionId);
    } catch (e) {
      console.error('Join error', e);
    }
  }

  async createRaceRoom() {
    try {
      this.room = await this.client.create<GameState>('race_arena', {
        nickname: 'Host',
        userId: this.getUserId(),
      });
      this.sessionId = this.room.sessionId;
      return this.room.id;
    } catch (e) {
      console.error('Create race error', e);
      return null;
    }
  }

  async joinRaceRoom(roomId: string) {
    try {
      this.room = await this.client.joinById<GameState>(roomId, {
        nickname: 'Challenger',
        userId: this.getUserId(),
      });
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

export const networkManager = new NetworkManager();
