import { describe, expect, it } from 'vitest';
import {
  OriginalDialogue,
  OriginalDialogueDefinition,
  OriginalSimulation,
} from '../src';
import { ORIGINAL_ADVENTURE, ORIGINAL_SCREENS } from '../../maps/src';

const npc: OriginalDialogueDefinition = {
  name: 'speaker',
  screen: 0,
  trigger: { x: 200, y: 300, width: 100, height: 30 },
  delay: 1 / 60,
  speed: 1 / 60,
  intro: ['intro', 'second'],
  quotes: [{ screen: 2, lines: ['new screen'] }],
  looping: [['loop one'], ['loop two']],
  flagQuotes: [{ flag: 'CompletedNormalGame', quotes: [['victory']] }],
};
const player = new OriginalSimulation(ORIGINAL_SCREENS).getState();
const run = (dialogue: OriginalDialogue, ticks: number) => {
  const talks: string[] = [];
  for (let i = 0; i < ticks; i++) talks.push(...dialogue.tick(player, []));
  return talks;
};

describe('original NPC quote state', () => {
  it('counts whole consumed quotes once, types every line and loops without awarding extra talks', () => {
    const dialogue = new OriginalDialogue([npc]);
    expect(run(dialogue, 1)).toEqual(['speaker']);
    expect(dialogue.line('speaker')?.text).toBe('intro');
    expect(run(dialogue, 140)).toEqual([]);
    expect(dialogue.line('speaker')?.text).toBe('second');
    expect(run(dialogue, 1950)).toEqual([]);
    expect(dialogue.line('speaker')?.text).toBe('loop one');
  });
  it('enqueues a quote only when its screen is actually visited and restores deterministic typing', () => {
    const dialogue = new OriginalDialogue([npc]);
    run(dialogue, 2085);
    dialogue.tick({ ...player, screen: 1, y: -100 }, []);
    const restored = new OriginalDialogue([npc]);
    restored.restore(JSON.parse(JSON.stringify(dialogue.getState())));
    expect(run(restored, 2300)).toEqual(run(dialogue, 2300));
    expect(restored.getState()).toEqual(dialogue.getState());
  });
  it('uses story flag quotes before the intro and imports real NPC rectangle triggers', () => {
    const dialogue = new OriginalDialogue([npc]);
    expect(dialogue.tick(player, ['CompletedNormalGame'])).toEqual(['speaker']);
    expect(dialogue.line('speaker')?.text).toBe('victory');
    for (const definition of ORIGINAL_ADVENTURE.npcs!)
      expect(Object.values(definition.trigger).every(Number.isFinite)).toBe(
        true,
      );
  });
});
