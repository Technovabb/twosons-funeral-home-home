/* Two Sons Funeral Home: small browser helpers. Plain JavaScript, no framework. */

/* Every form marked data-form="..." (condolence, quote, flowers, contact,
   plan_ahead, feedback) posts to FormSubmit, which emails info@. Nothing a
   visitor writes is published automatically: staff read it, and a condolence
   reaches a page only once it is copied into data/condolences.json.

   If the send fails for any reason the message is NOT lost: we fall back to
   opening the visitor's email app with everything filled in, and say so
   plainly. FormSubmit needs a one-time activation click before it delivers
   anything - see FORMS.md. */
var FORM_ENDPOINT = "https://formsubmit.co/ajax/info@twosonsfuneralhome.com";
var FORM_EMAIL = "info@twosonsfuneralhome.com";
var FORM_PHONE = "(246)\u00a0426-1205"; // non-breaking space: the number never splits across lines
var FORM_TEL = "tel:+12464261205";

var FORM_KINDS = {
  condolence: { subject: "Condolence for {person}", thanks: "Your message has been sent to Two Sons, and we will pass it to the family. Some messages are added to this page after our staff have read them." },
  quote: { subject: "Quote request: {quote_type} ({name})", sent: "Request sent", thanks: 'We have your request. We will call or email you with a price. <a href="get-a-quote.html">Ask for another quote</a>.' },
  flowers: { subject: "Flower order from {name}", sent: "Order sent", thanks: "We have your order. We will call you to confirm it and take payment." },
  plan_ahead: { subject: "Pre-planning request from {name}", sent: "Request sent", thanks: "We have your request and will call you to arrange a meeting." },
  contact: { subject: "Website message from {name}", thanks: "We have your message and will be in touch soon." },
  feedback: { subject: "Feedback from {name}", thanks: "Thank you for taking the time to write to us. We will ask you before showing anything on the website." },
};

/* Today in Barbados (UTC-4 all year), as YYYY-MM-DD */
function barbadosToday() {
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/* Search key: no accents, plain apostrophes, lower case (matches fold() in tools/build.js) */
function fold(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’]/g, "'").toLowerCase();
}

/* The quote form: turn the answered choices into readable lines for staff. */
function quoteLines(form) {
  var set = form.querySelector(".ts-quote-set:not([hidden])");
  if (!set) return [];
  return Array.prototype.map.call(set.querySelectorAll(".ts-q-row"), function (row) {
    var type = row.getAttribute("data-type"), answer = "";
    var inputs = row.querySelectorAll("input");
    if (type === "required") answer = "Included";
    else if (type === "check") answer = inputs[0].checked ? "Yes" : inputs[0].defaultChecked ? "No" : "";
    else if (type === "choice" || type === "multi") {
      answer = Array.prototype.filter.call(inputs, function (i) { return i.checked; }).map(function (i) { return i.value; }).join(", ");
    } else if (type === "qty") answer = +inputs[0].value > 0 ? inputs[0].value.trim() : "";
    else if (type === "text") answer = inputs[0].value.trim();
    else if (type === "multiqty") {
      answer = Array.prototype.filter.call(inputs, function (i) { return +i.value > 0; }).map(function (i) { return i.getAttribute("data-label") + " x " + i.value; }).join(", ");
    }
    return answer ? row.getAttribute("data-item") + ": " + answer : null;
  }).filter(Boolean);
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, function (m, k) { return values[k] || ""; });
}

var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("submit", function (event) {
  var form = event.target;
  var kind = form.getAttribute && form.getAttribute("data-form");
  if (!kind) return;
  event.preventDefault();
  var conf = FORM_KINDS[kind] || FORM_KINDS.contact;
  var data = new FormData(form);
  var values = {};
  if (kind === "quote") {
    // the service type and the choices first, so staff see them at the top of the email
    values.quote_type = String(data.get("quote_type") || "");
    var qLines = quoteLines(form);
    if (qLines.length) values.choices = qLines.join("\n");
  }
  data.forEach(function (v, k) {
    // quote rows are summarised above; skip their raw inputs, the honeypot and empty fields
    if (k === "website" || /_q\d+/.test(k) || !String(v).trim()) return;
    values[k] = String(v).trim();
  });
  if (form.hasAttribute("data-person")) {
    values.person = form.getAttribute("data-person");
    values.slug = form.getAttribute("data-slug") || "";
  }
  if (!values.name) values.name = "a visitor (no name given)";
  var subject = fill(conf.subject, values);
  var note = form.querySelector(".form-note");
  var button = form.querySelector("button[type=submit]");
  if (!note) {
    note = document.createElement("p");
    note.className = "form-note ts-meta mt-2";
    note.setAttribute("role", "status");
    (button || form.lastElementChild).insertAdjacentElement("afterend", note);
  }

  function done() {
    form.classList.add("is-sent");
    form.innerHTML = '<div class="ts-sent" role="status" tabindex="-1"><p class="ts-eyebrow">' + (conf.sent || "Message sent") + '</p><p class="mb-0">' + conf.thanks + "</p></div>";
    if (kind === "quote") { var qTabs = document.querySelector(".ts-tabs"); if (qTabs) qTabs.hidden = true; }
    if (kind === "flowers") { try { sessionStorage.removeItem("ts-flowers-basket"); } catch (e) {} }
    var sent = form.querySelector(".ts-sent");
    sent.focus({ preventScroll: true });
    form.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }

  // Honeypot: a robot fills it, a person never sees it. Accept and drop.
  if ((data.get("website") || "").toString().trim()) { done(); return; }

  function fallbackToMail() {
    var lines = [subject, ""];
    Object.keys(values).forEach(function (k) {
      if (values[k] && k !== "slug") lines.push(k.replace(/_/g, " ") + ": " + values[k]);
    });
    note.classList.add("form-note-warn");
    note.innerHTML = "We could not send this from the website. Your email app should open with your message ready: please press <strong>Send</strong> there. " +
      'If nothing opens, email <a href="mailto:' + FORM_EMAIL + '">' + FORM_EMAIL + '</a> or call <a href="' + FORM_TEL + '">' + FORM_PHONE + "</a>. Your message is still in the form above.";
    note.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    window.location.href = "mailto:" + FORM_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
  }

  var label = button ? button.innerHTML : "";
  if (button) { button.disabled = true; button.textContent = "Sending…"; }
  var payload = Object.assign({}, values, { _subject: subject, _template: "table", _captcha: "false" });

  // Give up after 15 seconds (a stalled phone signal) and fall back to email.
  var ctrl = window.AbortController ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

  fetch(FORM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal: ctrl ? ctrl.signal : undefined,
  })
    // FormSubmit answers 200 OK even when it has NOT delivered (an address not
    // yet activated comes back as {"success":"false"}), so the body decides.
    .then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    })
    .then(function (body) {
      clearTimeout(timer);
      if (String(body && body.success) !== "true") throw new Error("not delivered");
      done();
    })
    .catch(function () {
      clearTimeout(timer);
      if (button) { button.disabled = false; button.innerHTML = label; button.focus({ preventScroll: true }); }
      fallbackToMail();
    });
});

document.addEventListener("DOMContentLoaded", function () {
  var params = new URLSearchParams(location.search);
  var today = barbadosToday();

  /* Dates: the pages are built ahead of time, so a funeral can pass before the
     next build. data-until="YYYY-MM-DD" goes away after that day, and
     data-after="YYYY-MM-DD" (a streamed service) appears after it. */
  document.querySelectorAll("[data-until]").forEach(function (el) {
    var until = el.getAttribute("data-until");
    if (until && until < today) el.parentNode.removeChild(el);
  });
  document.querySelectorAll("[data-after]").forEach(function (el) {
    var after = el.getAttribute("data-after");
    if (after && after < today) el.hidden = false;
  });
  document.querySelectorAll("[data-list]").forEach(function (list) {
    var rows = Array.prototype.filter.call(list.querySelectorAll("article"), function (a) { return !a.hidden; });
    var empty = list.querySelector("[data-empty]");
    if (empty) empty.hidden = rows.length > 0;
    else if (!rows.length) list.hidden = true;
  });

  // Phone menu: say "Close" while it is open, and close it with Escape
  var nav = document.getElementById("ts-nav");
  var toggler = document.querySelector(".navbar-toggler");
  if (nav && toggler) {
    var menuLabel = toggler.querySelector(".ts-menu-label");
    nav.addEventListener("show.bs.collapse", function () { if (menuLabel) menuLabel.textContent = "Close"; });
    nav.addEventListener("hide.bs.collapse", function () { if (menuLabel) menuLabel.textContent = "Menu"; });
    var closeMenu = function () { if (nav.classList.contains("show") && window.bootstrap) window.bootstrap.Collapse.getOrCreateInstance(nav).hide(); };
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("show")) {
        var inside = nav.contains(document.activeElement);
        closeMenu();
        if (inside) toggler.focus();
      }
    });
    // Tabbing out of the open menu closes it, so it never hides the page behind it
    nav.addEventListener("focusout", function (e) {
      var to = e.relatedTarget;
      if (to && !nav.contains(to) && to !== toggler) closeMenu();
    });
  }

  // Obituaries: filter the cards by name as you type (and from ?search= on the home page)
  var cards = document.querySelectorAll(".ts-notice-grid .ts-notice-card[data-name]");
  var search = document.getElementById("ts-search");
  var result = document.querySelector(".ts-search-result");
  if (search && result && cards.length) {
    var run = function () {
      var text = search.value.trim(), words = fold(text).split(/[^a-z0-9']+/).filter(Boolean), shown = 0;
      cards.forEach(function (c) {
        var name = c.getAttribute("data-name");
        var hit = words.every(function (w) { return name.indexOf(w) >= 0; });
        c.hidden = !hit;
        if (hit) shown++;
      });
      if (!words.length) result.textContent = "";
      else if (shown) result.textContent = shown + " notice" + (shown === 1 ? "" : "s") + " found for “" + text + "”.";
      else result.textContent = "No notices found for “" + text + "”. Try just the surname, or call us on " + FORM_PHONE + ".";
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

  // Flowers shop: add tributes to a basket, choose the funeral, send one order to Two Sons.
  var flBasket = document.getElementById("fl-basket");
  var forSel = document.getElementById("fl-for");
  if (flBasket && forSel) {
    var basket = {}; // slug -> { name, price (number|null), from (bool), qty }
    var orderField = document.getElementById("fl-order-field");
    var totalField = document.getElementById("fl-total-field");
    var submitBtn = document.getElementById("fl-submit");
    var STORE = "ts-flowers-basket";
    var escHtml = function (s) {
      return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
    };
    var money = function (n) { return "US$" + n.toLocaleString("en-US"); };
    var save = function () { try { sessionStorage.setItem(STORE, JSON.stringify(basket)); } catch (e) {} };

    var render = function () {
      var slugs = Object.keys(basket);
      var total = 0, hasOnRequest = false;
      var rows = slugs.map(function (slug) {
        var it = basket[slug], priceText, lineText;
        if (it.price == null) {
          priceText = "Price on request"; lineText = "Price on request"; hasOnRequest = true;
        } else {
          var line = it.price * it.qty; total += line;
          priceText = (it.from ? "from " : "") + money(it.price) + " each";
          lineText = (it.from ? "from " : "") + money(line);
        }
        return '<div class="ts-basket-row" data-slug="' + escHtml(slug) + '">' +
          '<div class="ts-basket-item"><strong>' + escHtml(it.name) + '</strong><span class="ts-meta">' + priceText + '</span></div>' +
          '<div class="ts-qty" role="group" aria-label="Quantity of ' + escHtml(it.name) + '">' +
            '<button type="button" class="ts-qty-btn" data-step="-1" aria-label="One fewer ' + escHtml(it.name) + '">&minus;</button>' +
            '<span class="ts-qty-n">' + it.qty + '</span>' +
            '<button type="button" class="ts-qty-btn" data-step="1" aria-label="One more ' + escHtml(it.name) + '">+</button>' +
          '</div>' +
          '<div class="ts-basket-line">' + lineText + '</div>' +
          '<button type="button" class="ts-basket-remove" data-remove aria-label="Remove ' + escHtml(it.name) + ' from the basket">&times;</button>' +
        '</div>';
      });
      if (!slugs.length) {
        flBasket.innerHTML = '<p class="ts-basket-empty">Your basket is empty. Add tributes from the list above.</p>';
      } else {
        var totalText = hasOnRequest ? (total ? money(total) + " + items on request" : "Priced on request") : money(total);
        flBasket.innerHTML = rows.join("") +
          '<div class="ts-basket-total"><span>Total</span><strong>' + totalText + '</strong></div>' +
          (hasOnRequest ? '<p class="ts-meta ts-basket-note">We will confirm the price of any “price on request” tributes when we call you.</p>' : "");
      }
      // hidden fields that travel with the order email
      if (orderField) orderField.value = slugs.map(function (slug) {
        var it = basket[slug];
        var p = it.price == null ? "price on request" : (it.from ? "from " : "") + money(it.price) + " each";
        return it.qty + " × " + it.name + " (" + p + ")";
      }).join("\n");
      if (totalField) totalField.value = slugs.length ? (hasOnRequest ? (total ? money(total) + " + items on request" : "on request") : money(total)) : "";
      if (submitBtn) submitBtn.disabled = !slugs.length;
      save();
    };

    try { var saved = JSON.parse(sessionStorage.getItem(STORE) || "{}"); if (saved && typeof saved === "object") basket = saved; } catch (e) {}
    render();

    document.querySelectorAll(".ts-add").forEach(function (b) {
      b.addEventListener("click", function () {
        var slug = b.getAttribute("data-slug"), price = b.getAttribute("data-price");
        if (!basket[slug]) basket[slug] = { name: b.getAttribute("data-name"), price: price === "" ? null : Number(price), from: b.getAttribute("data-from") === "1", qty: 0 };
        if (basket[slug].qty < 99) basket[slug].qty += 1;
        render();
        var label = b.innerHTML; b.classList.add("is-added");
        b.innerHTML = '<i class="fa fa-check me-2" aria-hidden="true"></i>Added';
        setTimeout(function () { b.classList.remove("is-added"); b.innerHTML = label; }, 1200);
      });
    });

    flBasket.addEventListener("click", function (e) {
      var row = e.target.closest(".ts-basket-row");
      if (!row) return;
      var slug = row.getAttribute("data-slug");
      if (!basket[slug]) return;
      if (e.target.closest("[data-remove]")) { delete basket[slug]; render(); return; }
      var step = e.target.closest(".ts-qty-btn");
      if (step) {
        basket[slug].qty += Number(step.getAttribute("data-step"));
        if (basket[slug].qty < 1) delete basket[slug];
        render();
      }
    });

    // ?for=<slug> preselects the funeral; "A funeral not listed" needs the free-text field
    var wantFor = (params.get("for") || "").replace(/[^a-z0-9-]/g, "");
    if (wantFor) { var opt = forSel.querySelector('option[data-slug="' + wantFor + '"]'); if (opt) opt.selected = true; }
    var other = document.getElementById("fl-other");
    var otherRow = document.getElementById("fl-other-row");
    var deadline = document.getElementById("fl-deadline");
    var syncFor = function () {
      var isOther = forSel.value === "Not listed";
      if (otherRow) otherRow.hidden = !isOther;
      if (other) other.required = isOther;
      if (deadline) {
        var sel = forSel.options[forSel.selectedIndex];
        deadline.textContent = (sel && sel.getAttribute("data-until")) ? "Please order at least two days before the funeral so we can prepare your tribute in time." : "";
      }
    };
    forSel.addEventListener("change", syncFor);
    syncFor();
  }

  // Contact: "Ask about this style" on a casket fills in the message
  var about = (params.get("about") || "").slice(0, 80);
  var contactMsg = document.getElementById("contact-msg");
  if (about && contactMsg && !contactMsg.value) contactMsg.value = "I would like to ask about the " + about.charAt(0).toLowerCase() + about.slice(1) + ".";

  // Copy link on a notice
  document.querySelectorAll(".ts-copy").forEach(function (btn) {
    var status = btn.parentNode.querySelector(".ts-copy-status");
    btn.addEventListener("click", function () {
      var link = btn.getAttribute("data-url");
      var ok = function () {
        btn.innerHTML = '<i class="fa fa-check me-2" aria-hidden="true"></i>Link copied';
        if (status) status.textContent = "Link copied";
        setTimeout(function () {
          btn.innerHTML = '<i class="fa fa-link me-2" aria-hidden="true"></i>Copy link';
          if (status) status.textContent = "";
        }, 4000);
      };
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
    var frame = lightbox.querySelector(".lightbox-image");
    var img = frame.querySelector("img");
    if (!img) { img = document.createElement("img"); img.alt = ""; frame.insertBefore(img, frame.firstChild); }
    var prev = lightbox.querySelector(".lightbox-prev"), next = lightbox.querySelector(".lightbox-next");
    var counter = lightbox.querySelector(".lightbox-counter");
    var photos = [], at = 0, lastFocus = null;
    var show = function () {
      img.src = photos[at];
      var multi = photos.length > 1;
      prev.hidden = next.hidden = counter.hidden = !multi;
      counter.textContent = at + 1 + " / " + photos.length;
    };
    var open = function (card) {
      lastFocus = document.activeElement;
      photos = card.getAttribute("data-images").split("|");
      at = 0;
      img.alt = card.querySelector("img").alt;
      lightbox.querySelector(".lightbox-name").textContent = card.querySelector("h3").textContent;
      lightbox.querySelector(".lightbox-ask").href = "contact.html?about=" + encodeURIComponent(card.querySelector("h3").textContent) + "#contact";
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
      if (lastFocus) lastFocus.focus();
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
      if (e.key === "Tab") {
        // keep the keyboard inside the viewer while it is open
        var f = Array.prototype.filter.call(lightbox.querySelectorAll(".lightbox-panel button, .lightbox-panel a[href]"), function (x) { return !x.hidden; });
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (f.indexOf(document.activeElement) < 0) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // The year in the footer
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
});
