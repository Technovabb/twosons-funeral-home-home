/* Two Sons Funeral Home: small browser helpers. Plain JavaScript, no framework. */

/* Every form marked data-form="..." (condolence, quote, flowers, contact,
   plan_ahead, feedback) posts to FormSubmit, which emails info@. Nothing a
   visitor writes is published automatically: staff read it, and a condolence
   reaches a page only once it is copied into data/condolences.json.

   If the send fails for any reason the message is NOT lost: we fall back to
   opening the visitor's email app with everything filled in. FormSubmit needs
   a one-time activation click before it delivers anything - see FORMS.md. */
var FORM_ENDPOINT = "https://formsubmit.co/ajax/info@twosonsfuneralhome.com";
var FORM_EMAIL = "info@twosonsfuneralhome.com";

var FORM_KINDS = {
  condolence: { subject: "Condolence for {person}", thanks: "Thank you. Your message has been sent to Two Sons, who will pass it to the family. It will appear on this page after a quick check by our staff." },
  quote: { subject: "Quote request: {quote_type} ({name})", thanks: "Thank you, we have your request. We will call or email you with a price, usually within one working day. If you need us now, please call (246) 426-1205." },
  flowers: { subject: "Flower order from {name}", thanks: "Thank you, we have your order. We will call you to confirm it and take payment." },
  plan_ahead: { subject: "Pre-planning request from {name}", thanks: "Thank you. We have your request and will call you to arrange a meeting." },
  contact: { subject: "Website message from {name}", thanks: "Thank you. We have your message and will be in touch soon." },
  feedback: { subject: "Feedback from {name}", thanks: "Thank you for taking the time to write to us. We will ask you before showing anything on the website." },
};

/* The quote form: turn the ticked choices into readable lines for staff. */
function quoteLines(form) {
  var set = form.querySelector(".ts-quote-set:not([hidden])");
  if (!set) return [];
  return Array.prototype.map.call(set.querySelectorAll(".ts-q-row"), function (row) {
    var type = row.getAttribute("data-type"), answer = "-";
    var inputs = row.querySelectorAll("input");
    if (type === "required") answer = "Included";
    else if (type === "check") answer = inputs[0].checked ? "Yes" : "No";
    else if (type === "choice" || type === "multi") {
      var picked = Array.prototype.filter.call(inputs, function (i) { return i.checked; }).map(function (i) { return i.value; });
      answer = picked.join(", ") || "-";
    } else if (type === "qty" || type === "text") answer = inputs[0].value.trim() || (type === "qty" ? "0" : "-");
    else if (type === "multiqty") {
      var bits = Array.prototype.filter.call(inputs, function (i) { return +i.value > 0; }).map(function (i) { return i.getAttribute("data-label") + " x " + i.value; });
      answer = bits.join(", ") || "-";
    }
    return row.getAttribute("data-item") + ": " + answer;
  });
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, function (m, k) { return values[k] || ""; });
}

document.addEventListener("submit", function (event) {
  var form = event.target;
  var kind = form.getAttribute && form.getAttribute("data-form");
  if (!kind) return;
  event.preventDefault();
  var conf = FORM_KINDS[kind] || FORM_KINDS.contact;
  var data = new FormData(form);
  var values = {};
  data.forEach(function (v, k) {
    // quote rows are summarised separately; skip their raw inputs
    if (k === "website" || /_q\d+/.test(k)) return;
    values[k] = String(v).trim();
  });
  values.person = form.getAttribute("data-person") || "";
  values.slug = form.getAttribute("data-slug") || "";
  if (kind === "quote") values.choices = quoteLines(form).join("\n");
  var subject = fill(conf.subject, values);
  var note = form.querySelector(".form-note");
  var button = form.querySelector("button[type=submit]");

  function done() {
    form.classList.add("is-sent");
    form.innerHTML = '<p class="ts-eyebrow">Thank you</p><p class="mb-0">' + conf.thanks + "</p>";
    form.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  // Honeypot: a robot fills it, a person never sees it. Accept and drop.
  if ((data.get("website") || "").toString().trim()) { done(); return; }

  function fallbackToMail() {
    var lines = [subject, ""];
    Object.keys(values).forEach(function (k) {
      if (values[k] && k !== "slug") lines.push(k.replace(/_/g, " ") + ": " + values[k]);
    });
    window.location.href = "mailto:" + FORM_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
    if (note) note.textContent = "Your email app should now be open with the message ready to send.";
  }

  var label = button ? button.innerHTML : "";
  if (button) { button.disabled = true; button.textContent = "Sending…"; }
  var payload = Object.assign({}, values, { _subject: subject, _template: "table", _captcha: "false" });

  fetch(FORM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  })
    // FormSubmit answers 200 OK even when it has NOT delivered (an address not
    // yet activated comes back as {"success":"false"}), so the body decides.
    .then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    })
    .then(function (body) {
      if (String(body && body.success) !== "true") throw new Error("not delivered");
      done();
    })
    .catch(function () {
      if (button) { button.disabled = false; button.innerHTML = label; }
      fallbackToMail();
    });
});

document.addEventListener("DOMContentLoaded", function () {
  var params = new URLSearchParams(location.search);

  // Obituaries: filter the cards by name as you type (and from ?search= on the home page)
  var cards = document.querySelectorAll(".ts-notice-grid .ts-notice-card[data-name]");
  var search = document.getElementById("ts-search");
  var result = document.querySelector(".ts-search-result");
  if (search && result && cards.length) {
    var run = function () {
      var q = search.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var hit = !q || c.getAttribute("data-name").indexOf(q) >= 0;
        c.hidden = !hit;
        if (hit) shown++;
      });
      result.hidden = !q;
      result.textContent = shown + " notice" + (shown === 1 ? "" : "s") + ' found for "' + search.value.trim() + '".';
    };
    search.value = params.get("search") || "";
    search.addEventListener("input", run);
    search.form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
    run();
  }

  // Get a quote: switch between Burial, Cremation, Shipment and Memorial
  var tabs = document.querySelectorAll("[data-quote]");
  var quoteForm = document.querySelector(".ts-quote");
  function showQuote(id) {
    var found = false;
    document.querySelectorAll("[data-quote-set]").forEach(function (set) {
      var on = set.getAttribute("data-quote-set") === id;
      set.hidden = !on;
      set.disabled = !on;
      if (on) {
        found = true;
        quoteForm.querySelector('[name="quote_type"]').value = set.querySelector("legend").textContent;
      }
    });
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-quote") === id;
      t.classList.toggle("active", on);
      t.setAttribute("aria-pressed", on ? "true" : "false");
    });
    return found;
  }
  if (tabs.length && quoteForm) {
    tabs.forEach(function (t) { t.addEventListener("click", function () { showQuote(t.getAttribute("data-quote")); }); });
    if (!showQuote(params.get("type") || "")) showQuote(tabs[0].getAttribute("data-quote"));
  }

  // Flowers: "Send Flowers" on a tribute picks it in the order form; ?for=<slug> picks the funeral
  var item = document.getElementById("fl-item");
  document.querySelectorAll(".ts-pick").forEach(function (b) {
    b.addEventListener("click", function () {
      var want = b.getAttribute("data-pick");
      Array.prototype.forEach.call(item.options, function (o) { if (o.text.indexOf(want + " (") === 0) item.value = o.value; });
    });
  });
  var forSel = document.getElementById("fl-for");
  if (forSel && params.get("for")) forSel.value = params.get("for");

  // Copy link on a notice
  document.querySelectorAll(".ts-copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var link = btn.getAttribute("data-url");
      var ok = function () { btn.innerHTML = '<i class="fa fa-check me-2"></i>Link copied'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, function () { window.prompt("Copy this link:", link); });
      else window.prompt("Copy this link:", link);
    });
  });

  // Minimum orders (e.g. hymn sheets 50): blank or 0 is fine, 1 to 49 is not
  document.addEventListener("input", function (ev) {
    var el = ev.target, min = el.getAttribute && parseInt(el.getAttribute("data-min"), 10);
    if (!min) return;
    var v = parseInt(el.value, 10) || 0;
    el.setCustomValidity(v > 0 && v < min ? "The minimum order is " + min + "." : "");
  });

  // Caskets: click a photo to see it large, with every photo of that casket
  var lightbox = document.getElementById("casket-lightbox");
  var casketCards = document.querySelectorAll(".casket-card");
  if (lightbox && casketCards.length) {
    var img = lightbox.querySelector(".lightbox-image img");
    var prev = lightbox.querySelector(".lightbox-prev"), next = lightbox.querySelector(".lightbox-next");
    var counter = lightbox.querySelector(".lightbox-counter");
    var photos = [], at = 0;
    var show = function () {
      img.src = photos[at];
      var multi = photos.length > 1;
      prev.hidden = next.hidden = counter.hidden = !multi;
      counter.textContent = at + 1 + " / " + photos.length;
    };
    var open = function (card) {
      photos = card.getAttribute("data-images").split("|");
      at = 0;
      img.alt = card.querySelector("img").alt;
      lightbox.querySelector(".lightbox-name").textContent = card.querySelector("h3").textContent;
      lightbox.querySelector(".lightbox-detail").textContent = card.querySelector(".casket-info p").textContent;
      show();
      lightbox.classList.add("open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      lightbox.querySelector(".lightbox-close").focus();
    };
    var close = function () {
      lightbox.classList.remove("open");
      lightbox.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };
    casketCards.forEach(function (card) {
      var wrap = card.querySelector(".casket-image");
      wrap.setAttribute("role", "button");
      wrap.setAttribute("tabindex", "0");
      wrap.setAttribute("aria-label", "View larger photo of " + card.querySelector("h3").textContent);
      wrap.addEventListener("click", function () { open(card); });
      wrap.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(card); } });
    });
    lightbox.querySelector(".lightbox-close").addEventListener("click", close);
    lightbox.querySelector(".lightbox-backdrop").addEventListener("click", close);
    prev.addEventListener("click", function () { at = (at - 1 + photos.length) % photos.length; show(); });
    next.addEventListener("click", function () { at = (at + 1) % photos.length; show(); });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev.click();
      if (e.key === "ArrowRight") next.click();
    });
  }
});
