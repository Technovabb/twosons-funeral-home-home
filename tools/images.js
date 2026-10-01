/*
 * Makes the small copies of the flyers and photos that the pages use.
 *
 *   node tools/images.js
 *
 * Run it after saving a new flyer as images/notices/flyers/<slug>.jpg, then
 * run node tools/build.js. It needs the "sharp" image library once:
 *   npm install --no-save sharp
 *
 * For each flyer it writes (and skips copies that are already up to date):
 *   images/notices/cards/<slug>.jpg   600 px wide, for the notice cards
 *   images/notices/thumbs/<slug>.jpg  320 px wide, for the notice cards on phones
 *   images/notices/mini/<slug>.jpg    160 px wide, for the Funerals page list
 *   images/notices/share/<slug>.jpg   1200 x 630, the whole flyer on dark grey,
 *                                     for WhatsApp and Facebook link previews
 * and for each photo in images/photos/ and images/flowers/ (run it after
 * adding a photo too):
 *   images/thumbs/<name>.jpg          600 px on the short side (760 px for flowers,
 *                                     which fill tall boxes on the home page),
 *                                     for the gallery, the home page and the
 *                                     Floral tributes page
 *
 *   node tools/images.js --shrink
 * also makes any photo in images/photos/ or images/flowers/ that is wider or
 * taller than 1600 px into a 1200 px copy, saved over the original.
 */

const fs = require("fs");
const path = require("path");

let sharp;
try {
  sharp = require("sharp");
} catch (e) {
  console.error('This needs the sharp image library. Run "npm install --no-save sharp" in the site folder, then try again.');
  process.exit(1);
}

const root = path.join(__dirname, "..");
const img = (...p) => path.join(root, "images", ...p);
const JPEG = { quality: 78, progressive: true, mozjpeg: true };

const COPIES = [
  ["cards", (s) => s.resize({ width: 600, withoutEnlargement: true }).jpeg(JPEG)],
  ["thumbs", (s) => s.resize({ width: 320, withoutEnlargement: true }).jpeg(JPEG)],
  ["mini", (s) => s.resize({ width: 160, withoutEnlargement: true }).jpeg(JPEG)],
  ["share", (s) => s.resize({ width: 1200, height: 630, fit: "contain", background: "#26272c" }).jpeg({ ...JPEG, quality: 80 })],
];

/* up to date = newer than the source's modified AND changed time
   (a file copied from a phone or USB stick can keep an old modified date) */
function upToDate(src, dest) {
  if (!fs.existsSync(dest)) return false;
  const st = fs.statSync(src);
  return fs.statSync(dest).mtimeMs >= Math.max(st.mtimeMs, st.ctimeMs);
}

async function main() {
  let made = 0;
  const flyers = fs.readdirSync(img("notices", "flyers")).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  for (const f of flyers) {
    const slug = f.replace(/\.[^.]+$/, "");
    const src = img("notices", "flyers", f);
    for (const [dir, recipe] of COPIES) {
      fs.mkdirSync(img("notices", dir), { recursive: true });
      const dest = img("notices", dir, slug + ".jpg");
      if (upToDate(src, dest)) continue;
      await recipe(sharp(src).rotate().flatten({ background: "#ffffff" })).toFile(dest);
      made++;
    }
  }
  // copies whose flyer was removed
  for (const [dir] of COPIES) {
    if (!fs.existsSync(img("notices", dir))) continue;
    for (const f of fs.readdirSync(img("notices", dir))) {
      const slug = f.replace(/\.[^.]+$/, "");
      if (!flyers.some((x) => x.replace(/\.[^.]+$/, "") === slug)) { fs.unlinkSync(img("notices", dir, f)); made++; }
    }
  }
  console.log(`Notice copies: ${made} written or removed, ${flyers.length} flyers checked.`);

  if (process.argv.includes("--shrink")) {
    for (const dir of ["photos", "flowers"]) {
      for (const f of fs.readdirSync(img(dir)).filter((x) => /\.(jpe?g|png)$/i.test(x))) {
        const file = img(dir, f);
        const meta = await sharp(file).metadata();
        if (Math.max(meta.width, meta.height) <= 1600) continue;
        const buf = await sharp(file).rotate().resize({ width: 1200, height: 1200, fit: "inside" })[/\.png$/i.test(f) ? "png" : "jpeg"](/\.png$/i.test(f) ? { compressionLevel: 9 } : { quality: 82, progressive: true, mozjpeg: true }).toBuffer();
        fs.writeFileSync(file, buf);
        console.log(`Made smaller: images/${dir}/${f}`);
      }
    }
  }

  // gallery and home-page copies of the photos
  let thumbs = 0;
  fs.mkdirSync(img("thumbs"), { recursive: true });
  const wanted = new Set();
  for (const dir of ["photos", "flowers"]) {
    for (const f of fs.readdirSync(img(dir)).filter((x) => /\.(jpe?g|png)$/i.test(x))) {
      const name = f.replace(/\.[^.]+$/, "") + ".jpg";
      if (wanted.has(name)) console.log(`Two photos are both called ${name}: rename one.`);
      wanted.add(name);
      const dest = img("thumbs", name);
      if (upToDate(img(dir, f), dest)) continue;
      const side = dir === "flowers" ? 760 : 600;
      await sharp(img(dir, f)).rotate().flatten({ background: "#ffffff" }).resize({ width: side, height: side, fit: "outside", withoutEnlargement: true }).jpeg(JPEG).toFile(dest);
      thumbs++;
    }
  }
  for (const f of fs.readdirSync(img("thumbs"))) if (!wanted.has(f)) { fs.unlinkSync(img("thumbs", f)); thumbs++; }
  console.log(`Photo copies: ${thumbs} written or removed.`);

  console.log("Now run: node tools/build.js");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
