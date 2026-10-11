import { describe, expect, it } from 'vitest';
import { AABB } from '../src/math';
import {
  OriginalSimulation,
  type OriginalState,
} from '../src/OriginalSimulation';
import {
  OriginalWorldEvents,
  createOriginalWallDefinition,
  originalQuarkRegions,
  type OriginalWallEventDefinition,
  type OriginalWorldEventData,
} from '../src/OriginalWorldEvents';

const emptyScreen = {
  tiles: Array.from({ length: 45 }, () => ' '.repeat(60)),
  wind: false,
  teleport: -1,
};

function player(overrides: Partial<OriginalState> = {}): OriginalState {
  return {
    ...new OriginalSimulation([emptyScreen]).getState(),
    x: 240,
    y: 100,
    grounded: false,
    ticks: 0,
    ...overrides,
  };
}

// Literal data from hidden_wall133.xml; hitboxes are triggers, not colliders.
const phantom = createOriginalWallDefinition(
  132,
  {
    texture_name: '133_hidden_wall',
    use_screen_coords: true,
    Position: { X: 360, Y: 208 },
    hitboxes: { Rectangle: { X: 360, Y: 207, Width: 24, Height: 1 } },
    sfx_info: {
      sfx_name_enable: 'phantom_block',
      sfx_name_disable: 'phantom_block',
      play_mode: 'PlayEveryTime',
    },
  },
  { width: 24, height: 16 }
);

const touchPhantom = (ticks: number) =>
  player({ x: 360, y: -47338, screen: 132, grounded: true, ticks });

function wallData(wall: OriginalWallEventDefinition): OriginalWorldEventData {
  return { walls: [wall], jingles: [] };
}

describe('original hidden wall definitions', () => {
  it('converts screen-coordinate triggers without adding the sprite position', () => {
    expect(phantom.position).toEqual({ x: 360, y: -47312 });
    expect(phantom.hitboxes).toEqual([
      { x: 360, y: -47313, width: 24, height: 1 },
    ]);
    expect(phantom.texture).toBe('props/hidden_walls/textures/133_hidden_wall');
  });

  it('uses sprite-local hitboxes and texture size when XML omits hitboxes', () => {
    const wall = createOriginalWallDefinition(
      6,
      { texture_name: '7_hidden_wall1', Position: { X: 303, Y: 223 } },
      { width: 65, height: 82 }
    );
    expect(wall.hitboxes).toEqual([
      { x: 303, y: -1937, width: 65, height: 82 },
    ]);
    const local = createOriginalWallDefinition(
      6,
      {
        texture_name: '7_hidden_wall2_2',
        Position: { X: 288, Y: 47 },
        hitboxes: {
          Rectangle: [
            { X: 0, Y: 72, Width: 64, Height: 34 },
            { X: 48, Y: 16, Width: 16, Height: 57 },
          ],
        },
      },
      { width: 96, height: 106 }
    );
    expect(local.hitboxes).toEqual([
      { x: 288, y: -2041, width: 64, height: 34 },
      { x: 336, y: -2097, width: 16, height: 57 },
    ]);
  });
});

describe('original hidden wall events', () => {
  it('fades out on touching the one-pixel phantom trigger and plays each edge once', () => {
    const world = new OriginalWorldEvents(wallData(phantom));
    for (let ticks = 0; ticks < 12; ticks++)
      world.tick(player({ screen: 132, ticks }));
    expect(world.getState().walls[phantom.id].alpha).toBe(1);
    const enter = world.tick(touchPhantom(12));
    expect(enter.filter((event) => event.type === 'sound')).toEqual([
      { type: 'sound', key: 'audio/event_sfx/phantom_block', channel: 'sfx' },
    ]);
    expect(world.getState().walls[phantom.id].alpha).toBeCloseTo(11 / 12);
    expect(
      world.tick(touchPhantom(13)).filter((e) => e.type === 'sound')
    ).toEqual([]);
    for (let ticks = 14; ticks < 24; ticks++) world.tick(touchPhantom(ticks));
    expect(world.getState().walls[phantom.id].alpha).toBe(0);
    const leave = world.tick(player({ screen: 132, ticks: 24 }));
    expect(leave.filter((event) => event.type === 'sound')).toEqual([
      { type: 'sound', key: 'audio/event_sfx/phantom_block', channel: 'sfx' },
    ]);
    expect(world.tick(touchPhantom(25)).some((e) => e.type === 'sound')).toBe(
      true
    );
  });

  it('exhausts PlayOnce only after exiting, and restores without replaying sound', () => {
    const wall = { ...phantom, playMode: 'once' as const };
    const world = new OriginalWorldEvents(wallData(wall));
    expect(
      world.tick(touchPhantom(0)).filter((e) => e.type === 'sound')
    ).toHaveLength(1);
    const restored = new OriginalWorldEvents(wallData(wall));
    restored.restore(JSON.parse(JSON.stringify(world.getState())));
    expect(
      restored.tick(touchPhantom(1)).filter((e) => e.type === 'sound')
    ).toEqual([]);
    expect(
      restored.tick(player({ ticks: 2 })).filter((e) => e.type === 'sound')
    ).toHaveLength(1);
    expect(
      restored.tick(touchPhantom(3)).filter((e) => e.type === 'sound')
    ).toEqual([]);
    expect(
      restored.tick(player({ ticks: 4 })).filter((e) => e.type === 'sound')
    ).toEqual([]);
  });

  it('uses audio/illusion by default and never treats fading as collision removal', () => {
    const wall = createOriginalWallDefinition(
      0,
      { texture_name: 'test_wall', Position: { X: 100, Y: 100 } },
      { width: 40, height: 40 }
    );
    const world = new OriginalWorldEvents(wallData(wall));
    const events = world.tick(player({ x: 100, y: 100 }));
    expect(events.filter((e) => e.type === 'sound')).toEqual([
      { type: 'sound', key: 'audio/illusion', channel: 'sfx' },
    ]);
    expect(world.getCollisionOverrides(new AABB(100, 100, 18, 26), 0)).toEqual({
      disabledTileRegions: [],
      quark: false,
    });
  });

  it('checks every world trigger, including hitboxes extending to a neighboring screen', () => {
    // hidden_wall78.xml has a trigger extending 104px below its own screen.
    const wall = createOriginalWallDefinition(
      77,
      {
        texture_name: '78_hidden_wall1',
        use_screen_coords: true,
        Position: { X: 352, Y: 279 },
        hitboxes: { Rectangle: { X: 352, Y: 280, Width: 112, Height: 184 } },
      },
      { width: 113, height: 81 }
    );
    const world = new OriginalWorldEvents(wallData(wall));
    world.tick(player({ x: 352, y: -27270, screen: 76 }));
    expect(world.getState().walls[wall.id].touching).toBe(true);
  });

  it('truncates player coordinates like XNA and excludes edge-only contact', () => {
    const world = new OriginalWorldEvents(wallData(phantom));
    world.tick(player({ x: 342.9, y: -47313.9, screen: 132 }));
    expect(world.getState().walls[phantom.id].touching).toBe(false);
    world.tick(player({ x: 343.1, y: -47313.9, screen: 132, ticks: 1 }));
    expect(world.getState().walls[phantom.id].touching).toBe(true);
  });

  it('replays snapshots deterministically without sharing mutable state', () => {
    const first = new OriginalWorldEvents(wallData(phantom), 37);
    first.tick(touchPhantom(0));
    const snapshot = first.getState();
    const restored = new OriginalWorldEvents(wallData(phantom));
    restored.restore(snapshot);
    snapshot.walls[phantom.id].alpha = 1;
    snapshot.registeredScreens.push(94);
    expect(first.getState()).toEqual(restored.getState());
    for (let ticks = 1; ticks < 40; ticks++) {
      const input = ticks % 7 < 3 ? touchPhantom(ticks) : player({ ticks });
      expect(restored.tick(input)).toEqual(first.tick(input));
      expect(restored.getState()).toEqual(first.getState());
    }
  });
});

describe('grounded screen events', () => {
  it('plays XML jingles only on the first grounded visit and persists visited screens', () => {
    const world = new OriginalWorldEvents();
    expect(world.tick(player({ screen: 99 }))).toEqual([]);
    const events = world.tick(player({ screen: 99, grounded: true, ticks: 1 }));
    expect(events).toEqual([
      { type: 'sound', key: 'audio/music/event_music/Moon', channel: 'music' },
    ]);
    world.tick(player({ screen: 100, grounded: true, ticks: 2 }));
    const restored = new OriginalWorldEvents();
    restored.restore(JSON.parse(JSON.stringify(world.getState())));
    expect(
      restored.tick(player({ screen: 99, grounded: true, ticks: 3 }))
    ).toEqual([]);
    expect(restored.getState().registeredScreens).toEqual([99, 100]);
  });

  it.each([
    [42, 'audio/music/event_music/ending_jingle', 'music'],
    [137, 'audio/music/event_music/Elude1', 'music'],
    [153, 'audio/music/event_music/Elude2', 'music'],
    [147, 'audio/event_sfx/gargoyls', 'sfx'],
  ])(
    'resolves the source jingle channel on screen %i',
    (screen, key, channel) => {
      const world = new OriginalWorldEvents();
      expect(
        world.tick(player({ screen: screen as number, grounded: true }))[0]
      ).toEqual({
        type: 'sound',
        key,
        channel,
      });
    }
  );

  it('accepts XML-generated jingle definitions in place of the source defaults', () => {
    const world = new OriginalWorldEvents({
      jingles: [
        { screen: 3, key: 'audio/music/event_music/Moon', channel: 'music' },
      ],
    });
    expect(world.tick(player({ screen: 99, grounded: true }))).toEqual([]);
    expect(world.tick(player({ screen: 3, grounded: true, ticks: 1 }))).toEqual(
      [
        {
          type: 'sound',
          key: 'audio/music/event_music/Moon',
          channel: 'music',
        },
      ]
    );
  });

  it('ignores duplicate ticks so an authoritative snapshot cannot advance fades twice', () => {
    const world = new OriginalWorldEvents(wallData(phantom));
    world.tick(touchPhantom(0));
    const snapshot = world.getState();
    expect(world.tick(touchPhantom(0))).toEqual([]);
    expect(world.getState()).toEqual(snapshot);
  });
});

describe('tower lightning', () => {
  it('waits six seconds, flashes, gaps, fades with 256 steps, then finishes', () => {
    const world = new OriginalWorldEvents({ jingles: [] });
    expect(world.tick(player({ screen: 94, grounded: true }))).toEqual([]);
    for (let ticks = 1; ticks < 360; ticks++)
      expect(world.tick(player({ screen: 94, ticks }))).toEqual([]);
    expect(world.tick(player({ screen: 94, ticks: 360 }))).toEqual([
      { type: 'sound', key: 'audio/event_sfx/lightning', channel: 'sfx' },
      { type: 'lightning', screen: 94, phase: 'flash', alpha: 0.5 },
    ]);
    expect(world.tick(player({ screen: 94, ticks: 366 }))).toEqual([
      { type: 'lightning', screen: 94, phase: 'gap', alpha: 0 },
    ]);
    expect(world.tick(player({ screen: 94, ticks: 372 }))).toEqual([
      { type: 'lightning', screen: 94, phase: 'fade', alpha: 235 / 512 },
    ]);
    expect(world.tick(player({ screen: 94, ticks: 384 }))).toEqual([
      { type: 'lightning', screen: 94, phase: 'end', alpha: 0 },
    ]);
    expect(world.getState().lightning).toBeNull();
  });

  it('cancels immediately when leaving, including during the delay, without retriggering', () => {
    const world = new OriginalWorldEvents({ jingles: [] });
    world.tick(player({ screen: 94, grounded: true }));
    expect(world.tick(player({ screen: 93, ticks: 1 }))).toEqual([
      { type: 'lightning', screen: 94, phase: 'end', alpha: 0 },
    ]);
    expect(
      world.tick(player({ screen: 94, grounded: true, ticks: 360 }))
    ).toEqual([]);
    expect(world.getState().lightning).toBeNull();
  });

  it('restores the pending delay and a flash without repeating the thunder sound', () => {
    const first = new OriginalWorldEvents({ jingles: [] });
    first.tick(player({ screen: 94, grounded: true, ticks: 100 }));
    first.tick(player({ screen: 94, ticks: 300 }));
    const restored = new OriginalWorldEvents({ jingles: [] });
    restored.restore(JSON.parse(JSON.stringify(first.getState())));
    expect(restored.tick(player({ screen: 94, ticks: 460 }))).toEqual(
      first.tick(player({ screen: 94, ticks: 460 }))
    );
    const flash = new OriginalWorldEvents({ jingles: [] });
    flash.restore(restored.getState());
    expect(flash.tick(player({ screen: 94, ticks: 461 }))).toEqual([]);
    expect(flash.getState().lightning?.alpha).toBe(0.5);
  });
});

describe('flying gargoyles', () => {
  it('spawns the source 19 gargoyles once with the exact rows, flips, and animation data', () => {
    const world = new OriginalWorldEvents({ jingles: [] }, 123);
    const events = world.tick(player({ screen: 147, grounded: true }));
    const event = events.find((e) => e.type === 'gargoyles');
    if (event?.type !== 'gargoyles') throw new Error('Missing gargoyle event');
    expect(event.texture).toBe('ending/flying_gargoyle');
    expect(event.cells).toEqual({ x: 1, y: 3 });
    expect(event.frameSeconds).toBe(0.1);
    expect(event.baseSpeed).toBe(2);
    expect(event.acceleration).toBe(3);
    expect(event.spawns).toHaveLength(19);
    expect(
      event.spawns.slice(0, 6).map(({ x, y, flipped }) => ({ x, y, flipped }))
    ).toEqual([
      { x: 0, y: -52560, flipped: false },
      { x: 48, y: -52560, flipped: true },
      { x: 216, y: -52560, flipped: false },
      { x: 360, y: -52560, flipped: true },
      { x: 432, y: -52560, flipped: false },
      { x: 480, y: -52560, flipped: true },
    ]);
    expect(event.spawns[6].x).toBeCloseTo(48, 4);
    expect(event.spawns[6]).toMatchObject({ y: -52524, flipped: true });
    expect(event.spawns[7].x).toBeCloseTo(48, 4);
    expect(event.spawns[7]).toMatchObject({ y: -52524, flipped: true });
    expect(event.spawns[18]).toMatchObject({
      x: 240,
      y: -52524,
      flipped: false,
    });
    event.spawns.forEach((spawn, i) => {
      const maxDelay =
        [0.05, 0.45, 0.95, 0.75, 0.3, 0][i < 6 ? i : Math.floor((i - 6) / 2)] ??
        1;
      expect(spawn.delaySeconds).toBeGreaterThanOrEqual(0);
      expect(spawn.delaySeconds).toBeLessThanOrEqual(
        maxDelay * (i < 6 ? 1 : 0.5)
      );
    });
    expect(
      world.tick(player({ screen: 147, grounded: true, ticks: 1 }))
    ).toEqual([]);
  });

  it('replays seeded random delays from JSON snapshots and suppresses already-spawned flocks', () => {
    const first = new OriginalWorldEvents({ jingles: [] }, 73);
    first.tick(player({ screen: 146, grounded: true }));
    const second = new OriginalWorldEvents({ jingles: [] }, 2);
    second.restore(JSON.parse(JSON.stringify(first.getState())));
    expect(
      second.tick(player({ screen: 147, grounded: true, ticks: 1 }))
    ).toEqual(first.tick(player({ screen: 147, grounded: true, ticks: 1 })));
    expect(second.getState()).toEqual(first.getState());
    const restored = new OriginalWorldEvents({ jingles: [] });
    restored.restore(first.getState());
    expect(
      restored.tick(player({ screen: 147, grounded: true, ticks: 2 }))
    ).toEqual([]);
    const different = new OriginalWorldEvents({ jingles: [] }, 74);
    expect(
      different.tick(player({ screen: 147, grounded: true, ticks: 1 }))
    ).not.toEqual(
      new OriginalWorldEvents({ jingles: [] }, 73).tick(
        player({ screen: 147, grounded: true, ticks: 1 })
      )
    );
  });
});

describe('original collision overrides', () => {
  const quark = {
    screen: 108,
    kind: 'quark' as const,
    rect: { x: 472, y: -38824, width: 8, height: 8 },
  };
  const fake = {
    screen: 78,
    kind: 'fake' as const,
    rect: { x: 400, y: -27928, width: 64, height: 24 },
  };

  it('keeps gray fake regions nonsolid independently of hidden-wall fades', () => {
    const world = new OriginalWorldEvents({
      jingles: [],
      collisionRegions: [fake],
    });
    const hitbox = new AABB(400, -27928, 18, 26);
    expect(world.getCollisionOverrides(hitbox, 78)).toEqual({
      disabledTileRegions: [fake.rect],
      quark: false,
    });
    world.tick(
      player({ x: hitbox.x, y: hitbox.y, screen: 78, grounded: true })
    );
    expect(world.getCollisionOverrides(hitbox, 78).disabledTileRegions).toEqual(
      [fake.rect]
    );
  });

  it('activates quark metadata only while the integer player bottom is within the tile bottom', () => {
    const world = new OriginalWorldEvents({
      jingles: [],
      collisionRegions: [quark],
    });
    expect(
      world.getCollisionOverrides(new AABB(463, -38842, 18, 26), 108)
    ).toEqual({
      disabledTileRegions: [],
      quark: true,
    });
    expect(
      world.getCollisionOverrides(new AABB(463, -38841, 18, 26), 108)
    ).toEqual({
      disabledTileRegions: [quark.rect],
      quark: false,
    });
    expect(
      world.getCollisionOverrides(new AABB(463.9, -38842.9, 18, 26), 108).quark
    ).toBe(true);
  });

  it('reevaluates each tentative contact probe without mutating the tick snapshot', () => {
    const world = new OriginalWorldEvents({
      jingles: [],
      collisionRegions: [quark],
    });
    const before = world.getState();
    expect(
      world.getCollisionOverrides(new AABB(463, -38841, 18, 26), 108).quark
    ).toBe(false);
    expect(
      world.getCollisionOverrides(new AABB(463, -38842, 18, 26), 108).quark
    ).toBe(true);
    expect(world.getState()).toEqual(before);
  });

  it('includes neighboring collision screens, excludes distant screens and exact edges', () => {
    const world = new OriginalWorldEvents({
      jingles: [],
      collisionRegions: [quark],
    });
    const hitbox = new AABB(463, -38842, 18, 26);
    expect(world.getCollisionOverrides(hitbox, 107).quark).toBe(true);
    expect(world.getCollisionOverrides(hitbox, 106).quark).toBe(false);
    expect(
      world.getCollisionOverrides(new AABB(454, -38842, 18, 26), 108).quark
    ).toBe(false);
  });

  it('extracts separate eight-pixel Q tiles rather than merging away their bottom thresholds', () => {
    const tiles = [...emptyScreen.tiles];
    tiles[7] = ' '.repeat(59) + 'Q';
    tiles[8] = ' '.repeat(59) + 'Q';
    const regions = originalQuarkRegions([
      emptyScreen,
      { ...emptyScreen, tiles },
    ]);
    expect(regions).toEqual([
      {
        screen: 1,
        kind: 'quark',
        rect: { x: 472, y: -304, width: 8, height: 8 },
      },
      {
        screen: 1,
        kind: 'quark',
        rect: { x: 472, y: -296, width: 8, height: 8 },
      },
    ]);
    const world = new OriginalWorldEvents({
      jingles: [],
      collisionRegions: regions,
    });
    expect(
      world.getCollisionOverrides(new AABB(463, -322, 18, 26), 1).quark
    ).toBe(true);
    const lower = world.getCollisionOverrides(new AABB(463, -321, 18, 26), 1);
    expect(lower.quark).toBe(true);
    expect(lower.disabledTileRegions).toEqual([regions[0].rect]);
  });
});
