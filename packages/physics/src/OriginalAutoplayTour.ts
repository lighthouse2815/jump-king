import {
  OriginalAdventureData,
  originalWorldItemBounds,
} from './OriginalAdventure';
import { OriginalSimulation } from './OriginalSimulation';
import { PlayerInput } from './PlayerController';

interface TourStop {
  kind: 'screen' | 'item' | 'npc' | 'merchant' | 'bird' | 'ending';
  screen: number;
  x: number;
  y: number;
  ticks: number;
  name?: string;
  index?: number;
}

/** Explicit solo cheat: move to real triggers, then exercise the actual simulation. */
export class OriginalAutoplayTour {
  private stops: TourStop[] = [];
  private index = 0;
  private ticks = 0;
  private entered = false;
  private met = new Set<string>();
  readonly testedEquipment = new Set<string>();
  readonly visited = new Set<number>();
  get progress() {
    return Math.min(1, this.index / this.stops.length);
  }
  get finishing() {
    return this.stops[this.index]?.kind === 'ending';
  }
  get label() {
    const stop = this.stops[this.index];
    const labels = {
      screen: 'Tham quan màn',
      item: 'Nhặt vật phẩm',
      npc: 'Hội thoại NPC',
      merchant: 'Mua và thử trang bị',
      bird: 'Nhiệm vụ chim',
      ending: 'Cắt cảnh kết thúc',
    };
    return stop
      ? `${labels[stop.kind]}${stop.name ? ` · ${stop.name}` : ''}`
      : 'Hoàn tất tham quan';
  }
  get npcs() {
    return [...this.met];
  }

  constructor(
    readonly data: OriginalAdventureData,
    readonly screens: number[],
    finish: { screen: number; x: number; y: number },
  ) {
    for (const screen of screens) {
      this.stops.push({ kind: 'screen', screen, x: 231, y: 144, ticks: 120 });
      for (const item of data.items.filter(
        (item) => item.screen === screen && !item.displayOnly,
      )) {
        const bounds = originalWorldItemBounds(item);
        const y = bounds.y + bounds.height / 2 - 13;
        this.stops.push({
          kind: 'item',
          screen: Math.max(0, -Math.floor((y + 13) / 360)),
          x: bounds.x + bounds.width / 2 - 9,
          y: y + Math.max(0, -Math.floor((y + 13) / 360)) * 360,
          ticks: 90,
          name: item.id,
        });
      }
      for (const npc of data.npcs?.filter((npc) => npc.screen === screen) ||
        []) {
        if (!npc.intro.length && !npc.looping.length && npc.quotes.length)
          this.stops.push({
            kind: 'screen',
            screen: npc.quotes[0].screen - 1,
            x: 231,
            y: 144,
            ticks: 120,
          });
        const lines = [
          npc.intro,
          ...npc.looping,
          ...npc.quotes.map((quote) => quote.lines),
        ];
        const duration = Math.max(
          1,
          ...lines.map((quote) =>
            quote.reduce((sum, line) => sum + line.length * npc.speed + 2.2, 0),
          ),
        );
        this.stops.push({
          kind: 'npc',
          screen,
          x: npc.trigger.x + npc.trigger.width / 2 - 9,
          y: npc.trigger.y + npc.trigger.height / 2 - 13,
          ticks: Math.ceil((npc.delay + duration + 31) * 60),
          name: npc.name,
        });
      }
      for (const merchant of data.merchants.filter(
        (npc) => npc.screen === screen,
      ))
        this.stops.push({
          kind: 'merchant',
          screen,
          x: merchant.trigger.x + merchant.trigger.width / 2 - 9,
          y: merchant.trigger.y - 13,
          ticks: 18000,
          name: merchant.name,
        });
    }
    for (const bird of data.birds.filter((bird) =>
      screens.includes(bird.positions[0].screen),
    )) {
      bird.positions.forEach((pos, index) =>
        this.stops.push({
          kind: 'bird',
          screen: pos.screen,
          x: pos.x - 9,
          y: pos.y - 13,
          ticks: 180,
          name: bird.name,
          index,
        }),
      );
    }
    this.stops.push({ kind: 'ending', ...finish, ticks: 120 });
  }

  prepare(sim: OriginalSimulation): PlayerInput {
    const stop = this.stops[this.index];
    if (!stop) throw new Error('Tham quan đã hết bước nhưng chưa đạt đích.');
    const adventure = sim.adventure!;
    if (!this.entered || stop.kind !== 'screen') {
      sim.body.position.set(
        Math.max(0, Math.min(462, stop.x)),
        stop.y - stop.screen * 360,
      );
      sim.body.velocity.set(0, 1);
      sim.body.isGrounded = false;
      sim.screen = stop.screen;
      sim.chargeTicks = 0;
      sim.splatTicks = 0;
      sim.jumpConsumed = false;
      sim.windEnabled = false;
      if (!this.entered && stop.kind === 'merchant') {
        const merchant = this.data.merchants.find(
          (npc) => npc.name === stop.name,
        )!;
        const price = adventure.getState().merchants[merchant.name].price;
        for (
          let n = adventure.inventory[merchant.currency] || 0;
          n < price;
          n++
        )
          adventure.add(merchant.currency);
      }
      this.entered = true;
    }
    this.visited.add(stop.screen);
    return {
      left: false,
      right: false,
      jump: stop.kind === 'screen' && this.ticks < 36,
    };
  }

  afterTick(sim: OriginalSimulation) {
    const stop = this.stops[this.index];
    const adventure = sim.adventure!;
    const state = adventure.getState();
    this.visited.add(sim.screen);
    this.ticks++;
    for (const npc of this.data.npcs || [])
      if (adventure.dialogue.line(npc.name)) this.met.add(npc.name);
    for (const merchant of this.data.merchants)
      if (adventure.merchantLine(merchant.name)) this.met.add(merchant.name);
    for (const item of adventure.equipped) this.testedEquipment.add(item);
    let done = this.ticks >= stop.ticks;
    if (stop.kind === 'item')
      done = this.ticks >= 30 && state.collected.includes(stop.name!);
    if (stop.kind === 'merchant')
      done = this.ticks >= 60 && state.merchants[stop.name!].sold;
    if (stop.kind === 'bird')
      done =
        this.ticks >= 60 &&
        (state.birds[stop.name!].done ||
          state.birds[stop.name!].index > stop.index!);
    if (stop.kind === 'ending') return;
    if (!done && this.ticks >= stop.ticks)
      throw new Error(
        `Không hoàn tất kiểm tra ${this.label} ở màn ${stop.screen + 1}.`,
      );
    if (stop.kind === 'npc' && done && !this.met.has(stop.name!))
      throw new Error(`NPC ${stop.name} không phản hồi.`);
    if (done) {
      this.index++;
      this.ticks = 0;
      this.entered = false;
    }
  }
}
