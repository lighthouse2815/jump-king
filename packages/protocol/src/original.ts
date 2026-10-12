import { Schema, MapSchema, type } from '@colyseus/schema';

export class OriginalPlayerState extends Schema {
  @type('string') nickname = 'Player';
  @type('string') snapshot = '';
  @type('int32') lastProcessedInputSeq = -1;
  @type('boolean') ready = false;
  @type('boolean') finished = false;
  @type('number') finishTime = 0;
  @type('string') finishEquipment = '[]';
  @type('string') cosmeticHat = '';
  @type('number') colorHue = 0;
}

export class OriginalTowerState extends Schema {
  @type({ map: OriginalPlayerState }) players = new MapSchema<OriginalPlayerState>();
  @type('string') campaign = 'original';
  @type('string') status = 'PLAYING';
  @type('uint8') countdown = 0;
  @type('number') startTime = 0;
}
