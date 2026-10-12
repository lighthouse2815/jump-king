import { it, expect } from 'vitest';
import { OriginalPlayerState, OriginalTowerState } from '../src/original';
import { GameState, PlayerState } from '../src';

it('encodes the authoritative snapshot and propagates later changes', () => {
  const server = new OriginalTowerState();
  const player = new OriginalPlayerState();
  player.nickname = 'King'; player.snapshot = '{"x":231}';
  server.players.set('session', player);
  const client = new OriginalTowerState();
  client.decode(server.encodeAll());
  server.discardAllChanges();
  expect(client.players.get('session')?.snapshot).toBe('{"x":231}');
  player.snapshot = '{"x":234.5}'; player.lastProcessedInputSeq = 1; player.ready = true;
  player.finishEquipment = '["Shoes"]';
  client.decode(server.encode());
  expect(client.players.get('session')?.snapshot).toBe('{"x":234.5}');
  expect(client.players.get('session')?.lastProcessedInputSeq).toBe(1);
  expect(client.players.get('session')?.ready).toBe(true);
  expect(JSON.parse(client.players.get('session')!.finishEquipment)).toEqual(['Shoes']);
});

it('preserves encoding of the existing multiplayer protocol', () => {
  const server = new GameState();
  const player = new PlayerState(); player.x = 400; player.y = 500;
  server.players.set('legacy-session', player);
  const client = new GameState(); client.decode(server.encodeAll());
  expect(client.players.get('legacy-session')?.x).toBe(400);
  expect(client.players.get('legacy-session')?.y).toBe(500);
});

it('synchronizes cosmetic appearance separately from gameplay snapshots', () => {
  const server = new OriginalTowerState();
  const player = new OriginalPlayerState();
  player.snapshot = '{"adventure":{"inventory":{},"equipped":[]}}';
  player.cosmeticHat = 'Cap';
  player.colorHue = 123.5;
  server.players.set('costumed-player', player);
  const client = new OriginalTowerState();
  client.decode(server.encodeAll());
  server.discardAllChanges();
  expect(client.players.get('costumed-player')?.cosmeticHat).toBe('Cap');
  expect(client.players.get('costumed-player')?.colorHue).toBe(123.5);
  player.snapshot = '{"x":250,"adventure":{"inventory":{},"equipped":[]}}';
  client.decode(server.encode());
  expect(client.players.get('costumed-player')?.cosmeticHat).toBe('Cap');
  expect(client.players.get('costumed-player')?.colorHue).toBe(123.5);
  expect(JSON.parse(client.players.get('costumed-player')!.snapshot).adventure)
    .toEqual({ inventory: {}, equipped: [] });
});
