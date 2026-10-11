import type { OriginalState } from './OriginalSimulation';

export const ORIGINAL_ITEMS = [
  'Crown',
  'Shoes',
  'GoldRing',
  'CrownNBP',
  'Ruby',
  'SnakeRing',
  'GiantBoots',
  'Silver',
  'Cap',
  'GnomeHat',
  'Tunic',
  'YellowShoes',
  'CrownOwl',
  'CapeOwl',
  'BabeGhostItem',
  'GhostFragment',
  'Shroom',
  'BugNote',
] as const;
export type OriginalItem = (typeof ORIGINAL_ITEMS)[number];
export interface AdventureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface WorldItemDefinition extends AdventureRect {
  id: string;
  item: string;
  screen: number;
  texture: string;
  displayOnly: boolean;
  invisible: boolean;
}
export interface MerchantDefinition {
  name: string;
  screen: number;
  item: string;
  currency: string;
  basePrice: number;
  increase: number;
  trigger: AdventureRect;
  delay: number;
  speed: number;
  intro: string[];
  sale: string[];
  sell: string[];
  noGold: string[];
  sold: string[];
  achievements: { amount: number; code: string }[];
}
export interface BirdPosition {
  screen: number;
  x: number;
  y: number;
  treasure: boolean;
  direction: number;
  flyDirection: number;
}
export interface BirdDefinition {
  name: string;
  texture: string;
  sound: string;
  item: string;
  positions: BirdPosition[];
}
export interface OriginalAdventureData {
  items: WorldItemDefinition[];
  itemTextures: Record<string, string>;
  skins: { item: string; texture: string; layer: string }[];
  merchants: MerchantDefinition[];
  birds: BirdDefinition[];
}
export interface BirdState {
  index: number;
  done: boolean;
  dropped: boolean;
  flying: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ticks: number;
}
export type MerchantStage =
  'waiting' | 'intro' | 'sale' | 'sell' | 'noGold' | 'sold' | 'busy';
export interface MerchantState {
  price: number;
  sold: boolean;
  introduced: boolean;
  stage: MerchantStage;
  line: number;
  ticks: number;
}
export interface OriginalAdventureState {
  inventory: Record<string, number>;
  equipped: string[];
  collected: string[];
  birds: Record<string, BirdState>;
  merchants: Record<string, MerchantState>;
  flags: string[];
  npcTalks: Record<string, number>;
}
export interface AdventureEvent {
  type: 'pickup' | 'sale' | 'flee';
  item?: string;
  name?: string;
  x?: number;
  y?: number;
  sound?: string;
}
const intersects = (a: AdventureRect, b: AdventureRect) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
const validItem = (item: string) =>
  (ORIGINAL_ITEMS as readonly string[]).includes(item);
const cleanCounts = (counts: Record<string, number> | undefined) =>
  Object.fromEntries(
    Object.entries(counts || {}).filter(
      ([key, value]) =>
        validItem(key) &&
        Number.isSafeInteger(value) &&
        value >= 0 &&
        value <= 1000000,
    ),
  );

/** WorldItemComp, MerchantComp, RavenComp and RavenFlee from the supplied 1.04. */
export class OriginalAdventure {
  private state: OriginalAdventureState;
  constructor(
    readonly data: OriginalAdventureData,
    initial?: OriginalAdventureState,
  ) {
    this.state = {
      inventory: {},
      equipped: [],
      collected: [],
      birds: {},
      merchants: {},
      flags: [],
      npcTalks: {},
    };
    if (initial) this.restore(initial);
    for (const merchant of data.merchants) {
      this.state.merchants[merchant.name] ||= {
        price:
          (this.state.inventory[merchant.currency] || 0) +
          merchant.basePrice +
          merchant.increase,
        sold: false,
        introduced: false,
        stage: 'waiting',
        line: 0,
        ticks: 0,
      };
    }
    for (const bird of data.birds) {
      const pos = bird.positions[0];
      this.state.birds[bird.name] ||= {
        index: 0,
        done: false,
        dropped: false,
        flying: false,
        x: pos.x,
        y: pos.y - pos.screen * 360,
        vx: 0,
        vy: 0,
        ticks: 0,
      };
    }
  }
  get inventory() {
    return this.state.inventory;
  }
  get equipped() {
    return this.state.equipped;
  }
  has(item: string) {
    return (this.state.inventory[item] || 0) > 0;
  }
  add(item: string, once = false) {
    if (!validItem(item) || (once && this.has(item))) return;
    this.state.inventory[item] = (this.state.inventory[item] || 0) + 1;
    this.setEquipped(item, true);
  }
  setEquipped(item: string, enabled: boolean) {
    const skin = this.data.skins.find((skin) => skin.item === item);
    if (!skin || !this.has(item)) return false;
    this.state.equipped = this.state.equipped.filter(
      (current) =>
        current !== item &&
        (!enabled ||
          this.data.skins.find((skin) => skin.item === current)?.layer !==
            skin.layer),
    );
    if (enabled) this.state.equipped.push(item);
    return true;
  }
  recordTalk(name: string) {
    this.state.npcTalks[name] = (this.state.npcTalks[name] || 0) + 1;
  }
  flag(name: string) {
    if (!this.state.flags.includes(name)) this.state.flags.push(name);
  }
  complete(campaign: string) {
    const item =
      campaign === 'nbp'
        ? 'CrownNBP'
        : campaign === 'ghost'
          ? 'CrownOwl'
          : 'Crown';
    this.add(item, true);
    if (campaign === 'ghost' && this.state.birds.tsuchinoko?.done) this.add('CapeOwl', true);
    this.flag(
      campaign === 'nbp'
        ? 'CompletedNBP'
        : campaign === 'ghost'
          ? 'CompletedGhost'
          : 'CompletedNormalGame',
    );
  }
  getWorldItems(): WorldItemDefinition[] {
    const items = this.data.items.filter(
      (item) =>
        !this.state.collected.includes(item.id) &&
        !(item.displayOnly && this.has(item.item)),
    );
    for (const bird of this.data.birds) {
      const state = this.state.birds[bird.name],
        id = `bird:${bird.name}`;
      if (!state.dropped || this.state.collected.includes(id)) continue;
      const pos = bird.positions.at(-1)!;
      const item = bird.item;
      const sizes: Record<string, number[]> = {
        GoldRing: [8, 4],
        Ruby: [8, 5],
        BugNote: [14, 6],
      };
      const [width, height] = sizes[item] || [8, 4];
      items.push({
        id,
        item,
        x: pos.x - 5,
        y: pos.y + 8,
        screen: pos.screen,
        width,
        height,
        texture: this.data.itemTextures[item],
        displayOnly: false,
        invisible: false,
      });
    }
    return items;
  }
  merchantLine(name: string) {
    const definition = this.data.merchants.find((m) => m.name === name),
      state = this.state.merchants[name];
    if (
      !definition ||
      !state ||
      state.stage === 'waiting' ||
      state.stage === 'busy'
    )
      return null;
    const lines = definition[state.stage];
    const text = lines[state.line]?.replaceAll(
      '[gold_count]',
      String(state.price),
    );
    return text
      ? {
          text,
          characters: Math.min(
            text.length,
            Math.floor(state.ticks / (60 * definition.speed)),
          ),
          stage: state.stage,
        }
      : null;
  }
  private startStage(definition: MerchantDefinition, stage: MerchantStage) {
    const state = this.state.merchants[definition.name];
    state.stage = stage;
    state.line = 0;
    state.ticks = 0;
  }
  private canBuy(definition: MerchantDefinition) {
    const state = this.state.merchants[definition.name];
    return (
      !state.sold &&
      (this.state.inventory[definition.currency] || 0) >= state.price
    );
  }
  private advanceMerchant(
    definition: MerchantDefinition,
    touching: boolean,
    events: AdventureEvent[],
  ) {
    const state = this.state.merchants[definition.name];
    if (state.stage === 'busy') {
      if (++state.ticks >= 30 * 60) this.startStage(definition, 'waiting');
      return;
    }
    if (state.stage === 'waiting') {
      state.ticks = touching ? state.ticks + 1 : 0;
      if (state.ticks >= definition.delay * 60)
        this.startStage(
          definition,
          state.sold ? 'sold' : !state.introduced ? 'intro' : 'sale',
        );
      return;
    }
    const text = definition[state.stage][state.line]?.replaceAll(
      '[gold_count]',
      String(state.price),
    );
    if (
      text &&
      ++state.ticks < Math.ceil((text.length * definition.speed + 2.2) * 60)
    )
      return;
    state.ticks = 0;
    state.line++;
    if (state.line < definition[state.stage].length) return;
    this.recordTalk(definition.name);
    if (state.stage === 'intro' || state.stage === 'sale') {
      state.introduced = true;
      this.startStage(
        definition,
        touching && this.canBuy(definition) ? 'sell' : 'noGold',
      );
    } else if (state.stage === 'sell' && this.canBuy(definition)) {
      this.state.inventory[definition.currency] =
        (this.state.inventory[definition.currency] || 0) - state.price;
      this.add(definition.item, true);
      state.sold = true;
      for (const achievement of definition.achievements)
        if (state.price >= achievement.amount) this.flag(achievement.code);
      events.push({
        type: 'sale',
        item: definition.item,
        name: definition.name,
      });
      this.startStage(definition, 'sold');
    } else this.startStage(definition, 'busy');
  }
  tick(player: OriginalState) {
    const events: AdventureEvent[] = [];
    const box = {
      x: Math.trunc(player.x),
      y: Math.trunc(player.y),
      width: 18,
      height: 26,
    };
    for (const item of this.getWorldItems()) {
      if (item.displayOnly) continue;
      const y = item.y - item.screen * 360;
      const hitbox = item.invisible
        ? { x: 0, y: Math.trunc(y / 360) * 360 + 360, width: 480, height: 360 }
        : {
            x: item.x - item.width / 2,
            y: y - item.height,
            width: item.width,
            height: item.height,
          };
      if (intersects(box, hitbox)) {
        this.state.collected.push(item.id);
        this.add(item.item);
        events.push({ type: 'pickup', item: item.item });
      }
    }
    for (const merchant of this.data.merchants) {
      const trigger = {
        ...merchant.trigger,
        y: merchant.trigger.y - merchant.screen * 360,
      };
      this.advanceMerchant(merchant, intersects(box, trigger), events);
    }
    for (const bird of this.data.birds) {
      const state = this.state.birds[bird.name],
        pos = bird.positions[state.index];
      if (state.done) continue;
      if (
        !state.flying &&
        player.screen === pos.screen &&
        (box.x + 9 - state.x) ** 2 + (box.y + 13 - state.y) ** 2 < 40 ** 2
      ) {
        state.flying = true;
        state.ticks = 0;
        const next = bird.positions[state.index + 1];
        state.vy = next && next.screen < pos.screen ? 6 : -2;
        state.vx = state.vy > 0 ? pos.flyDirection * 3.5 : 0;
        events.push({
          type: 'flee',
          name: bird.name,
          x: state.x,
          y: state.y,
          sound: bird.sound,
        });
      }
      if (state.flying) {
        state.ticks++;
        if (state.ticks % 2 === 0) {
          state.vx += pos.flyDirection * (state.vy < 0 ? 0.5 : 0.3);
          state.vy *= state.vy < 0 ? 1.15 : 1.1;
        }
        state.x += state.vx / 2;
        state.y += state.vy / 2;
        const localY = state.y + pos.screen * 360;
        if (state.x < 0 || state.x >= 480 || localY < 0 || localY >= 360) {
          state.index++;
          if (state.index >= bird.positions.length) {
            state.done = true;
            state.index = bird.positions.length - 1;
            if (bird.name === 'fly') this.flag('CHASE_AWAY_BUG');
          }
          state.flying = false;
          const next = bird.positions[state.index];
          state.x = next.x;
          state.y = next.y - next.screen * 360;
          if (state.index === bird.positions.length - 1 && !state.dropped) {
            state.dropped = true;
            if (bird.name === 'raven') this.flag('CHASE_BIRD_PAST_SNOWSTORM');
          }
        }
      }
    }
    return events;
  }
  getState(): OriginalAdventureState {
    return {
      inventory: { ...this.state.inventory },
      equipped: [...this.state.equipped],
      collected: [...this.state.collected],
      flags: [...this.state.flags],
      npcTalks: { ...this.state.npcTalks },
      birds: Object.fromEntries(
        Object.entries(this.state.birds).map(([key, value]) => [
          key,
          { ...value },
        ]),
      ),
      merchants: Object.fromEntries(
        Object.entries(this.state.merchants).map(([key, value]) => [
          key,
          { ...value },
        ]),
      ),
    };
  }
  restore(state: OriginalAdventureState) {
    this.state.inventory = cleanCounts(state.inventory);
    this.state.equipped = [];
    for (const item of Array.isArray(state.equipped) ? state.equipped : [])
      this.setEquipped(item, true);
    this.state.collected = Array.isArray(state.collected)
      ? state.collected.filter((value) => typeof value === 'string')
      : [];
    this.state.flags = Array.isArray(state.flags)
      ? state.flags.filter((value) => typeof value === 'string')
      : [];
    this.state.npcTalks = Object.fromEntries(
      Object.entries(state.npcTalks || {}).filter(
        ([, count]) => Number.isSafeInteger(count) && count >= 0,
      ),
    );
    for (const definition of this.data.birds) {
      const value = state.birds?.[definition.name];
      if (
        value &&
        Number.isInteger(value.index) &&
        value.index >= 0 &&
        value.index < definition.positions.length &&
        [value.x, value.y, value.vx, value.vy, value.ticks].every(
          Number.isFinite,
        )
      )
        this.state.birds[definition.name] = { ...value };
    }
    for (const definition of this.data.merchants) {
      const value = state.merchants?.[definition.name];
      if (
        value &&
        Number.isSafeInteger(value.price) &&
        value.price >= 0 &&
        Number.isInteger(value.line) &&
        value.line >= 0 &&
        Number.isFinite(value.ticks) &&
        ['waiting', 'intro', 'sale', 'sell', 'noGold', 'sold', 'busy'].includes(
          value.stage,
        )
      )
        this.state.merchants[definition.name] = { ...value };
    }
  }
}
