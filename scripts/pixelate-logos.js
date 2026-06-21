const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PIXEL_SIZE = 16;
const OUTPUT_SIZE = 128;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'logos');
const PALETTE_COLORS = 16;

const teams = require('./teams.json');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function pixelate(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(PIXEL_SIZE, PIXEL_SIZE, { kernel: 'nearest' })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { kernel: 'nearest' })
    .png({ palette: true, colors: PALETTE_COLORS })
    .toFile(outputPath);
}

async function run() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const team of teams) {
    const tmpPath = path.join(OUT_DIR, `${team.league}-${team.abbr}-raw.png`);
    const outPath = path.join(OUT_DIR, `${team.league}-${team.abbr}.png`);

    console.log(`Fetching ${team.league.toUpperCase()} ${team.abbr}...`);
    await download(team.logo, tmpPath);

    console.log(`Pixelating -> ${outPath}`);
    await pixelate(tmpPath, outPath);

    fs.unlinkSync(tmpPath);
  }

  console.log(`Done. ${teams.length} logos pixelated into ${OUT_DIR}`);
}

run().catch(console.error);
