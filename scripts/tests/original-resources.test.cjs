const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { XMLParser } = require("fast-xml-parser");
const { PNG } = require("pngjs");

const assets = path.resolve(__dirname, "../../apps/web/public/original");
const manifest = JSON.parse(fs.readFileSync(`${assets}/manifest.json`, "utf8"));
const details = JSON.parse(fs.readFileSync(`${assets}/details.json`, "utf8"));
const array = (value) => (Array.isArray(value) ? value : [value]);

test("retains all nine original TTF fonts and eight usable bitmap fonts", () => {
  assert.equal(Object.keys(manifest.fonts || {}).length, 8);
  for (const name of [
    "alkhemikal",
    "double_homicide",
    "entercommand_bold",
    "litter_lover2",
    "litter_lover2_bold",
    "microserif",
    "pixolde",
    "pixolde_bold",
    "tangerine_regular",
  ]) {
    const font = fs.readFileSync(`${assets}/font/ttf_${name}.ttf`);
    assert.equal(font.readUInt32BE(0), 0x00010000);
  }
  const parser = new XMLParser({ ignoreAttributes: false });
  for (const font of Object.values(manifest.fonts)) {
    const xml = parser.parse(
      fs.readFileSync(path.join(assets, font.data), "utf8"),
    ).font;
    const png = PNG.sync.read(fs.readFileSync(path.join(assets, font.texture)));
    const chars = array(xml.chars.char);
    assert.equal(chars.length, 150);
    assert.equal(Number(xml.common["@_lineHeight"]), font.lineHeight);
    for (const char of chars) {
      assert.ok(char["@_x"] >= 0 && char["@_y"] >= 0);
      assert.ok(Number(char["@_x"]) + Number(char["@_width"]) <= png.width);
      assert.ok(Number(char["@_y"]) + Number(char["@_height"]) <= png.height);
    }
    if (font.texture === "font/sf_pixolde.png") {
      const a = chars.find((char) => Number(char["@_id"]) === 65);
      assert.equal(Number(a["@_width"]), 8);
      assert.equal(Number(a["@_yoffset"]), 3);
      assert.equal(Number(a["@_xadvance"]), 9);
    }
  }
});

test("retains complete English text and every original readable message", () => {
  assert.equal(details.adventure.messages?.length, 23);
  const language = JSON.parse(
    fs.readFileSync(`${assets}/language/en-US.json`, "utf8"),
  );
  assert.equal(Object.keys(language).length, 1422);
  const diary = details.adventure.messages.find(
    (message) => message.id === "7_diary",
  );
  assert.equal(diary.screen, 6);
  assert.deepEqual(diary.trigger, { x: 304, y: 272, width: 32, height: 32 });
  assert.equal(diary.font, "font/sf_pixolde");
  assert.equal(diary.lines[0], language.DIARY_LINE_0);
  assert.match(diary.lines[0], /My feet hurt from all the jumping/);
  assert.equal(diary.lines.length, 6);
  for (const message of details.adventure.messages) {
    assert.ok(message.lines.every((line) => typeof line === "string"));
    assert.ok(message.lines.length > 0);
  }
});

test("maps weather to per-effect masks and leaves unmasked weather visible", () => {
  assert.equal(
    manifest.screens[8].weather[0].mask,
    "screens/masks/light_rainmask9",
  );
  assert.equal(
    manifest.screens[26].weather[0].mask,
    "screens/masks/snowmask27",
  );
  assert.equal(manifest.screens[22].weather[0].mask, null);
  let masks = 0;
  for (const [index, screen] of manifest.screens.entries()) {
    for (const weather of screen.weather) {
      const key = `screens/masks/${weather.name}mask${index + 1}`;
      assert.equal(weather.mask, manifest.textures[key] ? key : null);
      if (weather.mask) masks++;
    }
  }
  assert.equal(masks, 35);
});

test("converts the test mask texture and preserves the engine shader for reference", () => {
  const mask = manifest.textures["shaders/test_mask"];
  assert.ok(mask);
  assert.ok(fs.existsSync(path.join(assets, mask.file)));
  assert.ok(
    fs.existsSync(path.resolve(__dirname, "../original-reference/Mask.xnb")),
  );
});
