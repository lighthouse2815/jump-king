const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const root = path.resolve(__dirname, '..');
const content = path.join(root, 'Jump.King.v1.04/Content');
const languageFile = process.argv[2];
if (!languageFile)
  throw new Error(
    'Pass the English .resx exported from en-US/LanguageJK.resources.dll by ILSpy.'
  );
const parser = new XMLParser({ ignoreAttributes: false });
const read = (file) => parser.parse(fs.readFileSync(file, 'utf8'));
const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const language = Object.fromEntries(
  array(read(languageFile).root.data).map((value) => [
    value['@_name'],
    value.value,
  ])
);
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(root, 'apps/web/public/original/manifest.json'),
    'utf8'
  )
);
const lines = (value) =>
  array(value?.lines?.string)
    .map((key) => language[String(key).trim()])
    .filter(Boolean);
const npcs = [];
for (const file of fs.readdirSync(
  path.join(content, 'props/textures/old_man/lines')
)) {
  const npc = read(
    path.join(content, 'props/textures/old_man/lines', file)
  ).OldManSettings;
  if (!npc) continue;
  const texture = `props/textures/old_man/${npc.name}`;
  if (!manifest.textures[texture])
    throw new Error(`Missing NPC texture ${texture}`);
  const quotes = [{ screen: 0, lines: lines(npc.intro_quote) }];
  for (const entry of array(npc.screens?.OldManScreen))
    for (const quote of array(entry.quotes?.OldManQuote))
      quotes.push({ screen: entry.screen, lines: lines(quote) });
  for (const quote of array(npc.looping_lines?.OldManQuote))
    quotes.push({ screen: 0, lines: lines(quote) });
  npcs.push({
    name: npc.name,
    screen: npc.home_screen - 1,
    position: npc.position,
    cells: npc.sprite_cells,
    bubble: npc.bubble_format,
    trigger: npc.trigger_box,
    delay: npc.talk_delay || 0.5,
    speed: npc.talking_speed || 0.05,
    talking: array(npc.talk_animation?.frames?.AnimationFrame),
    busy: array(npc.busy_animation?.frames?.AnimationFrame),
    quotes: quotes.filter((quote) => quote.lines.length),
    texture,
  });
}
const walls = {};
for (const file of fs.readdirSync(path.join(content, 'props/hidden_walls'))) {
  const match = file.match(/^hidden_wall(\d+)\.xml$/);
  if (!match) continue;
  walls[Number(match[1]) - 1] = array(
    read(path.join(content, 'props/hidden_walls', file)).RaymanCollection.walls
      ?.RaymanData
  ).map((wall) => {
    const texture = `props/hidden_walls/textures/${wall.texture_name}`;
    const info = manifest.textures[texture];
    if (!info) throw new Error(`Missing hidden wall texture ${texture}`);
    return {
      texture,
      position: wall.Position,
      screenCoordinates: !!wall.use_screen_coords,
      hitboxes: array(wall.hitboxes?.Rectangle).length
        ? array(wall.hitboxes.Rectangle)
        : [{ X: 0, Y: 0, Width: info.width, Height: info.height }],
    };
  });
}
const details = {
  npcs,
  walls,
  locations: Object.fromEntries(
    Object.entries(language).filter(([key]) => key.startsWith('LOCATION_'))
  ),
};
fs.writeFileSync(
  path.join(root, 'apps/web/public/original/details.json'),
  JSON.stringify(details)
);
console.log(
  `Imported ${npcs.length} NPCs and hidden walls on ${Object.keys(walls).length} screens.`
);
