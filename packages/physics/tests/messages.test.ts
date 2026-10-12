import { describe, expect, it } from "vitest";
import { OriginalAdventure, OriginalSimulation } from "../src";
import { ORIGINAL_ADVENTURE, ORIGINAL_SCREENS } from "../../maps/src";

const idle = { left: false, right: false, jump: false };
const definition = {
  id: "diary",
  screen: 6,
  trigger: { x: 304, y: 272, width: 32, height: 32 },
  anchor: { x: 290, y: 316 },
  bubble: { direction: "Right", anchor: { X: "Left", Y: "Down" }, width: 160 },
  font: "font/sf_pixolde",
  lines: ["ABC", "DEF"],
};
const data = {
  items: [],
  skins: [],
  merchants: [],
  birds: [],
  itemTextures: {},
  messages: [definition],
};
const player = {
  ...new OriginalSimulation(ORIGINAL_SCREENS).getState(),
  x: 304,
  y: 272 - 6 * 360,
  screen: 6,
};
const tick = (adventure: OriginalAdventure, count: number, input = idle) => {
  for (let i = 0; i < count; i++) adventure.tick(player, input);
};

describe("original readable world text", () => {
  it("requires thirty consecutive ticks without direction or jump, then types one character per three ticks", () => {
    const adventure = new OriginalAdventure(data);
    tick(adventure, 29);
    expect(adventure.messages?.line("diary")).toBeNull();
    tick(adventure, 1, { ...idle, right: true });
    tick(adventure, 29);
    expect(adventure.messages?.line("diary")).toBeNull();
    tick(adventure, 1);
    expect(adventure.messages?.line("diary")).toEqual({
      text: "ABC",
      characters: 0,
    });
    tick(adventure, 3);
    expect(adventure.messages?.line("diary")).toEqual({
      text: "ABC",
      characters: 1,
    });
  });

  it("continues reading inside the trigger, holds each complete line, and waits for departure before replaying", () => {
    const adventure = new OriginalAdventure(data);
    tick(adventure, 30 + 9 + 131);
    expect(adventure.messages?.line("diary")?.text).toBe("ABC");
    tick(adventure, 1, { ...idle, left: true });
    expect(adventure.messages?.line("diary")?.text).toBe("DEF");
    tick(adventure, 9 + 132 + 100);
    expect(adventure.messages?.line("diary")).toBeNull();
    adventure.tick({ ...player, x: 350 }, idle);
    tick(adventure, 30);
    expect(adventure.messages?.line("diary")?.text).toBe("ABC");
  });

  it("resets on leaving the rectangle, including crossing to a different screen", () => {
    const adventure = new OriginalAdventure(data);
    tick(adventure, 40);
    adventure.tick({ ...player, screen: 5, y: player.y + 360 }, idle);
    expect(adventure.messages?.line("diary")).toBeNull();
    tick(adventure, 29);
    expect(adventure.messages?.line("diary")).toBeNull();
  });

  it("restores authoritative typing, accepts legacy saves, and rejects invalid message progress", () => {
    const adventure = new OriginalAdventure(data);
    tick(adventure, 35);
    const saved = adventure.getState();
    const restored = new OriginalAdventure(
      data,
      JSON.parse(JSON.stringify(saved)),
    );
    expect(restored.messages?.line("diary")).toEqual({
      text: "ABC",
      characters: 1,
    });
    tick(restored, 6);
    tick(adventure, 6);
    expect(restored.getState()).toEqual(adventure.getState());
    delete saved.messages;
    expect(
      new OriginalAdventure(data, saved).messages?.line("diary"),
    ).toBeNull();
    restored.restore({
      ...saved,
      messages: { diary: { wait: -1, line: 999, ticks: NaN, done: false } },
    });
    expect(restored.messages?.line("diary")).toBeNull();
  });

  it("reads the imported diary through the same simulation used by the server", () => {
    const simulation = new OriginalSimulation(
      ORIGINAL_SCREENS,
      304,
      272 - 6 * 360,
      ORIGINAL_ADVENTURE,
    );
    for (let i = 0; i < 40; i++) simulation.tick(idle);
    expect(simulation.adventure?.messages?.line("7_diary")?.text).toMatch(
      /My feet hurt/,
    );
    expect(simulation.adventure?.getState().npcTalks).toEqual({});
  });

  it("formats original punctuation and emits speech sounds only when a non-space character appears", () => {
    const adventure = new OriginalAdventure({
      ...data,
      messages: [{ ...definition, lines: ["“A B” ."] }],
    });
    tick(adventure, 30);
    expect(adventure.messages.line("diary")?.text).toBe('"A B".');
    expect(adventure.tick(player, idle)).toEqual([]);
    adventure.tick(player, idle);
    expect(adventure.tick(player, idle)).toEqual([
      { type: "speech", sound: "audio/talking" },
    ]);
    tick(adventure, 5);
    expect(adventure.tick(player, idle)).toEqual([]);
  });
});
