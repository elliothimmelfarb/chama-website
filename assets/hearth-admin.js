/* ==========================================================================
   The Hearth, the owner's side: members, roles, the log, metrics, settings.

   This file registers the rooms only the business walks into. It is loaded
   after hearth.js and speaks to it through window.Hearth: register for the
   routes, api for the wire, and the same DOM helpers so both files read as
   one. Nothing new is styled here; every class comes from hearth.css.

   The same hard rule holds: everything the API returns is data. It reaches
   the page through textContent or attributes set from code. There is no
   innerHTML anywhere and no HTML is assembled from a value, which matters
   most in the log, where the details column is other people's text.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;

  var el = H.el;
  var append = H.append;
  var clear = H.clear;
  var button = H.button;
  var field = H.field;
  var input = H.input;
  var pill = H.pill;
  var avatar = H.avatar;
  var api = H.api;
  var toast = H.toast;
  var flare = H.flare;
  var can = H.can;
  var fmtDate = H.fmtDate;
  var fmtRelative = H.fmtRelative;
  var BASE = H.BASE;

  // The event names the audit log writes, kept in step with lib/hearth/audit.js.
  // They only fill a datalist, so a name gone stale costs a suggestion.
  var EVENT_NAMES = [
    "auth.sign_in", "auth.sign_out", "auth.sign_out_all", "auth.failed",
    "auth.link_sent", "auth.email_verified", "auth.password_set",
    "user.created", "user.profile_updated",
    "member.role_changed", "member.status_changed", "member.permission_changed",
    "role.updated", "settings.updated",
    "key.created", "key.revoked", "mcp.call",
    "oauth.client_registered", "oauth.consent", "oauth.revoked"
  ];

  var ROLE_ORDER = ["owner", "staff", "client", "guest"];

  /* ---------- small shared pieces ---------- */

  // A select built from [{ value, label }], with one option marked.
  function select(options, value, onChange) {
    var node = el("select", "select");
    options.forEach(function (opt) {
      var o = el("option", null, opt.label);
      o.value = opt.value;
      if (opt.value === value) o.selected = true;
      node.appendChild(o);
    });
    if (onChange) node.addEventListener("change", function () { onChange(node.value); });
    return node;
  }

  function textarea(value, rows) {
    var node = el("textarea", "textarea");
    if (rows) node.rows = rows;
    if (value) node.value = value;
    return node;
  }

  // A checkbox in the switch dress. Returns both the row and the input.
  function toggle(labelText, checked) {
    var wrap = el("label", "switch");
    var box = el("input");
    box.type = "checkbox";
    box.checked = Boolean(checked);
    wrap.appendChild(box);
    wrap.appendChild(el("span", null, labelText));
    return { node: wrap, input: box };
  }

  function check(labelText, checked, disabled) {
    var wrap = el("label", "check");
    var box = el("input");
    box.type = "checkbox";
    box.checked = Boolean(checked);
    if (disabled) box.disabled = true;
    wrap.appendChild(box);
    wrap.appendChild(el("span", null, labelText));
    return { node: wrap, input: box };
  }

  // Every write disables its own button until the server has answered, so a
  // double click cannot send the change twice.
  function busy(node, promise) {
    node.disabled = true;
    return promise.then(function (result) {
      node.disabled = false;
      return result;
    }, function (error) {
      node.disabled = false;
      throw error;
    });
  }

  function sectionCard(labelText, hint) {
    var card = el("div", "card stack tight");
    card.appendChild(el("p", "label", labelText));
    if (hint) card.appendChild(el("p", "small dim", hint));
    return card;
  }

  function rise(node, index) {
    node.style.setProperty("--i", String(index));
    return node;
  }

  function roleLabel(name) {
    var labels = { owner: "Owner", staff: "Staff", client: "Client", guest: "Guest" };
    return labels[name] || name || "";
  }

  function memberName(member) {
    return (member && (member.name || member.email)) || "Someone";
  }

  function isOwner() {
    return H.state.user && H.state.user.role === "owner";
  }

  function roleOptions(includeAll) {
    var out = includeAll ? [{ value: "", label: "Every role" }] : [];
    ROLE_ORDER.forEach(function (name) {
      if (name === "owner" && !isOwner() && !includeAll) return;
      out.push({ value: name, label: roleLabel(name) });
    });
    return out;
  }

  // Ids are uuids in the log and in targets; eight characters is enough to
  // recognise one and short enough to keep the table readable.
  function shortId(value) {
    var text = value === null || value === undefined ? "" : String(value);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) return text.slice(0, 8);
    return text;
  }

  // The meta column: key=value pairs, everything stringified, the whole thing
  // capped. It is written by whatever wrote the log line, so it is only ever
  // text content.
  function metaText(meta) {
    if (!meta || typeof meta !== "object") return "";
    var parts = [];
    Object.keys(meta).forEach(function (key) {
      var value = meta[key];
      if (value === null || value === undefined) return;
      var text = typeof value === "object" ? JSON.stringify(value) : String(value);
      parts.push(key + "=" + text);
    });
    var joined = parts.join(" ");
    return joined.length > 80 ? joined.slice(0, 79) + "…" : joined;
  }

  function actorText(row) {
    if (row.actor_name || row.actor_email) return row.actor_name || row.actor_email;
    if (row.actor_kind && row.actor_kind !== "user") return row.actor_kind + " " + shortId(row.actor_ref || "");
    if (row.actor_user_id) return shortId(row.actor_user_id);
    return "system";
  }

  function whereText(row) {
    return [row.country || "", row.device || ""].filter(Boolean).join(" · ");
  }

  function table(headings) {
    var wrap = el("div", "tbl-wrap");
    var node = el("table", "tbl");
    var head = el("thead");
    var headRow = el("tr");
    headings.forEach(function (h) { headRow.appendChild(el("th", null, h)); });
    head.appendChild(headRow);
    node.appendChild(head);
    var body = el("tbody");
    node.appendChild(body);
    wrap.appendChild(node);
    return { wrap: wrap, body: body };
  }

  function cells(row, values) {
    values.forEach(function (value) { row.appendChild(el("td", null, value)); });
    return row;
  }

  // The permission catalog, grouped in the order the server lists it.
  function byGroup(catalog) {
    var groups = [];
    catalog.forEach(function (permission) {
      var group = groups.filter(function (g) { return g.name === permission.group; })[0];
      if (!group) { group = { name: permission.group, items: [] }; groups.push(group); }
      group.items.push(permission);
    });
    return groups;
  }

  /* ---------- members ---------- */

  H.register("/admin/members", function () {
    var wrap = el("div", "stack");
    var q = "";
    var role = "";

    var invite = el("div");
    invite.hidden = true;
    var inviteBuilt = false;

    var actions = [];
    if (can("members.manage")) {
      actions.push(button("Invite", "btn primary", function () {
        if (!inviteBuilt) { invite.appendChild(inviteCard()); inviteBuilt = true; }
        invite.hidden = !invite.hidden;
      }));
    }
    wrap.appendChild(H.viewHead("Members", "Everyone with a place here, and who is in the room now.", actions.length ? actions : null));
    wrap.appendChild(invite);

    var controls = el("div", "row");
    var search = input("search", "q", "Search name or email");
    search.classList.add("grow");
    var roleSelect = select(roleOptions(true), "", function (value) { role = value; load(); });
    append(controls, [search, roleSelect]);
    wrap.appendChild(controls);

    // The search waits a quarter of a second after the last keystroke, so
    // typing a name is one request and not nine.
    var timer = null;
    search.addEventListener("input", function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { q = search.value; load(); }, 250);
    });

    var stats = el("div", "grid3 rise");
    wrap.appendChild(stats);
    var listCard = el("div", "card pad0");
    wrap.appendChild(listCard);

    function inviteCard() {
      var card = el("div", "card stack tight");
      card.appendChild(el("p", "label", "Invite someone"));
      card.appendChild(el("p", "small dim", "They get an email with a sign-in link. A place is made for them if they do not have one."));
      var form = el("form", "stack tight");
      var email = input("email", "email", "them@example.com");
      email.required = true;
      var name = input("text", "name", "Their name (optional)");
      var who = select(roleOptions(false), "client");
      var send = button("Send invitation", "btn primary");
      send.type = "submit";
      var status = el("p", "form-error");
      append(form, [field("Email", email), field("Name", name), field("Role", who), append(el("div", "row"), [send]), status]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        status.textContent = "";
        busy(send, api("/admin/invite", { method: "POST", body: { email: email.value, name: name.value, role: who.value } }))
          .then(function () {
            toast("Invitation sent.", "good");
            flare();
            email.value = "";
            name.value = "";
            invite.hidden = true;
            load();
          })
          .catch(function (error) {
            status.textContent = error.message;
            toast(error.message, "bad");
          });
      });
      card.appendChild(form);
      return card;
    }

    function tile(value, what, emberish, index) {
      var card = rise(el("div", "card stat"), index);
      var num = el("div", "num" + (emberish ? " ember" : ""), "0");
      card.appendChild(num);
      card.appendChild(el("div", "what", what));
      stats.appendChild(card);
      H.countUp(num, value);
    }

    function draw(members) {
      clear(stats);
      var online = members.filter(function (m) { return m.liveSessions > 0; }).length;
      var clients = members.filter(function (m) { return m.role === "client"; }).length;
      var guests = members.filter(function (m) { return m.role === "guest"; }).length;
      tile(members.length, "members", false, 0);
      tile(online, "online now", true, 1);
      tile(clients, "clients", false, 2);
      tile(guests, "guests", false, 3);

      clear(listCard);
      if (!members.length) {
        listCard.appendChild(H.empty("Nobody matches that."));
        return;
      }
      var list = el("div", "list");
      members.forEach(function (member) {
        var row = el("a");
        row.href = BASE + "/admin/members/" + encodeURIComponent(member.id);
        row.addEventListener("click", function (e) { e.preventDefault(); H.navigate("/admin/members/" + encodeURIComponent(member.id)); });
        var left = el("div", "row");
        var text = el("div", "grow");
        append(text, [
          el("div", "primary", memberName(member)),
          el("div", "secondary", member.email + (member.lastSeenAt ? " · last seen " + fmtRelative(member.lastSeenAt) : " · never signed in"))
        ]);
        append(left, [avatar(member), text]);
        var right = el("div", "row");
        if (member.liveSessions > 0) right.appendChild(pill("live", "live"));
        if (member.status !== "active") right.appendChild(pill(member.status, "bad"));
        right.appendChild(pill(roleLabel(member.role), member.role));
        append(row, [left, right]);
        list.appendChild(row);
      });
      listCard.appendChild(list);
    }

    function load() {
      var path = "/admin/members?q=" + encodeURIComponent(q) + "&role=" + encodeURIComponent(role);
      return api(path).then(function (data) { draw(data.members || []); }, function (error) {
        clear(listCard);
        listCard.appendChild(H.empty(error.message));
      });
    }

    return load().then(function () { return wrap; });
  }, { perm: "members.read", title: "Members", nav: { group: "Business", label: "Members", order: 0 } });

  /* ---------- one member ---------- */

  H.register("/admin/members/:id", function (ctx) {
    var id = ctx.params.id;
    var manage = can("members.manage");
    var wants = [api("/admin/members/" + encodeURIComponent(id))];
    wants.push(manage ? api("/admin/permissions").catch(function () { return null; }) : Promise.resolve(null));

    return Promise.all(wants).then(function (results) {
      var data = results[0];
      var catalog = results[1] && results[1].permissions ? results[1].permissions : null;
      var member = data.member;
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead(memberName(member), "", [button("Back to members", "btn ghost", function () { H.navigate("/admin/members"); })]));

      wrap.appendChild(headCard(member, data.referrer));
      if (manage) wrap.appendChild(actionsCard(member));
      wrap.appendChild(waysCard(data.identities || []));
      wrap.appendChild(devicesCard(data.sessions || []));
      if (manage) wrap.appendChild(overridesCard(member, catalog, data.overrides || []));
      wrap.appendChild(referralsCard(data.referrals || []));
      wrap.appendChild(activityCard(data.recent || []));
      return wrap;
    });

    function headCard(member, referrer) {
      var card = el("div", "card stack tight");
      var top = el("div", "row");
      var text = el("div", "grow");
      append(text, [el("p", null, member.name || "No name yet"), el("p", "small dim", member.email)]);
      var right = el("div", "row");
      if (member.status !== "active") right.appendChild(pill(member.status, "bad"));
      right.appendChild(pill(roleLabel(member.role), member.role));
      append(top, [avatar(member, "lg"), text, right]);
      card.appendChild(top);

      var facts = el("div", "list");
      function fact(what, value) {
        if (!value) return;
        var row = el("div");
        append(row, [el("div", "primary", what), el("div", "meta", value)]);
        facts.appendChild(row);
      }
      fact("Joined", fmtDate(member.createdAt));
      fact("Last seen", member.lastSeenAt ? fmtRelative(member.lastSeenAt) : "never");
      fact("Timezone", member.timezone);
      fact("Email verified", member.emailVerified ? "yes" : "no");
      if (referrer) fact("Came in through", referrer.name || referrer.email);
      card.appendChild(facts);
      return card;
    }

    function actionsCard(member) {
      var card = sectionCard("Their standing", "Role, access, and what you want to remember about them.");

      var roleRow = el("div", "row");
      var roleSelect = select(roleOptions(false), member.role);
      roleSelect.classList.add("grow");
      var saveRole = button("Save role", "btn", function () {
        busy(saveRole, api("/admin/members/" + encodeURIComponent(member.id), { method: "PATCH", body: { role: roleSelect.value } }))
          .then(function () { toast("Role saved.", "good"); flare(); H.render(); })
          .catch(function (error) { toast(error.message, "bad"); });
      });
      append(roleRow, [roleSelect, saveRole]);
      card.appendChild(field("Role", roleRow));

      var suspended = member.status !== "active";
      var statusButton = button(suspended ? "Reactivate" : "Suspend", suspended ? "btn" : "btn danger", function () {
        var next = suspended ? "active" : "suspended";
        var question = suspended
          ? "Let " + memberName(member) + " back in?"
          : "Suspend " + memberName(member) + "? They are signed out everywhere and cannot sign back in.";
        if (!window.confirm(question)) return;
        busy(statusButton, api("/admin/members/" + encodeURIComponent(member.id), { method: "PATCH", body: { status: next } }))
          .then(function () { toast(suspended ? "They are back in." : "Suspended.", "good"); H.render(); })
          .catch(function (error) { toast(error.message, "bad"); });
      });
      card.appendChild(append(el("div", "row"), [statusButton]));

      var notes = textarea(member.notes || "", 4);
      var saveNotes = button("Save notes", "btn", function () {
        busy(saveNotes, api("/admin/members/" + encodeURIComponent(member.id), { method: "PATCH", body: { notes: notes.value } }))
          .then(function () { toast("Notes saved.", "good"); flare(); })
          .catch(function (error) { toast(error.message, "bad"); });
      });
      card.appendChild(field("Notes", notes, "Only the business sees these."));
      card.appendChild(append(el("div", "row"), [saveNotes]));
      return card;
    }

    function waysCard(identities) {
      var card = el("div", "card pad0");
      var head = el("div", "row between");
      head.style.padding = "0.9rem 1.1rem";
      head.appendChild(el("p", "label", "Ways in"));
      card.appendChild(head);
      var list = el("div", "list");
      identities.forEach(function (identity) {
        var row = el("div");
        var left = el("div");
        append(left, [
          el("div", "primary", { google: "Google", github: "GitHub", discord: "Discord", email: "Email" }[identity.provider] || identity.provider),
          el("div", "secondary", identity.email || "")
        ]);
        append(row, [left, el("div", "meta", identity.created_at ? "linked " + fmtRelative(identity.created_at) : "")]);
        list.appendChild(row);
      });
      if (!identities.length) {
        var only = el("div");
        append(only, [el("div", "primary", "Email link"), el("div", "meta", "the only way in so far")]);
        list.appendChild(only);
      }
      card.appendChild(list);
      return card;
    }

    function devicesCard(sessions) {
      var card = el("div", "card pad0");
      var head = el("div", "row between");
      head.style.padding = "0.9rem 1.1rem";
      head.appendChild(el("p", "label", "Signed-in devices"));
      card.appendChild(head);
      if (!sessions.length) {
        var none = el("div");
        none.style.padding = "0 1.1rem 1rem";
        none.appendChild(el("p", "small dim", "Not signed in anywhere."));
        card.appendChild(none);
        return card;
      }
      var list = el("div", "list");
      sessions.forEach(function (session) {
        var row = el("div");
        var left = el("div");
        append(left, [
          el("div", "primary", (session.device || "unknown device") + (session.country ? " · " + session.country : "")),
          el("div", "secondary", "since " + fmtDate(session.createdAt))
        ]);
        append(row, [left, el("div", "meta", "last seen " + fmtRelative(session.lastSeenAt))]);
        list.appendChild(row);
      });
      card.appendChild(list);
      return card;
    }

    // Three states per permission: inherit what the role says, grant it on
    // top, or deny it whatever the role says. Each click is its own request,
    // which is the shape the server takes.
    function overridesCard(member, catalog, overrides) {
      var card = sectionCard("Permission overrides", "On top of the role. Inherit means the role decides.");
      if (member.role === "owner") {
        card.appendChild(el("p", "small dim", "An owner holds every permission, always. There is nothing to override."));
        return card;
      }
      if (!catalog) {
        card.appendChild(el("p", "small dim", "The permission catalog could not be loaded."));
        return card;
      }
      var current = {};
      overrides.forEach(function (o) { current[o.permission] = Boolean(o.granted); });

      byGroup(catalog).forEach(function (group) {
        card.appendChild(el("p", "small faint mt", group.name));
        group.items.forEach(function (permission) {
          var row = el("div", "row between");
          row.appendChild(el("div", "grow small", permission.label));
          var choices = el("div", "row");
          var value = permission.key in current ? current[permission.key] : null;
          var buttons = [];
          function paint() {
            buttons.forEach(function (b) {
              b.node.className = "btn sm" + (b.value === value ? " primary" : " ghost");
            });
          }
          [{ value: null, label: "Inherit" }, { value: true, label: "Grant" }, { value: false, label: "Deny" }].forEach(function (choice) {
            var node = button(choice.label, "btn sm ghost", function () {
              if (choice.value === value) return;
              busy(node, api("/admin/members/" + encodeURIComponent(member.id) + "/permissions", {
                method: "PUT", body: { permission: permission.key, granted: choice.value }
              })).then(function () {
                value = choice.value;
                paint();
                toast("Saved.", "good");
              }).catch(function (error) { toast(error.message, "bad"); });
            });
            buttons.push({ node: node, value: choice.value });
            choices.appendChild(node);
          });
          paint();
          row.appendChild(choices);
          card.appendChild(row);
        });
      });
      return card;
    }

    function referralsCard(referrals) {
      var card = el("div", "card pad0");
      var head = el("div", "row between");
      head.style.padding = "0.9rem 1.1rem";
      head.appendChild(el("p", "label", "Referrals"));
      card.appendChild(head);
      if (!referrals.length) {
        var none = el("div");
        none.style.padding = "0 1.1rem 1rem";
        none.appendChild(el("p", "small dim", "Nobody yet."));
        card.appendChild(none);
        return card;
      }
      var list = el("div", "list");
      referrals.forEach(function (referral) {
        var row = el("div");
        var left = el("div");
        append(left, [
          el("div", "primary", referral.name || referral.email),
          el("div", "secondary", fmtDate(referral.created_at, { dateStyle: "medium" }))
        ]);
        append(row, [left, pill(referral.status || "pending")]);
        list.appendChild(row);
      });
      card.appendChild(list);
      return card;
    }

    function activityCard(recent) {
      var card = el("div", "card stack tight");
      card.appendChild(el("p", "label", "Recent activity"));
      if (!recent.length) {
        card.appendChild(el("p", "small dim", "Nothing recorded yet."));
        return card;
      }
      var built = table(["Time", "Event", "Target", "Details", "Where"]);
      recent.forEach(function (row) {
        built.body.appendChild(cells(el("tr"), [
          fmtDate(row.at),
          row.event,
          shortId(row.target),
          metaText(row.meta),
          whereText(row)
        ]));
      });
      card.appendChild(built.wrap);
      return card;
    }
  }, { perm: "members.read", title: "Member" });

  /* ---------- roles ---------- */

  H.register("/admin/roles", function () {
    return api("/admin/roles").then(function (data) {
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead("Roles", "What each kind of person can do here. Overrides for one person live on their page."));
      var catalog = data.catalog || [];
      var roles = (data.roles || []).slice().sort(function (a, b) {
        return ROLE_ORDER.indexOf(a.name) - ROLE_ORDER.indexOf(b.name);
      });

      var cards = el("div", "stack rise");
      roles.forEach(function (role, index) {
        cards.appendChild(rise(roleCard(role, catalog), index));
      });
      wrap.appendChild(cards);
      return wrap;
    });

    function roleCard(role, catalog) {
      var isTheOwner = role.name === "owner";
      var card = el("div", "card stack tight");
      var head = el("div", "row between");
      append(head, [el("p", "label", role.label || roleLabel(role.name)), pill(roleLabel(role.name), role.name)]);
      card.appendChild(head);
      if (role.description) card.appendChild(el("p", "small dim", role.description));
      if (isTheOwner) card.appendChild(el("p", "small dim", "The owner role always holds every permission."));

      var held = {};
      (Array.isArray(role.permissions) ? role.permissions : []).forEach(function (key) { held[key] = true; });
      var boxes = [];

      byGroup(catalog).forEach(function (group) {
        card.appendChild(el("p", "small faint mt", group.name));
        var checks = el("div", "checks");
        group.items.forEach(function (permission) {
          var box = check(permission.label, isTheOwner || held[permission.key], isTheOwner);
          boxes.push({ key: permission.key, input: box.input });
          checks.appendChild(box.node);
        });
        card.appendChild(checks);
      });

      if (!isTheOwner) {
        var save = button("Save " + (role.label || role.name), "btn primary", function () {
          var keys = boxes.filter(function (b) { return b.input.checked; }).map(function (b) { return b.key; });
          busy(save, api("/admin/roles/" + encodeURIComponent(role.name), { method: "PUT", body: { permissions: keys } }))
            .then(function () { toast("Saved.", "good"); flare(); })
            .catch(function (error) { toast(error.message, "bad"); });
        });
        card.appendChild(append(el("div", "row mt"), [save]));
      }
      return card;
    }
  }, { perm: "roles.manage", title: "Roles", nav: { group: "Business", label: "Roles", order: 1 } });

  /* ---------- the log ---------- */

  H.register("/admin/log", function (ctx) {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Log", "Every sign-in, change and agent call, oldest hidden behind Load more."));

    var eventInput = input("text", "event", "auth. or mcp.call");
    eventInput.setAttribute("list", "hearth-events");
    var datalist = el("datalist");
    datalist.id = "hearth-events";
    EVENT_NAMES.forEach(function (name) {
      var option = el("option");
      option.value = name;
      datalist.appendChild(option);
    });
    var actorInput = input("text", "actor", "Actor id (optional)", ctx.query.actor || "");

    var apply = button("Filter", "btn", function () { first(); });
    var controls = el("form", "row");
    append(controls, [
      append(el("div", "grow"), [eventInput, datalist]),
      append(el("div", "grow"), [actorInput]),
      apply
    ]);
    controls.addEventListener("submit", function (e) { e.preventDefault(); first(); });
    wrap.appendChild(controls);

    var card = el("div", "card stack tight");
    var built = table(["Time", "Actor", "Event", "Target", "Details", "Where"]);
    card.appendChild(built.wrap);
    var footer = el("div", "row");
    card.appendChild(footer);
    wrap.appendChild(card);

    var more = button("Load more", "btn sm", function () { fetchPage(more.dataset.before); });
    more.hidden = true;
    footer.appendChild(more);
    var status = el("p", "small dim");
    footer.appendChild(status);

    function draw(entries) {
      entries.forEach(function (row) {
        built.body.appendChild(cells(el("tr"), [
          fmtDate(row.at),
          actorText(row),
          row.event,
          shortId(row.target),
          metaText(row.meta),
          whereText(row)
        ]));
      });
    }

    function fetchPage(before) {
      var path = "/admin/audit?event=" + encodeURIComponent(eventInput.value.trim()) +
        "&actor=" + encodeURIComponent(actorInput.value.trim()) +
        (before ? "&before=" + encodeURIComponent(before) : "");
      return busy(more, api(path)).then(function (data) {
        var entries = data.entries || [];
        draw(entries);
        if (data.nextBefore) {
          more.dataset.before = String(data.nextBefore);
          more.hidden = false;
        } else {
          more.hidden = true;
        }
        if (!built.body.childNodes.length) status.textContent = "Nothing matches that.";
        else status.textContent = "";
      }, function (error) {
        status.textContent = error.message;
      });
    }

    function first() {
      clear(built.body);
      status.textContent = "";
      return fetchPage(null);
    }

    return first().then(function () { return wrap; });
  }, { perm: "audit.read", title: "Log", nav: { group: "Business", label: "Log", order: 2 } });

  /* ---------- metrics ---------- */

  H.register("/admin/metrics", function () {
    return api("/admin/metrics").then(function (data) {
      var totals = data.totals || {};
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead("Metrics", "The last " + (data.days || 30) + " days of the room."));

      var tiles = el("div", "grid3 rise");
      var index = 0;
      function tile(value, what, emberish) {
        var card = rise(el("div", "card stat"), index++);
        var num = el("div", "num" + (emberish ? " ember" : ""), "0");
        card.appendChild(num);
        card.appendChild(el("div", "what", what));
        tiles.appendChild(card);
        H.countUp(num, Number(value || 0));
      }
      tile(totals.members, "members");
      tile(totals.active_week, "active this week");
      tile(totals.live_sessions, "live sessions", true);
      tile(totals.api_keys, "API keys");
      tile(totals.connected_agents, "connected agents");
      tile(totals.mcp_calls, "MCP calls (30 d)");
      wrap.appendChild(tiles);

      var charts = el("div", "stack rise");
      var byDay = data.byDay || [];
      [
        { key: "auth.sign_in", label: "Sign-ins" },
        { key: "user.created", label: "New members" },
        { key: "mcp.call", label: "MCP calls" }
      ].forEach(function (spec, i) {
        var card = rise(el("div", "card stack tight"), i);
        card.appendChild(el("p", "label", spec.label));
        card.appendChild(H.barChart(byDay, data.days || 30, spec.key));
        charts.appendChild(card);
      });
      wrap.appendChild(charts);

      var split = el("div", "grid2");

      var rolesCard = el("div", "card stack tight");
      rolesCard.appendChild(el("p", "label", "Members by role"));
      var rolesList = el("div", "list");
      (data.byRole || []).slice().sort(function (a, b) {
        return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
      }).forEach(function (row) {
        var line = el("div");
        append(line, [el("div", "primary", roleLabel(row.role)), el("div", "meta", String(row.n))]);
        rolesList.appendChild(line);
      });
      rolesCard.appendChild((data.byRole || []).length ? rolesList : el("p", "small dim", "Nobody yet."));
      split.appendChild(rolesCard);

      var hereCard = el("div", "card stack tight");
      hereCard.appendChild(el("p", "label", "Here now"));
      var presence = data.presence || [];
      if (!presence.length) {
        hereCard.appendChild(el("p", "small dim", "The room is empty."));
      } else {
        var hereList = el("div", "list");
        presence.forEach(function (person) {
          var row = el("div");
          var left = el("div", "row");
          var text = el("div", "grow");
          append(text, [el("div", "primary", memberName(person)), el("div", "secondary", fmtRelative(person.lastSeenAt))]);
          append(left, [avatar(person), text]);
          append(row, [left, pill(roleLabel(person.role), person.role)]);
          hereList.appendChild(row);
        });
        hereCard.appendChild(hereList);
      }
      split.appendChild(hereCard);
      wrap.appendChild(split);

      var toolsCard = el("div", "card stack tight");
      toolsCard.appendChild(el("p", "label", "Top tools"));
      var tools = (data.topTools || []).filter(function (t) { return t.tool; });
      if (!tools.length) {
        toolsCard.appendChild(H.empty("No agent calls yet."));
      } else {
        var toolList = el("div", "list");
        tools.forEach(function (tool) {
          var row = el("div");
          append(row, [el("div", "primary", tool.tool), el("div", "meta", String(tool.n))]);
          toolList.appendChild(row);
        });
        toolsCard.appendChild(toolList);
      }
      wrap.appendChild(toolsCard);
      return wrap;
    });
  }, { perm: "metrics.read", title: "Metrics", nav: { group: "Business", label: "Metrics", order: 3 } });

  /* ---------- settings ---------- */

  H.register("/admin/settings", function () {
    return api("/admin/settings").then(function (data) {
      var settings = data.settings || {};
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead("Settings", "How the room behaves: sessions, booking, referrals, and what is open to the public."));

      var form = el("form", "stack");
      var errorLine = el("p", "form-error");

      var booking = el("div", "card stack tight");
      booking.appendChild(el("p", "label", "Sessions and booking"));
      var sessionMinutes = input("number", "session_minutes", "60", settings.session_minutes);
      var minNotice = input("number", "min_notice_hours", "24", settings.min_notice_hours);
      var horizon = input("number", "booking_horizon_days", "60", settings.booking_horizon_days);
      var cancelNotice = input("number", "cancel_notice_hours", "24", settings.cancel_notice_hours);
      [sessionMinutes, minNotice, horizon, cancelNotice].forEach(function (node) { node.min = "0"; node.step = "1"; });
      var meetingUrl = input("url", "meeting_url", "https://meet.google.com/...", settings.meeting_url);
      append(booking, [
        field("Session length in minutes", sessionMinutes),
        field("Least notice in hours", minNotice, "How far ahead someone has to book."),
        field("How far ahead in days", horizon, "The last day the calendar offers."),
        field("Cancellation notice in hours", cancelNotice),
        field("Meeting link", meetingUrl, "A standing video link, for example a personal Google Meet room")
      ]);
      form.appendChild(booking);

      var referral = el("div", "card stack tight");
      referral.appendChild(el("p", "label", "Referral reward"));
      var reward = settings.referral_reward || {};
      var rewardType = select([
        { value: "session_credit", label: "Session credit" },
        { value: "percent_off", label: "Percent off" }
      ], reward.type || "session_credit");
      var rewardAmount = input("number", "referral_reward_amount", "1", reward.amount === undefined ? 1 : reward.amount);
      rewardAmount.min = "0";
      rewardAmount.max = "100";
      rewardAmount.step = "1";
      append(referral, [
        field("Kind", rewardType),
        field("Amount", rewardAmount, "Session credit counts free sessions. Percent off is a discount on their next purchase.")
      ]);
      form.appendChild(referral);

      var openness = el("div", "card stack tight");
      openness.appendChild(el("p", "label", "What is open"));
      var openSignup = toggle("Anyone can create an account", settings.open_signup);
      var feedPublic = toggle("The feed has a public page", settings.feed_public);
      var mcpPublic = toggle("The MCP server answers public questions without sign-in", settings.mcp_public);
      append(openness, [openSignup.node, feedPublic.node, mcpPublic.node]);
      form.appendChild(openness);

      var zone = el("div", "card stack tight");
      zone.appendChild(el("p", "label", "The owner's zone"));
      var ownerTimezone = input("text", "owner_timezone", "Europe/Lisbon", settings.owner_timezone);
      zone.appendChild(field("Timezone", ownerTimezone, "Availability is set in this zone."));
      form.appendChild(zone);

      // Google Meet: connected once by the owner; every booking then gets its
      // own Meet room and the transcript is pulled after the meeting.
      var meet = el("div", "card stack tight");
      meet.appendChild(el("p", "label", "Google Meet"));
      var meetLine = el("p", "small dim", "Checking...");
      var meetRow = el("div", "row");
      append(meet, [meetLine, meetRow]);
      api("/admin/google").then(function (g) {
        if (!g.configured) {
          meetLine.textContent = "Not set up yet: GOOGLE_CLIENT_SECRET is missing in Vercel. Until then bookings use the standing meeting link above.";
          return;
        }
        if (g.connected) {
          meetLine.textContent = "Connected as " + (g.email || "your Google account") + " since " + H.fmtDate(g.connectedAt, { dateStyle: "medium" }) + ". Every booking gets its own Meet room on your calendar with the client invited, and the transcript is pulled through the Meet API after the meeting.";
          var off = button("Disconnect", "btn danger sm", function () {
            if (!window.confirm("Disconnect Google? New bookings fall back to the standing link.")) return;
            busy(off, api("/admin/google", { method: "DELETE" })).then(function () { toast("Disconnected.", "good"); H.render(); }).catch(function (err) { toast(err.message, "bad"); });
          });
          meetRow.appendChild(off);
        } else {
          meetLine.textContent = "Connect your Google account once. From then on every booking becomes a Calendar event with a Meet room, the client invited, and the transcript is pulled through the Meet API after the meeting. Turn on transcription in Meet, or set it to automatic in Workspace.";
          meetRow.appendChild(H.link("Connect Google", "/api/hearth/admin/google/connect", "btn primary sm"));
        }
      }).catch(function () { meetLine.textContent = "Could not read the Google connection."; });
      form.appendChild(meet);
      var googleResult = new URLSearchParams(location.search).get("google");
      if (googleResult === "connected") toast("Google connected.", "good");
      if (googleResult === "failed") toast("Google could not be connected. Try again.", "bad");

      var save = button("Save settings", "btn primary");
      save.type = "submit";
      form.appendChild(append(el("div", "row"), [save]));
      form.appendChild(errorLine);

      function whole(node, fallback) {
        var value = parseInt(node.value, 10);
        return isNaN(value) ? fallback : value;
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        errorLine.textContent = "";
        var body = {
          session_minutes: whole(sessionMinutes, 60),
          min_notice_hours: whole(minNotice, 24),
          booking_horizon_days: whole(horizon, 60),
          cancel_notice_hours: whole(cancelNotice, 24),
          meeting_url: meetingUrl.value.trim(),
          referral_reward: { type: rewardType.value, amount: whole(rewardAmount, 1) },
          open_signup: openSignup.input.checked,
          feed_public: feedPublic.input.checked,
          mcp_public: mcpPublic.input.checked,
          owner_timezone: ownerTimezone.value.trim()
        };
        busy(save, api("/admin/settings", { method: "PUT", body: body }))
          .then(function () { toast("Settings saved.", "good"); flare(); })
          .catch(function (error) {
            errorLine.textContent = error.message;
            toast(error.message, "bad");
          });
      });

      wrap.appendChild(form);
      return wrap;
    });
  }, { perm: "settings.manage", title: "Settings", nav: { group: "Business", label: "Settings", order: 4 } });

  /* ---------- two tiles on the home view ---------- */

  // Whoever can read metrics sees the size of the room and who is in it
  // without leaving home. A failure here adds nothing and says nothing.
  H.onHome(function (tile) {
    if (!can("metrics.read")) return null;
    return api("/admin/metrics").then(function (data) {
      var totals = data.totals || {};
      H.countUp(tile(0, "members"), Number(totals.members || 0));
      H.countUp(tile(0, "here now", true), (data.presence || []).length);
    }).catch(function () { /* the home view is fine without them */ });
  });
})();
