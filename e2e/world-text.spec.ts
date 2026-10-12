import { test, expect } from "@playwright/test";
import { OriginalSimulation } from "../packages/physics/src";
import { ORIGINAL_SCREENS } from "../packages/maps/src";
import { setNickname } from "./helpers/gameMenu";

test.skip(
  !!process.env.E2E_BASE_URL,
  "Inspects the local Phaser scene and original assets.",
);

test("reads the original diary with bitmap glyphs and removes it after leaving", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const simulation = new OriginalSimulation(
    ORIGINAL_SCREENS,
    304,
    272 - 6 * 360,
  );
  await page.goto("/");
  await page.evaluate(
    (state) =>
      localStorage.setItem(
        "jumpking.original.v1.original",
        JSON.stringify({
          version: 1,
          campaign: "original",
          state,
          bestScreen: 6,
          completed: false,
        }),
      ),
    simulation.getState(),
  );
  await page.goto("/play");
  await expect(page.getByTestId("game-state")).toHaveAttribute(
    "data-status",
    "PLAYING",
    { timeout: 30000 },
  );
  const rendered = () =>
    page.evaluate(() => {
      const scene = (window as any).Phaser.Display.Canvas.CanvasPool.pool
        .map((entry: any) => entry.parent?.scene)
        .find((scene: any) => scene?.sys?.settings?.key === "OriginalScene");
      const text = scene?.children.list.find(
        (child: any) => child.name === "message:7_diary",
      );
      return text
        ? {
            visible: text.visible,
            text: text.text,
            type: text.type,
            font: text.font,
            width: text.width,
          }
        : null;
    });
  await expect.poll(rendered).toMatchObject({
    visible: true,
    type: "BitmapText",
    font: "font/sf_pixolde",
  });
  await expect
    .poll(async () => (await rendered())?.text.replaceAll("\n", " "), {
      timeout: 10000,
    })
    .toContain("My feet hurt");
  expect((await rendered())!.width).toBeLessThanOrEqual(160);
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await rendered())?.visible).toBe(false);
  await page.keyboard.up("ArrowRight");
  expect(errors).toEqual([]);
});

test("reads world text from authoritative online snapshots", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/community");
  await setNickname(page);
  const state = page.getByTestId("game-state");
  await expect(state).toHaveAttribute("data-status", "PLAYING", {
    timeout: 30000,
  });
  const toggleFlight = async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Code", exact: true }).click();
    const code = page.getByLabel("Mã cheat online", { exact: true });
    await code.fill(process.env.E2E_CHEAT_CODE!);
    await code.press("Enter");
    await code.press("Escape");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
  };
  await toggleFlight();
  await expect(state).toHaveAttribute("data-free-flight", "true");
  // Drive the real touch input and release it within the browser, avoiding a
  // round trip through the HUD (which refreshes only every 100 milliseconds).
  await page.evaluate(async () => {
    const scene = (window as any).Phaser.Display.Canvas.CanvasPool.pool
      .map((entry: any) => entry.parent?.scene)
      .find((scene: any) => scene?.sys?.settings?.key === "OriginalScene");
    const move = (control: string, axis: "x" | "y", target: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          scene.setControl(control, false);
          remove();
          reject(new Error(`Did not reach ${axis}=${target}`));
        }, 20000);
        const remove = () => scene.room.onStateChange.remove(onState);
        const onState = () => {
          const state = JSON.parse(
            scene.room.state.players.get(scene.room.sessionId).snapshot,
          );
          if (axis === "x" ? state.x >= target : state.y <= target) {
            scene.setControl(control, false);
            // Screen asset loading can suspend client update while the server
            // keeps simulating its last input. Send a real idle packet now.
            scene.room.send("input", {
              seq: scene.sequence++, left: false, right: false, jump: false,
            });
            clearTimeout(timer);
            remove();
            resolve();
          }
        };
        scene.room.onStateChange(onState);
        scene.setControl(control, true);
      });
    await move("right", "x", 304);
    await move("up", "y", 260 - 6 * 360);
  });
  await toggleFlight();
  await expect(state).toHaveAttribute("data-free-flight", "false");
  const view = () =>
    page.evaluate(() => {
      const scene = (window as any).Phaser.Display.Canvas.CanvasPool.pool
        .map((entry: any) => entry.parent?.scene)
        .find((scene: any) => scene?.sys?.settings?.key === "OriginalScene");
      const player = scene?.room?.state.players.get(scene.room.sessionId);
      const snapshot = player?.snapshot && JSON.parse(player.snapshot);
      const text = scene?.children.list.find(
        (child: any) => child.name === "message:7_diary",
      );
      return {
        server: snapshot?.adventure?.messages?.["7_diary"],
        visible: text?.visible,
        text: text?.text,
      };
    });
  await expect
    .poll(async () => (await view()).server?.wait, { timeout: 10000 })
    .toBe(30);
  await expect.poll(async () => (await view()).visible).toBe(true);
  await expect
    .poll(async () => (await view()).text?.replaceAll("\n", " "), {
      timeout: 10000,
    })
    .toContain("My feet hurt");
  expect(errors).toEqual([]);
});
