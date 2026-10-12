import { AABB } from "./math";
import type { AdventureRect } from "./OriginalAdventure";
import type { OriginalState } from "./OriginalSimulation";
import type { PlayerInput } from "./PlayerController";

export interface OriginalMessageDefinition {
  id: string;
  screen: number;
  trigger: AdventureRect;
  anchor: { x: number; y: number };
  bubble: {
    direction: string;
    anchor: { X: string; Y: string };
    width: number;
  };
  font: string;
  lines: string[];
}
interface MessageState {
  wait: number;
  line: number;
  ticks: number;
  done: boolean;
}
export type OriginalMessageState = Record<string, MessageState>;
const idle = { left: false, right: false, jump: false };
const initialState = (): MessageState => ({
  wait: 0,
  line: 0,
  ticks: 0,
  done: false,
});

/** RattmanEntity: wait 30 idle input ticks, type at 0.05s, hold each line 2.2s. */
export class OriginalMessages {
  private state: OriginalMessageState = {};
  constructor(readonly definitions: OriginalMessageDefinition[]) {
    this.definitions = definitions.map((definition) => ({
      ...definition,
      lines: definition.lines.map((line) =>
        line.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replaceAll(" .", "."),
      ),
    }));
    this.restore();
  }
  getState(): OriginalMessageState {
    return Object.fromEntries(
      Object.entries(this.state)
        .filter(([, value]) => value.wait > 0 || value.done)
        .map(([id, value]) => [id, { ...value }]),
    );
  }
  restore(saved?: OriginalMessageState) {
    for (const definition of this.definitions) {
      const value = saved?.[definition.id];
      this.state[definition.id] =
        value &&
        [value.wait, value.line, value.ticks].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        ) &&
        value.wait <= 30 &&
        value.line < definition.lines.length &&
        value.ticks <= definition.lines[value.line].length * 3 + 132 &&
        typeof value.done === "boolean"
          ? { ...value }
          : initialState();
    }
  }
  line(id: string) {
    const definition = this.definitions.find((message) => message.id === id);
    const state = this.state[id];
    if (!definition || !state || state.wait < 30 || state.done) return null;
    const text = definition.lines[state.line];
    return {
      text,
      characters: Math.min(text.length, Math.floor(state.ticks / 3)),
    };
  }
  tick(player: OriginalState, input: PlayerInput = idle) {
    let speaking = false;
    const box = new AABB(Math.trunc(player.x), Math.trunc(player.y), 18, 26);
    for (const definition of this.definitions) {
      const state = this.state[definition.id];
      const rect = definition.trigger;
      if (
        !box.intersects(
          new AABB(
            rect.x,
            rect.y - definition.screen * 360,
            rect.width,
            rect.height,
          ),
        )
      ) {
        Object.assign(state, initialState());
        continue;
      }
      if (state.done) continue;
      if (state.wait < 30) {
        state.wait =
          input.left !== input.right || input.jump ? 0 : state.wait + 1;
        continue;
      }
      const text = definition.lines[state.line];
      state.ticks++;
      if (
        state.ticks % 3 === 0 &&
        state.ticks <= text.length * 3 &&
        text[state.ticks / 3 - 1] !== " "
      )
        speaking = true;
      if (state.ticks >= text.length * 3 + 132) {
        state.ticks = 0;
        if (state.line + 1 < definition.lines.length) state.line++;
        else state.done = true;
      }
    }
    return speaking;
  }
}
