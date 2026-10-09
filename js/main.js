/* Two Sons website adjustment layer. Preserves the original helpers in main-legacy.js. */
(function () {
  var current = document.currentScript;
  var currentSrc = current && current.src ? current.src : "js/main.js";
  var legacySrc = currentSrc.replace(/main\.js(?:\?.*)?$/, "main-legacy.js");

  /* Load the original helper synchronously while the page is still parsing so
     its DOMContentLoaded handlers behave exactly as before. */
  document.write('<script src="' + legacySrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"><\/script>');

  document.addEventListener("DOMContentLoaded", function () {
    var inObituary = /\/obituaries\//.test(location.pathname);
    var up = inObituary ? "../" : "";

    /* Obituaries is now the single notice/service page. */
    document.querySelectorAll('a[href$="livestreams.html"]').forEach(function (link) {
      if (link.closest(".ts-mobilebar")) {
        link.href = up + "get-a-quote.html";
        link.innerHTML = '<i class="fa fa-file-text-o" aria-hidden="true"></i>Get a quote';
        return;
      }
      var li = link.closest("li");
      if (li) li.remove();
      else link.href = up + "obituaries.html";
    });

    /* Make Get a Quote prominent without removing emergency phone access. */
    document.querySelectorAll(".ts-call-btn, .ts-call-btn-lg").forEach(function (btn) {
      btn.href = up + "get-a-quote.html";
      btn.innerHTML = '<i class="fa fa-file-text-o me-2" aria-hidden="true"></i>Get a quote';
    });

    if (/\/livestreams\.html$/.test(location.pathname)) {
      location.replace(up + "obituaries.html");
      return;
    }

    /* Landing-page wording supplied 6 October 2026. */
    var isHome = /\/$/.test(location.pathname) || /\/index\.html$/.test(location.pathname);
    if (isHome) {
      Array.prototype.forEach.call(document.querySelectorAll("h2"), function (h2) {
        if (h2.textContent.trim() === "Funeral notices") {
          h2.textContent = "Obituaries";
          var lead = h2.parentNode.querySelector(".ts-lead");
          if (lead) lead.textContent = "Service times, viewings, flowers and livestream links for each obituary.";
        }
      });
      Array.prototype.forEach.call(document.querySelectorAll("a.ts-link"), function (link) {
        if (/All funeral notices/i.test(link.textContent)) link.innerHTML = 'View all obituaries <i class="fa fa-arrow-right ms-1" aria-hidden="true"></i>';
      });

      var steps = document.querySelectorAll(".ts-steps > div");
      var stepCopy = [
        ["Give us a call", "Give us a call and we will walk you through the necessary steps."],
        ["We bring your loved one into our care", "Our team comes to the home, hospital or nursing home with dignity and respect."],
        ["Meet us at our office", "Meet us at our office to make complete arrangements, including the service location and flowers."],
        ["Share the obituary", "We post the obituary and livestream link here, ready to share on WhatsApp."]
      ];
      Array.prototype.forEach.call(steps, function (step, i) {
        if (!stepCopy[i]) return;
        var h3 = step.querySelector("h3"), p = step.querySelector("p");
        if (h3) h3.textContent = stepCopy[i][0];
        if (p) p.textContent = stepCopy[i][1];
      });

      var callbox = document.querySelector(".ts-callbox");
      if (callbox) {
        callbox.style.background = "#22304f";
        callbox.style.borderColor = "#22304f";
      }

      Array.prototype.forEach.call(document.querySelectorAll(".ts-section p"), function (p) {
        if (/Casket sprays, hearts, crosses and lettered tributes such as MUM and GRAN\./.test(p.textContent)) {
          p.textContent = "Casket sprays, hearts, crosses and lettered tributes such as MUM and GRAN. Order with the funeral, or bring flowers to our chapel by the time shown on the obituary. Floral tributes should be ordered at least two days before the funeral date to ensure on-time delivery.";
        }
      });

      Array.prototype.forEach.call(document.querySelectorAll(".ts-live-card p, .ts-live-card a"), function (el) {
        if (el.tagName === "P" && /funeral notice/i.test(el.textContent)) el.textContent = "When a service is streamed, the link goes on the obituary, so family abroad can watch. Share it with one tap on WhatsApp.";
        if (el.tagName === "A" && /funerals and livestreams/i.test(el.textContent)) {
          el.href = "obituaries.html";
          el.textContent = "See obituaries and livestreams";
        }
      });
    }

    /* About-page copy supplied by Tamika. */
    if (/\/about\.html$/.test(location.pathname)) {
      var aboutHeading = Array.prototype.find.call(document.querySelectorAll("main h2"), function (h) {
        return /Serving Barbados from Bush Hall since 1979/.test(h.textContent);
      });
      if (aboutHeading) {
        var copy = aboutHeading.nextElementSibling;
        if (copy) copy.textContent = "Since its humble start, Two Sons Funeral Home has been a caring part of our community and has helped many families over the years honour the life and mourn the loss of loved ones. We have served Barbados’ families of all faiths and cultures with professionalism and compassion.";
        var todo = aboutHeading.parentNode.querySelector(".ts-todo");
        if (todo) todo.remove();
      }
    }

    /* Mandatory Burial items display as Included, matching the other quote types. */
    if (/\/get-a-quote\.html$/.test(location.pathname)) {
      document.querySelectorAll('[data-quote-set="burial"] .ts-q-row[data-type="check"] input[type="checkbox"]').forEach(function (input) {
        if (!input.defaultChecked) return;
        var row = input.closest(".ts-q-row");
        var opts = row && row.querySelector(".ts-q-opts");
        if (!row || !opts) return;
        row.setAttribute("data-type", "required");
        opts.innerHTML = '<span class="fw-semibold">Included</span>';
      });
    }
  });
})();
