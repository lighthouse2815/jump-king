import { expect, it } from 'vitest';
import type { Client } from '@colyseus/core';
import { OriginalTowerState } from '@jump-king/protocol';
import { ORIGINAL_ADVENTURE } from '@jump-king/maps';
import { OriginalRoom, OriginalRaceRoom } from '../src/rooms/OriginalRoom';

for (const Room of [OriginalRoom, OriginalRaceRoom]) {
  it(`${Room.name} balances hats and keeps colors stable through a full-room departure and join`, () => {
    const room = new Room();
    room.autoDispose = false;
    room.setPatchRate(null);
    room.setState(new OriginalTowerState());
    const clients = Array.from(
      { length: room.maxClients },
      (_, index) => ({ sessionId: `player-${index}` }) as Client,
    );
    const hats = ORIGINAL_ADVENTURE.skins
      .filter((skin) => skin.layer === 'Hat')
      .map((skin) => skin.item);
    try {
      for (const client of clients) {
        room.onJoin(client, {
          nickname: 'Cùng tên',
          ...{ cosmeticHat: 'invalid', colorHue: -1 },
        });
      }
      expect(room.state.players.size).toBe(room.maxClients);
      const players = [...room.state.players.values()];
      expect(new Set(players.map((player) => player.colorHue)).size).toBe(
        room.maxClients,
      );
      expect(
        new Set(
          players.slice(0, hats.length).map((player) => player.cosmeticHat),
        ).size,
      ).toBe(hats.length);
      for (const player of players) {
        expect(hats).toContain(player.cosmeticHat);
        expect(player.colorHue).toBeGreaterThanOrEqual(0);
        expect(player.colorHue).toBeLessThan(360);
        expect(JSON.parse(player.snapshot).adventure).toMatchObject({
          equipped: [],
          inventory: {},
        });
      }
      const counts = hats.map(
        (hat) => players.filter((player) => player.cosmeticHat === hat).length,
      );
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      const initial = new Map(
        [...room.state.players.entries()].map(([id, player]) => [
          id,
          { hat: player.cosmeticHat, hue: player.colorHue },
        ]),
      );
      const departing = clients.pop()!;
      const freedHat = initial.get(departing.sessionId)!.hat;
      room.onLeave(departing);
      expect(room.state.players.size).toBe(room.maxClients - 1);
      const newcomer = { sessionId: 'newcomer' } as Client;
      room.onJoin(newcomer, {});
      clients.push(newcomer);
      expect(room.state.players.size).toBe(room.maxClients);
      if (room.maxClients % hats.length === 0)
        expect(room.state.players.get(newcomer.sessionId)!.cosmeticHat).toBe(
          freedHat,
        );
      room.update();
      for (const [id, appearance] of initial) {
        if (id === departing.sessionId) continue;
        expect(room.state.players.get(id)).toMatchObject({
          cosmeticHat: appearance.hat,
          colorHue: appearance.hue,
        });
      }
      expect(
        new Set(
          [...room.state.players.values()].map((player) => player.colorHue),
        ).size,
      ).toBe(room.maxClients);
    } finally {
      for (const client of clients) room.onLeave(client);
      room.clock.stop();
    }
  });
}
