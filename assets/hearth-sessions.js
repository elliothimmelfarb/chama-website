/* ==========================================================================
   The Hearth: sessions, the client's side.

   Where a client sees their sessions drawn as the homepage's hop figure,
   books the next one against Elliot's real availability in their own
   timezone, moves or cancels it, and asks for a pack of credits. The owner's
   side of the same tables lives in hearth-sessions-admin.js.

   Same rules as the core: no innerHTML, every value through textContent.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;
  var el = H.el, svg = H.svg, append = H.append, button = H.button, link = H.link, api = H.api, pill = H.pill, input = H.input, field = H.field;

  var DAY = 86400000;

  /* ---------- helpers ---------- */

  function tz() { return (H.state.user && H.state.user.timezone) || undefined; }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { timeZone: tz(), hour: "numeric", minute: "2-digit" });
  }

  function fmtDay(iso, long) {
    return new Date(iso).toLocaleDateString(undefined, { timeZone: tz(), weekday: long ? "long" : "short", month: long ? "long" : "short", day: "numeric" });
  }

  function dayKey(iso) {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz() });
  }

  function hoursAway(iso) { return (new Date(iso).getTime() - Date.now()) / 3600000; }

  function money(cents, currency) {
    if (cents === null || cents === undefined) return "price on request";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(cents / 100); } catch (e) { return (cents / 100).toFixed(2) + " " + currency; }
  }

  // Arms the figure system for a node that was just inserted: the homepage
  // does this once for the whole page; here figures arrive with each view.
  function armFigure(node) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("figs-armed");
    requestAnimationFrame(function () { requestAnimationFrame(function () { node.classList.add("in"); }); });
    node.addEventListener("click", function () {
      node.classList.remove("in");
      void node.getBoundingClientRect();
      node.classList.add("in");
    });
  }

  /* ---------- the figure: sessions as hops ---------- */

  // Completed sessions are ink dots joined by arcs that rise a little more
  // each time; the next scheduled one is ember; a faint arc continues past.
  function hopsFigure(completed, hasNext) {
    var W = 560, Hh = 200, base = 156;
    var shown = Math.min(completed, 7);
    var slots = shown + (hasNext ? 1 : 0) + 1;
    var gap = (W - 80) / Math.max(slots, 2);
    var node = svg("svg", { viewBox: "0 0 " + W + " " + Hh, role: "img", "aria-label": completed + " sessions so far" + (hasNext ? ", the next one booked" : "") });
    node.setAttribute("class", "figure hops");
    var defs = svg("defs");
    var filter = svg("filter", { id: "hops-glow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    filter.appendChild(svg("feGaussianBlur", { stdDeviation: 3 }));
    defs.appendChild(filter);
    node.appendChild(defs);
    var line = svg("path", { d: "M40 " + base + "H" + (W - 12), fill: "none", stroke: "currentColor", "stroke-opacity": ".26", class: "draw", pathLength: 1 });
    line.style.setProperty("--dur", "500ms");
    node.appendChild(line);
    var xs = [];
    for (var i = 0; i < shown + (hasNext ? 1 : 0); i += 1) xs.push(70 + i * gap);
    var d = "";
    for (var j = 0; j < shown - 1; j += 1) {
      var peak = base - 48 - j * 16;
      d += (j === 0 ? "M" + xs[j] + " " + base : "") + "Q" + ((xs[j] + xs[j + 1]) / 2) + " " + peak + " " + xs[j + 1] + " " + base;
    }
    if (d) {
      var arcs = svg("path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": 1.2, class: "draw", pathLength: 1 });
      arcs.style.setProperty("--d", "500ms"); arcs.style.setProperty("--dur", (400 * shown) + "ms"); arcs.style.setProperty("--ease", "linear");
      node.appendChild(arcs);
      var head = svg("path", { d: d, stroke: "currentColor", "stroke-width": 7, class: "head", pathLength: 1 });
      head.style.setProperty("--d", "500ms"); head.style.setProperty("--dur", (400 * shown) + "ms"); head.style.setProperty("--ease", "linear");
      node.appendChild(head);
    }
    var t0 = 500 + 400 * Math.max(0, shown - 1);
    if (hasNext && shown > 0) {
      var nx = xs[shown - 1], ex = xs[shown];
      var ed = "M" + nx + " " + base + "Q" + ((nx + ex) / 2) + " " + (base - 48 - (shown - 1) * 16 - 20) + " " + ex + " " + base;
      var e1 = svg("path", { d: ed, fill: "none", stroke: "#f4581f", "stroke-width": 1.6, class: "draw", pathLength: 1 });
      e1.style.setProperty("--d", t0 + "ms"); e1.style.setProperty("--dur", "600ms"); e1.style.setProperty("--ease", "linear");
      var e2 = svg("path", { d: ed, stroke: "#f4581f", "stroke-width": 12, "stroke-opacity": ".6", filter: "url(#hops-glow)", class: "head", pathLength: 1 });
      e2.style.setProperty("--d", t0 + "ms"); e2.style.setProperty("--dur", "600ms"); e2.style.setProperty("--ease", "linear");
      var e3 = svg("path", { d: ed, stroke: "#f4581f", "stroke-width": 8, class: "head", pathLength: 1 });
      e3.style.setProperty("--d", t0 + "ms"); e3.style.setProperty("--dur", "600ms"); e3.style.setProperty("--ease", "linear");
      append(node, [e1, e2, e3]);
    }
    var lastX = xs.length ? xs[xs.length - 1] : 70;
    var beyond = svg("path", { d: "M" + lastX + " " + base + "Q" + (lastX + gap / 2) + " " + (base - 60 - shown * 16) + " " + (lastX + gap) + " " + base, fill: "none", stroke: "#f4581f", "stroke-opacity": ".4", "stroke-width": 1.2, "stroke-dasharray": "2 4", class: "fade" });
    beyond.style.setProperty("--d", (t0 + 900) + "ms");
    node.appendChild(beyond);
    xs.forEach(function (x, k) {
      var isNext = hasNext && k === shown;
      var dot = svg("circle", { cx: x, cy: base, r: isNext ? 4.5 : 3.5, fill: isNext ? "#f4581f" : "currentColor", class: "pop" });
      dot.style.setProperty("--d", (isNext ? t0 + 600 : 400 + k * 400) + "ms");
      node.appendChild(dot);
      if (isNext) {
        var ring = svg("circle", { cx: x, cy: base, r: 14, fill: "none", stroke: "#f4581f", "stroke-width": 1.4, class: "ring" });
        ring.style.setProperty("--d", (t0 + 600) + "ms");
        node.appendChild(ring);
      }
      var label = svg("text", { x: x, y: 180, "font-size": 10, "text-anchor": "middle", fill: isNext ? "#f4581f" : "currentColor", "fill-opacity": isNext ? 1 : ".55", class: "fade" });
      label.textContent = isNext ? "next" : String(completed - shown + k + 1);
      label.style.setProperty("--d", (isNext ? t0 + 700 : 500 + k * 400) + "ms");
      node.appendChild(label);
    });
    var caption = svg("text", { x: W - 12, y: 40, "font-size": 10, "letter-spacing": 1, "text-anchor": "end", fill: "currentColor", "fill-opacity": ".55", class: "fade" });
    caption.textContent = completed === 0 ? "no sessions yet" : completed + (completed === 1 ? " session" : " sessions") + " completed";
    caption.style.setProperty("--d", (t0 + 1000) + "ms");
    node.appendChild(caption);
    return node;
  }

  /* ---------- the sessions view ---------- */

  H.register("/sessions", function () {
    var wrap = el("div", "stack");
    return Promise.all([api("/bookings"), api("/invoices").catch(function () { return { invoices: [] }; })]).then(function (r) {
      var data = r[0];
      var invoices = r[1].invoices || [];
      var bookings = data.bookings;
      var upcoming = bookings.filter(function (b) { return b.status === "scheduled" && new Date(b.endsAt) > new Date(); }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
      var past = bookings.filter(function (b) { return b.status !== "scheduled" || new Date(b.endsAt) <= new Date(); }).sort(function (a, b) { return new Date(b.startsAt) - new Date(a.startsAt); });
      var completed = bookings.filter(function (b) { return b.status === "completed" || (b.status === "scheduled" && new Date(b.endsAt) <= new Date()); }).length;

      var after = data.billing === "after";
      var canBook = after || data.balance > 0;
      var actions = [];
      if (canBook) actions.push(button("Book a session", "btn primary", function () { H.navigate("/sessions/book"); }));
      if (!after) actions.push(button(canBook ? "Packs and credits" : "Get sessions", canBook ? "btn" : "btn primary", function () { H.navigate("/sessions/packs"); }));
      if (!canBook) actions.push(button("See open times", "btn ghost", function () { H.navigate("/sessions/book"); }));
      wrap.appendChild(H.viewHead("Sessions", "Your upcoming and past sessions.", actions));

      var figCard = el("div", "card");
      var fig = hopsFigure(completed, upcoming.length > 0);
      figCard.appendChild(fig);
      wrap.appendChild(figCard);
      armFigure(fig);

      var tiles = el("div", "stats rise");
      function tile(value, what, emberish, i) {
        var c = el("div", "stat");
        c.style.setProperty("--i", String(i));
        var n = el("div", "num" + (emberish ? " ember" : ""), typeof value === "number" ? "0" : value);
        if (typeof value === "number") H.countUp(n, value); else n.classList.add("words");
        append(c, [n, el("div", "what", what)]);
        tiles.appendChild(c);
      }
      if (!after) tile(data.balance, "credits left", data.balance > 0, 0);
      tile(completed, "sessions so far", false, 1);
      tile(upcoming.length ? fmtDay(upcoming[0].startsAt) : "none yet", "next session", upcoming.length > 0, 2);
      wrap.appendChild(tiles);

      if (invoices.length) wrap.appendChild(invoicesCard(invoices));

      var up = el("div", "card pad0");
      var upHead = el("div", "row between");
      upHead.style.padding = "0.9rem 1.1rem";
      upHead.appendChild(el("p", "label", "Upcoming"));
      up.appendChild(upHead);
      if (!upcoming.length) {
        var e = el("div", "empty");
        e.style.border = "0";
        e.appendChild(el("p", null, "No sessions booked."));
        if (canBook) e.appendChild(button("Find a time", "btn primary mt", function () { H.navigate("/sessions/book"); }));
        up.appendChild(e);
      } else {
        var list = el("div", "list");
        upcoming.forEach(function (b) { list.appendChild(upcomingRow(b, data)); });
        up.appendChild(list);
      }
      wrap.appendChild(up);

      if (past.length) {
        var pastCard = el("div", "card pad0");
        var ph = el("div", "row between");
        ph.style.padding = "0.9rem 1.1rem";
        ph.appendChild(el("p", "label", "Past"));
        pastCard.appendChild(ph);
        var plist = el("div", "list");
        past.forEach(function (b) { plist.appendChild(pastRow(b)); });
        pastCard.appendChild(plist);
        wrap.appendChild(pastCard);
      }

      var tzNote = el("p", "small faint");
      tzNote.appendChild(document.createTextNode("Times are in " + (tz() || "your local time") + ". "));
      var change = link("Change", H.BASE + "/account");
      change.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/account"); });
      tzNote.appendChild(change);
      wrap.appendChild(tzNote);
      return wrap;
    });
  }, { perm: "sessions.own", title: "Sessions", nav: { label: "Sessions", order: 1, hideFor: "sessions.manage" } });

  // Invoices Elliot sent through Stripe. An open one can be paid on Stripe's
  // page; a paid one keeps that page as the receipt.
  function invoicesCard(invoices) {
    var card = el("div", "card pad0");
    var head = el("div", "row between");
    head.style.padding = "0.9rem 1.1rem";
    head.appendChild(el("p", "label", "Invoices"));
    card.appendChild(head);
    var list = el("div", "list");
    invoices.forEach(function (inv) {
      var row = el("div");
      var left = el("div", "grow");
      left.appendChild(el("div", "primary", money(inv.amountCents, inv.currency) + (inv.number ? " · " + inv.number : "")));
      var lines = inv.lines || [];
      var what = !lines.length ? inv.description
        : lines.length <= 2 ? lines.map(function (l) { return l.description; }).join(", ")
        : lines[0].description + " and " + (lines.length - 1) + " more";
      var when = inv.status === "paid" && inv.paidAt ? "paid " + fmtDay(inv.paidAt)
        : inv.status === "open" && inv.dueAt ? "due " + fmtDay(inv.dueAt)
        : "sent " + fmtDay(inv.createdAt);
      left.appendChild(el("div", "secondary", (what ? what + " · " : "") + when));
      var right = el("div", "row");
      var label = { open: "to pay", paid: "paid", void: "void", uncollectible: "closed" }[inv.status] || inv.status;
      right.appendChild(pill(label, inv.status === "paid" ? "client" : inv.status === "open" ? "live" : ""));
      if (inv.hostedUrl) {
        var go = link(inv.status === "open" ? "Pay" : "Receipt", inv.hostedUrl, "btn sm" + (inv.status === "open" ? " primary" : ""));
        go.target = "_blank";
        go.rel = "noopener";
        right.appendChild(go);
      }
      append(row, [left, right]);
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  /* ---------- billing details ---------- */

  // Who invoices are made out to. A business outside Portugal with its legal
  // name, address and tax ID pays no Portuguese IVA; everyone else pays 23
  // percent on top. The same form serves the member (saving is their
  // declaration) and the owner (who also sets the currency and notes how the
  // business was checked). lib/hearth/iva.js holds the rules.
  var EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
  var COUNTRIES = EU.concat(["US", "GB", "CA", "CH", "NO", "BR", "MX", "AU", "NZ", "IL", "AE", "SG", "JP", "IN", "ZA"]);

  function countryName(code) {
    try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code); } catch (e) { return code; }
  }

  function ivaLine(iva, billing) {
    if (!iva) return "";
    if (!iva.ready) return "Still needed: " + iva.missing.join(", ") + ".";
    var vies = billing && billing.viesValidAt ? " The EU's VIES register confirmed the number on " + new Date(billing.viesValidAt).toLocaleDateString("en-GB", { dateStyle: "medium" }) + "." : "";
    if (iva.treatment === "portugal") {
      return (billing && billing.kind === "business" ? "Invoices are made out to the company with its NIF, and IVA at 23 percent is added, which it can deduct." : "IVA at 23 percent is added to each invoice.") + vies;
    }
    return (iva.treatment === "eu-reverse-charge"
      ? "No Portuguese IVA: reverse charge for an EU business."
      : "No Portuguese IVA: a business outside the EU. The invoice says why.") + vies;
  }

  function billingForm(data, options) {
    options = options || {};
    var b = data.billing || {};
    var form = el("form", "stack tight");
    var kind = el("select", "select");
    [["person", options.owner ? "A person, paying for themselves" : "Me, personally"], ["business", options.owner ? "Their company" : "My company"]].forEach(function (pair) {
      var o = el("option", null, pair[1]);
      o.value = pair[0];
      if ((b.kind || "person") === pair[0]) o.selected = true;
      kind.appendChild(o);
    });
    var legal = input("text", "legalName", "", b.legalName);
    legal.autocomplete = "organization";
    var taxId = input("text", "taxId", "", b.taxId);
    var line1 = input("text", "addressLine1", "Street and number", b.addressLine1);
    line1.autocomplete = "address-line1";
    var line2 = input("text", "addressLine2", "Suite, floor (optional)", b.addressLine2);
    line2.autocomplete = "address-line2";
    var city = input("text", "city", "City", b.city);
    city.autocomplete = "address-level2";
    var region = input("text", "region", "State or region", b.region);
    region.autocomplete = "address-level1";
    var postal = input("text", "postalCode", "Postal code", b.postalCode);
    postal.autocomplete = "postal-code";
    var country = el("select", "select");
    var none = el("option", null, "Choose a country");
    none.value = "";
    country.appendChild(none);
    var codes = COUNTRIES.slice();
    if (b.country && codes.indexOf(b.country) === -1) codes.push(b.country);
    codes.map(function (c) { return [c, countryName(c)]; })
      .sort(function (x, y) { return x[1].localeCompare(y[1]); })
      .forEach(function (pair) {
        var o = el("option", null, pair[1]);
        o.value = pair[0];
        if (b.country === pair[0]) o.selected = true;
        country.appendChild(o);
      });
    taxId.classList.add("grow");
    // In the EU, the number alone finds the company: VIES gives its
    // registered name and address, which fill in the form.
    var lookup = button("Look up", "btn", function () {
      lookup.disabled = true;
      api("/billing/lookup?country=" + encodeURIComponent(country.value) + "&taxId=" + encodeURIComponent(taxId.value)).then(function (r) {
        lookup.disabled = false;
        if (r.valid === null) { H.toast("The EU register did not answer. Fill in the details by hand.", "bad"); return; }
        if (!r.valid) { H.toast("The EU register does not know that number. Check it.", "bad"); return; }
        taxId.value = r.taxId;
        if (r.name) legal.value = r.name;
        if (r.address) {
          line1.value = r.address.line1 || line1.value;
          line2.value = r.address.line2 || "";
          city.value = r.address.city || city.value;
          postal.value = r.address.postalCode || postal.value;
        }
        H.toast(r.name ? "Found " + r.name + "." : "That number is valid.", "good");
      }).catch(function (err) { lookup.disabled = false; H.toast(err.message, "bad"); });
    });
    var taxField = field("Tax ID", append(el("div", "row"), [taxId, lookup]));
    var businessOnly = append(el("div", "stack tight"), [taxField, field("Company's legal name", legal)]);
    var status = el("p", "small");

    function sync() {
      var business = kind.value === "business";
      var c = country.value;
      var eu = EU.indexOf(c) !== -1;
      businessOnly.hidden = !business;
      lookup.hidden = !eu;
      var label = taxField.querySelector("span");
      label.textContent = c === "PT" ? "NIF" : c === "US" ? "EIN" : eu ? "VAT number" : "Tax ID";
      var hint = c === "PT" ? "The company's NIF, nine digits. Look up fills in its name and address."
        : c === "US" ? "The company's EIN, like 12-3456789."
        : eu ? "Its VAT number. Look up checks it and fills in the name and address."
        : "Its company or tax registration number.";
      taxId.placeholder = c === "PT" ? "123456789" : c === "US" ? "12-3456789" : "";
      legal.placeholder = c === "PT" ? "Empresa, Lda" : c === "US" ? "Company LLC" : "";
      var oldHint = taxField.querySelector(".hint");
      if (oldHint) oldHint.textContent = hint; else taxField.appendChild(el("span", "hint", hint));
    }
    kind.addEventListener("change", sync);
    country.addEventListener("change", sync);

    var currency = null;
    var evidence = null;
    append(form, [
      field(options.owner ? "Who pays" : "Who pays your invoices", kind),
      field("Country", country),
      businessOnly,
      field("Address", line1),
      line2,
      append(el("div", "row"), [city, region]),
      postal
    ]);
    if (options.owner) {
      currency = el("select", "select");
      ["EUR", "USD"].forEach(function (c) {
        var o = el("option", null, c === "EUR" ? "Euros (EUR)" : "US dollars (USD)");
        o.value = c;
        if ((b.currency || "EUR") === c) o.selected = true;
        currency.appendChild(o);
      });
      evidence = el("textarea", "input");
      evidence.rows = 2;
      evidence.maxLength = 1000;
      evidence.value = b.evidence || "";
      append(form, [
        field("Invoice in", currency),
        field("How you checked it is a business", evidence, "Optional. For example the state registry record of the LLC, or that it is valid in VIES.")
      ]);
    }
    form.appendChild(status);
    if (!options.owner) {
      form.appendChild(el("p", "small dim", "If you choose your company, saving confirms it is a registered business and that the sessions are for its work. Invoices are then made out to it: a company in Portugal can deduct the IVA, and one outside Portugal pays none."));
    }
    var save = button("Save billing details", "btn primary");
    save.type = "submit";
    form.appendChild(append(el("div", "row"), [save]));

    function show(result) {
      status.textContent = ivaLine(result.iva, result.billing);
      status.className = "small" + (result.iva && !result.iva.ready ? " form-error" : " dim");
    }
    show(data);
    sync();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var body = {
        kind: kind.value, legalName: legal.value, taxId: taxId.value, addressLine1: line1.value, addressLine2: line2.value,
        city: city.value, region: region.value, postalCode: postal.value, country: country.value
      };
      if (currency) body.currency = currency.value;
      if (evidence) body.evidence = evidence.value;
      save.disabled = true;
      api(options.path || "/billing", { method: "PUT", body: body }).then(function (result) {
        save.disabled = false;
        show(result);
        H.toast("Billing details saved.", "good");
        if (options.onSave) options.onSave(result);
      }).catch(function (err) {
        save.disabled = false;
        H.toast(err.message, "bad");
      });
    });
    return form;
  }
  H.billingForm = billingForm;
  H.ivaLine = ivaLine;

  H.register("/billing", function () {
    return api("/billing").then(function (data) {
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead("Billing details", "Who your invoices are made out to."));
      var card = el("div", "card stack");
      card.appendChild(billingForm(data));
      wrap.appendChild(card);
      return wrap;
    });
  }, { title: "Billing details", nav: { label: "Billing details", short: "Billing", order: 3.1, hideFor: "purchases.manage", when: function () { return H.can("sessions.own") || H.state.invoices > 0; } } });

  // Everyone's own invoices, guests included, on a page of their own. The
  // arrival notice leads here: an open one is a single click from Stripe's
  // page, where they pay by card.
  H.register("/invoices", function () {
    return api("/invoices").then(function (data) {
      var wrap = el("div", "stack");
      var invoices = data.invoices || [];
      var open = invoices.filter(function (i) { return i.status === "open"; });
      H.state.openInvoices = open.length;
      wrap.appendChild(H.viewHead("Invoices", open.length ? "Pay by card on Stripe's secure page, which opens in a new tab. Once it is paid it shows here as paid." : "Every invoice from Chama Inteligente, with its receipt."));
      if (!invoices.length) {
        wrap.appendChild(H.empty("No invoices yet."));
        return wrap;
      }
      open.forEach(function (inv) {
        var card = el("div", "card stack tight glow");
        card.appendChild(el("p", "label", "To pay" + (inv.number ? " · " + inv.number : "")));
        card.appendChild(el("p", "invoice-total", money(inv.amountCents, inv.currency)));
        var lines = inv.lines || [];
        if (lines.length) {
          var list = el("ul", "invoice-lines");
          lines.forEach(function (l) {
            var li = el("li");
            append(li, [el("span", null, l.description), el("span", "dim", money(l.amountCents, inv.currency))]);
            list.appendChild(li);
          });
          card.appendChild(list);
        }
        if (inv.description) card.appendChild(el("p", "small dim", inv.description));
        if (inv.dueAt) card.appendChild(el("p", "small", "Due " + fmtDay(inv.dueAt)));
        var row = el("div", "row");
        if (inv.hostedUrl) {
          var pay = link("Pay " + money(inv.amountCents, inv.currency), inv.hostedUrl, "btn primary");
          pay.target = "_blank";
          pay.rel = "noopener";
          row.appendChild(pay);
        }
        if (inv.pdfUrl) {
          var pdf = link("Download PDF", inv.pdfUrl, "btn ghost");
          pdf.target = "_blank";
          pdf.rel = "noopener";
          row.appendChild(pdf);
        }
        card.appendChild(row);
        wrap.appendChild(card);
      });
      var rest = invoices.filter(function (i) { return i.status !== "open"; });
      if (rest.length) wrap.appendChild(invoicesCard(rest));
      var who = el("p", "small dim");
      who.appendChild(document.createTextNode("Paying through your company? "));
      var details = link("Add its billing details", H.BASE + "/billing");
      details.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/billing"); });
      who.appendChild(details);
      who.appendChild(document.createTextNode(" and future invoices are made out to it."));
      wrap.appendChild(who);
      return wrap;
    });
  }, { title: "Invoices", nav: { label: "Invoices", order: 3, hideFor: "purchases.manage", when: function () { return H.state.invoices > 0; } } });

  function upcomingRow(b, data) {
    var row = el("div");
    var left = el("div");
    left.appendChild(el("div", "primary", fmtDay(b.startsAt, true) + ", " + fmtTime(b.startsAt) + " to " + fmtTime(b.endsAt)));
    var sec = el("div", "secondary");
    var away = hoursAway(b.startsAt);
    sec.textContent = away < 1 ? "starting now" : away < 48 ? "in " + Math.round(away) + " hours" : "in " + Math.round(away / 24) + " days";
    if (b.clientNote) sec.textContent += " · you noted: " + b.clientNote.slice(0, 80);
    left.appendChild(sec);
    var right = el("div", "row");
    var url = b.meetingUrl || data.meetingUrl;
    if (url) {
      var join = link("Join", url, "btn sm" + (away < 1 ? " primary" : ""));
      join.target = "_blank";
      join.rel = "noopener";
      right.appendChild(join);
    }
    var canMove = away >= data.cancelNoticeHours;
    right.appendChild(button("Move", "btn ghost sm", function () { H.navigate("/sessions/move/" + b.id); }));
    var cancel = button("Cancel", "btn ghost sm", function () {
      var paid = b.billing === "credit";
      var msg = !paid ? "Cancel this session?" : canMove ? "Cancel this session? The credit comes back to you." : "Cancel this session? It is inside the " + data.cancelNoticeHours + "-hour notice, so the credit is not returned.";
      if (!window.confirm(msg)) return;
      cancel.disabled = true;
      api("/bookings/" + encodeURIComponent(b.id) + "/cancel", { method: "POST", body: {} }).then(function (r) {
        H.toast(r.refund ? "Cancelled. The credit has been returned." : "Cancelled.", "good");
        H.render();
      }).catch(function (err) { cancel.disabled = false; H.toast(err.message, "bad"); });
    });
    right.appendChild(cancel);
    append(row, [left, right]);
    return row;
  }

  function pastRow(b) {
    var row = el("div");
    var left = el("div");
    left.appendChild(el("div", "primary", fmtDay(b.startsAt, true) + ", " + fmtTime(b.startsAt)));
    var status = b.status === "cancelled" ? "cancelled" : b.status === "no_show" ? "missed" : "held";
    left.appendChild(el("div", "secondary", status + (b.title ? " · " + b.title : "")));
    var right = el("div", "row");
    if (b.transcriptId) {
      var t = button("Summary and transcript", "btn sm", function () { H.navigate("/transcripts/" + b.transcriptId); });
      right.appendChild(t);
    } else if (status === "held") {
      right.appendChild(el("span", "meta", "no transcript yet"));
    }
    append(row, [left, right]);
    return row;
  }

  /* ---------- booking and moving ---------- */

  // One page, three beats: a strip of days glowing by how open they are, the
  // chosen day drawn as its daylight with the free times on it, and a
  // confirmation that says exactly what the booking costs. The soonest free
  // time sits on top for anyone who just wants the next one.

  var DAY_PARTS = [
    { label: "Morning", until: 12 * 60 },
    { label: "Afternoon", until: 17 * 60 },
    { label: "Evening", until: 24 * 60 }
  ];
  var LIGHT_FROM = 6 * 60, LIGHT_TO = 23 * 60;

  function minuteOfDay(iso, zone) {
    var p = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
    var h = 0, m = 0;
    p.forEach(function (x) { if (x.type === "hour") h = +x.value % 24; if (x.type === "minute") m = +x.value; });
    return h * 60 + m;
  }

  function sameClock(iso, a, b) {
    if (!a || !b || a === b) return true;
    return minuteOfDay(iso, a) === minuteOfDay(iso, b) && dayKeyIn(iso, a) === dayKeyIn(iso, b);
  }

  function dayKeyIn(iso, zone) {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: zone });
  }

  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Ember tokens, one per credit, with the one a booking would spend marked.
  function tokens(count, spending) {
    var row = el("span", "tokens");
    row.setAttribute("aria-hidden", "true");
    var shown = Math.min(count, 12);
    for (var i = 0; i < shown; i += 1) row.appendChild(el("span", "token" + (spending && i === shown - 1 ? " spending" : "")));
    return row;
  }

  function picker(opts) {
    var wrap = el("div", "stack book");
    wrap.appendChild(H.viewHead(opts.title, opts.lede));

    var pay = opts.pay || { billing: "prebuy", balance: 0 };
    var canBook = Boolean(opts.except) || pay.billing === "after" || pay.balance > 0;

    var payLine = null;
    if (!opts.except) {
      // A member billed after just books: no line about paying at all.
      if (pay.billing === "after") {
        // nothing
      } else if (pay.balance > 0) {
        payLine = el("p", "pay-line small");
        append(payLine, [tokens(pay.balance), document.createTextNode(pay.balance + (pay.balance === 1 ? " session credit" : " session credits") + ". A booking uses one.")]);
      } else {
        payLine = el("div", "card glow row between");
        var t = el("div", "grow");
        append(t, [el("p", null, "Sessions are bought ahead."), el("p", "small dim", "Get a pack and any of these times can be yours. You can look around first.")]);
        append(payLine, [t, button("See packs", "btn primary", function () { H.navigate("/sessions/packs"); })]);
      }
      if (payLine) wrap.appendChild(payLine);
    }

    var soonest = el("div");
    wrap.appendChild(soonest);
    var stage = el("div", "card stack book-stage");
    stage.appendChild(el("p", "dim", "Finding open times..."));
    wrap.appendChild(stage);
    var foot = el("p", "small faint");
    foot.appendChild(document.createTextNode("Times are in " + (tz() || "your local time") + ". "));
    var change = link("Change", H.BASE + "/account");
    change.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/account"); });
    foot.appendChild(change);
    wrap.appendChild(foot);

    var slots = [];
    var horizon = null;
    var loadedTo = new Date();
    var ownerZone = null;
    var minutes = 60;
    var selectedDay = null;
    var stripScroll = 0;

    function fetchMore() {
      var from = loadedTo;
      var to = new Date(from.getTime() + 42 * DAY);
      var q = "?from=" + encodeURIComponent(from.toISOString()) + "&to=" + encodeURIComponent(to.toISOString()) + (opts.except ? "&except=" + encodeURIComponent(opts.except) : "");
      return api("/slots" + q).then(function (data) {
        horizon = new Date(data.horizon);
        ownerZone = data.ownerTimezone || null;
        minutes = data.minutes || minutes;
        var cut = to > horizon ? horizon : to;
        loadedTo = cut;
        var seen = {};
        slots.forEach(function (s) { seen[s.startsAt] = true; });
        data.slots.forEach(function (s) { if (!seen[s.startsAt]) slots.push(s); });
      });
    }

    function load() {
      slots = [];
      loadedTo = new Date();
      return fetchMore().then(drawPicker).catch(function (err) { H.clear(stage); stage.appendChild(el("p", "form-error", err.message)); });
    }

    function byDay() {
      var out = { keys: [], map: {} };
      slots.forEach(function (s) {
        var k = dayKey(s.startsAt);
        if (!out.map[k]) { out.map[k] = []; out.keys.push(k); }
        out.map[k].push(s);
      });
      return out;
    }

    function drawSoonest(first) {
      H.clear(soonest);
      if (!first) return;
      var card = el("div", "card soonest row between");
      var left = el("div", "grow");
      append(left, [el("p", "small dim", "Soonest open time"), el("p", "soonest-when", fmtDay(first.startsAt, true) + ", " + fmtTime(first.startsAt))]);
      append(card, [left, button(opts.except ? "Move it here" : "Take it", "btn primary", function () { confirmSlot(first); })]);
      soonest.appendChild(card);
    }

    function drawPicker() {
      H.clear(stage);
      var days = byDay();
      drawSoonest(slots[0]);
      if (!days.keys.length) {
        stage.appendChild(H.empty("No open times right now. Elliot opens more regularly, so check back soon, or write to contact@chamainteligente.com."));
        return;
      }
      if (!selectedDay || !days.map[selectedDay]) selectedDay = days.keys[0];

      // The strip: every calendar day from today to the last one loaded, so
      // a closed day reads as closed rather than vanishing.
      var max = 1;
      days.keys.forEach(function (k) { max = Math.max(max, days.map[k].length); });
      var strip = el("div", "daystrip");
      strip.setAttribute("role", "listbox");
      strip.setAttribute("aria-label", "Days");
      var cursor = new Date(days.map[days.keys[0]][0].startsAt);
      var lastKey = days.keys[days.keys.length - 1];
      var guard = 0;
      while (guard < 120) {
        guard += 1;
        var iso = cursor.toISOString();
        var k = dayKey(iso);
        var free = (days.map[k] || []).length;
        var chip = el("button", "day" + (free ? "" : " closed") + (k === selectedDay ? " selected" : ""));
        chip.type = "button";
        chip.disabled = !free;
        chip.setAttribute("role", "option");
        chip.setAttribute("aria-selected", String(k === selectedDay));
        chip.setAttribute("aria-label", fmtDay(iso, true) + (free ? ", " + free + " open " + (free === 1 ? "time" : "times") : ", closed"));
        chip.style.setProperty("--heat", String(free / max));
        var dow = new Date(iso).toLocaleDateString(undefined, { timeZone: tz(), weekday: "short" });
        var num = new Date(iso).toLocaleDateString(undefined, { timeZone: tz(), day: "numeric" });
        var mon = new Date(iso).toLocaleDateString(undefined, { timeZone: tz(), month: "short" });
        append(chip, [el("span", "day-dow", dow), el("span", "day-num", num), el("span", "day-mon", mon), el("span", "day-ember")]);
        (function (key) {
          chip.addEventListener("click", function () {
            selectedDay = key;
            stripScroll = strip.scrollLeft;
            drawPicker();
          });
        })(k);
        strip.appendChild(chip);
        if (k >= lastKey) break;
        cursor = new Date(cursor.getTime() + DAY);
      }
      if (horizon && loadedTo < horizon) {
        var more = button("Later dates", "day more", function () {
          more.disabled = true;
          stripScroll = strip.scrollLeft;
          fetchMore().then(drawPicker).catch(function (err) { H.toast(err.message, "bad"); more.disabled = false; });
        });
        strip.appendChild(more);
      }
      stage.appendChild(strip);
      requestAnimationFrame(function () {
        strip.scrollLeft = stripScroll;
        var sel = strip.querySelector(".day.selected");
        if (sel && (sel.offsetLeft < strip.scrollLeft || sel.offsetLeft + sel.offsetWidth > strip.scrollLeft + strip.clientWidth)) {
          strip.scrollLeft = sel.offsetLeft - 16;
        }
      });

      stage.appendChild(dayView(days.map[selectedDay]));
    }

    // The chosen day as its daylight, with every free time an ember on it.
    function dayView(daySlots) {
      var box = el("div", "dayview");
      box.appendChild(el("h2", null, fmtDay(daySlots[0].startsAt, true)));

      var zone = tz();
      var light = el("div", "daylight");
      light.setAttribute("aria-hidden", "true");
      var lo = LIGHT_FROM, hi = LIGHT_TO;
      daySlots.forEach(function (s) { var m = minuteOfDay(s.startsAt, zone); lo = Math.min(lo, Math.floor(m / 60) * 60); hi = Math.max(hi, Math.min(1440, m + minutes)); });
      var span = hi - lo;
      function pct(m) { return (((m - lo) / span) * 100) + "%"; }
      // The open stretches as one glow, a dot at each start, and the hour a
      // hovered time would take lit on top.
      var runs = [];
      daySlots.forEach(function (s) {
        var m = minuteOfDay(s.startsAt, zone);
        var last = runs[runs.length - 1];
        if (last && m <= last[1]) last[1] = Math.max(last[1], m + minutes); else runs.push([m, m + minutes]);
      });
      runs.forEach(function (r) {
        var band = el("span", "band");
        band.style.left = pct(r[0]);
        band.style.width = ((r[1] - r[0]) / span * 100) + "%";
        light.appendChild(band);
      });
      var marks = {};
      daySlots.forEach(function (s) {
        var m = minuteOfDay(s.startsAt, zone);
        var dot = el("span", "spark");
        dot.style.left = pct(m);
        light.appendChild(dot);
        var hour = el("span", "hourlit");
        hour.style.left = pct(m);
        hour.style.width = ((minutes / span) * 100) + "%";
        marks[s.startsAt] = hour;
        light.appendChild(hour);
      });
      [lo, lo + span / 2, hi].forEach(function (m, i) {
        var tick = el("span", "tick" + (i === 0 ? " start" : i === 2 ? " end" : ""), minutesToLabel(Math.round(m / 60) * 60));
        tick.style.left = (i * 50) + "%";
        light.appendChild(tick);
      });
      box.appendChild(light);

      DAY_PARTS.forEach(function (part, idx) {
        var from = idx ? DAY_PARTS[idx - 1].until : 0;
        var inPart = daySlots.filter(function (s) { var m = minuteOfDay(s.startsAt, zone); return m >= from && m < part.until; });
        if (!inPart.length) return;
        var group = el("div", "times-group");
        group.appendChild(el("p", "label", part.label));
        var times = el("div", "times");
        inPart.forEach(function (s, i) {
          var t = button(fmtTime(s.startsAt), "time", function () { confirmSlot(s); });
          t.style.setProperty("--i", String(i));
          function lit(on) { if (marks[s.startsAt]) marks[s.startsAt].classList.toggle("lit", on); }
          t.addEventListener("mouseenter", function () { lit(true); });
          t.addEventListener("mouseleave", function () { lit(false); });
          t.addEventListener("focus", function () { lit(true); });
          t.addEventListener("blur", function () { lit(false); });
          times.appendChild(t);
        });
        group.appendChild(times);
        box.appendChild(group);
      });
      return box;
    }

    function minutesToLabel(m) {
      var d = new Date(Date.UTC(2026, 0, 5, Math.floor(m / 60) % 24, m % 60));
      return d.toLocaleTimeString(undefined, { timeZone: "UTC", hour: "numeric" });
    }

    function confirmSlot(slot) {
      H.clear(soonest);
      H.clear(stage);
      stage.classList.add("confirming");
      var top = el("div", "confirm-when");
      append(top, [
        el("p", "small dim", opts.except ? "Move your session to" : "Your session"),
        el("p", "confirm-day", fmtDay(slot.startsAt, true)),
        el("p", "confirm-time", fmtTime(slot.startsAt) + " to " + fmtTime(slot.endsAt))
      ]);
      if (ownerZone && !sameClock(slot.startsAt, tz(), ownerZone)) {
        top.appendChild(el("p", "small faint", "That is " + new Date(slot.startsAt).toLocaleTimeString(undefined, { timeZone: ownerZone, hour: "numeric", minute: "2-digit" }) + " for Elliot in " + ownerZone.split("/").pop().replace(/_/g, " ") + "."));
      }
      stage.appendChild(top);

      var noteInput = null;
      if (!opts.except && canBook) {
        noteInput = el("textarea", "textarea");
        noteInput.placeholder = "What would make this session worth it? (optional)";
        noteInput.maxLength = 2000;
        noteInput.rows = 3;
        stage.appendChild(H.field("A note for Elliot", noteInput));
      }

      if (!opts.except && pay.billing !== "after") {
        var cost = el("p", "pay-line small");
        if (pay.balance > 0) append(cost, [tokens(pay.balance, true), document.createTextNode("Uses 1 of your " + pay.balance + " credits. Cancel at least " + (opts.cancelNoticeHours || 24) + " hours ahead and it comes back.")]);
        else cost.textContent = "This needs a session credit. Get a pack, then come back for this time.";
        stage.appendChild(cost);
      }

      var row = el("div", "row");
      var ok;
      if (canBook) {
        ok = button(opts.except ? "Move it here" : "Book it", "btn primary book-go", function () {
          ok.disabled = true;
          ok.textContent = opts.except ? "Moving..." : "Booking...";
          var body = { startsAt: slot.startsAt };
          if (noteInput) body.note = noteInput.value;
          var req = opts.except ? api("/bookings/" + opts.except + "/move", { method: "POST", body: body }) : api("/bookings", { method: "POST", body: body });
          req.then(function (r) {
            H.flare();
            booked(slot, r);
          }).catch(function (err) {
            H.toast(err.message, "bad");
            ok.disabled = false;
            ok.textContent = opts.except ? "Move it here" : "Book it";
            if (err.status === 409) { stage.classList.remove("confirming"); load(); }
          });
        });
      } else {
        ok = button("See packs", "btn primary", function () { H.navigate("/sessions/packs"); });
      }
      append(row, [ok, button("Pick another time", "btn ghost", function () { stage.classList.remove("confirming"); drawSoonest(slots[0]); drawPicker(); })]);
      stage.appendChild(row);
      if (noteInput && !("ontouchstart" in window)) noteInput.focus({ preventScroll: true });
      stage.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "nearest" });
    }

    // The ticket: what is now true, and where to go next.
    function booked(slot, result) {
      H.clear(soonest);
      if (payLine && payLine.parentNode) payLine.parentNode.removeChild(payLine);
      H.clear(stage);
      stage.classList.remove("confirming");
      stage.classList.add("ticket");
      var mark = svg("svg", { viewBox: "0 0 120 120", class: "ticket-mark", "aria-hidden": "true" });
      mark.appendChild(svg("circle", { cx: 60, cy: 60, r: 44, fill: "none", stroke: "#f4581f", "stroke-opacity": ".25", "stroke-width": 1.5 }));
      mark.appendChild(svg("circle", { cx: 60, cy: 60, r: 44, fill: "none", stroke: "#f4581f", "stroke-width": 2.5, "stroke-linecap": "round", pathLength: 1, class: "ticket-ring" }));
      mark.appendChild(svg("path", { d: "M42 61 L55 74 L80 47", fill: "none", stroke: "#f4581f", "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, class: "ticket-tick" }));
      stage.appendChild(mark);
      append(stage, [
        el("h2", null, opts.except ? "Moved." : "You're booked."),
        el("p", "confirm-day", fmtDay(slot.startsAt, true)),
        el("p", "confirm-time", fmtTime(slot.startsAt) + " to " + fmtTime(slot.endsAt)),
        el("p", "small dim", "A calendar invitation is on its way to your email. The meeting link is in it and on your Sessions page.")
      ]);
      if (!opts.except && result && typeof result.balance === "number" && pay.billing !== "after") {
        stage.appendChild(el("p", "small faint", result.balance + (result.balance === 1 ? " credit" : " credits") + " left."));
      }
      var row = el("div", "row center-row");
      row.appendChild(button("See my sessions", "btn primary", function () { H.navigate("/sessions"); }));
      var more = pay.billing === "after" || (result && result.balance > 0);
      if (!opts.except && more) row.appendChild(button("Book another", "btn ghost", function () { H.render(); }));
      stage.appendChild(row);
    }

    load();
    return wrap;
  }

  H.register("/sessions/book", function () {
    return Promise.all([api("/credits"), api("/bookings")]).then(function (r) {
      return picker({
        title: "Book a session",
        lede: "Pick a day, then a time. Sessions are " + (r[1].sessionMinutes || 60) + " minutes, on a video call.",
        pay: { billing: r[0].billing || "prebuy", balance: r[0].balance },
        cancelNoticeHours: r[1].cancelNoticeHours
      });
    });
  }, { perm: "sessions.own", title: "Book" });

  H.register("/sessions/move/:id", function (ctx) {
    return picker({ title: "Move a session", lede: "Pick the new time. Nothing changes but the time.", except: ctx.params.id });
  }, { perm: "sessions.own", title: "Move" });

  /* ---------- packs and credits ---------- */

  // Card payment leaves for Stripe's own page and comes back here. Only an
  // https address from the server is followed.
  function payByCard(purchaseId, node) {
    node.disabled = true;
    return api("/purchases/" + encodeURIComponent(purchaseId) + "/checkout", { method: "POST", body: {} }).then(function (data) {
      if (data.url && /^https:\/\//.test(data.url)) { window.location.assign(data.url); return; }
      if (data.paid) { H.toast("That pack is already paid. Your credits are in.", "good"); H.render(); return; }
      if (data.processing) { H.toast("Your payment is still clearing. The credits arrive when it does.", "good"); }
      node.disabled = false;
    }).catch(function (err) { H.toast(err.message, "bad"); node.disabled = false; });
  }

  // Back from Stripe: the server asks Stripe what happened, then the address
  // bar is tidied so a reload does not ask again.
  function checkoutReturn(query) {
    if (!query || !query.checkout) return Promise.resolve();
    history.replaceState(null, "", location.pathname);
    if (query.checkout === "cancelled") {
      H.toast("Checkout cancelled. Nothing was charged.");
      return Promise.resolve();
    }
    if (query.checkout !== "done" || !query.purchase) return Promise.resolve();
    return api("/purchases/" + encodeURIComponent(query.purchase) + "/checkout/confirm", { method: "POST", body: {} }).then(function (data) {
      if (data.status === "paid") {
        H.toast("Paid. " + data.sessions + " session credits are in your account.", "good");
        H.flare();
      } else if (data.status === "processing") {
        H.toast("Your payment is still clearing. The credits arrive when it does, and you will get an email.", "good");
      } else {
        H.toast("Stripe has not confirmed the payment yet. If you paid, the credits arrive within the hour.");
      }
    }).catch(function (err) { H.toast(err.message, "bad"); });
  }

  H.register("/sessions/packs", function (ctx) {
    var wrap = el("div", "stack");
    return checkoutReturn(ctx && ctx.query).then(function () {
      return Promise.all([api("/packs").catch(function () { return { packs: [] }; }), api("/credits")]);
    }).then(function (r) {
      var packs = r[0].packs, credits = r[1];
      // Packs are not for a member billed after; their Sessions page is.
      if (credits.billing === "after") { H.navigate("/sessions", true); return wrap; }
      var card = Boolean(r[0].cardCheckout);
      wrap.appendChild(H.viewHead("Packs and credits", card
        ? "A pack is a set of sessions. Pay by card and the credits arrive straight away, or ask for an invoice."
        : "A pack is a set of sessions. Request one, and the credits are added when the invoice is paid."));
      var bal = el("div", "card row between");
      append(bal, [append(el("div", "stat"), [el("div", "num" + (credits.balance > 0 ? " ember" : ""), String(credits.balance)), el("div", "what", "credits left")]),
        credits.balance > 0 ? button("Book a session", "btn primary", function () { H.navigate("/sessions/book"); }) : null]);
      wrap.appendChild(bal);
      if (credits.pendingDiscount) {
        wrap.appendChild(append(el("div", "card glow"), [el("p", "label", "Referral reward"), el("p", "small", credits.pendingDiscount.percent + "% off your next pack, from someone you sent here. It applies itself when you ask for one.")]));
      }
      var open = credits.purchases.filter(function (p) { return p.status === "requested" || p.status === "invoiced"; });
      if (open.length) {
        var oc = el("div", "card stack tight");
        oc.appendChild(el("p", "label", "In progress"));
        open.forEach(function (p) {
          var line = el("p", "small", p.packName + ", " + p.sessions + " sessions: " + (p.status === "requested" ? (p.cardStarted ? "card payment started" : "requested") : "invoiced, awaiting payment"));
          var net = p.amountCents === null || p.amountCents === undefined ? null : p.amountCents - (p.discountCents || 0);
          if (card && p.status === "requested" && net !== null && net >= 50) {
            var pay = button("Pay " + money(net, p.currency) + " by card", "btn sm primary", function () { payByCard(p.id, pay); });
            oc.appendChild(append(el("div", "row between"), [line, pay]));
          } else {
            oc.appendChild(line);
          }
        });
        wrap.appendChild(oc);
      }
      if (packs.length) {
        var grid = el("div", "grid2 rise");
        packs.forEach(function (p, i) {
          var c = el("div", "card stack tight");
          c.style.setProperty("--i", String(i));
          append(c, [el("h3", null, p.name), el("p", "small dim", p.description || ""), el("p", null, p.sessions + (p.sessions === 1 ? " session of " : " sessions of ") + p.minutes + " minutes"), el("p", "ember", money(p.priceCents, p.currency))]);
          var payable = card && p.priceCents !== null && p.priceCents !== undefined && p.priceCents >= 50;
          var ask = button(payable ? "Ask for an invoice" : "Ask for this pack", payable ? "btn ghost" : "btn", function () {
            ask.disabled = true;
            api("/purchases", { method: "POST", body: { packId: p.id } }).then(function () {
              H.toast("Requested. Elliot will send the invoice.", "good");
              H.flare();
              H.render();
            }).catch(function (err) { H.toast(err.message, "bad"); ask.disabled = false; });
          });
          var row = el("div", "row");
          if (payable) {
            var cardBtn = button("Pay by card", "btn primary", function () {
              cardBtn.disabled = true;
              api("/purchases", { method: "POST", body: { packId: p.id, card: true } }).then(function (data) {
                return payByCard(data.purchase.id, cardBtn);
              }).catch(function (err) { H.toast(err.message, "bad"); cardBtn.disabled = false; });
            });
            row.appendChild(cardBtn);
          }
          row.appendChild(ask);
          c.appendChild(row);
          grid.appendChild(c);
        });
        wrap.appendChild(grid);
      } else {
        wrap.appendChild(H.empty("No packs available. Contact Elliot directly."));
      }
      if (credits.ledger.length) {
        var lc = el("div", "card pad0");
        var lh = el("div", "row between");
        lh.style.padding = "0.9rem 1.1rem";
        lh.appendChild(el("p", "label", "Credit history"));
        lc.appendChild(lh);
        var list = el("div", "list");
        credits.ledger.forEach(function (e) {
          var row = el("div");
          var reasons = { purchase: "pack paid", booking: "session booked", cancel: "session cancelled", referral: "referral reward", grant: "from Elliot" };
          append(row, [append(el("div"), [el("div", "primary", (e.delta > 0 ? "+" : "") + e.delta + " · " + (reasons[e.reason] || e.reason)), el("div", "secondary", e.note || "")]), el("div", "meta", H.fmtDate(e.created_at, { dateStyle: "medium" }))]);
          list.appendChild(row);
        });
        lc.appendChild(list);
        wrap.appendChild(lc);
      }
      return wrap;
    });
  }, { perm: "sessions.own", title: "Packs" });

  /* ---------- home tiles ---------- */

  H.onHome(function (tile) {
    if (!H.can("sessions.own") || H.can("sessions.manage")) return;
    return api("/bookings").then(function (data) {
      var next = data.bookings.filter(function (b) { return b.status === "scheduled" && new Date(b.endsAt) > new Date(); }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); })[0];
      if (data.billing !== "after") H.countUp(tile(data.balance, "credits left", data.balance > 0), data.balance);
      tile(next ? fmtDay(next.startsAt) : "none booked", next ? "next session, " + fmtTime(next.startsAt) : "next session", Boolean(next));
    });
  });

  // A member who has never said who pays is asked once, on Home, so a
  // company gets its invoice made out to it from the start.
  H.onHome(function (tile, wrap) {
    if (!H.can("sessions.own") || H.can("purchases.manage")) return;
    return api("/billing").then(function (data) {
      if (data.billing) return;
      var card = el("div", "card stack tight");
      append(card, [
        el("p", "label", "Billing details"),
        el("p", null, "Paying through a company? Add its name, address and tax number, and your invoices are made out to it.")
      ]);
      card.appendChild(append(el("div", "row"), [button("Add billing details", "btn sm primary", function () { H.navigate("/billing"); })]));
      var tiles = wrap.querySelector(".stats");
      wrap.insertBefore(card, tiles ? tiles.nextSibling : null);
    });
  });

  // An invoice waiting to be paid is the first thing anyone sees, guests
  // included: someone can be billed before they are a client.
  H.onHome(function (tile, wrap) {
    return api("/invoices").then(function (data) {
      var open = (data.invoices || []).filter(function (i) { return i.status === "open"; });
      if (!open.length) return;
      var card = invoicesCard(open);
      card.classList.add("glow");
      var tiles = wrap.querySelector(".stats");
      wrap.insertBefore(card, tiles ? tiles.nextSibling : null);
    });
  });
})();
