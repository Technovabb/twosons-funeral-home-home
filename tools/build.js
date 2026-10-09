/*
 * Builds the Two Sons Funeral Home website.
 *
 *   node tools/build.js
 *
 * Writes every page at the root from pages/*.html (the content) plus the shared
 * header, footer and "24 hours" band below, and generates from data/:
 *   obituaries.html + obituaries/<slug>.html (+ .ics calendar file)
 *   livestreams.html, testimonials.html, flowers.html, get-a-quote.html
 *   the "Upcoming funerals" band and latest notices on the home page
 *   sitemap.xml, robots.txt
 * Then fingerprints image, CSS and JS links so a changed photo shows at once.
 *
 * Never edit the root .html files by hand: the next build overwrites them.
 * Edit pages/*.html or data/*.json, then run the build.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* Where the site lives. While it's a preview this is
   https://technovabb.com/twosons-funeral-home-home; at launch change it to
   https://www.twosonsfuneralhome.com (and add the CNAME file).
   Facebook and WhatsApp need absolute og:image links. */
const SITE = "https://technovabb.com/twosons-funeral-home-home";

/* true = green "Preview" bar on every page, and search engines are told not
   to index the site. Set to false at launch. */
const PREVIEW = true;

const EMAIL = "info@twosonsfuneralhome.com";
const PHONE = "(246) 426-1205";
const TEL = "tel:+12464261205";
const FACEBOOK = "https://www.facebook.com/twosons246";
const HOME_PLACE = "Two Sons Funeral Home, Stadium Road, Bush Hall, St. Michael";
const MAPS = "https://www.google.com/maps/search/?api=1&query=Two+Sons+Funeral+Home+Stadium+Road+Bush+Hall+St+Michael+Barbados";

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

let people = json("data/obituaries.json"); // newest Facebook post first: add new notices at the top
if (!PREVIEW) people = people.filter((p) => !p.sample);
const condolences = json("data/condolences.json");
const testimonials = json("data/testimonials.json");
const flowers = json("data/flowers.json");
const quotes = json("data/quotes.json");

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- dates (Barbados time, written YYYY-MM-DDTHH:MM) ---------- */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s || "");
  if (!m) return null;
  const wd = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: m[4] == null ? null : +m[4], mi: +(m[5] || 0), wd };
}
/** true when the text is a real date (and time), e.g. not 2026-02-30 */
function realDate(s) {
  const p = parts(s);
  if (!p || (p.h != null && (p.h > 23 || p.mi > 59))) return false;
  const d = new Date(Date.UTC(p.y, p.mo, p.d));
  return d.getUTCFullYear() === p.y && d.getUTCMonth() === p.mo && d.getUTCDate() === p.d;
}
const hour = (p) => `${p.h % 12 || 12}:${String(p.mi).padStart(2, "0")} ${p.h < 12 ? "a.m." : "p.m."}`;
/** "2:00 p.m." -> { h: 14, mi: 0 } */
function clock(t) {
  const m = /^(\d{1,2}):(\d{2}) ([ap])\.m\.$/.exec(t || "");
  return m && +m[1] >= 1 && +m[1] <= 12 && +m[2] < 60 ? { h: (+m[1] % 12) + (m[3] === "p" ? 12 : 0), mi: +m[2] } : null;
}
/** Wednesday 14 October 2026, 1:15 p.m. */
function longDate(s) {
  const p = parts(s);
  if (!p) return "";
  return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.mo]} ${p.y}` + (p.h == null ? "" : `, ${hour(p)}`);
}
/** Tue 13 Oct, 4:00 p.m. */
function shortDate(s) {
  const p = parts(s);
  return p ? `${DAYS[p.wd].slice(0, 3)} ${p.d} ${MONTHS[p.mo].slice(0, 3)}` + (p.h == null ? "" : `, ${hour(p)}`) : "";
}
/** add a full stop unless the text already ends with one (e.g. "3:30 p.m." or "Jr.") */
const stop = (t) => (/\.$/.test(t) ? t : t + ".");
/** a name used inside a sentence: "The Chapel of ..." -> "the Chapel of ..." */
const inline = (t) => String(t).replace(/^The /, "the ");
function viewing(p) {
  if (!p.viewing_start) return "";
  const e = parts(p.viewing_end);
  return longDate(p.viewing_start) + (e && e.h != null ? "–" + hour(e) : "");
}
const today = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10); // Barbados is UTC-4
const serviceDay = (p) => (p.service || "").slice(0, 10);
const daysSince = (day) => (Date.parse(today) - Date.parse(day)) / 864e5;
/** the funeral is over (a notice with a stream link but no date was a service already streamed) */
const isPast = (p) => (p.service ? serviceDay(p) < today : !!p.livestream);
/** flowers can still be ordered: the funeral is today or later, or the death was recent and no date is set yet */
const takesFlowers = (p) => (p.service ? serviceDay(p) >= today : !p.livestream && !!p.died && daysSince(p.died) <= 21);

/* ---------- check the notices before anything is written ---------- */

{
  const errors = [];
  const seen = new Set();
  for (const [i, p] of people.entries()) {
    const who = p.name || `notice ${i + 1}`;
    if (!p.name) errors.push(`${who}: has no "name"`);
    if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) errors.push(`${who}: "slug" must be lower-case letters, numbers and dashes`);
    else if (seen.has(p.slug)) errors.push(`${who}: the slug "${p.slug}" is used twice`);
    seen.add(p.slug);
    for (const k of ["service", "viewing_start", "viewing_end", "born", "died"]) {
      if (p[k] && !realDate(p[k])) errors.push(`${who}: "${k}" must be a real date like 2026-10-14 or 2026-10-14T13:15 (it says "${p[k]}")`);
    }
    if (p.viewing_end && (!p.viewing_start || p.viewing_end.slice(0, 10) !== p.viewing_start.slice(0, 10))) errors.push(`${who}: "viewing_end" must be on the same day as "viewing_start"`);
    if (p.church_time && !p.church) errors.push(`${who}: "church_time" needs "church" (the church where the service is)`);
    if (p.church_time && !clock(p.church_time)) errors.push(`${who}: "church_time" must look like 2:00 p.m. (it says "${p.church_time}")`);
    if (p.livestream && !/^https:\/\//.test(p.livestream.url || "")) errors.push(`${who}: the livestream "url" must start with https://`);
  }
  if (errors.length) {
    console.error("The build stopped. Fix data/obituaries.json, then run it again:\n" + errors.map((e) => "  - " + e).join("\n"));
    process.exit(1);
  }
}

/* ---------- images ---------- */

function photoFor(dir, slug) {
  const abs = path.join(root, "images", dir);
  if (!fs.existsSync(abs)) return null;
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    // exact (case-sensitive) match, so a link that works here also works on GitHub Pages
    if (fs.readdirSync(abs).includes(slug + ext)) return `images/${dir}/${slug}${ext}`;
  }
  return null;
}

/** width and height of a JPEG or PNG under site/, read from the file header */
function imageSize(rel) {
  if (!rel) return null;
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return null;
  const b = fs.readFileSync(abs);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG
  if (b[0] !== 0xff || b[1] !== 0xd8) return null; // not a JPEG
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}
const dims = (rel) => { const d = imageSize(rel); return d ? ` width="${d.w}" height="${d.h}"` : ""; };

/* ---------- business details (search engines) ---------- */

/* Keep these in step with the footer and the top bar. */
const LD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${SITE}/#business`,
  name: "Two Sons Funeral Home Ltd.",
  alternateName: "Two Sons Funeral Home",
  description: "Funeral home serving Barbadian families of every faith from Bush Hall, St. Michael since 1979.",
  url: `${SITE}/`,
  logo: `${SITE}/images/brand/icon-512.png`,
  image: `${SITE}/images/photos/fleet-at-the-chapel.jpg`,
  telephone: "+1-246-426-1205",
  faxNumber: "+1-246-426-9411",
  email: EMAIL,
  foundingDate: "1979",
  address: { "@type": "PostalAddress", streetAddress: "Stadium Road, Bush Hall", addressLocality: "St. Michael", postalCode: "BB15038", addressCountry: "BB" },
  hasMap: MAPS,
  areaServed: { "@type": "Country", name: "Barbados" },
  sameAs: [FACEBOOK],
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:30", closes: "17:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "14:00" },
  ],
};

/* ---------- shared chrome ---------- */

/* One list, used for the desktop and phone menus alike. */
const NAV = [
  ["index.html", "Home"],
  ["about.html", "About"],
  ["services.html", "Services"],
  ["caskets.html", "Caskets"],
  ["obituaries.html", "Obituaries"],
  // Label, not file name: someone looking for the time of a funeral would never think to click "Livestreams".
  ["livestreams.html", "Funerals"],
  ["testimonials.html", "Testimonials"],
  ["pre-planning.html", "Pre-planning"],
  ["contact.html", "Contact"],
];

/* Used only if the page's script can't run: the browser then posts the form to FormSubmit itself. */
const FORM_ACTION = `https://formsubmit.co/${EMAIL}`;

const NEW_TAB = '<span class="visually-hidden"> (opens in a new tab)</span>';

function head({ up = "", file, title, desc, image, imageAlt, ogTitle, type = "website" }) {
  const url = `${SITE}/${file === "index.html" ? "" : file}`;
  const full = file === "index.html" ? "Two Sons Funeral Home | Bush Hall, St. Michael, Barbados" : `${title} | Two Sons Funeral Home`;
  const img = image || "images/brand/og.png";
  const size = imageSize(img);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="icon" type="image/png" href="${up}images/brand/favicon-32.png" />
<link rel="apple-touch-icon" href="${up}images/brand/icon-512.png" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="${type}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="Two Sons Funeral Home" />
<meta property="og:title" content="${esc(ogTitle || full)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${SITE}/${img}" />
${size ? `<meta property="og:image:width" content="${size.w}" />\n<meta property="og:image:height" content="${size.h}" />\n` : ""}<meta property="og:image:alt" content="${esc(imageAlt || "Two Sons Funeral Home, Stadium Road, Bush Hall, St. Michael, Barbados")}" />
<meta name="twitter:card" content="summary_large_image" />
${PREVIEW ? '<meta name="robots" content="noindex" />\n' : ""}<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${up}css/styles.css" />
${file === "index.html" ? `<script type="application/ld+json">${JSON.stringify(LD)}</script>\n` : ""}</head>`;
}

function header(up, current) {
  const links = NAV.map(([href, label]) => {
    const on = href === current;
    return `<li class="nav-item"><a class="nav-link${on ? " active" : ""}"${on ? ' aria-current="page"' : ""} href="${up}${href}">${label}</a></li>`;
  }).join("\n");
  return `<body>
<div id="wrapwrap">
<a class="visually-hidden-focusable ts-skip" href="#main">Skip to main content</a>
${PREVIEW ? '<aside class="ts-preview" aria-label="Preview notice">Preview website &middot; not yet live</aside>\n' : ""}<aside class="ts-topbar" aria-label="Phone, address and office hours"><div class="container d-flex align-items-center justify-content-center justify-content-lg-between gap-3">
<a href="${TEL}"><i class="fa fa-phone me-2"></i>Help 24 hours a day <strong>${PHONE}</strong></a>
<a class="d-none d-lg-inline" href="${MAPS}" target="_blank" rel="noopener"><i class="fa fa-map-marker me-2"></i>Stadium Road, Bush Hall, St. Michael${NEW_TAB}</a>
<span class="d-none d-lg-inline"><i class="fa fa-clock-o me-2"></i>Office: Mon&ndash;Fri 8:30&ndash;5 &middot; Sat 9&ndash;2</span>
</div></aside>
<header class="ts-header"><nav class="navbar navbar-expand-xl" aria-label="Main"><div class="container">
<a class="navbar-brand" href="${up}index.html"><span class="ts-brand"><img src="${up}images/brand/crest-dark.png" alt="" width="68" height="50" /><span class="ts-brand-text"><span class="ts-brand-name">Two Sons</span><span class="ts-brand-sub">Funeral Home Ltd &middot; Since 1979</span></span></span></a>
<a class="btn btn-primary ts-call-btn-lg d-none d-lg-inline-flex d-xl-none align-items-center ms-auto me-2" href="${TEL}"><i class="fa fa-phone me-2"></i>Call 24 hours</a>
<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#ts-nav" aria-controls="ts-nav" aria-expanded="false"><i class="fa fa-bars me-2"></i><span class="ts-menu-label">Menu</span></button>
<div class="collapse navbar-collapse" id="ts-nav"><ul class="navbar-nav ms-auto me-xl-3">
${links}
</ul><a class="btn btn-primary ts-call-btn" href="${TEL}"><i class="fa fa-phone me-2"></i>Call 24 hours</a></div>
</div></nav></header>
<main id="main" tabindex="-1">`;
}

const contactBand = `<section class="ts-section ts-dark ts-band">
<div class="container d-lg-flex justify-content-between align-items-center gap-4">
<div><p class="ts-eyebrow">Whenever you need us</p><h2>We&rsquo;re here, 24 hours a day.</h2><p class="ts-lead mb-lg-0">When a death occurs, call us at any hour. A member of our team will tell you exactly what happens next.</p></div>
<div class="d-flex flex-wrap gap-2 flex-shrink-0"><a class="btn btn-light btn-lg" href="${TEL}"><i class="fa fa-phone me-2"></i>Call ${PHONE}</a><a class="btn btn-outline-light btn-lg" href="REPLACE_UP">Send a message</a></div>
</div>
</section>`;

function footer(up) {
  return `</main>
<footer class="ts-footer"><section class="pt-5 pb-3" aria-label="Contact details and links"><div class="container"><div class="row g-4">
<div class="col-md-6 col-lg-3"><img src="${up}images/brand/crest-light.png" alt="" width="120" height="89" class="mb-3" loading="lazy" />
<p><strong>Two Sons Funeral Home Ltd.</strong><br />Stadium Road, Bush Hall<br />St. Michael, Barbados BB15038</p></div>
<div class="col-sm-6 col-lg-3"><h2 class="ts-footer-h">Call us</h2><ul class="list-unstyled">
<li>24 hours: <a href="${TEL}">${PHONE}</a></li>
<li>Office: <a href="tel:+12464261206">(246) 426-1206</a></li>
<li>After hours: <a href="tel:+12464331243">(246) 433-1243</a></li>
<li>Fax: <span class="text-nowrap">(246) 426-9411</span></li>
<li><a href="mailto:${EMAIL}">${EMAIL}</a></li></ul></div>
<div class="col-sm-6 col-lg-3"><h2 class="ts-footer-h">Office hours</h2><ul class="list-unstyled">
<li>Mon&ndash;Fri, 8:30 a.m.&ndash;5:00 p.m.</li><li>Saturday, 9:00 a.m.&ndash;2:00 p.m.</li>
<li>Sunday, public and bank holidays: closed</li><li>Help by phone, 24 hours a day</li></ul></div>
<div class="col-md-6 col-lg-3"><h2 class="ts-footer-h">For families</h2><ul class="list-unstyled ts-footer-nav">
<li><a href="${up}obituaries.html">Obituaries</a></li><li><a href="${up}livestreams.html">Funerals &amp; livestreams</a></li>
<li><a href="${up}pre-planning.html#first-steps">What to do first</a></li><li><a href="${up}get-a-quote.html">Get a quote</a></li>
<li><a href="${up}flowers.html">Floral tributes</a></li><li><a href="${up}caskets.html">Casket collection</a></li>
<li><a href="${up}gallery.html">Gallery</a></li><li><a href="${up}testimonials.html">Testimonials &amp; feedback</a></li></ul></div>
</div></div></section>
<div class="container"><div class="ts-copyright d-flex flex-wrap justify-content-between gap-2">
<span>&copy; <span id="year">${new Date().getFullYear()}</span> Two Sons Funeral Home Ltd. All rights reserved.</span>
<a href="${FACEBOOK}" target="_blank" rel="noopener"><i class="fa fa-facebook-official me-2"></i>Two Sons on Facebook${NEW_TAB}</a>
</div></div>
</footer>
<nav class="ts-mobilebar d-lg-none" aria-label="Quick links">
<a class="ts-mobilebar-call" href="${TEL}"><i class="fa fa-phone"></i>Call 24 hrs</a>
<a href="${up}obituaries.html"><i class="fa fa-file-text-o"></i>Notices</a>
<a href="${up}livestreams.html"><i class="fa fa-video-camera"></i>Funerals</a>
<a href="${MAPS}" target="_blank" rel="noopener"><i class="fa fa-map-marker"></i>Directions${NEW_TAB}</a>
</nav>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script src="${up}js/main.js"></script>
</body>
</html>
`;
}

function page({ up = "", file, title, desc, image, imageAlt, ogTitle, type, body, band = true }) {
  return head({ up, file, title, desc, image, imageAlt, ogTitle, type }) + "\n" + header(up, file) + "\n" + body + "\n" +
    (band ? contactBand.replace("REPLACE_UP", up + "contact.html") + "\n" : "") + footer(up);
}

/** wrap: "ts-narrow" or "ts-narrow-wide" so the heading lines up with a narrow page body */
function banner(eyebrow, h1, lead, wrap = "") {
  return `<section class="ts-banner"><div class="container${wrap ? " " + wrap : ""}">
${eyebrow ? `<p class="ts-eyebrow">${eyebrow}</p>` : ""}<h1>${h1}</h1>
${lead ? `<p class="ts-lead">${lead}</p>` : ""}
</div></section>`;
}

/* ---------- obituaries ---------- */

const lateOf = (p) => (p.late_of ? (/^formerly of /i.test(p.late_of) ? esc(p.late_of.charAt(0).toUpperCase() + p.late_of.slice(1)) : `Late of ${esc(p.late_of)}`) : "");
const meta = (p) => [p.age ? `Aged ${p.age}` : "", lateOf(p)].filter(Boolean).join(" &middot; ");
/** 1 February 1932 – 18 July 2026 (dates only, no weekday) */
function dayMonthYear(s) { const p = parts(s); return p ? `${p.d} ${MONTHS[p.mo]} ${p.y}` : ""; }
function lifeDates(p) {
  if (p.born && p.died) return `${dayMonthYear(p.born)} &ndash; ${dayMonthYear(p.died)}`;
  return p.died ? `Entered rest ${dayMonthYear(p.died)}` : "";
}
/** "aka" may be one name or a list: ["Tallies", "Papi"] reads “Tallies” or “Papi” ("aka_join": "and" for “A” and “B”) */
const akas = (p) => [].concat(p.aka || []);
const akaText = (p, quote) => akas(p).map(quote).join(p.aka_join === "and" ? " and " : " or ");
/** search key: no accents, plain apostrophes, lower case ("née" is found by "nee") */
const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2018\u2019]/g, "'").toLowerCase();

const flyerFor = (p) => photoFor("notices/flyers", p.slug);
/** small copies of the flyer made by tools/images.js; the full flyer is used until they exist */
const cardFor = (p) => photoFor("notices/cards", p.slug) || flyerFor(p);
const miniFor = (p) => photoFor("notices/mini", p.slug) || flyerFor(p);
const shareFor = (p) => photoFor("notices/share", p.slug) || flyerFor(p);
const thumbFor = (p) => photoFor("notices/thumbs", p.slug);

/** the service time at the church, when it differs from the time on the notice (the cortège leaving Two Sons) */
function churchTime(p) {
  const s = parts(p.service), c = p.church ? clock(p.church_time) : null;
  return s && c && !(s.h === c.h && s.mi === c.mi) ? p.church_time : "";
}
/** first line of a listing: the date, with the time when it is the time of the service itself */
const whenText = (p) => (churchTime(p) ? longDate(serviceDay(p)) : longDate(p.service));
/** second line: where the service is */
function placeText(p) {
  if (p.church) return (churchTime(p) ? `Service ${esc(p.church_time)}, ` : "") + esc(p.church);
  return esc(p.service_start || "");
}
/** third line, only when the funeral starts somewhere before the church service */
function departText(p) {
  const s = parts(p.service);
  if (!churchTime(p) || !s || s.h == null) return "";
  return /^Leaves\b.*Two Sons/i.test(p.service_start || "") ? `Leaves Two Sons at ${hour(s)}` : `${esc(p.service_start || "The funeral begins")} at ${hour(s)}`;
}
/** service_start already names the church, e.g. "A Service of Thanksgiving at Holy Innocents Anglican Church" */
const namesChurch = (p) => !!p.church && (p.service_start || "").toLowerCase().includes(p.church.toLowerCase().replace(/^the /, ""));
/** where to send mourners: an explicit "place", else the church, else Two Sons (always ending in Barbados) */
function placeOf(p) {
  const x = p.place || p.church || HOME_PLACE;
  return /barbados/i.test(x) ? x : x + ", Barbados";
}

function oval(p, up, large) {
  const photo = photoFor("notices", p.slug);
  return `<div class="ts-oval${large ? " ts-oval-lg" : ""}">${
    photo ? `<img src="${up}${photo}" alt="${esc(p.name)}"${large ? "" : ' loading="lazy"'} />` : `<img src="${up}images/brand/dove.svg" alt="" />`
  }</div>`;
}

function card(p, up = "", eager = false) {
  const pills = [
    p.livestream ? '<span class="ts-pill ts-pill-dark"><i class="fa fa-video-camera me-1"></i>Livestream</span>' : "",
    p.viewing_start ? `<span class="ts-pill"><i class="fa fa-eye me-1"></i>Viewing ${shortDate(p.viewing_start)}</span>` : "",
    !p.viewing_start && p.flowers_by && takesFlowers(p) ? `<span class="ts-pill"><i class="fa fa-leaf me-1"></i>Flowers by ${esc(p.flowers_by.replace(" on the day", ""))}</span>` : "",
  ].join("");
  const img = cardFor(p);
  const thumb = img !== flyerFor(p) && thumbFor(p);
  // phones show the card picture 92 px wide and other screens at most 320 px (380 px on the home page from 1400 px):
  // most screens get the 320 px copy, large and high-density screens the 600 px one
  const srcset = thumb ? ` srcset="${up}${thumb} 320w, ${up}${img} 600w" sizes="(max-width: 767.98px) 92px, (max-height: 500px) and (max-width: 991.98px) 92px, (min-width: 1400px) 380px, 320px"` : "";
  const picture = !photoFor("notices", p.slug) && img
    ? `<div class="ts-card-flyer${p.flyer_wide ? " ts-card-flyer-wide" : ""}"${p.flyer_wide ? ` style="background-image:url('${up}${miniFor(p)}')"` : ""}><img src="${up}${img}"${srcset}${dims(img)} alt=""${eager ? "" : ' loading="lazy"'} /></div>`
    : oval(p, up);
  const when = p.service ? `Funeral: ${whenText(p)}` : lifeDates(p);
  const lines = [placeText(p), departText(p)].filter(Boolean).map((t) => `<p class="ts-meta">${t}</p>`).join("\n");
  return `<a class="ts-notice-card" href="${up}obituaries/${p.slug}.html" data-name="${esc(fold(p.name + " " + akas(p).join(" ")))}">
${p.sample ? '<span class="ts-sample">Sample</span>' : ""}${picture}
<div class="ts-card-body">
<p class="ts-eyebrow">In loving memory of</p>
<h3 class="ts-name">${esc(p.name)}</h3>
${meta(p) ? `<p class="ts-meta">${meta(p)}</p>` : ""}
${when ? `<p class="ts-when">${when}</p>` : ""}
${lines}
${pills ? `<div class="ts-pills">${pills}</div>` : ""}
</div>
</a>`;
}

function familyList(lines) {
  // "Son of the late X" -> bold the relationship, keep the names plain
  return lines
    .map((line) => {
      const m = String(line).match(/^(.{2,40}?\s+of)\s+([\s\S]+)$/);
      return m ? `<p><strong>${esc(m[1])}</strong><br /><em>${esc(m[2])}</em></p>` : `<p>${esc(line)}</p>`;
    })
    .join("\n");
}

function condolenceSection(p) {
  const approved = Array.isArray(condolences[p.slug]) ? condolences[p.slug] : [];
  const list = approved.length
    ? approved.map((c) => `<blockquote class="ts-condolence"><p>${esc(c.message)}</p><footer>${esc(c.name)}${c.relationship ? ` &middot; ${esc(c.relationship)}` : ""}</footer></blockquote>`).join("\n")
    : '<p class="ts-meta">Share a memory or a few words of comfort for the family.</p>';
  const subject = encodeURIComponent(`Condolence for ${p.name}`);
  return `<div class="ts-panel" id="condolences">
<h2>Condolence book</h2>
${list}
<form class="ts-form mt-4" data-form="condolence" data-person="${esc(p.name)}" data-slug="${esc(p.slug)}" method="post" action="${FORM_ACTION}">
<input type="hidden" name="person" value="${esc(p.name)}" />
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<div class="mb-3"><label class="form-label" for="c-msg">Your message</label><textarea id="c-msg" name="message" class="form-control" rows="4" maxlength="4000" required placeholder="Write a few words for the family"></textarea></div>
<div class="row g-3 mb-3">
<div class="col-sm-6"><label class="form-label" for="c-name">Your name</label><input id="c-name" name="name" class="form-control" maxlength="120" required autocomplete="name" /></div>
<div class="col-sm-6"><label class="form-label" for="c-rel">How you knew them (optional)</label><input id="c-rel" name="relationship" class="form-control" maxlength="120" placeholder="e.g. A neighbour" /></div>
<div class="col-12"><label class="form-label" for="c-email">Your email (optional, so the family can reply)</label><input id="c-email" name="email" type="email" class="form-control" maxlength="120" autocomplete="email" /></div>
</div>
<button type="submit" class="btn btn-primary"><i class="fa fa-pencil me-2"></i>Post in the condolence book</button>
<p class="form-note ts-meta mt-2" role="status">Your message goes to Two Sons, and we pass it to the family. Some messages are added to this page after our staff have read them.</p>
</form>
<p class="ts-meta mt-3 mb-0">Would you rather write privately? <a href="mailto:${EMAIL}?subject=${subject}">Email the family through Two Sons</a> and nothing is published.</p>
</div>`;
}

function memorialPage(p) {
  const up = "../";
  const file = `obituaries/${p.slug}.html`;
  const photo = photoFor("notices", p.slug);
  const flyer = flyerFor(p);
  const share = `${SITE}/${file}`;
  const s = parts(p.service);
  const ct = churchTime(p);
  const past = isPast(p);
  const flowersOk = takesFlowers(p);
  const quoted = akaText(p, (a) => `“${a}”`);

  const shareText = stop(`In loving memory of ${p.name}`) +
    (p.service ? ` Funeral: ${stop(longDate(serviceDay(p)))}` + (p.church ? ` Service${p.church_time ? " " + p.church_time : ""} at ${stop(inline(p.church))}` : p.service_start ? " " + stop(p.service_start) : "") : "");
  let desc = stop(`In loving memory of ${p.name}${quoted ? `, also known as ${quoted}` : ""}${p.age ? `, aged ${p.age}` : ""}`) +
    (p.service ? ` Funeral ${stop(longDate(serviceDay(p)))}` : p.died ? ` Entered rest ${dayMonthYear(p.died)}.` : "") +
    (p.church ? " " + stop(`Service${p.church_time ? " " + p.church_time : ""} at ${inline(p.church)}`) : p.service_start ? " " + stop(p.service_start) : "");
  if (desc.length < 100) desc += p.service ? " Funeral details and condolence book from Two Sons Funeral Home." : p.livestream ? " Livestream and condolence book from Two Sons Funeral Home." : " Condolence book from Two Sons Funeral Home.";

  // "The funeral": the day, where it starts, the church, the interment
  const dup = namesChurch(p);
  const churchLines = [p.officiant ? `Officiating Minister: ${esc(p.officiant)}` : "", p.church_note ? esc(p.church_note) : ""].filter(Boolean);
  let noService = "";
  if (!p.service) {
    noService = p.livestream
      ? "Service details were not published with this notice. You can watch the service below."
      : p.died && daysSince(p.died) <= 30
        ? "Funeral arrangements will be announced here."
        : `Service details were not published with this notice. For details, please call us on <a href="${TEL}">${PHONE}</a>.`;
  }
  const facts = [
    p.service ? `<li><i class="fa fa-calendar"></i><div><strong>${longDate(p.service)}</strong>${p.service_start ? `<br />${esc(p.service_start)}` : ""}${dup && ct ? `<br />Service, ${esc(ct)}` : ""}${(dup || !p.church) && churchLines.length ? "<br />" + churchLines.join("<br />") : ""}</div></li>` : "",
    p.church && !dup ? `<li><i class="fa fa-building-o"></i><div><strong>${ct ? `Service, ${esc(ct)}` : esc(p.church)}</strong>${ct ? `<br />${esc(p.church)}` : ""}${churchLines.map((l) => `<br />${l}`).join("")}</div></li>` : "",
    p.interment ? `<li><i class="fa fa-map-marker"></i><div><strong>Interment</strong><br />${esc(p.interment)}</div></li>` : "",
    p.note ? `<li><i class="fa fa-info-circle"></i><div>${esc(p.note)}</div></li>` : "",
    noService ? `<li><i class="fa fa-info-circle"></i><div>${noService}</div></li>` : "",
  ].filter(Boolean).join("\n");
  const funeralButtons = [
    p.service || p.church || p.place ? `<a class="btn btn-outline-primary" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(placeOf(p))}" target="_blank" rel="noopener"><i class="fa fa-location-arrow me-2"></i>Directions${NEW_TAB}</a>` : "",
    p.service && !past ? `<a class="btn btn-outline-primary" href="${p.slug}.ics" download data-until="${serviceDay(p)}"><i class="fa fa-calendar-plus-o me-2"></i>Add to calendar</a>` : "",
  ].filter(Boolean).join("\n");

  // Livestream: the time is the church service, never the cortège
  let streamPanel = "";
  if (p.livestream) {
    const live = p.service && !past;
    const at = ct || (s && s.h != null ? hour(s) : "");
    const text = !p.service
      ? "The service has already been streamed. The recording may still be available."
      : live
        ? `The service begins ${longDate(serviceDay(p))}${at ? `, ${at}` : ""} (Barbados time). One link for everyone, at home and abroad.`
        : `The service was streamed on ${longDate(serviceDay(p))}. Links are run by the streaming service and may not stay available.`;
    const label = p.livestream.label ? `<p class="ts-meta mt-2 mb-0">Streamed ${/^(youtube|facebook)$/i.test(p.livestream.label) ? "on" : "by"} ${esc(p.livestream.label)}</p>` : "";
    streamPanel = `<div class="ts-panel ts-panel-dark">
${live ? `<span class="ts-live-tag" data-until="${serviceDay(p)}"><span aria-hidden="true">&#9679;</span> Live ${DAYS[s.wd]}</span>` : ""}
<h2>Watch the service</h2>
<p>${text}</p>
<a class="btn btn-light" href="${esc(p.livestream.url)}" target="_blank" rel="noopener"><i class="fa fa-video-camera me-2"></i>Open livestream${NEW_TAB}</a>
${label}
</div>`;
  }

  // Viewing and flowers: only what the notice actually says
  const vf = [
    p.viewing_start ? `<li><i class="fa fa-eye"></i><div><strong>Viewing: ${viewing(p)}</strong>${p.viewing_place ? `<br />${esc(p.viewing_place)}` : ""}</div></li>` : "",
    p.viewing_note ? `<li><i class="fa fa-eye-slash"></i><div><strong>${esc(p.viewing_note)}</strong></div></li>` : "",
    p.flowers_by ? `<li><i class="fa fa-leaf"></i><div><strong>Flowers by ${esc(p.flowers_by)}</strong>${flowersOk ? "<br />Bring them to our chapel, or order a tribute from us." : ""}</div></li>` : "",
  ].filter(Boolean).join("\n");
  const hasViewing = p.viewing_start || p.viewing_note;
  const vfTitle = hasViewing && p.flowers_by ? "Viewing and flowers" : hasViewing ? "Viewing" : "Flowers";
  const vfPanel = vf || flowersOk ? `<div class="ts-panel">
<h2>${vfTitle}</h2>
${vf ? `<ul class="ts-facts">\n${vf}\n</ul>` : '<p>Send a floral tribute through us, or leave a few words for the family in the condolence book.</p>'}
<div class="d-grid gap-2 d-sm-flex">
${flowersOk ? `<a class="btn btn-primary" href="../flowers.html?for=${encodeURIComponent(p.slug)}#order"${p.service ? ` data-until="${serviceDay(p)}"` : ""}><i class="fa fa-leaf me-2"></i>Order flowers</a>` : ""}
<a class="btn btn-outline-primary" href="#condolences"><i class="fa fa-pencil me-2"></i>Sign the book</a>
</div>
</div>` : "";

  const body = `<div class="ts-page ts-notice-page"><div class="container ts-narrow py-4">
<p><a href="../obituaries.html" class="ts-back"><i class="fa fa-arrow-left me-2"></i>All obituaries</a></p>
<div class="ts-panel ts-panel-framed text-center position-relative">
${p.sample ? '<span class="ts-sample">Sample notice</span>' : ""}${flyer ? `<a class="ts-flyer" href="${up}${flyer}" target="_blank" rel="noopener"><img src="${up}${flyer}"${dims(flyer)} alt="Funeral notice for ${esc(p.name)}" fetchpriority="high" /><span class="visually-hidden"> (opens the notice full size in a new tab)</span></a>
<p class="ts-meta ts-flyer-hint">Tap or click the notice to see it full size.</p>` : oval(p, up, true)}
<p class="ts-eyebrow">In loving memory of</p>
<h1 class="ts-name ts-name-lg">${esc(p.name)}</h1>
${quoted ? `<p class="ts-meta mb-1">also known as ${akaText(p, (a) => `&ldquo;${esc(a)}&rdquo;`)}</p>` : ""}
${meta(p) ? `<p class="ts-meta mb-1">${meta(p)}</p>` : ""}
${lifeDates(p) ? `<p class="ts-meta">${lifeDates(p)}</p>` : ""}
<div class="d-flex flex-wrap justify-content-center gap-2 mt-3">
<a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText + " " + share)}"><i class="fa fa-whatsapp me-2"></i>Share on WhatsApp${NEW_TAB}</a>
<a class="btn btn-outline-primary" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share)}"><i class="fa fa-facebook me-2"></i>Share on Facebook${NEW_TAB}</a>
<button type="button" class="btn btn-outline-primary ts-copy" data-url="${esc(share)}"><i class="fa fa-link me-2"></i>Copy link</button>
<span class="visually-hidden ts-copy-status" role="status"></span>
</div>
</div>
<div class="ts-panel">
<h2>The funeral</h2>
<ul class="ts-facts">
${facts}
</ul>
${past && p.service ? '<p class="ts-meta">This service has taken place.</p>' : ""}
${funeralButtons ? `<div class="d-grid gap-2 d-sm-flex">\n${funeralButtons}\n</div>` : ""}
</div>
${streamPanel}
${vfPanel}
${p.family && p.family.length ? `<div class="ts-panel ts-family"><h2>Family</h2>\n${familyList(p.family)}\n</div>` : ""}
${p.obituary && p.obituary.length ? `<div class="ts-panel"><h2>Obituary</h2>\n${p.obituary.map((x) => `<p>${esc(x)}</p>`).join("\n")}\n</div>` : ""}
${condolenceSection(p)}
${p.entrusted === false ? "" : '<p class="ts-meta">Funeral arrangements entrusted to Two Sons Funeral Home Ltd., Stadium Road, Bush Hall, St. Michael.</p>'}
</div></div>`;
  return page({
    up, file, title: `${p.name} | Obituaries`, desc, body,
    image: (flyer && shareFor(p)) || photo, imageAlt: flyer ? `Funeral notice for ${p.name}` : photo ? p.name : undefined, ogTitle: `In loving memory of ${p.name}`, type: "article",
  });
}

/** an .ics calendar file: at the church at the church's time, or an all-day event when no time is known */
function ics(p) {
  const s = parts(p.service);
  const c = p.church ? clock(p.church_time) : null;
  const h = c ? c.h : s.h, mi = c ? c.mi : s.mi;
  const pad = (x) => String(x).padStart(2, "0");
  const f = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  const e = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n");
  let when;
  if (h == null) {
    when = [`DTSTART;VALUE=DATE:${ymd(new Date(Date.UTC(s.y, s.mo, s.d)))}`, `DTEND;VALUE=DATE:${ymd(new Date(Date.UTC(s.y, s.mo, s.d + 1)))}`];
  } else {
    const start = new Date(Date.UTC(s.y, s.mo, s.d, h + 4, mi)); // Barbados is UTC-4 all year
    when = [`DTSTART:${f(start)}`, `DTEND:${f(new Date(start.getTime() + 2 * 3600 * 1000))}`];
  }
  const ct = churchTime(p);
  const notes = [
    ct && s.h != null ? stop(`${p.service_start || "The funeral begins"} at ${hour(s)}`) : "",
    p.church
      ? ct ? (namesChurch(p) ? "" : stop(`Service at ${inline(p.church)}, ${ct}`))
        : namesChurch(p) ? stop(p.service_start)
          : /^Leaves\b/i.test(p.service_start || "") ? `${stop(p.service_start)} Service at ${stop(inline(p.church))}`
            : stop(`${p.service_start || "Service"} at ${inline(p.church)}`)
      : p.service_start ? stop(p.service_start) : "",
    ct && namesChurch(p) ? stop(`Service at ${ct}`) : "",
    p.church_note ? stop(p.church_note) : "",
    p.officiant ? `Officiating Minister: ${stop(p.officiant)}` : "",
    p.interment ? `Interment: ${stop(p.interment)}` : "",
    `${SITE}/obituaries/${p.slug}.html`,
  ].filter(Boolean).join(" ");
  // RFC 5545: lines of at most 75 octets, continued with a space
  const foldLine = (l) => {
    const out = [];
    let cur = "";
    for (const ch of l) {
      if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
      cur += ch;
    }
    out.push(cur);
    return out.join("\r\n ");
  };
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Two Sons Funeral Home//Notices//EN", "BEGIN:VEVENT",
    `UID:${p.slug}@twosonsfuneralhome.com`, `DTSTAMP:${f(new Date(Date.UTC(s.y, s.mo, s.d)))}`, ...when,
    `SUMMARY:${e("Funeral of " + p.name)}`, `LOCATION:${e(placeOf(p))}`, `DESCRIPTION:${e(notes)}`,
    `URL:${SITE}/obituaries/${p.slug}.html`, "END:VEVENT", "END:VCALENDAR",
  ].map(foldLine).join("\r\n") + "\r\n";
}

/* Notices stay in data order (newest Facebook post first). Upcoming funerals: soonest first. */
const upcoming = people.filter((p) => p.service && serviceDay(p) >= today).sort((a, b) => a.service.localeCompare(b.service));

/* A listing row for the home page and the Funerals page. data-until / data-after let the
   browser drop or show a row when its day passes, even if nobody has rebuilt the site. */
function serviceRow(p, { up = "", cls, until, after, watch = "Watch" }) {
  const thumb = miniFor(p) && !photoFor("notices", p.slug)
    ? `<img class="ts-service-flyer${p.flyer_wide ? " ts-service-flyer-wide" : ""}" src="${up}${miniFor(p)}" alt="" width="64" height="80" loading="lazy" />`
    : oval(p, up);
  const lines = [placeText(p), departText(p)].filter(Boolean).map((t) => `<p class="ts-meta mb-0">${t}</p>`).join("\n");
  return `<article class="${cls}"${until ? ` data-until="${until}"` : ""}${after ? ` data-after="${after}" hidden` : ""}>
<a class="ts-service-face" href="${up}obituaries/${p.slug}.html" tabindex="-1" aria-hidden="true">${thumb}</a>
<div class="ts-service-detail"><h3><a href="${up}obituaries/${p.slug}.html">${esc(p.name)}</a>${p.sample ? ' <span class="ts-sample ts-sample-inline">Sample</span>' : ""}</h3>
<p class="ts-when mb-0">${p.service ? whenText(p) : lifeDates(p)}</p>
${lines}</div>
${p.livestream ? `<a class="btn btn-primary" href="${esc(p.livestream.url)}" target="_blank" rel="noopener"><i class="fa fa-video-camera me-2"></i>${watch}<span class="visually-hidden"> the funeral of ${esc(p.name)} (opens in a new tab)</span></a>` : '<span class="ts-meta">No livestream listed</span>'}
</article>`;
}

function upcomingBlock() {
  // Omitted entirely when nothing is coming up: an empty "Upcoming funerals" heading reads as neglect.
  if (!upcoming.length) return "";
  return `<section class="ts-section ts-upcoming" aria-labelledby="upcoming-h" data-list><div class="container">
<div class="d-md-flex justify-content-between align-items-end mb-3"><div><p class="ts-eyebrow">Upcoming funerals</p><h2 class="mb-0" id="upcoming-h">Services still to come</h2></div>
<a class="ts-link" href="livestreams.html">All funerals and livestreams <i class="fa fa-arrow-right ms-1"></i></a></div>
${upcoming.slice(0, 4).map((p) => serviceRow(p, { cls: "ts-upcoming-row", until: serviceDay(p), watch: "Watch live" })).join("\n")}
</div></section>`;
}

function grid(list, empty, up = "", eager = 0, extra = "") {
  return list.length
    ? `<div class="ts-notice-grid${extra ? " " + extra : ""}">\n${list.map((p, i) => card(p, up, i < eager)).join("\n")}\n</div>`
    : `<p class="ts-empty">${empty}</p>`;
}

const searchBox = (id) => `<form action="obituaries.html" method="get" class="ts-search" role="search"><label for="${id}" class="visually-hidden">Search notices by name</label><i class="fa fa-search"></i><input id="${id}" type="search" name="search" placeholder="Search notices by name" class="form-control" /><button type="submit" class="visually-hidden-focusable ts-search-go">Search</button></form>`;

function obituariesPage() {
  const body = banner("Obituaries &amp; funeral notices", "Remembering lives. Sharing their stories.",
    "Service times, viewings, flowers and livestream links, as printed on each notice. Share a notice on WhatsApp, or leave a message in the condolence book.") + `
<section class="ts-section pt-0"><div class="container">
<div class="d-md-flex justify-content-between align-items-center gap-4 mb-4"><h2 class="mb-3 mb-md-0">In loving memory</h2>${searchBox("ts-search")}</div>
<p class="ts-search-result" role="status"></p>
${grid(people, `Published funeral notices will appear here. For help with a notice, call <a href="${TEL}">${PHONE}</a>.`, "", 4)}
</div></section>`;
  return page({ file: "obituaries.html", title: "Obituaries", desc: "Obituaries and funeral notices from Two Sons Funeral Home, Barbados: service times, viewings, flowers, livestreams and condolences.", body });
}

function livestreamsPage() {
  // A streamed funeral still to come is listed under "Watch a service" too, hidden until its day has passed.
  const streamed = people.filter((p) => p.livestream);
  const block = (title, lede, rows, shown, empty) => `<div class="mb-5" data-list><h2>${title}</h2><p class="ts-lead">${lede}</p>
${rows.join("\n")}
<p class="ts-empty"${shown ? " hidden" : ""} data-empty>${empty}</p></div>`;
  const body = banner("Funerals &amp; livestreams", "Be there, wherever you are.",
    "Service details for the families in our care, and livestream links for those who cannot be with us in person.", "ts-narrow-wide") + `
<section class="ts-section pt-0"><div class="container ts-narrow-wide">
${block("Upcoming services", "Times are as printed on each notice. Please arrive a little early.",
    upcoming.map((p) => serviceRow(p, { cls: "ts-service-row", until: serviceDay(p) })), upcoming.length,
    `There are no services listed right now. If you are expecting details, please call us on <a href="${TEL}">${PHONE}</a>.`)}
${block("Watch a service", "Services that have taken place and were streamed. Links are run by the streaming service and may not stay available.",
    streamed.map((p) => serviceRow(p, { cls: "ts-service-row", after: isPast(p) ? "" : serviceDay(p) })), streamed.filter(isPast).length,
    "No streamed services are listed yet.")}
</div></section>`;
  return page({ file: "livestreams.html", title: "Funerals & livestreams", desc: "Upcoming funeral services arranged by Two Sons Funeral Home, and livestream links for family near and far.", body });
}

function testimonialsPage() {
  const entries = Array.isArray(testimonials.entries) ? testimonials.entries : [];
  const list = entries.length
    ? entries.map((t) => `<blockquote class="ts-condolence">${String(t.message).split(/\n\s*\n/).map((x) => `<p>${esc(x.trim())}</p>`).join("")}<footer>${esc(t.from)}${t.about ? ` &middot; ${esc(t.about)}` : ""}</footer></blockquote>`).join("\n")
    : '<p class="ts-empty">We are gathering messages from the families we have served.</p>';
  const body = banner("Testimonials", "In the words of the families we serve.",
    "Since 1979, Two Sons has cared for Barbadian families of every faith." + (entries.length ? " These are messages from some of them." : ""), "ts-narrow") + `
<section class="ts-section pt-0"><div class="container ts-narrow">
${list}
<div class="ts-panel mt-4" id="feedback">
<p class="ts-eyebrow">Share your experience</p>
<h2>Tell us how we did</h2>
<p>If Two Sons cared for someone you love, we would be grateful to hear how we did, the difficult parts as well as the kind ones. Nothing appears on this page unless you are happy for it to.</p>
<form class="ts-form" data-form="feedback" method="post" action="${FORM_ACTION}">
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<div class="mb-3"><label class="form-label" for="fb-rating">How would you rate our service? (optional)</label>
<select id="fb-rating" name="rating" class="form-select"><option value="" selected>Choose a rating</option><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option></select></div>
<div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="fb-name">Your name</label><input id="fb-name" name="name" class="form-control" required maxlength="200" autocomplete="name" /></div>
<div class="col-sm-6"><label class="form-label" for="fb-about">Who were we caring for? (optional)</label><input id="fb-about" name="relationship" class="form-control" maxlength="200" placeholder="e.g. My mother, Brenda" /></div>
<div class="col-12"><label class="form-label" for="fb-email">Your email (optional, so we can reply)</label><input id="fb-email" name="email" type="email" class="form-control" maxlength="120" autocomplete="email" /></div></div>
<div class="mb-3"><label class="form-label" for="fb-msg">Your message</label><textarea id="fb-msg" name="message" class="form-control" rows="5" maxlength="4000" required></textarea></div>
<button type="submit" class="btn btn-primary">Send your message</button>
<p class="form-note ts-meta mt-2" role="status">Your message goes to Two Sons. We will ask you before showing it here.</p>
</form>
</div>
<p class="ts-meta">You can also write to us at <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
</div></section>`;
  return page({ file: "testimonials.html", title: "Testimonials", desc: entries.length ? "What families say about the care they received from Two Sons Funeral Home, Barbados, and a form to tell us how we did." : "Tell Two Sons Funeral Home, Barbados, how we cared for your family.", body });
}

function flowersPage() {
  const money = (f) => (f.price == null ? "Price on request" : `${f.from ? "From " : ""}US$${f.price}`);
  const funerals = people.filter(takesFlowers).sort((a, b) => String(a.service || "9").localeCompare(String(b.service || "9")));
  const options = funerals.map((p) => {
    const label = esc(p.name) + (p.service ? ` (${esc(shortDate(serviceDay(p)))})` : "");
    return `<option value="${label}" data-slug="${esc(p.slug)}"${p.service ? ` data-until="${serviceDay(p)}"` : ""}>${label}</option>`;
  }).join("");
  const body = banner("Floral tributes", "Flowers for every service",
    "Wreaths, hearts, crosses and lettered tributes such as MUM and GRAN. Order with the funeral, or bring flowers to our chapel by the time shown on the obituary. Floral tributes should be ordered at least two days before the funeral, to ensure on-time delivery. Prices are in US dollars.") + `
<section class="ts-section pt-0"><div class="container">
<h2 class="visually-hidden">Choose a tribute</h2>
<div class="ts-flower-grid">
${flowers.items.map((f, i) => {
    const photo = photoFor("flowers", f.slug);
    const tile = photo && (photoFor("thumbs", f.slug) || photo); // the smaller copy made by tools/images.js
    const picture = photo
      ? `<img src="${tile}"${dims(tile)} alt="${esc(f.name)}" class="img-fluid${f.fit === "contain" ? " ts-contain" : ""}"${i < 3 ? "" : ' loading="lazy"'} />`
      : '<div class="ts-service-art ts-flower-art" aria-hidden="true"><i class="fa fa-leaf"></i></div>';
    return `<div class="ts-panel ts-flower">${picture}<h3>${esc(f.name)}</h3><p class="ts-price">${money(f)}</p>
<a class="btn btn-outline-primary ts-pick" href="#order" data-pick="${esc(f.name)}">Send Flowers<span class="visually-hidden">: ${esc(f.name)}</span></a></div>`;
  }).join("\n")}
</div>
</div></section>
<section class="ts-section ts-alt" id="order"><div class="container ts-narrow">
<h2>Order a tribute</h2>
<p>Send us your order and we will call you to confirm it and take payment.</p>
<form class="ts-panel ts-form" data-form="flowers" method="post" action="${FORM_ACTION}">
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<div class="row g-3">
<div class="col-md-8"><label class="form-label" for="fl-item">Tribute</label><select id="fl-item" name="tribute" class="form-select">${flowers.items.map((f) => `<option>${esc(f.name)} (${money(f)})</option>`).join("")}</select></div>
<div class="col-md-4"><label class="form-label" for="fl-qty">How many</label><input id="fl-qty" name="quantity" type="number" min="1" max="50" value="1" class="form-control" /></div>
<div class="col-12"><label class="form-label" for="fl-for">For the funeral of</label><select id="fl-for" name="funeral" class="form-select" required><option value="" selected disabled>Choose the funeral</option>${options}<option value="Not listed">A funeral not listed here (tell us below)</option></select></div>
<div class="col-12" id="fl-other-row"><label class="form-label" for="fl-other">If the funeral is not listed: the name of the person who has died, and the funeral date</label><input id="fl-other" name="funeral_not_listed" class="form-control" maxlength="200"${funerals.length ? "" : " required"} /></div>
<div class="col-12"><label class="form-label" for="fl-card">Message for the card</label><textarea id="fl-card" name="card_message" class="form-control" rows="3" maxlength="600"></textarea></div>
<div class="col-md-6"><label class="form-label" for="fl-name">Your name</label><input id="fl-name" name="name" class="form-control" required maxlength="200" autocomplete="name" /></div>
<div class="col-md-6"><label class="form-label" for="fl-phone">Your phone number</label><input id="fl-phone" name="phone" type="tel" class="form-control" required maxlength="60" autocomplete="tel" /></div>
<div class="col-12"><label class="form-label" for="fl-email">Your email (optional)</label><input id="fl-email" name="email" type="email" class="form-control" maxlength="120" autocomplete="email" /></div>
</div>
<button type="submit" class="btn btn-primary mt-3">Send Flowers</button>
<p class="form-note ts-meta mt-2" role="status">Please do not put card details here. We take payment by phone.</p>
</form>
</div></section>`;
  return page({ file: "flowers.html", title: "Floral tributes", desc: "Order funeral flowers from Two Sons Funeral Home, Barbados: casket sprays, hearts, crosses and lettered tributes. Prices in US dollars.", body });
}

function quotePage() {
  const tabs = quotes.map((f, i) => `<button type="button" class="ts-tab${i === 0 ? " active" : ""}" data-quote="${f.id}" aria-pressed="${i === 0}">${esc(f.title)}</button>`).join("");
  const control = (item, key) => {
    const opts = item.options || [];
    const note = item.note ? ` aria-describedby="${key}-note"` : "";
    switch (item.type) {
      case "required": return '<span class="ts-included"><i class="fa fa-check me-1"></i>Included</span>';
      case "check": return `<label><input type="checkbox" name="${key}" value="Yes" aria-labelledby="${key}-label"${item.checked ? " checked" : ""} /> Yes</label>`;
      case "choice": return opts.map((o) => `<label><input type="radio" name="${key}" value="${esc(o)}" /> ${esc(o)}</label>`).join("");
      case "multi": return opts.map((o, i) => `<label><input type="checkbox" name="${key}_${i}" value="${esc(o)}" /> ${esc(o)}</label>`).join("");
      case "qty": return `<input type="number" class="form-control ts-num" id="${key}" name="${key}" min="0" step="1" placeholder="0" data-min="${item.min || 0}"${note} />`;
      case "multiqty": return opts.map((o, i) => `<label>${esc(o)} <input type="number" class="form-control ts-num" name="${key}_${i}" data-label="${esc(o)}" min="0" step="1" placeholder="0" /></label>`).join("");
      case "text": return `<input class="form-control" id="${key}" name="${key}" maxlength="200"${item.placeholder ? ` placeholder="${esc(item.placeholder)}"` : ""} />`;
    }
    return "";
  };
  const forms = quotes.map((f, fi) => `<fieldset class="ts-quote-set" data-quote-set="${f.id}"${fi === 0 ? "" : " hidden disabled"}>
<legend class="h2">${esc(f.title)}</legend>
${f.items.map((item, n) => {
    const key = `${f.id}_q${n}`;
    const label = item.type === "qty" || item.type === "text" ? `<label for="${key}">${esc(item.name)}</label>` : `<span id="${key}-label">${esc(item.name)}</span>`;
    const group = ["choice", "multi", "multiqty"].includes(item.type)
      ? ` role="${item.type === "choice" ? "radiogroup" : "group"}" aria-labelledby="${key}-label"${item.note ? ` aria-describedby="${key}-note"` : ""}` : "";
    return `<div class="ts-q-row" data-item="${esc(item.name)}" data-type="${item.type}" data-key="${key}"><div class="ts-q-label">${label}${item.note ? `<span class="ts-q-note" id="${key}-note">${esc(item.note)}</span>` : ""}</div><div class="ts-q-opts"${group}>${control(item, key)}</div></div>`;
  }).join("\n")}
</fieldset>`).join("\n");
  const body = banner("", "Get a quote", "Choose the type of service and tick what you would like. We will call or email you with a price.", "ts-narrow-wide") + `
<section class="ts-section pt-0"><div class="container ts-narrow-wide">
<div class="ts-tabs" role="group" aria-label="Type of service">${tabs}</div>
<form class="ts-panel ts-form ts-quote" data-form="quote" method="post" action="${FORM_ACTION}">
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<input type="hidden" name="quote_type" value="${esc(quotes[0].title)}" />
<div class="ts-q-row"><label class="ts-q-label" for="q-budget">Do you have a budget or price range?</label><input id="q-budget" name="budget" class="form-control" maxlength="200" /></div>
${forms}
<h2 class="h3 mt-4">Your details</h2>
<div class="row g-3">
<div class="col-md-4"><label class="form-label" for="q-name">Your name</label><input id="q-name" name="name" class="form-control" required maxlength="200" autocomplete="name" /></div>
<div class="col-md-4"><label class="form-label" for="q-phone">Phone number</label><input id="q-phone" name="phone" type="tel" class="form-control" required maxlength="60" autocomplete="tel" /></div>
<div class="col-md-4"><label class="form-label" for="q-email">Email (optional)</label><input id="q-email" name="email" type="email" class="form-control" maxlength="120" autocomplete="email" /></div>
<div class="col-12"><label class="form-label" for="q-notes">Anything else we should know?</label><textarea id="q-notes" name="notes" class="form-control" rows="3" maxlength="2000"></textarea></div>
</div>
<button type="submit" class="btn btn-primary mt-4">Send quote request</button>
<p class="form-note ts-meta mt-2" role="status">Your request goes to Two Sons. If you need us now, please call <a href="${TEL}">${PHONE}</a>, 24 hours a day.</p>
</form>
</div></section>`;
  return page({ file: "get-a-quote.html", title: "Get a quote", desc: "Get a funeral quote from Two Sons Funeral Home: burial, cremation, shipment or a memorial service.", body });
}

/* ---------- hand-written pages (content in pages/) ---------- */

const PAGES = [
  ["index.html", "Home", `Two Sons Funeral Home, Bush Hall, St. Michael, Barbados, since 1979. Help 24 hours a day: ${PHONE}. Funeral notices, livestreams, cremation, repatriation.`, false],
  ["about.html", "About us", "Two Sons Funeral Home has served Barbadian families of every faith from Bush Hall, St. Michael since 1979.", true],
  ["services.html", "Services", "Funeral arrangements, chapel and viewings, live streaming, cremation, repatriation and burial at sea from Two Sons Funeral Home, Barbados.", true],
  ["caskets.html", "Casket collection", "Caskets from Two Sons Funeral Home, Bush Hall, St. Michael. Visit or call to talk through styles and finishes.", true],
  ["pre-planning.html", "Pre-planning", "What to do when a death occurs, and how to plan a funeral ahead with Two Sons Funeral Home, Barbados.", false],
  ["gallery.html", "Gallery", "Photos of the Two Sons Funeral Home chapel, fleet and floral work.", true],
  ["contact.html", "Contact us", `Contact Two Sons Funeral Home, Stadium Road, Bush Hall, St. Michael. Help 24 hours a day on ${PHONE}.`, false],
];

const out = {};
for (const [file, title, desc, band] of PAGES) {
  let body = read("pages/" + file).replaceAll("{{PHONE}}", PHONE).replaceAll("{{TEL}}", TEL).replaceAll("{{FORM_ACTION}}", FORM_ACTION);
  if (file === "index.html") {
    body = body.replace(/<!-- upcoming:start -->[\s\S]*?<!-- upcoming:end -->/, "<!-- upcoming:start -->" + upcomingBlock() + "<!-- upcoming:end -->");
    body = body.replace("<!-- notices:home -->", grid(people.slice(0, 3), "New funeral notices will appear here.", "", 0, "ts-notice-grid-3"));
    body = body.replace("<!-- search:home -->", searchBox("ts-home-search"));
  }
  out[file] = page({ file, title, desc, body, band });
}
out["obituaries.html"] = obituariesPage();
out["livestreams.html"] = livestreamsPage();
out["testimonials.html"] = testimonialsPage();
out["flowers.html"] = flowersPage();
out["get-a-quote.html"] = quotePage();
out["404.html"] = page({
  file: "404.html", title: "Page not found", desc: "Page not found.",
  body: banner("", "Page not found", `Sorry, we couldn't find that page. <a href="${SITE}/">Go to the home page</a>, or call us on <a href="${TEL}">${PHONE}</a>.`),
}).replace(/(href|src)="(?!https?:|#|tel:|mailto:)([^"]+)"/g, (m, a, v) => `${a}="${SITE}/${v.replace(/^\.\.\//, "")}"`);

for (const p of people) {
  out[`obituaries/${p.slug}.html`] = memorialPage(p);
  if (p.service) out[`obituaries/${p.slug}.ics`] = ics(p);
}

/* ---------- finishing touches on every page ---------- */

/* Icons are decoration: screen readers skip them. */
const hideIcons = (html) => html.replace(/<i class="(fa [^"]*)"><\/i>/g, '<i class="$1" aria-hidden="true"></i>');
/* Keep "3:30 p.m.", "St. Michael", "26 August" and "(246) 426-1205" on one line,
   in visible text only (not in scripts or attributes). */
const MONTH_WORD = /\b(\d{1,2}) (?=(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b)/g;
const keepTogether = (html) => html.split(/(<script[\s\S]*?<\/script>)/).map((part, i) => (i % 2 ? part
  : part.replace(/>([^<]+)</g, (m, text) => ">" + text.replace(/ (a\.m\.|p\.m\.)/g, "&nbsp;$1").replace(/\bSt\. (?=[A-Z])/g, "St.&nbsp;")
    .replace(MONTH_WORD, "$1&nbsp;").replace(/\((\d{3})\) (?=\d{3}-\d{4})/g, "($1)&nbsp;") + "<"))).join("");

/* ---------- fingerprint local assets (as on Sterling) ----------
   GitHub Pages caches files for ten minutes and that can't be changed, so a
   replaced photo would keep showing the old picture. Every local image, CSS
   and JS link gets ?v=<hash of the file>: change the file, the link changes. */
const hashes = new Map();
function fingerprint(rel) {
  if (!hashes.has(rel)) {
    const abs = path.join(root, rel);
    hashes.set(rel, fs.existsSync(abs) ? crypto.createHash("md5").update(fs.readFileSync(abs)).digest("hex").slice(0, 8) : null);
  }
  return hashes.get(rel);
}
const ASSET = /\b((?:images\/[\w\-\/.]+?\.(?:jpe?g|png|webp|gif|svg))|css\/styles\.css|js\/main\.js)(?:\?v=[0-9a-f]{8})?(?=["'|)\s])/g;
const stamp = (text) => text.replace(ASSET, (whole, rel) => (fingerprint(rel) ? `${rel}?v=${fingerprint(rel)}` : rel));

/* ---------- checks before writing ---------- */
const warn = [];
for (const [rel, html] of Object.entries(out)) {
  if (/ts-todo|____|\[Your |placeholder\.svg/.test(html)) warn.push(`${rel}: placeholder text or a "photo to come" picture is still on the page`);
}
if (!PREVIEW && warn.length) {
  console.error("The build stopped: placeholder text can't go live.\n" + warn.map((w) => "  - " + w).join("\n"));
  process.exit(1);
}

/* ---------- write ---------- */
fs.mkdirSync(path.join(root, "obituaries"), { recursive: true });
for (const [rel, text] of Object.entries(out)) {
  fs.writeFileSync(path.join(root, rel), rel.endsWith(".ics") ? text : stamp(keepTogether(hideIcons(text))));
}
// drop pages of notices that were removed from the data (only after everything else is written)
for (const f of fs.readdirSync(path.join(root, "obituaries"))) {
  if (!out[`obituaries/${f}`]) fs.rmSync(path.join(root, "obituaries", f), { recursive: true, force: true });
}

/* ---------- sitemap and robots ---------- */
const ROOT_PAGES = ["", "obituaries.html", "livestreams.html", "services.html", "caskets.html", "pre-planning.html", "get-a-quote.html", "flowers.html", "about.html", "testimonials.html", "gallery.html", "contact.html"];
const urls = [...ROOT_PAGES.map((f) => `${SITE}/${f}`), ...people.filter((p) => !p.sample).map((p) => `${SITE}/obituaries/${p.slug}.html`)];
fs.writeFileSync(path.join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(root, "robots.txt"), PREVIEW ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

/* ---------- report ---------- */
console.log(`Built ${Object.keys(out).filter((f) => f.endsWith(".html")).length} pages (${people.length} obituaries, ${upcoming.length} upcoming).`);
const noPhoto = people.filter((p) => !photoFor("notices", p.slug) && !flyerFor(p));
if (noPhoto.length) console.log(`Waiting for a flyer (images/notices/flyers/<slug>.jpg): ${noPhoto.map((p) => p.slug).join(", ")}`);
for (const p of people) {
  if (p.service && p.died && serviceDay(p) < p.died) warn.push(`${p.name}: the funeral is before the date of death`);
  if (p.flag) warn.push(`${p.name}: ${p.flag}`);
  if (p.church && p.service && /^Leaves\b/i.test(p.service_start || "") && !p.church_time) warn.push(`${p.name}: the funeral leaves before the church service; add "church_time" if the flyer gives it, or the leaving time is shown as the service time`);
}
// every local picture a page uses must exist (e.g. a gallery thumb not made yet)
const missing = new Set();
for (const [rel, html] of Object.entries(out)) {
  if (rel === "404.html" || rel.endsWith(".ics")) continue;
  for (const m of html.matchAll(/(?:\.\.\/)?(images\/[\w\-\/.]+\.(?:jpe?g|png|webp|gif|svg))/g)) if (!fs.existsSync(path.join(root, m[1]))) missing.add(m[1]);
}
// gallery and home-page copies older than their photo (a photo was replaced)
for (const dir of ["photos", "flowers"]) {
  for (const f of fs.readdirSync(path.join(root, "images", dir)).filter((x) => /\.(jpe?g|png)$/i.test(x))) {
    const t = path.join(root, "images", "thumbs", f.replace(/\.[^.]+$/, "") + ".jpg");
    if (fs.existsSync(t) && fs.statSync(t).mtimeMs < fs.statSync(path.join(root, "images", dir, f)).mtimeMs) warn.push(`images/${dir}/${f} is newer than its small copy: run node tools/images.js, then build again.`);
  }
}
for (const m of missing) warn.push(`${m} is used on a page but the file is missing (new photo? run node tools/images.js)`);
if (people.some((p) => flyerFor(p) && ["cards", "thumbs", "mini", "share"].some((d) => !photoFor("notices/" + d, p.slug)))) {
  warn.push("Some flyers have no small copies yet: run node tools/images.js, then build again.");
}
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir + "/" + e.name;
    if (e.isDirectory()) { if (e.name !== "flyers") walk(rel); continue; }
    if (!/\.(jpe?g|png|webp)$/i.test(e.name)) continue;
    const kb = Math.round(fs.statSync(path.join(root, rel)).size / 1024), d = imageSize(rel);
    const big = d && Math.max(d.w, d.h) > 1600;
    const how = big && /^images\/(photos|flowers)\//.test(rel) ? "run node tools/images.js --shrink, then build again." : "make it smaller (1200 px on the long side is plenty).";
    if (kb > 400 || big) warn.push(`${rel} is ${kb} KB${d ? `, ${d.w}x${d.h}` : ""}: ${how}`);
  }
})("images");
if (PREVIEW) warn.push("PREVIEW is on: the preview bar shows and search engines are told not to index. Turn it off at launch.");
if (people.some((p) => p.sample)) warn.push("Sample notices are in data/obituaries.json. Delete them before launch.");
if (warn.length) console.log("\nCheck:\n" + warn.map((w) => "  - " + w).join("\n"));
