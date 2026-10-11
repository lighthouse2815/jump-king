const fs = require('node:fs');
const path = require('node:path');
const { XMLParser } = require('fast-xml-parser');
const root = path.resolve(__dirname, '..');
const content = path.join(root, 'Jump.King.v1.04/Content');
const languageFile = process.argv[2];
if (!languageFile)
  throw new Error(
    'Pass the English .resx exported from en-US/LanguageJK.resources.dll by ILSpy.',
  );
const parser = new XMLParser({ ignoreAttributes: false });
const read = (file) => parser.parse(fs.readFileSync(file, 'utf8'));
const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const language = Object.fromEntries(
  array(read(languageFile).root.data).map((value) => [
    value['@_name'],
    value.value,
  ]),
);
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(root, 'apps/web/public/original/manifest.json'),
    'utf8',
  ),
);
const lines = (value) =>
  array(value?.lines?.string)
    .map((key) => language[String(key).trim()])
    .filter(Boolean);
const formatNpc = (npc) => {
  const texture = `props/textures/old_man/${npc.name}`;
  if (!manifest.textures[texture])
    throw new Error(`Missing NPC texture ${texture}`);
  const quotes = [{ screen: 0, lines: lines(npc.intro_quote) }];
  for (const entry of array(npc.screens?.OldManScreen))
    for (const quote of array(entry.quotes?.OldManQuote))
      quotes.push({ screen: entry.screen, lines: lines(quote) });
  for (const quote of array(npc.looping_lines?.OldManQuote))
    quotes.push({ screen: 0, lines: lines(quote) });
  return {
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
    achievements: array(npc.achievements?.OldmanTalkAchievement),
  };
};
const npcs = [];
for (const file of fs.readdirSync(
  path.join(content, 'props/textures/old_man/lines'),
)) {
  const npc = read(
    path.join(content, 'props/textures/old_man/lines', file),
  ).OldManSettings;
  if (npc) npcs.push(formatNpc(npc));
}
const merchants = [];
for (const file of fs.readdirSync(
  path.join(content, 'props/textures/old_man/merchant'),
)) {
  const settings = read(
    path.join(content, 'props/textures/old_man/merchant', file),
  ).MerchantSettings;
  const npc = formatNpc(settings.settings);
  npcs.push(npc);
  const trigger = npc.trigger.screen_rect;
  merchants.push({
    name: npc.name,
    screen: npc.screen,
    item: settings.sale_item,
    currency: settings.currency_type,
    basePrice: settings.base_price || 0,
    increase: settings.price_increase || 0,
    trigger: trigger
      ? {
          x: trigger.X,
          y: trigger.Y,
          width: trigger.Width,
          height: trigger.Height,
        }
      : {
          x: Math.trunc(
            npc.position.X - npc.trigger.width * npc.trigger.center_x,
          ),
          y: Math.trunc(
            npc.position.Y - npc.trigger.height * npc.trigger.center_y,
          ),
          width: npc.trigger.width,
          height: npc.trigger.height,
        },
    delay: npc.delay,
    speed: npc.speed,
    intro: lines(settings.settings.intro_quote),
    sale: array(settings.sale_lines?.OldManQuote).flatMap(lines),
    sell: lines(settings.sell_quote),
    noGold: array(settings.no_gold_lines?.OldManQuote).flatMap(lines),
    sold: array(settings.sold_lines?.OldManQuote).flatMap(lines),
    achievements: array(settings.sale_achievements?.SaleAchievement).map(
      (value) => ({ amount: value.sell_amount, code: value.code }),
    ),
  });
}
const itemTextures = {
  GoldRing: 'props/textures/raven/gold_ring',
  Ruby: 'props/textures/raven/ruby',
  Silver: 'props/worlditems/silver_coin',
  GiantBoots: 'props/worlditems/shoes_iron',
  GnomeHat: 'props/worlditems/gnome_hat',
  Tunic: 'props/worlditems/tunic',
  YellowShoes: 'props/worlditems/yellow_shoes',
  Cap: 'props/worlditems/cap',
  GhostFragment: 'props/worlditems/ghost_fragment',
  Shroom: 'props/worlditems/shroom',
  BugNote: 'props/worlditems/bug_note',
  BabeGhostItem: 'props/textures/babeghost',
};
const worldItems = array(
  read(path.join(content, 'props/worlditems/worlditems.xml')).WorldItemsSave
    .items.WorldItemState,
).map((item, index) => {
  const texture = itemTextures[item.item];
  const info = manifest.textures[texture];
  if (!info) throw new Error(`Missing world item texture ${texture}`);
  return {
    id: `world:${index}`,
    item: item.item,
    screen: item.screen - 1,
    x: item._x,
    y: item._y,
    texture,
    width: info.width,
    height: info.height,
    displayOnly: ['GiantBoots', 'YellowShoes'].includes(item.item),
    invisible: item.item === 'BabeGhostItem',
  };
});
const birds = fs
  .readdirSync(path.join(content, 'props/textures/raven'))
  .filter((file) => file.endsWith('.ravset'))
  .map((file) => {
    const settings = read(
      path.join(content, 'props/textures/raven', file),
    ).RavenSettings;
    return {
      name: file.replace('.ravset', ''),
      texture: `props/textures/raven/${settings.texture}`,
      sound: `audio/event_sfx/${settings.fly_sfx}`,
      item: settings.item,
      positions: array(settings.positions.RavenPosition).map((position) => ({
        screen: position.screen - 1,
        x: position.position.X,
        y: position.position.Y,
        treasure: !!position.treasure,
        direction: position.look_direction === 'Left' ? -1 : 1,
        flyDirection: position.fly_direction === 'Left' ? -1 : 1,
      })),
    };
  });
const skins = array(
  read(path.join(content, 'king/skin_settings.xml')).SkinSettings.skins.Skin,
).map((skin) => ({
  item: skin.item,
  texture: `king/${skin.texture}`,
  layer: array(skin.layers.SkinLayer)[0],
}));
const adventure = {
  items: worldItems,
  itemTextures,
  skins,
  birds,
  merchants,
  labels: Object.fromEntries(
    Object.entries(language).filter(
      ([key]) =>
        key.startsWith('ITEMNAMEUTIL_') ||
        key.startsWith('MENUFACTORY_INVENTORY_'),
    ),
  ),
};
const walls = {};
for (const file of fs.readdirSync(path.join(content, 'props/hidden_walls'))) {
  const match = file.match(/^hidden_wall(\d+)\.xml$/);
  if (!match) continue;
  walls[Number(match[1]) - 1] = array(
    read(path.join(content, 'props/hidden_walls', file)).RaymanCollection.walls
      ?.RaymanData,
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
  adventure,
  locations: Object.fromEntries(
    Object.entries(language).filter(([key]) => key.startsWith('LOCATION_')),
  ),
};
fs.writeFileSync(
  path.join(root, 'apps/web/public/original/details.json'),
  JSON.stringify(details),
);
fs.writeFileSync(
  path.join(root, 'packages/maps/src/original-adventure-data.json'),
  JSON.stringify(adventure),
);
console.log(
  `Imported ${npcs.length} NPCs, ${worldItems.length} items, ${merchants.length} merchants, ${birds.length} bird quests and hidden walls on ${Object.keys(walls).length} screens.`,
);
