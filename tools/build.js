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

/* Where the site lives. While it's a preview on GitHub Pages this is the
   github.io address; at launch change it to https://www.twosonsfuneralhome.com
   (and add the CNAME file). Facebook and WhatsApp need absolute og:image links. */
const SITE = "https://technovabb.github.io/twosons-funeral-home-home";

/* true = green "Preview" bar on every page and sample notices shown.
   Set to false at launch, after the samples are deleted from obituaries.json. */
const PREVIEW = true;

const EMAIL = "info@twosonsfuneralhome.com";
const PHONE = "(246) 426-1205";
const TEL = "tel:+12464261205";
const MAPS = "https://www.google.com/maps/search/?api=1&query=Two+Sons+Funeral+Home+Stadium+Road+Bush+Hall+St+Michael+Barbados";

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

let people = json("data/obituaries.json");
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
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(s || "");
  if (!m) return null;
  const wd = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: m[4] == null ? null : +m[4], mi: +(m[5] || 0), wd };
}
const hour = (p) => `${p.h % 12 || 12}:${String(p.mi).padStart(2, "0")} ${p.h < 12 ? "a.m." : "p.m."}`;
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
function viewing(p) {
  if (!p.viewing_start) return "";
  const e = parts(p.viewing_end);
  return longDate(p.viewing_start) + (e && e.h != null ? "–" + hour(e) : "");
}
const today = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10); // Barbados is UTC-4
const serviceDay = (p) => (p.service || "").slice(0, 10);

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
  ["pre-planning.html", "Pre-Planning"],
  ["contact.html", "Contact"],
];

function head({ up = "", file, title, desc, image }) {
  const url = `${SITE}/${file === "index.html" ? "" : file}`;
  const full = file === "index.html" ? "Two Sons Funeral Home | Bush Hall, St. Michael, Barbados" : `${title} | Two Sons Funeral Home`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="icon" type="image/svg+xml" href="${up}images/brand/crest-dark.svg" />
<link rel="canonical" href="${url}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="Two Sons Funeral Home" />
<meta property="og:title" content="${esc(full)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${SITE}/${image || "images/brand/og.png"}" />
<meta name="twitter:card" content="summary_large_image" />
${PREVIEW ? '<meta name="robots" content="noindex" />\n' : ""}<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${up}css/styles.css" />
</head>`;
}

function header(up, current) {
  const links = NAV.map(([href, label]) => {
    const on = href === current;
    return `<li class="nav-item"><a class="nav-link${on ? " active" : ""}"${on ? ' aria-current="page"' : ""} href="${up}${href}">${label}</a></li>`;
  }).join("\n");
  return `<body>
<div id="wrapwrap">
${PREVIEW ? '<div class="ts-preview">Preview website &middot; names and service details are samples</div>\n' : ""}<div class="ts-topbar"><div class="container d-flex align-items-center justify-content-center justify-content-lg-between gap-3">
<a href="${TEL}"><i class="fa fa-phone me-2"></i>Help 24 hours a day <strong>${PHONE}</strong></a>
<a class="d-none d-lg-inline" href="${MAPS}" target="_blank" rel="noopener"><i class="fa fa-map-marker me-2"></i>Stadium Road, Bush Hall, St. Michael</a>
<span class="d-none d-lg-inline"><i class="fa fa-clock-o me-2"></i>Office: Mon&ndash;Fri 8:30&ndash;5 &middot; Sat 9&ndash;2</span>
</div></div>
<header class="ts-header"><nav class="navbar navbar-expand-xl" aria-label="Main"><div class="container">
<a class="navbar-brand" href="${up}index.html" aria-label="Two Sons Funeral Home home"><span class="ts-brand"><img src="${up}images/brand/crest-dark.svg" alt="" width="52" height="47" /><span class="ts-brand-text"><span class="ts-brand-name">Two Sons</span><span class="ts-brand-sub">Funeral Home Ltd &middot; Since 1979</span></span></span></a>
<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#ts-nav" aria-controls="ts-nav" aria-expanded="false" aria-label="Menu"><i class="fa fa-bars me-2"></i>Menu</button>
<div class="collapse navbar-collapse" id="ts-nav"><ul class="navbar-nav ms-auto me-xl-3">
${links}
</ul><a class="btn btn-primary ts-call-btn" href="${TEL}"><i class="fa fa-phone me-2"></i>Call 24 hours</a></div>
</div></nav></header>
<main id="main">`;
}

const contactBand = `<section class="ts-section ts-dark ts-band">
<div class="container d-lg-flex justify-content-between align-items-center gap-4">
<div><p class="ts-eyebrow">Whenever you need us</p><h2>We&rsquo;re here, 24 hours a day.</h2><p class="ts-lead mb-lg-0">When a death occurs, call us at any hour. A member of our team will tell you exactly what happens next.</p></div>
<div class="d-flex flex-wrap gap-2 flex-shrink-0"><a class="btn btn-light btn-lg" href="${TEL}"><i class="fa fa-phone me-2"></i>Call ${PHONE}</a><a class="btn btn-outline-light btn-lg" href="REPLACE_UP" data-band-contact>Send a message</a></div>
</div>
</section>`;

function footer(up) {
  return `</main>
<footer class="ts-footer"><section class="pt-5 pb-3"><div class="container"><div class="row g-4">
<div class="col-lg-3"><img src="${up}images/brand/crest-light.svg" alt="Two Sons crest" width="80" height="72" class="mb-3" />
<p><strong>Two Sons Funeral Home Ltd.</strong><br />Stadium Road, Bush Hall<br />St. Michael, Barbados BB15038</p></div>
<div class="col-6 col-lg-3"><h5>Call us</h5><ul class="list-unstyled">
<li>24 hours: <a href="tel:+12464261205">(246) 426-1205</a></li>
<li>Office: <a href="tel:+12464261206">(246) 426-1206</a></li>
<li>After hours: <a href="tel:+12464331243">(246) 433-1243</a></li>
<li>Fax: (246) 426-9411</li>
<li><a href="mailto:${EMAIL}">${EMAIL}</a></li></ul></div>
<div class="col-6 col-lg-3"><h5>Office hours</h5><ul class="list-unstyled">
<li>Mon&ndash;Fri, 8:30 a.m.&ndash;5:00 p.m.</li><li>Saturday, 9:00 a.m.&ndash;2:00 p.m.</li>
<li>Sunday and public holidays, closed</li><li>Help by phone, 24 hours a day</li></ul></div>
<div class="col-lg-3"><h5>For families</h5><ul class="list-unstyled">
<li><a href="${up}obituaries.html">Obituaries</a></li><li><a href="${up}livestreams.html">Funerals &amp; livestreams</a></li>
<li><a href="${up}pre-planning.html">What to do first</a></li><li><a href="${up}get-a-quote.html">Get a quote</a></li>
<li><a href="${up}flowers.html">Floral tributes</a></li><li><a href="${up}caskets.html">Casket collection</a></li>
<li><a href="${up}gallery.html">Gallery</a></li><li><a href="${up}testimonials.html">Testimonials &amp; feedback</a></li></ul></div>
</div></div></section>
<div class="container ts-copyright">&copy; <span id="year">${new Date().getFullYear()}</span> Two Sons Funeral Home Ltd. All rights reserved.</div>
</footer>
<nav class="ts-mobilebar d-lg-none" aria-label="Quick links">
<a class="ts-mobilebar-call" href="${TEL}"><i class="fa fa-phone"></i>Call 24 hrs</a>
<a href="${up}obituaries.html"><i class="fa fa-file-text-o"></i>Notices</a>
<a href="${up}livestreams.html"><i class="fa fa-video-camera"></i>Funerals</a>
<a href="${MAPS}" target="_blank" rel="noopener"><i class="fa fa-map-marker"></i>Directions</a>
</nav>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script src="${up}js/main.js"></script>
</body>
</html>
`;
}

function page({ up = "", file, title, desc, image, body, band = true }) {
  return head({ up, file, title, desc, image }) + "\n" + header(up, file) + "\n" + body + "\n" +
    (band ? contactBand.replace("REPLACE_UP", up + "contact.html") + "\n" : "") + footer(up);
}

function banner(eyebrow, h1, lead) {
  return `<section class="ts-banner"><div class="container">
${eyebrow ? `<p class="ts-eyebrow">${eyebrow}</p>` : ""}<h1>${h1}</h1>
${lead ? `<p class="ts-lead">${lead}</p>` : ""}
</div></section>`;
}

/* ---------- obituaries ---------- */

function photoFor(dir, slug) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    if (fs.existsSync(path.join(root, "images", dir, slug + ext))) return `images/${dir}/${slug}${ext}`;
  }
  return null;
}
const meta = (p) => [p.age ? `Aged ${p.age}` : "", p.late_of ? `Late of ${esc(p.late_of)}` : ""].filter(Boolean).join(" &middot; ");

function oval(p, up, large) {
  const photo = photoFor("notices", p.slug);
  return `<div class="ts-oval${large ? " ts-oval-lg" : ""}">${
    photo ? `<img src="${up}${photo}" alt="${esc(p.name)}"${large ? "" : ' loading="lazy"'} />` : `<img src="${up}images/brand/dove.svg" alt="" />`
  }</div>`;
}

function card(p, up = "") {
  const pills = [
    p.livestream ? '<span class="ts-pill ts-pill-dark"><i class="fa fa-video-camera me-1"></i>Livestream</span>' : "",
    p.viewing_start ? `<span class="ts-pill"><i class="fa fa-eye me-1"></i>Viewing ${shortDate(p.viewing_start)}</span>` : "",
    !p.viewing_start && p.flowers_by ? `<span class="ts-pill"><i class="fa fa-leaf me-1"></i>Flowers by ${esc(p.flowers_by.replace(" on the day", ""))}</span>` : "",
  ].join("");
  return `<a class="ts-notice-card" href="${up}obituaries/${p.slug}.html" data-name="${esc((p.name + " " + (p.aka || "")).toLowerCase())}">
${p.sample ? '<span class="ts-sample">Sample</span>' : ""}${oval(p, up)}
<p class="ts-eyebrow">In loving memory of</p>
<h3 class="ts-name">${esc(p.name)}</h3>
<p class="ts-meta">${meta(p)}</p>
${p.service ? `<p class="ts-when">Funeral: ${longDate(p.service)}</p>` : ""}
<p class="ts-meta">${esc(p.church || p.service_start || "")}</p>
<div class="ts-pills">${pills}</div>
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
    : '<p class="ts-meta">No messages have been published yet. Yours would be the first.</p>';
  const subject = encodeURIComponent(`Condolence for ${p.name}`);
  return `<div class="ts-panel" id="condolences">
<h2>Condolence book</h2>
${list}
<form class="ts-form mt-4" data-form="condolence" data-person="${esc(p.name)}" data-slug="${esc(p.slug)}">
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<div class="mb-3"><label class="form-label" for="c-msg">Your message</label><textarea id="c-msg" name="message" class="form-control" rows="4" maxlength="4000" required placeholder="Write a few words for the family"></textarea></div>
<div class="row g-3 mb-3">
<div class="col-sm-6"><label class="form-label" for="c-name">Your name</label><input id="c-name" name="name" class="form-control" maxlength="120" required /></div>
<div class="col-sm-6"><label class="form-label" for="c-rel">How you knew them (optional)</label><input id="c-rel" name="relationship" class="form-control" maxlength="120" placeholder="e.g. A neighbour" /></div>
<div class="col-12"><label class="form-label" for="c-email">Your email (optional, so the family can reply)</label><input id="c-email" name="email" type="email" class="form-control" maxlength="120" /></div>
</div>
<button type="submit" class="btn btn-primary"><i class="fa fa-pencil me-2"></i>Post in the condolence book</button>
<p class="form-note ts-meta mt-2" role="status">Your message goes to Two Sons, who pass it to the family. It appears here after a quick check by our staff.</p>
</form>
<p class="ts-meta mt-3 mb-0">Would you rather write privately? <a href="mailto:${EMAIL}?subject=${subject}">Email the family through Two Sons</a> and nothing is published.</p>
</div>`;
}

function memorialPage(p) {
  const up = "../";
  const file = `obituaries/${p.slug}.html`;
  const photo = photoFor("notices", p.slug);
  const share = `${SITE}/${file}`;
  const shareText = `In loving memory of ${p.name}.` + (p.service ? ` Funeral: ${longDate(p.service)}.` : "");
  const place = p.church || "Two Sons Funeral Home, Stadium Road, Bush Hall, St. Michael, Barbados";
  const desc = `${p.name}${p.aka ? `, also known as ${p.aka}` : ""}. ` + (p.service ? `Funeral ${longDate(p.service)}.` : "Funeral details from Two Sons Funeral Home.");
  const facts = [
    p.service ? `<li><i class="fa fa-calendar"></i><div><strong>${longDate(p.service)}</strong><br />${esc(p.service_start || "")}</div></li>` : "",
    p.church ? `<li><i class="fa fa-building-o"></i><div><strong>Service${p.church_time ? ", " + esc(p.church_time) : ""}</strong><br />${esc(p.church)}${p.church_note ? ", " + esc(p.church_note) : ""}</div></li>` : "",
    p.interment ? `<li><i class="fa fa-map-marker"></i><div><strong>Interment</strong><br />${esc(p.interment)}</div></li>` : "",
    !p.service ? '<li><i class="fa fa-info-circle"></i><div>Funeral arrangements will be announced here.</div></li>' : "",
  ].join("\n");
  const serviceDayName = parts(p.service) ? DAYS[parts(p.service).wd] : "";
  const live = p.livestream && serviceDay(p) >= today;

  const body = `<div class="ts-page ts-notice-page"><div class="container ts-narrow py-4">
<p><a href="../obituaries.html" class="ts-back"><i class="fa fa-arrow-left me-2"></i>All obituaries</a></p>
<div class="ts-panel text-center position-relative">
${p.sample ? '<span class="ts-sample">Sample notice</span>' : ""}${oval(p, up, true)}
<p class="ts-eyebrow">In loving memory of</p>
<h1 class="ts-name ts-name-lg">${esc(p.name)}</h1>
${p.aka ? `<p class="ts-meta mb-1">also known as &ldquo;${esc(p.aka)}&rdquo;</p>` : ""}
<p class="ts-meta">${meta(p)}</p>
<div class="d-flex flex-wrap justify-content-center gap-2 mt-3">
<a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(shareText + " " + share)}"><i class="fa fa-whatsapp me-2"></i>Share on WhatsApp</a>
<a class="btn btn-outline-primary" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(share)}"><i class="fa fa-facebook me-2"></i>Facebook</a>
<button type="button" class="btn btn-outline-primary ts-copy" data-url="${esc(share)}"><i class="fa fa-link me-2"></i>Copy link</button>
</div>
</div>
<div class="ts-panel">
<h2>The funeral</h2>
<ul class="ts-facts">
${facts}
</ul>
<div class="d-grid gap-2 d-sm-flex">
<a class="btn btn-outline-primary" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(place)}" target="_blank" rel="noopener"><i class="fa fa-location-arrow me-2"></i>Directions</a>
${p.service ? `<a class="btn btn-outline-primary" href="${p.slug}.ics" download><i class="fa fa-calendar-plus-o me-2"></i>Add to calendar</a>` : ""}
</div>
</div>
${p.livestream ? `<div class="ts-panel ts-panel-dark">
${live ? `<span class="ts-live-tag">&#9679; Live ${serviceDayName}</span>` : ""}
<h2>${live ? "Watch the service live" : "Watch the service"}</h2>
<p>${p.service ? `${live ? "Starts" : "Streamed"} ${longDate(p.service)}. ` : ""}One link for everyone, at home and abroad.</p>
<a class="btn btn-light" href="${esc(p.livestream.url)}" target="_blank" rel="noopener"><i class="fa fa-video-camera me-2"></i>Open livestream</a>
${p.livestream.label ? `<p class="ts-meta mt-2 mb-0" style="color:#c9c9c5">Streamed by ${esc(p.livestream.label)}</p>` : ""}
</div>` : ""}
<div class="ts-panel">
<h2>Viewing and flowers</h2>
<ul class="ts-facts">
${p.viewing_start ? `<li><i class="fa fa-eye"></i><div><strong>Viewing: ${viewing(p)}</strong><br />${esc(p.viewing_place || "")}</div></li>` : ""}
${p.flowers_by ? `<li><i class="fa fa-leaf"></i><div><strong>Flowers by ${esc(p.flowers_by)}</strong><br />Deliver to our chapel, or order a tribute from us.</div></li>` : ""}
</ul>
<div class="d-grid gap-2">
<a class="btn btn-primary" href="../flowers.html?for=${encodeURIComponent(p.slug)}"><i class="fa fa-leaf me-2"></i>Order flowers</a>
<a class="btn btn-outline-primary" href="#condolences"><i class="fa fa-pencil me-2"></i>Sign the book</a>
</div>
</div>
${p.family && p.family.length ? `<div class="ts-panel ts-family"><h2>Family</h2>\n${familyList(p.family)}\n</div>` : ""}
${p.obituary && p.obituary.length ? `<div class="ts-panel"><h2>Obituary</h2>\n${p.obituary.map((x) => `<p>${esc(x)}</p>`).join("\n")}\n</div>` : ""}
${condolenceSection(p)}
<p class="ts-meta">Professional services entrusted to Two Sons Funeral Home Ltd., Stadium Road, Bush Hall, St. Michael.</p>
</div></div>`;
  return page({ up, file, title: `${p.name} | Obituaries`, desc, image: photo, body });
}

function ics(p) {
  const s = parts(p.service);
  const pad = (x) => String(x).padStart(2, "0");
  const start = new Date(Date.UTC(s.y, s.mo, s.d, (s.h == null ? 10 : s.h) + 4, s.mi));
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  const f = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const e = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Two Sons Funeral Home//Notices//EN", "BEGIN:VEVENT",
    `UID:${p.slug}@twosonsfuneralhome.com`, `DTSTAMP:${f(start)}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${e("Funeral of " + p.name)}`, `LOCATION:${e(p.church || "Two Sons Funeral Home, Stadium Road, Bush Hall, St. Michael")}`,
    `URL:${SITE}/obituaries/${p.slug}.html`, "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}

/* newest funeral first */
people.sort((a, b) => String(b.service || b.died || "").localeCompare(String(a.service || a.died || "")));
const upcoming = people.filter((p) => p.service && serviceDay(p) >= today).sort((a, b) => a.service.localeCompare(b.service));

function upcomingBlock() {
  // Omitted entirely when nothing is coming up: an empty "Upcoming funerals" heading reads as neglect.
  if (!upcoming.length) return "";
  const row = (p) => `<article class="ts-upcoming-row">
<div><h3><a href="obituaries/${p.slug}.html">${esc(p.name)}</a>${p.sample ? ' <span class="ts-sample ts-sample-inline">Sample</span>' : ""}</h3>
<p class="ts-when mb-0">${longDate(p.service)}</p>
<p class="ts-meta mb-0">${esc(p.church || p.service_start || "")}</p></div>
${p.livestream ? `<a class="btn btn-primary" href="${esc(p.livestream.url)}" target="_blank" rel="noopener"><i class="fa fa-video-camera me-2"></i>Watch live</a>` : ""}
</article>`;
  return `<section class="ts-section ts-upcoming" aria-label="Upcoming funerals"><div class="container">
<div class="d-md-flex justify-content-between align-items-end mb-3"><div><p class="ts-eyebrow">Upcoming funerals</p><h2 class="mb-0">Services still to come</h2></div>
<a class="ts-link" href="livestreams.html">All funerals and livestreams <i class="fa fa-arrow-right ms-1"></i></a></div>
${upcoming.slice(0, 4).map(row).join("\n")}
</div></section>`;
}

function grid(list, empty, up = "") {
  return list.length ? `<div class="ts-notice-grid">\n${list.map((p) => card(p, up)).join("\n")}\n</div>` : `<p class="ts-empty">${empty}</p>`;
}

const searchBox = `<form action="obituaries.html" method="get" class="ts-search" role="search"><label for="ts-search" class="visually-hidden">Search notices by name</label><i class="fa fa-search"></i><input id="ts-search" type="search" name="search" placeholder="Search notices by name" class="form-control" /></form>`;

function obituariesPage() {
  const body = banner("Obituaries &amp; funeral notices", "Remembering lives. Sharing their stories.",
    "Service times, viewings, flowers and livestream links, all in one place. Share a notice on WhatsApp, or leave a message in the condolence book.") + `
<section class="ts-section pt-0"><div class="container">
<div class="d-md-flex justify-content-between align-items-center gap-4 mb-4"><h2 class="mb-3 mb-md-0">In loving memory</h2>${searchBox}</div>
<p class="ts-search-result mb-4" hidden></p>
${grid(people, "Published funeral notices will appear here. For help with a notice, call " + PHONE + ".")}
</div></section>`;
  return page({ file: "obituaries.html", title: "Obituaries", desc: "Obituaries and funeral notices from Two Sons Funeral Home, Barbados: service times, viewings, flowers, livestreams and condolences.", body });
}

function livestreamsPage() {
  const watch = people.filter((p) => p.livestream && !(p.service && serviceDay(p) >= today));
  const row = (p) => `<article class="ts-service-row">
<a class="ts-service-face" href="obituaries/${p.slug}.html" aria-label="View the notice for ${esc(p.name)}">${oval(p, "")}</a>
<div class="ts-service-detail"><h3><a href="obituaries/${p.slug}.html">${esc(p.name)}</a>${p.sample ? ' <span class="ts-sample ts-sample-inline">Sample</span>' : ""}</h3>
<p class="ts-when mb-0">${p.service ? longDate(p.service) : "Details available on request"}</p>
<p class="ts-meta mb-0">${esc(p.church || p.service_start || "")}</p></div>
${p.livestream ? `<a class="btn btn-primary" href="${esc(p.livestream.url)}" target="_blank" rel="noopener"><i class="fa fa-video-camera me-2"></i>Watch</a>` : '<span class="ts-meta">No livestream</span>'}
</article>`;
  const block = (title, lede, rows, empty) => `<div class="mb-5"><h2>${title}</h2><p class="ts-lead">${lede}</p>
${rows.length ? rows.map(row).join("\n") : `<p class="ts-empty">${empty}</p>`}</div>`;
  const body = banner("Funerals &amp; livestreams", "Be there, wherever you are.",
    "Service details for the families in our care, and livestream links for those who cannot be with us in person.") + `
<section class="ts-section pt-0"><div class="container ts-narrow-wide">
${block("Upcoming services", "Services still to come. Please arrive a little early.", upcoming, "There are no services scheduled right now. Please call us if you are expecting details.")}
${block("Watch a service", "Services that have taken place and were streamed. Links may not stay available forever.", watch, "No streamed services are listed yet.")}
</div></section>`;
  return page({ file: "livestreams.html", title: "Funerals & livestreams", desc: "Upcoming funeral services arranged by Two Sons Funeral Home, and livestream links for family near and far.", body });
}

function testimonialsPage() {
  const entries = Array.isArray(testimonials.entries) ? testimonials.entries : [];
  const list = entries.length
    ? entries.map((t) => `<blockquote class="ts-condolence">${String(t.message).split(/\n\s*\n/).map((x) => `<p>${esc(x.trim())}</p>`).join("")}<footer>${esc(t.from)}${t.about ? ` &middot; ${esc(t.about)}` : ""}</footer></blockquote>`).join("\n")
    : '<p class="ts-empty">We are gathering messages from the families we have served. If Two Sons cared for someone you love, yours could be the first.</p>';
  const body = banner("Testimonials", "In the words of the families we serve.",
    "Since 1979, Two Sons has cared for Barbadian families of every faith. These are messages from some of them.") + `
<section class="ts-section pt-0"><div class="container ts-narrow">
${list}
<div class="ts-panel mt-4" id="feedback">
<p class="ts-eyebrow">Share your experience</p>
<h2>Tell us how we did</h2>
<p>If Two Sons cared for someone you love, we would be grateful to hear how we did, the difficult parts as well as the kind ones. Nothing appears on this page unless you are happy for it to.</p>
<form class="ts-form" data-form="feedback">
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<div class="mb-3"><label class="form-label" for="fb-rating">How would you rate our service?</label>
<select id="fb-rating" name="rating" class="form-select"><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option></select></div>
<div class="row g-3 mb-3"><div class="col-sm-6"><label class="form-label" for="fb-name">Your name</label><input id="fb-name" name="name" class="form-control" required maxlength="200" /></div>
<div class="col-sm-6"><label class="form-label" for="fb-about">Who were we caring for? (optional)</label><input id="fb-about" name="relationship" class="form-control" maxlength="200" placeholder="e.g. My mother, Brenda" /></div>
<div class="col-12"><label class="form-label" for="fb-email">Your email (optional, so we can reply)</label><input id="fb-email" name="email" type="email" class="form-control" maxlength="120" /></div></div>
<div class="mb-3"><label class="form-label" for="fb-msg">Your message</label><textarea id="fb-msg" name="message" class="form-control" rows="5" maxlength="4000" required></textarea></div>
<button type="submit" class="btn btn-primary">Send your message</button>
<p class="form-note ts-meta mt-2" role="status">Your message goes to Two Sons. We will ask you before showing it here.</p>
</form>
</div>
</div></section>`;
  return page({ file: "testimonials.html", title: "Testimonials", desc: "What families say about the care they received from Two Sons Funeral Home, Barbados.", body });
}

function flowersPage() {
  const money = (f) => (f.price == null ? "Price on request" : `${f.from ? "From " : ""}US$${f.price}`);
  const options = people.filter((p) => !p.service || serviceDay(p) >= today)
    .map((p) => `<option value="${esc(p.slug)}">${esc(p.name)}${p.service ? " (" + esc(shortDate(p.service)) + ")" : ""}</option>`).join("");
  const body = banner("Floral tributes", "Flowers for every service",
    "Casket sprays, hearts, crosses and lettered tributes such as MUM and GRAN. Order with the funeral, or have flowers delivered to our chapel by 1 p.m. on the day. Prices are in US dollars.") + `
<section class="ts-section pt-0"><div class="container">
<div class="ts-flower-grid">
${flowers.items.map((f) => {
    const photo = photoFor("flowers", f.slug) || "images/brand/placeholder.svg";
    return `<div class="ts-panel ts-flower"><img src="${photo}" alt="${esc(f.name)}" class="img-fluid" loading="lazy" /><h3>${esc(f.name)}</h3><p class="ts-price">${money(f)}</p>
<a class="btn btn-outline-primary ts-pick" href="#order" data-pick="${esc(f.name)}">Send Flowers</a></div>`;
  }).join("\n")}
</div>
</div></section>
<section class="ts-section ts-alt" id="order"><div class="container ts-narrow">
<h2>Order a tribute</h2>
<p>Send us your order and we will call you to confirm it and take payment.</p>
<form class="ts-panel ts-form" data-form="flowers">
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<div class="row g-3">
<div class="col-md-8"><label class="form-label" for="fl-item">Tribute</label><select id="fl-item" name="tribute" class="form-select">${flowers.items.map((f) => `<option>${esc(f.name)} (${money(f)})</option>`).join("")}</select></div>
<div class="col-md-4"><label class="form-label" for="fl-qty">How many</label><input id="fl-qty" name="quantity" type="number" min="1" value="1" class="form-control" /></div>
<div class="col-12"><label class="form-label" for="fl-for">For the funeral of</label><select id="fl-for" name="funeral" class="form-select">${options}<option value="">Someone else (put the name in the card message)</option></select></div>
<div class="col-12"><label class="form-label" for="fl-card">Message for the card</label><textarea id="fl-card" name="card_message" class="form-control" rows="3" maxlength="600"></textarea></div>
<div class="col-md-6"><label class="form-label" for="fl-name">Your name</label><input id="fl-name" name="name" class="form-control" required maxlength="200" autocomplete="name" /></div>
<div class="col-md-6"><label class="form-label" for="fl-phone">Your phone number</label><input id="fl-phone" name="phone" type="tel" class="form-control" required maxlength="60" autocomplete="tel" /></div>
<div class="col-12"><label class="form-label" for="fl-email">Your email (optional)</label><input id="fl-email" name="email" type="email" class="form-control" maxlength="120" autocomplete="email" /></div>
</div>
<button type="submit" class="btn btn-primary mt-3">Send Flowers</button>
<p class="form-note ts-meta mt-2" role="status">Your order goes to Two Sons. We will call you to confirm and take payment.</p>
</form>
</div></section>`;
  return page({ file: "flowers.html", title: "Floral tributes", desc: "Order funeral flowers from Two Sons Funeral Home, Barbados: casket sprays, hearts, crosses and lettered tributes. Prices in US dollars.", body });
}

function quotePage() {
  const tabs = quotes.map((f, i) => `<button type="button" class="ts-tab${i === 0 ? " active" : ""}" data-quote="${f.id}" aria-pressed="${i === 0}">${esc(f.title)}</button>`).join("");
  const control = (item, key) => {
    const opts = item.options || [];
    switch (item.type) {
      case "required": return '<span class="ts-included"><i class="fa fa-check me-1"></i>Included</span>';
      case "check": return `<label><input type="checkbox" name="${key}"${item.checked ? " checked" : ""} /> Yes</label>`;
      case "choice": return opts.map((o) => `<label><input type="radio" name="${key}" value="${esc(o)}" /> ${esc(o)}</label>`).join("");
      case "multi": return opts.map((o, i) => `<label><input type="checkbox" name="${key}_${i}" value="${esc(o)}" /> ${esc(o)}</label>`).join("");
      case "qty": return `<input type="number" class="form-control ts-num" id="${key}" name="${key}" min="0" step="1" placeholder="0" data-min="${item.min || 0}" />`;
      case "multiqty": return opts.map((o, i) => `<label>${esc(o)} <input type="number" class="form-control ts-num" name="${key}_${i}" data-label="${esc(o)}" min="0" step="1" placeholder="0" /></label>`).join("");
      case "text": return `<input class="form-control" id="${key}" name="${key}" maxlength="200" />`;
    }
    return "";
  };
  const forms = quotes.map((f, fi) => `<fieldset class="ts-quote-set" data-quote-set="${f.id}"${fi === 0 ? "" : " hidden"}>
<legend class="h2">${esc(f.title)}</legend>
${f.items.map((item, n) => {
    const key = `${f.id}_q${n}`;
    const label = item.type === "qty" || item.type === "text" ? `<label for="${key}">${esc(item.name)}</label>` : esc(item.name);
    return `<div class="ts-q-row" data-item="${esc(item.name)}" data-type="${item.type}" data-key="${key}"><div class="ts-q-label">${label}${item.note ? `<span class="ts-q-note">${esc(item.note)}</span>` : ""}</div><div class="ts-q-opts">${control(item, key)}</div></div>`;
  }).join("\n")}
</fieldset>`).join("\n");
  const body = banner("", "Get a quote", "Choose the type of service and tick what you would like. We will reply with a price, usually within one working day.") + `
<section class="ts-section pt-0"><div class="container ts-narrow-wide">
<div class="ts-tabs" role="group" aria-label="Type of service">${tabs}</div>
<form class="ts-panel ts-form ts-quote" data-form="quote">
<div class="ts-trap" aria-hidden="true"><label>Leave empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
<input type="hidden" name="quote_type" value="${esc(quotes[0].title)}" />
<div class="ts-q-row"><label class="ts-q-label" for="q-budget">Do you have a budget or price range?</label><input id="q-budget" name="budget" class="form-control" maxlength="200" /></div>
${forms}
<h3 class="mt-4">Your details</h3>
<div class="row g-3">
<div class="col-md-4"><label class="form-label" for="q-name">Your name</label><input id="q-name" name="name" class="form-control" required maxlength="200" autocomplete="name" /></div>
<div class="col-md-4"><label class="form-label" for="q-phone">Phone number</label><input id="q-phone" name="phone" type="tel" class="form-control" required maxlength="60" autocomplete="tel" /></div>
<div class="col-md-4"><label class="form-label" for="q-email">Email (optional)</label><input id="q-email" name="email" type="email" class="form-control" maxlength="120" autocomplete="email" /></div>
<div class="col-12"><label class="form-label" for="q-notes">Anything else we should know?</label><textarea id="q-notes" name="notes" class="form-control" rows="3" maxlength="2000"></textarea></div>
</div>
<button type="submit" class="btn btn-primary mt-4">Send quote request</button>
<p class="form-note ts-meta mt-2" role="status">Your request goes to Two Sons. If you need us now, please call ${PHONE}, 24 hours a day.</p>
</form>
</div></section>`;
  return page({ file: "get-a-quote.html", title: "Get a quote", desc: "Get a funeral quote from Two Sons Funeral Home: burial, cremation, shipment or a memorial service.", body });
}

/* ---------- hand-written pages (content in pages/) ---------- */

const PAGES = [
  ["index.html", "Home", "Two Sons Funeral Home, Stadium Road, Bush Hall, St. Michael, Barbados. Help 24 hours a day on (246) 426-1205. Funeral notices, livestreams, funerals, cremation, repatriation and floral tributes since 1979.", true],
  ["about.html", "About us", "Two Sons Funeral Home has served Barbadian families of every faith from Bush Hall, St. Michael since 1979.", true],
  ["services.html", "Services", "Funeral arrangements, chapel and viewings, live streaming, cremation, repatriation, burial at sea and limousines from Two Sons Funeral Home, Barbados.", true],
  ["caskets.html", "Casket collection", "Caskets from Two Sons Funeral Home, Bush Hall, St. Michael. Visit or call to talk through styles and finishes.", true],
  ["pre-planning.html", "Pre-planning", "What to do when a death occurs, and how to plan a funeral ahead with Two Sons Funeral Home, Barbados.", false],
  ["gallery.html", "Gallery", "Photos of the Two Sons Funeral Home chapel, fleet and floral work.", true],
  ["contact.html", "Contact us", "Contact Two Sons Funeral Home, Stadium Road, Bush Hall, St. Michael. Help 24 hours a day on (246) 426-1205.", false],
];

const out = {};
for (const [file, title, desc, band] of PAGES) {
  let body = read("pages/" + file);
  if (file === "index.html") {
    body = body.replace(/<!-- upcoming:start -->[\s\S]*?<!-- upcoming:end -->/, "<!-- upcoming:start -->" + upcomingBlock() + "<!-- upcoming:end -->");
    body = body.replace("<!-- notices:home -->", grid(people.slice(0, 3), "New funeral notices will appear here."));
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
  body: banner("", "Page not found", `Sorry, we couldn't find that page. <a href="${SITE}/">Go to the home page</a>, or call us on ${PHONE}.`),
}).replace(/(href|src)="(?!https?:|#|tel:|mailto:)([^"]+)"/g, (m, a, v) => `${a}="${SITE}/${v.replace(/^\.\.\//, "")}"`);

fs.mkdirSync(path.join(root, "obituaries"), { recursive: true });
for (const f of fs.readdirSync(path.join(root, "obituaries"))) fs.unlinkSync(path.join(root, "obituaries", f)); // drop removed notices
for (const p of people) {
  out[`obituaries/${p.slug}.html`] = memorialPage(p);
  if (p.service) fs.writeFileSync(path.join(root, "obituaries", p.slug + ".ics"), ics(p));
}

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

for (const [rel, html] of Object.entries(out)) fs.writeFileSync(path.join(root, rel), stamp(html));

/* ---------- sitemap and robots ---------- */
const ROOT_PAGES = ["", "obituaries.html", "livestreams.html", "services.html", "caskets.html", "pre-planning.html", "get-a-quote.html", "flowers.html", "about.html", "testimonials.html", "gallery.html", "contact.html"];
const urls = [...ROOT_PAGES.map((f) => `${SITE}/${f}`), ...people.filter((p) => !p.sample).map((p) => `${SITE}/obituaries/${p.slug}.html`)];
fs.writeFileSync(path.join(root, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(root, "robots.txt"), PREVIEW ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

/* ---------- report ---------- */
console.log(`Built ${Object.keys(out).length} pages (${people.length} obituaries, ${upcoming.length} upcoming).`);
const noPhoto = people.filter((p) => !photoFor("notices", p.slug));
if (noPhoto.length) console.log(`Waiting for a photo (images/notices/<slug>.jpg): ${noPhoto.map((p) => p.slug).join(", ")}`);
const warn = [];
for (const p of people) {
  if (!p.slug || !/^[a-z0-9-]+$/.test(p.slug)) warn.push(`${p.name}: slug must be lower-case letters, numbers and dashes`);
  if (p.service && !parts(p.service)) warn.push(`${p.name}: service must look like 2026-10-14T13:15`);
  if (p.service && p.died && serviceDay(p) < p.died) warn.push(`${p.name}: the funeral is before the date of death`);
  if (p.flag) warn.push(`${p.name}: ${p.flag}`);
}
if (PREVIEW) warn.push("PREVIEW is on: the preview bar shows and search engines are told not to index. Turn it off at launch.");
if (people.some((p) => p.sample)) warn.push("Sample notices are in data/obituaries.json. Delete them before launch.");
if (warn.length) console.log("\nCheck:\n" + warn.map((w) => "  - " + w).join("\n"));
