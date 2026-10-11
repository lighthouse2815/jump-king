import type { AdventureRect } from './OriginalAdventure';
import type { OriginalState } from './OriginalSimulation';

export interface OriginalDialogueDefinition {
  name: string;
  screen: number;
  trigger: AdventureRect;
  delay: number;
  speed: number;
  intro: string[];
  quotes: { screen: number; lines: string[] }[];
  looping: string[][];
  flagQuotes: { flag: string; quotes: string[][] }[];
}
interface SpeakerState {
  introduced: boolean;
  best: number;
  pool: string[][];
  loop: number;
  flags: Record<string, number>;
  lines: string[];
  line: number;
  ticks: number;
  wait: number;
  busy: number;
}
export type OriginalDialogueState = Record<string, SpeakerState>;

/** OldManState, QuoteIndexer and SpeechComp: consume whole quotes, then loop. */
export class OriginalDialogue {
  private state: OriginalDialogueState = {};
  constructor(readonly definitions: OriginalDialogueDefinition[]) {
    for (const npc of definitions)
      this.state[npc.name] = {
        introduced: !npc.intro.length,
        best: 0,
        pool: [],
        loop: 0,
        flags: {},
        lines: [],
        line: 0,
        ticks: 0,
        wait: 0,
        busy: 0,
      };
  }
  getState(): OriginalDialogueState {
    return structuredClone(this.state);
  }
  restore(state: OriginalDialogueState) {
    for (const npc of this.definitions) {
      const value = state?.[npc.name];
      if (
        value &&
        [
          value.best,
          value.loop,
          value.line,
          value.ticks,
          value.wait,
          value.busy,
        ].every((n) => Number.isSafeInteger(n) && n >= 0) &&
        Array.isArray(value.lines) &&
        value.line < Math.max(1, value.lines.length) &&
        value.flags &&
        typeof value.flags === 'object' &&
        Object.values(value.flags).every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        ) &&
        value.lines.every((line) => typeof line === 'string') &&
        Array.isArray(value.pool) &&
        value.pool.every(
          (lines) =>
            Array.isArray(lines) &&
            lines.every((line) => typeof line === 'string'),
        )
      )
        this.state[npc.name] = structuredClone(value);
    }
  }
  line(name: string) {
    const npc = this.definitions.find((npc) => npc.name === name),
      state = this.state[name];
    const text = state?.lines[state.line];
    return text && npc
      ? {
          text,
          characters: Math.min(
            text.length,
            Math.floor(state.ticks / (60 * npc.speed)),
          ),
        }
      : null;
  }
  tick(player: OriginalState, flags: readonly string[]): string[] {
    const conversations: string[] = [];
    for (const npc of this.definitions) {
      const state = this.state[npc.name];
      const quotes = npc.quotes.filter(
        (quote) => quote.screen === player.screen + 1,
      );
      if (quotes.length && player.screen + 1 > state.best) {
        state.best = player.screen + 1;
        state.pool.push(...quotes.map((quote) => [...quote.lines]).reverse());
      }
      if (state.busy > 0) {
        state.busy--;
        continue;
      }
      if (state.lines.length) {
        state.ticks++;
        if (
          state.ticks >=
          state.lines[state.line].length * npc.speed * 60 + 132
        ) {
          state.ticks = 0;
          if (++state.line >= state.lines.length) {
            state.lines = [];
            state.line = 0;
            state.busy = 1800;
          }
        }
        continue;
      }
      const rect = npc.trigger,
        y = rect.y - npc.screen * 360;
      const touching =
        player.x < rect.x + rect.width &&
        player.x + 18 > rect.x &&
        player.y < y + rect.height &&
        player.y + 26 > y;
      state.wait = touching ? state.wait + 1 : 0;
      if (state.wait < npc.delay * 60) continue;
      state.wait = 0;
      const flagged = npc.flagQuotes.find(
        (quote) =>
          flags.includes(quote.flag) &&
          (state.flags[quote.flag] || 0) < quote.quotes.length,
      );
      let consumed = true;
      if (flagged) {
        const index = state.flags[flagged.flag] || 0;
        state.lines = [...flagged.quotes[index]];
        state.flags[flagged.flag] = index + 1;
        state.introduced = true;
      } else if (!state.introduced) {
        state.lines = [...npc.intro];
        state.introduced = true;
      } else if (state.pool.length) state.lines = state.pool.pop()!;
      else {
        state.lines = [
          ...(npc.looping[state.loop++ % npc.looping.length] || []),
        ];
        consumed = false;
      }
      // The original counts GetAndConsumeQuote, excluding looping QuoteIndexer lines.
      if (consumed && state.lines.length) conversations.push(npc.name);
    }
    return conversations;
  }
}
