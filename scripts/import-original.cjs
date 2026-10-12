const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { bufferToXnb, addReaders, Readers } = require("xnb/dist/xnb.cjs");
const { PNG } = require("pngjs");
const { XMLParser, XMLBuilder } = require("fast-xml-parser");

const root = path.resolve(__dirname, "..");
const source = path.resolve(
  process.argv[2] || path.join(root, "Jump.King.v1.04/Content"),
);
const output = path.join(root, "apps/web/public/original");
const missingOnly = process.argv.includes("--missing-only");
const xml = new XMLParser();
const array = (value) =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const readXml = (file) =>
  xml.parse(fs.readFileSync(path.join(source, file), "utf8"));
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

// xnb supplies decompression and texture readers; this reader adds MonoGame sound.
class SoundEffectReader extends Readers.BaseReader {
  static isTypeOf(type) {
    return type === "Microsoft.Xna.Framework.Content.SoundEffectReader";
  }
  isValueType() {
    return false;
  }
  read(reader) {
    const format = Buffer.from(reader.read(reader.readUInt32()));
    const data = Buffer.from(reader.read(reader.readUInt32()));
    reader.readUInt32(); // loop start
    reader.readUInt32(); // loop length
    const duration = reader.readUInt32();
    return { format, data, duration };
  }
}
addReaders({ SoundEffectReader });

function unpack(file) {
  const buffer = fs.readFileSync(file);
  // The library expects an ArrayBuffer, including the precise Buffer byte range.
  const log = console.log;
  console.log = () => {};
  try {
    return bufferToXnb(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    ).content;
  } finally {
    console.log = log;
  }
}

function wave(sound) {
  const chunk = (name, data) => {
    const header = Buffer.alloc(8);
    header.write(name);
    header.writeUInt32LE(data.length, 4);
    return Buffer.concat([
      header,
      data,
      ...(data.length % 2 ? [Buffer.alloc(1)] : []),
    ]);
  };
  const body = Buffer.concat([
    Buffer.from("WAVE"),
    chunk("fmt ", sound.format),
    chunk("data", sound.data),
  ]);
  const header = Buffer.alloc(8);
  header.write("RIFF");
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

const textures = {};
const sounds = {};
const fonts = {};
let assetCount = 0;
function convert(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      convert(file);
      continue;
    }
    if (
      !file.endsWith(".xnb") ||
      file === path.join(source, "shaders/Mask.xnb")
    )
      continue;
    const key = path
      .relative(source, file)
      .replaceAll(path.sep, "/")
      .slice(0, -4);
    const content = unpack(file);
    if (content.export?.type === "Texture2D") {
      const { data, width, height } = content.export;
      const target = `${key}.png`;
      write(
        path.join(output, target),
        PNG.sync.write({ width, height, data: Buffer.from(data) }),
      );
      textures[key] = { file: target, width, height };
    } else if (content.texture?.export?.type === "Texture2D") {
      const { data, width, height } = content.texture.export;
      const texture = `${key}.png`;
      const fontData = `${key}.xml`;
      write(
        path.join(output, texture),
        PNG.sync.write({
          width,
          height,
          data: Buffer.from(data),
        }),
      );
      const chars = content.characterMap.map((character, index) => {
        const glyph = content.glyphs[index];
        const crop = content.cropping[index];
        const bearing = content.kerning[index];
        return {
          "@_id": character.codePointAt(0),
          "@_x": glyph.x,
          "@_y": glyph.y,
          "@_width": glyph.width,
          "@_height": glyph.height,
          "@_xoffset": crop.x + bearing.x,
          "@_yoffset": crop.y,
          "@_xadvance":
            bearing.x + bearing.y + bearing.z + content.horizontalSpacing,
          "@_page": 0,
          "@_chnl": 15,
        };
      });
      write(
        path.join(output, fontData),
        new XMLBuilder({
          ignoreAttributes: false,
          format: true,
        }).build({
          font: {
            info: { "@_face": key, "@_size": content.verticalLineSpacing },
            common: {
              "@_lineHeight": content.verticalLineSpacing,
              "@_base": content.verticalLineSpacing,
              "@_scaleW": width,
              "@_scaleH": height,
              "@_pages": 1,
            },
            pages: { page: { "@_id": 0, "@_file": path.basename(texture) } },
            chars: { "@_count": chars.length, char: chars },
          },
        }),
      );
      fonts[key] = {
        texture,
        data: fontData,
        lineHeight: content.verticalLineSpacing,
        defaultCharacter: content.defaultCharacter,
      };
    } else if (content.format && content.data) {
      const target = `${key}.ogg`;
      fs.mkdirSync(path.dirname(path.join(output, target)), {
        recursive: true,
      });
      if (!missingOnly || !fs.existsSync(path.join(output, target))) {
        const result = spawnSync(
          "ffmpeg",
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            "pipe:0",
            "-c:a",
            "libvorbis",
            "-q:a",
            "4",
            path.join(output, target),
          ],
          { input: wave(content) },
        );
        if (result.status !== 0)
          throw new Error(`Audio conversion failed: ${key}: ${result.stderr}`);
      }
      sounds[key] = { file: target, duration: content.duration };
    }
    assetCount++;
  }
}
convert(source);
for (const file of fs.readdirSync(path.join(source, "font"))) {
  if (file.endsWith(".ttf"))
    write(
      path.join(output, "font", file),
      fs.readFileSync(path.join(source, "font", file)),
    );
}
write(
  path.join(root, "scripts/original-reference/Mask.xnb"),
  fs.readFileSync(path.join(source, "shaders/Mask.xnb")),
);

const level = unpack(path.join(source, "level.xnb")).export;
const tileColor = (screen, x, y) => {
  if (y < 0) {
    screen++;
    y += 45;
  }
  if (y >= 45) {
    screen--;
    y -= 45;
  }
  if (screen < 0 || screen >= 169 || x < 0 || x >= 60) return "000000ff";
  const px = Math.floor(screen / 13) * 60 + x;
  const py = (screen % 13) * 45 + y;
  return Buffer.from(
    level.data.subarray(
      (py * level.width + px) * 4,
      (py * level.width + px) * 4 + 4,
    ),
  ).toString("hex");
};
const codes = {
  "000000ff": "#",
  "00ffffff": "I",
  ffff00ff: "N",
  "00aaaaff": "W",
  ff6a00ff: "S",
  b6ff00ff: "Q",
  ffffffff: "X",
};
const edge = (s, x, y) =>
  [
    "000000ff",
    "ff0000ff",
    "00ffffff",
    "ffff00ff",
    "ff6a00ff",
    "808080ff",
  ].includes(tileColor(s, x, y));
const locations = array(
  readXml("gui/location_settings.xml").LocationSettings.locations.Location,
);
const settings = array(
  readXml("props/textures/prop_settings.xml").PropSettings.settings.PropSetting,
);
const weathers = array(
  readXml("particles/weather.xml").WeatherEffect.weathers.Weather,
);
let ambienceScreen = 0;
const ambience = [];
for (const section of array(
  readXml("audio/background/data/values.xml").AmbienceSaveValues.sections
    .AmbienceSave,
)) {
  for (let i = 0; i < section.screens; i++)
    ambience[ambienceScreen++] = array(section.ambience?.Ambience);
}
const screens = [];
for (let s = 0; s < 169; s++) {
  const tiles = [];
  let wind = false;
  let teleport = -1;
  for (let y = 0; y < 45; y++) {
    let row = "";
    for (let x = 0; x < 60; x++) {
      const color = tileColor(s, x, y);
      let code = codes[color] || " ";
      if (color === "ff0000ff") {
        code =
          edge(s, x + 1, y) && edge(s, x, y + 1)
            ? "a"
            : edge(s, x - 1, y) && edge(s, x, y + 1)
              ? "b"
              : edge(s, x + 1, y) && edge(s, x, y - 1)
                ? "c"
                : edge(s, x - 1, y) && edge(s, x, y - 1)
                  ? "d"
                  : "#";
      }
      if (color === "00ff00ff") wind = true;
      if (color.slice(2) === "00ffff")
        teleport = Number.parseInt(color.slice(0, 2), 16) - 1;
      row += code;
    }
    tiles.push(row);
  }
  const propsFile = `props/prop${s + 1}.xml`;
  const props = fs.existsSync(path.join(source, propsFile))
    ? array(readXml(propsFile).PropCollection.Props?.PropData).map((prop) => {
        const setting = settings.find((setting) => setting.name === prop.type);
        const key = `props/textures/${prop.type}`;
        return {
          ...prop,
          texture: textures[key] ? key : null,
          cells: setting?.sheet_cells || { X: 1, Y: 1 },
          fps: setting?.fps || 1,
          durations: array(setting?.frames?.float),
        };
      })
    : [];
  const layers = ["background", "midground", "foreground"]
    .map((layer) => `screens/${layer}/${s + 1}`)
    .filter((key) => textures[key]);
  const scrollingFile = `screens/scrolling/scroll${s + 1}.xml`;
  screens.push({
    tiles,
    wind,
    teleport,
    layers,
    props,
    location:
      locations
        .find((location) => s + 1 >= location.start && s + 1 <= location.end)
        ?.name.replace("LOCATION_", "")
        .replaceAll("_", " ") || "",
    ambience: ambience[s] || [],
    weather: weathers.filter((weather) =>
      array(weather.screens?.int).includes(s + 1),
    ),
    scrolling: fs.existsSync(path.join(source, scrollingFile))
      ? readXml(scrollingFile)
      : null,
  });
}
write(
  path.join(root, "packages/maps/src/original-data.json"),
  JSON.stringify(
    screens.map(({ tiles, wind, teleport }) => ({ tiles, wind, teleport })),
  ),
);
write(
  path.join(output, "manifest.json"),
  JSON.stringify({
    version: "1.04",
    sourceHash: createHash("sha256")
      .update(fs.readFileSync(path.join(source, "level.xnb")))
      .digest("hex"),
    textures,
    sounds,
    fonts,
    screens,
  }),
);
console.log(
  `Imported ${Object.keys(textures).length} textures, ${Object.keys(sounds).length} sounds, ${Object.keys(fonts).length} bitmap fonts, ${screens.length} screens (${assetCount} XNB files).`,
);
