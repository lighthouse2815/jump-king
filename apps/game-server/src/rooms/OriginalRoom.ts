import { Room, Client } from '@colyseus/core';
import {
  ORIGINAL_SCREENS,
  ORIGINAL_ADVENTURE,
  CAMPAIGNS,
  CampaignId,
  isOriginalFinish,
} from '@jump-king/maps';
import { OriginalSimulation, PlayerInput } from '@jump-king/physics';
import {
  OriginalPlayerState,
  OriginalTowerState,
  ChatMessage,
  CHAT_MAX_LENGTH,
  CHAT_HISTORY_LIMIT,
  CHAT_COOLDOWN_MS,
  NICKNAME_MAX_LENGTH,
} from '@jump-king/protocol';
import { isSnapshotTick } from '../networking/snapshotCadence';

type SequencedInput = PlayerInput & { seq: number };
const idle: SequencedInput = {
  left: false,
  right: false,
  jump: false,
  seq: -1,
};

export class OriginalRoom extends Room<OriginalTowerState> {
  maxClients = 20;
  protected race = false;
  private campaign: CampaignId = 'original';
  private simulations = new Map<string, OriginalSimulation>();
  private queues = new Map<string, SequencedInput[]>();
  private lastInputs = new Map<string, SequencedInput>();
  private latestSequences = new Map<string, number>();
  private receivedAt = new Map<string, number>();
  private simulationTicks = 0;
  private chatHistory: ChatMessage[] = [];
  private lastChatAt = new Map<string, number>();
  private chatSequence = 0;

  onCreate(options: { campaign?: string }) {
    if (
      options.campaign &&
      Object.prototype.hasOwnProperty.call(CAMPAIGNS, options.campaign)
    )
      this.campaign = options.campaign as CampaignId;
    this.setState(new OriginalTowerState());
    this.state.campaign = this.campaign;
    this.state.status = this.race ? 'WAITING' : 'PLAYING';
    this.setMetadata({ campaign: this.campaign });
    this.onMessage('cheat', (client, code: unknown) => {
      const player = this.state.players.get(client.sessionId);
      const simulation = this.simulations.get(client.sessionId);
      if (!player || !simulation || player.finished) return;
      if (typeof code !== 'string' || code.length > 32) {
        client.send('cheatError', 'Mã cheat không hợp lệ. Dùng FLY hoặc NORMAL.');
        return;
      }
      const normalized = code.trim().toUpperCase();
      if (normalized !== 'FLY' && normalized !== 'NORMAL') {
        client.send('cheatError', 'Mã cheat không hợp lệ. Dùng FLY hoặc NORMAL.');
        return;
      }
      if (!simulation.setFreeFlight(normalized === 'FLY')) {
        client.send('cheatError', 'Hãy bay ra khỏi địa hình trước khi dùng NORMAL.');
        return;
      }
      this.queues.get(client.sessionId)!.length = 0;
      this.lastInputs.delete(client.sessionId);
      // Drop prediction inputs already superseded by this mode change.
      player.lastProcessedInputSeq =
        this.latestSequences.get(client.sessionId) ?? -1;
      player.snapshot = JSON.stringify(simulation.getState());
    });
    this.onMessage('chatHistory', (client) => {
      if (this.state.players.has(client.sessionId))
        client.send('chatHistory', this.chatHistory);
    });
    this.onMessage('chat', (client, value: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || typeof value !== 'string') return;
      const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
      if (!text) return;
      if (text.length > CHAT_MAX_LENGTH) {
        client.send('chatError', `Tin nhắn tối đa ${CHAT_MAX_LENGTH} ký tự.`);
        return;
      }
      const sentAt = Date.now();
      if (
        sentAt - (this.lastChatAt.get(client.sessionId) ?? -Infinity) <
        CHAT_COOLDOWN_MS
      ) {
        client.send('chatError', 'Hãy chờ 1 giây trước khi gửi tin tiếp.');
        return;
      }
      this.lastChatAt.set(client.sessionId, sentAt);
      const message: ChatMessage = {
        id: ++this.chatSequence,
        sessionId: client.sessionId,
        nickname: player.nickname,
        text,
        sentAt,
      };
      this.chatHistory.push(message);
      if (this.chatHistory.length > CHAT_HISTORY_LIMIT)
        this.chatHistory.shift();
      this.broadcast('chat', message);
    });
    this.onMessage('input', (client, input: unknown) => {
      if (!input || typeof input !== 'object') return;
      const value = input as SequencedInput;
      if (
        typeof value.left !== 'boolean' ||
        typeof value.right !== 'boolean' ||
        typeof value.jump !== 'boolean' ||
        (value.up !== undefined && typeof value.up !== 'boolean') ||
        (value.down !== undefined && typeof value.down !== 'boolean') ||
        !Number.isSafeInteger(value.seq) ||
        value.seq < 0 ||
        value.seq > 2147483647 ||
        value.seq <= (this.latestSequences.get(client.sessionId) ?? -1)
      )
        return;
      const queue = this.queues.get(client.sessionId);
      if (!queue) return;
      this.latestSequences.set(client.sessionId, value.seq);
      this.receivedAt.set(client.sessionId, Date.now());
      if (queue.length >= 6) queue.splice(0, queue.length - 5);
      queue.push({
        left: value.left,
        right: value.right,
        jump: value.jump,
        up: value.up === true,
        down: value.down === true,
        seq: value.seq,
      });
    });
    this.onMessage('ready', (client, value: unknown) => {
      if (
        !this.race ||
        this.state.status !== 'WAITING' ||
        typeof value !== 'boolean'
      )
        return;
      const player = this.state.players.get(client.sessionId);
      if (player) player.ready = value;
      if (
        this.state.players.size >= 2 &&
        [...this.state.players.values()].every((player) => player.ready)
      ) {
        this.state.status = 'COUNTDOWN';
        this.state.countdown = 3;
        const countdown = this.clock.setInterval(() => {
          if (this.state.players.size < 2) {
            countdown.clear();
            this.state.status = 'WAITING';
            this.state.countdown = 0;
            return;
          }
          this.state.countdown--;
          if (!this.state.countdown) {
            countdown.clear();
            this.state.status = 'RUNNING';
            this.state.startTime = Date.now();
            void this.lock();
            for (const queue of this.queues.values()) queue.length = 0;
            this.lastInputs.clear();
          }
        }, 1000);
      }
    });
    this.onMessage('equip', (client, value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const { item, enabled } = value as { item?: unknown; enabled?: unknown };
      if (typeof item !== 'string' || typeof enabled !== 'boolean') return;
      const simulation = this.simulations.get(client.sessionId);
      const player = this.state.players.get(client.sessionId);
      if (!simulation || !player || player.finished) return;
      if (simulation.adventure?.setEquipped(item, enabled))
        player.snapshot = JSON.stringify(simulation.getState());
    });
    this.setSimulationInterval(() => this.update(), 1000 / 60);
  }

  onJoin(client: Client, options: { nickname?: string }) {
    const campaign = CAMPAIGNS[this.campaign];
    const simulation = new OriginalSimulation(
      ORIGINAL_SCREENS,
      campaign.spawnX,
      campaign.spawnY - campaign.startScreen * 360,
      ORIGINAL_ADVENTURE,
    );
    if (this.campaign === 'nbp') simulation.adventure?.flag('StartedNBP');
    if (this.campaign === 'ghost') simulation.adventure?.flag('StartedGhost');
    const player = new OriginalPlayerState();
    player.nickname =
      typeof options.nickname === 'string'
        ? options.nickname
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .trim()
            .slice(0, NICKNAME_MAX_LENGTH)
        : '';
    if (!player.nickname) player.nickname = `Khách ${client.sessionId}`;
    player.snapshot = JSON.stringify(simulation.getState());
    this.simulations.set(client.sessionId, simulation);
    this.queues.set(client.sessionId, []);
    this.state.players.set(client.sessionId, player);
  }

  update() {
    const publishSnapshot = isSnapshotTick(++this.simulationTicks);
    const running = !this.race || this.state.status === 'RUNNING';
    for (const [sessionId, simulation] of this.simulations) {
      const player = this.state.players.get(sessionId)!;
      if (player.finished) continue;
      const queue = this.queues.get(sessionId)!;
      const next = queue.shift();
      if (next) {
        this.lastInputs.set(sessionId, next);
        player.lastProcessedInputSeq = next.seq;
      }
      const input =
        Date.now() - (this.receivedAt.get(sessionId) ?? 0) < 500
          ? this.lastInputs.get(sessionId) || idle
          : idle;
      const event = simulation.tick(
        running || simulation.freeFlight ? input : idle,
      );
      if (event.effects.length)
        this.broadcast('playerEffects', {
          sessionId,
          effects: event.effects,
          screen: simulation.screen,
          water: simulation.inWater,
          snow: simulation.onSnow,
          ice: simulation.onIce,
        });
      const finished =
        running &&
        !simulation.freeFlight &&
        isOriginalFinish(
          this.campaign,
          simulation.body.position.x,
          simulation.body.position.y,
          simulation.body.isGrounded,
          simulation.screen,
        );
      if (finished) {
        player.finished = true;
        player.finishEquipment = JSON.stringify(
          simulation.adventure?.equipped || [],
        );
        simulation.adventure?.complete(this.campaign);
        player.finishTime = this.race
          ? Date.now() - this.state.startTime
          : (simulation.elapsedTicks / 60) * 1000;
      }
      if (publishSnapshot || finished)
        player.snapshot = JSON.stringify(simulation.getState());
    }
    if (
      this.race &&
      this.state.status === 'RUNNING' &&
      this.state.players.size > 0 &&
      [...this.state.players.values()].every((player) => player.finished)
    )
      this.state.status = 'FINISHED';
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.simulations.delete(client.sessionId);
    this.queues.delete(client.sessionId);
    this.lastInputs.delete(client.sessionId);
    this.latestSequences.delete(client.sessionId);
    this.receivedAt.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId);
  }
}

export class OriginalRaceRoom extends OriginalRoom {
  maxClients = 8;
  protected race = true;
}
