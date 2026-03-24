/** Optional: window.__CARDCORE_API_BASE__ vor Laden setzen (anderes API-Origin). */
const API =
      typeof window !== "undefined" && window.__CARDCORE_API_BASE__ != null
        ? String(window.__CARDCORE_API_BASE__).replace(/\/$/, "")
        : "";
    const LS = "cardcore_admin_token";

    function token() { return localStorage.getItem(LS); }
    function setToken(t) { if (t) localStorage.setItem(LS, t); else localStorage.removeItem(LS); }

    async function api(path, opts = {}) {
      const headers = { ...opts.headers, "Content-Type": "application/json" };
      const tok = token();
      if (tok) headers.Authorization = "Bearer " + tok;
      const r = await fetch(API + "/api/admin" + path, { ...opts, headers });
      const text = await r.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      if (!r.ok) throw new Error(data.error || r.statusText || "Fehler");
      return data;
    }

    function showLogin() {
      document.getElementById("view-login").classList.remove("hidden");
      document.getElementById("view-app").classList.add("hidden");
    }
    function showApp() {
      document.getElementById("view-login").classList.add("hidden");
      document.getElementById("view-app").classList.remove("hidden");
    }

    const tabs = [
      { id: "dashboard", label: "Dashboard", kicker: "Übersicht", icon: "dashboard" },
      { id: "users", label: "Nutzer", kicker: "Accounts & Moderation", icon: "users" },
      { id: "listings", label: "Karten", kicker: "Listings & Markt", icon: "listings" },
      { id: "revenue", label: "Umsatz", kicker: "Finanzen", icon: "revenue" },
      { id: "support", label: "Support", kicker: "Tickets", icon: "support" },
      { id: "reports", label: "Meldungen", kicker: "Moderation", icon: "reports" },
      { id: "invites", label: "Einladungscodes", kicker: "Private Trade", icon: "invites" },
      { id: "welcome", label: "Willkommen", kicker: "Messaging", icon: "welcome" },
      { id: "app", label: "App & Wartung", kicker: "System", icon: "app" },
    ];
    let activeTab = "dashboard";

    function navIconSvg(kind) {
      const a =
        'class="nav-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
      switch (kind) {
        case "dashboard":
          return `<svg ${a} aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>`;
        case "users":
          return `<svg ${a} aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        case "listings":
          return `<svg ${a} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6"/></svg>`;
        case "revenue":
          return `<svg ${a} aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
        case "support":
          return `<svg ${a} aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        case "reports":
          return `<svg ${a} aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;
        case "invites":
          return `<svg ${a} aria-hidden="true"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 11.5"/><path d="M15 2l6 6"/></svg>`;
        case "welcome":
          return `<svg ${a} aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
        case "app":
          return `<svg ${a} aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
        default:
          return `<svg ${a} aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`;
      }
    }

    function updatePageTitle() {
      const t = tabs.find((x) => x.id === activeTab);
      const titleEl = document.getElementById("page-title");
      const kickerEl = document.getElementById("page-kicker");
      if (titleEl && t) titleEl.textContent = t.label;
      if (kickerEl && t) kickerEl.textContent = t.kicker || "Bereich";
    }

    function setWhoLabel(email) {
      const w = document.getElementById("who");
      const s = document.getElementById("who-sidebar");
      const t = email != null ? String(email) : "";
      if (w) {
        w.textContent = t || "—";
        w.title = t;
      }
      if (s) {
        s.textContent = t ? "Angemeldet als\n" + t : "";
      }
    }

    function wireShellNav() {
      const shell = document.getElementById("admin-shell");
      const toggle = document.getElementById("sidebar-toggle");
      const backdrop = document.getElementById("sidebar-backdrop");
      const nav = document.getElementById("tabs");
      if (!shell || !toggle || !backdrop || !nav) return;
      const close = () => shell.classList.remove("sidebar-open");
      toggle.onclick = () => shell.classList.toggle("sidebar-open");
      backdrop.onclick = close;
      nav.onclick = (e) => {
        const btn = e.target.closest("button[data-tab]");
        if (!btn) return;
        if (window.matchMedia("(max-width: 900px)").matches) close();
      };
    }

    function renderTabs() {
      const el = document.getElementById("tabs");
      el.innerHTML = tabs.map(t =>
        `<button type="button" class="${t.id === activeTab ? "active" : ""}" data-tab="${t.id}">` +
          `<span class="nav-ico-wrap" aria-hidden="true">${navIconSvg(t.icon)}</span>` +
          `<span class="nav-label">${escapeHtml(t.label)}</span>` +
        `</button>`
      ).join("");
      el.querySelectorAll("button").forEach(b => {
        b.onclick = () => { activeTab = b.dataset.tab; renderTabs(); showTab(); };
      });
      updatePageTitle();
      wireShellNav();
    }

    function showTab() {
      ["dashboard", "users", "listings", "revenue", "support", "reports", "invites", "welcome", "app"].forEach(id => {
        const sec = document.getElementById("tab-" + id);
        if (sec) sec.classList.toggle("hidden", id !== activeTab);
      });
      if (activeTab === "dashboard") loadDashboard();
      if (activeTab === "users") loadUsers();
      if (activeTab === "listings") loadListings();
      if (activeTab === "revenue") loadRevenue();
      if (activeTab === "support") loadSupport();
      if (activeTab === "reports") loadReports();
      if (activeTab === "invites") loadPrivateInvites();
      if (activeTab === "welcome") loadWelcomeTest();
      if (activeTab === "app") loadAppSettings();
      updatePageTitle();
    }

    function fmtCents(c) {
      return (Number(c) / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    }

    function escapeHtml(s) {
      const d = document.createElement("div");
      d.textContent = s ?? "";
      return d.innerHTML;
    }

    function loadingHtml(message) {
      const m = message != null ? String(message) : "Lade Daten…";
      return (
        `<div class="loading-block" role="status" aria-live="polite">` +
          `<span class="loading-dot"></span><span class="loading-dot"></span><span class="loading-dot"></span>` +
          `<span>${escapeHtml(m)}</span>` +
        `</div>`
      );
    }

    function dashboardSkeletonHtml() {
      const sk = `<article class="kpi kpi-skeleton" aria-hidden="true"><span>—</span><strong>—</strong></article>`;
      return (
        `<div class="dashboard-hero-row" style="margin-bottom:1.35rem;">` +
          `<div class="dashboard-hero">` +
            `<p class="dashboard-eyebrow">Übersicht</p>` +
            `<h2 class="dashboard-title">Kennzahlen</h2>` +
            `<p class="dashboard-lead muted">Daten werden geladen …</p>` +
          `</div>` +
        `</div>` +
        `<div class="kpi-group"><div class="grid-kpi">${sk}${sk}${sk}${sk}${sk}${sk}</div></div>` +
        loadingHtml("Verbindung zur API …")
      );
    }

    function formatDateTime(iso) {
      if (!iso) return "—";
      try {
        return new Date(iso).toLocaleString("de-DE", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return String(iso);
      }
    }

    function avatarMarkup(user) {
      const url = user && user.avatar_url ? String(user.avatar_url) : "";
      if (user && user.has_avatar && url && /^data:image\//i.test(url)) {
        const safe = url.replace(/"/g, "&quot;");
        return `<img class="user-avatar" src="${safe}" alt="" loading="lazy" />`;
      }
      if (user && user.has_avatar && url && /^https?:\/\//i.test(url)) {
        return `<img class="user-avatar" src="${escapeHtml(url)}" alt="" loading="lazy" />`;
      }
      return '<div class="user-avatar placeholder">Kein Bild</div>';
    }

    function userJsonForDebug(user) {
      const copy = { ...user };
      const au = copy.avatar_url;
      if (au != null && String(au).length > 180) {
        copy.avatar_url = `[ausgeblendet · ${String(au).length} Zeichen]`;
      }
      return JSON.stringify(copy, null, 2);
    }

    async function loadWelcomeTest() {
      const el = document.getElementById("tab-welcome");
      el.innerHTML = `<div class="panel">${loadingHtml("Nutzerliste wird geladen …")}</div>`;
      const esc = (s) => {
        const d = document.createElement("div");
        d.textContent = s ?? "";
        return d.innerHTML;
      };
      try {
        const data = await api("/users?limit=200");
        const opts = data.users.map((u) =>
          `<option value="${u.id}">#${u.id} · ${esc(u.email)} · ${esc(u.display_name || "")}</option>`
        ).join("");
        el.innerHTML = `
          <div class="panel">
            <div class="panel-header">
              <h2>Willkommens-Testnachricht</h2>
              <p class="muted">
                Sendet die gleiche automatische Nachricht wie bei der Registrierung (erscheint in <strong>Nachrichten</strong> der App).
                Funktioniert nicht, wenn der gewählte Nutzer derselbe wie der Absender ist (Standard: User-ID 1).
              </p>
            </div>
            <label>Suche (E-Mail / Name)<input type="search" id="welcome-search" placeholder="Filter…" /></label>
            <div class="row-actions" style="margin-top:0.5rem">
              <button type="button" class="secondary" id="welcome-refresh">Liste aktualisieren</button>
            </div>
            <label style="margin-top:0.75rem">Nutzer wählen
              <select id="welcome-user" size="10" style="height:auto; min-height:14rem;">${opts}</select>
            </label>
            <p class="muted" style="font-size:0.85rem; margin:0.5rem 0 0;">
              Alternativ nur User-ID (überschreibt die Auswahl oben):
              <input type="number" id="welcome-user-id" min="1" placeholder="z. B. 4" style="width:7rem; margin:0 0 0 0.35rem; display:inline-block;" />
            </p>
            <button type="button" id="welcome-send">Testnachricht senden</button>
            <p id="welcome-msg" style="margin-top:0.75rem;"></p>
            <pre id="welcome-out" class="panel" style="margin-top:0.5rem; display:none; max-height:12rem; overflow:auto;"></pre>
          </div>`;
        document.getElementById("welcome-refresh").onclick = async () => {
          const q = document.getElementById("welcome-search").value.trim();
          const msg = document.getElementById("welcome-msg");
          try {
            const path = "/users?limit=200" + (q ? "&search=" + encodeURIComponent(q) : "");
            const d = await api(path);
            const sel = document.getElementById("welcome-user");
            sel.innerHTML = d.users.map((u) =>
              `<option value="${u.id}">#${u.id} · ${esc(u.email)} · ${esc(u.display_name || "")}</option>`
            ).join("");
            msg.textContent = d.total + " Treffer geladen.";
            msg.style.color = "var(--muted)";
          } catch (e) {
            msg.textContent = e.message;
            msg.style.color = "var(--danger)";
          }
        };
        document.getElementById("welcome-search").addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") document.getElementById("welcome-refresh").click();
        });
        document.getElementById("welcome-send").onclick = async () => {
          const msgEl = document.getElementById("welcome-msg");
          const outEl = document.getElementById("welcome-out");
          msgEl.textContent = "";
          outEl.style.display = "none";
          let uid = parseInt(document.getElementById("welcome-user-id").value, 10);
          if (!Number.isInteger(uid) || uid < 1) {
            uid = parseInt(document.getElementById("welcome-user").value, 10);
          }
          if (!Number.isInteger(uid) || uid < 1) {
            msgEl.textContent = "Bitte Nutzer wählen oder gültige User-ID eingeben.";
            msgEl.style.color = "var(--danger)";
            return;
          }
          try {
            const res = await api("/welcome-dm", {
              method: "POST",
              body: JSON.stringify({ user_id: uid }),
            });
            outEl.textContent = JSON.stringify(res, null, 2);
            outEl.style.display = "block";
            const ok = res.welcome_dm && res.welcome_dm.sent;
            msgEl.textContent = ok
              ? "Gesendet. Der Nutzer sollte die Konversation in der App unter Nachrichten sehen."
              : "Nicht gesendet: " + (res.welcome_dm && res.welcome_dm.reason ? res.welcome_dm.reason : "siehe JSON unten");
            msgEl.style.color = ok ? "var(--ok)" : "var(--danger)";
          } catch (e) {
            msgEl.textContent = e.message;
            msgEl.style.color = "var(--danger)";
          }
        };
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + esc(e.message) + "</p>";
      }
    }

    async function loadAppSettings() {
      const el = document.getElementById("tab-app");
      el.innerHTML = `<div class="panel">${loadingHtml("Einstellungen werden geladen …")}</div>`;
      try {
        const data = await api("/app-settings");
        const s = data.settings;
        const mv = escapeHtml(s.min_native_version);
        const mm = escapeHtml(s.maintenance_message);
        const pn = escapeHtml(s.partner_name || "");
        const pu = escapeHtml(s.partner_url || "");
        el.innerHTML = `
          <div class="panel">
            <div class="panel-header">
              <h2>App &amp; Wartung</h2>
              <p class="muted">Mindest-Version (native App, Semver). Liegt die installierte Version darunter, zeigt die App einen Update-Zwang.</p>
            </div>
            <label>min_native_version<input type="text" id="min-ver" value="${mv}" /></label>
            <label style="margin-top:1rem; display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" id="maint-enabled" ${s.maintenance_enabled ? "checked" : ""} />
              Wartungsmodus aktiv
            </label>
            <label>Wartungstext (in der App)<textarea id="maint-msg" rows="6">${mm}</textarea></label>
            <hr style="margin:1rem 0; border:none; border-top:1px solid var(--border);" />
            <h3 style="margin:0 0 0.6rem; font-size:0.95rem;">Partner im App-Footer</h3>
            <label>Partner-Name (optional)<input type="text" id="partner-name" value="${pn}" placeholder="z. B. Test Partner" /></label>
            <label>Partner-Link (optional)<input type="url" id="partner-url" value="${pu}" placeholder="https://example.com" /></label>
            <button type="button" id="btn-save-app">Speichern</button>
            <p id="app-save-msg" class="muted"></p>
          </div>`;
        document.getElementById("btn-save-app").onclick = async () => {
          const msg = document.getElementById("app-save-msg");
          msg.textContent = "";
          msg.style.color = "";
          try {
            await api("/app-settings", {
              method: "PATCH",
              body: JSON.stringify({
                min_native_version: document.getElementById("min-ver").value.trim(),
                maintenance_enabled: document.getElementById("maint-enabled").checked,
                maintenance_message: document.getElementById("maint-msg").value,
                partner_name: document.getElementById("partner-name").value.trim(),
                partner_url: document.getElementById("partner-url").value.trim(),
              }),
            });
            msg.textContent = "Gespeichert.";
          } catch (e) {
            msg.textContent = e.message;
            msg.style.color = "var(--danger)";
          }
        };
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + escapeHtml(e.message) + "</p>";
      }
    }

    async function loadDashboard() {
      const el = document.getElementById("tab-dashboard");
      el.innerHTML = dashboardSkeletonHtml();
      try {
        const d = await api("/dashboard");
        const refreshed = new Date().toLocaleString("de-DE", {
          dateStyle: "medium",
          timeStyle: "medium",
        });
        el.innerHTML = `
          <div class="dashboard-hero-row">
            <div class="dashboard-hero">
              <p class="dashboard-eyebrow">Übersicht</p>
              <h2 class="dashboard-title">Was passiert gerade?</h2>
              <p class="dashboard-lead muted">Kennzahlen aus der CardCore-API – Community, Marktplatz und Support auf einen Blick.</p>
            </div>
            <div class="dashboard-actions">
              <button type="button" class="secondary" id="dash-refresh">Aktualisieren</button>
            </div>
          </div>
          <section class="kpi-group" aria-labelledby="kpi-group-community">
            <h3 class="kpi-group-title" id="kpi-group-community">Community</h3>
            <div class="grid-kpi">
              <article class="kpi kpi--blue"><span>Nutzer</span><strong>${d.users_total}</strong></article>
              <article class="kpi kpi--emerald"><span>Verifiziert</span><strong>${d.users_verified}</strong></article>
            </div>
          </section>
          <section class="kpi-group" aria-labelledby="kpi-group-market">
            <h3 class="kpi-group-title" id="kpi-group-market">Marktplatz</h3>
            <div class="grid-kpi">
              <article class="kpi kpi--violet"><span>Aktive Listings</span><strong>${d.listings_active}</strong></article>
              <article class="kpi kpi--violet"><span>Verkauft</span><strong>${d.listings_sold}</strong></article>
              <article class="kpi kpi--amber"><span>Lagerwert (aktiv)</span><strong>${fmtCents(d.inventory_value_active_cents)}</strong></article>
              <article class="kpi kpi--amber"><span>Umsatz (SOLD)</span><strong>${fmtCents(d.revenue_sold_cents)}</strong></article>
            </div>
          </section>
          <section class="kpi-group" aria-labelledby="kpi-group-support">
            <h3 class="kpi-group-title" id="kpi-group-support">Support &amp; Moderation</h3>
            <div class="grid-kpi">
              <article class="kpi kpi--rose"><span>Support offen</span><strong>${d.support_open}</strong></article>
              <article class="kpi kpi--blue"><span>Tickets gesamt</span><strong>${d.support_tickets_total}</strong></article>
              <article class="kpi kpi--rose"><span>Meldungen offen</span><strong>${d.reports_open != null ? d.reports_open : "—"}</strong></article>
            </div>
          </section>
          <p class="dashboard-meta muted">Datenstand: ${escapeHtml(refreshed)} · <span class="inline-code">GET /api/admin/dashboard</span></p>`;
        const dr = document.getElementById("dash-refresh");
        if (dr) dr.onclick = () => loadDashboard();
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + escapeHtml(e.message) + "</p>";
      }
    }

    async function loadUsers() {
      const el = document.getElementById("tab-users");
      el.innerHTML = `
        <div class="panel panel-flush">
          <div class="panel-toolbar toolbar">
            <input type="search" id="user-search" placeholder="E-Mail oder Anzeigename …" style="flex:1;min-width:200px;margin:0" />
            <button type="button" class="secondary" id="user-refresh">Aktualisieren</button>
          </div>
          <div id="user-table-wrap">${loadingHtml("Nutzer werden geladen …")}</div>
        </div>`;
      const run = async () => {
        const wrap = document.getElementById("user-table-wrap");
        const q = document.getElementById("user-search").value.trim();
        const path = "/users?limit=50" + (q ? "&search=" + encodeURIComponent(q) : "");
        wrap.innerHTML = loadingHtml("Suche läuft …");
        try {
          const data = await api(path);
          const rows = data.users.map(u => {
            const ver = u.is_verified
              ? "<span class=\"pill pill-ok\">Verifiziert</span>"
              : "<span class=\"pill pill-neutral\">Offen</span>";
            const st = u.suspended_at
              ? "<span class=\"pill pill-warn\">Gesperrt</span>"
              : "<span class=\"pill pill-ok\">Aktiv</span>";
            const rolePill = `<span class="pill pill-neutral">${escapeHtml(u.role)}</span>`;
            return `<tr>
            <td class="cell-mono">${u.id}</td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.display_name || "—")}</td>
            <td>${rolePill}</td>
            <td>${ver}</td>
            <td>${st}</td>
            <td><button type="button" class="secondary user-detail" data-id="${u.id}">Details</button></td>
          </tr>`;
          }).join("");
          wrap.innerHTML = `
            <p class="muted" style="margin:0;padding:0.65rem 1rem 0.35rem;font-size:0.82rem;">${data.total} Treffer</p>
            <div class="table-scroll">
            <table class="data-table"><thead><tr><th>ID</th><th>E-Mail</th><th>Name</th><th>Rolle</th><th>Verifizierung</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows || "<tr><td colspan=\"7\" class=\"empty-hint\">Keine Treffer für diese Suche.</td></tr>"}</tbody></table>
            </div>`;
          document.querySelectorAll(".user-detail").forEach(b => {
            b.onclick = () => openUserDetail(Number(b.dataset.id));
          });
        } catch (e) {
          wrap.innerHTML = "<p class=\"error\" style=\"padding:1rem;\">" + escapeHtml(e.message) + "</p>";
        }
      };
      document.getElementById("user-refresh").onclick = run;
      document.getElementById("user-search").onchange = run;
      await run();
    }

    async function openUserDetail(id) {
      const el = document.getElementById("tab-users");
      el.innerHTML = `<div class="panel">${loadingHtml("Profil wird geladen …")}</div>`;
      try {
        const { user, stats } = await api("/users/" + id);
        const role = user.role || "user";
        const roleBadge =
          role === "admin"
            ? '<span class="badge admin">Admin</span>'
            : '<span class="badge">User</span>';
        const verBadge = user.is_verified
          ? '<span class="badge ok">Verifiziert</span>'
          : '<span class="badge">Nicht verifiziert</span>';
        const suspBadge = user.suspended_at
          ? `<span class="badge warn">Gesperrt · ${formatDateTime(user.suspended_at)}</span>`
          : '<span class="badge">Aktiv</span>';
        const addrLine = [
          user.street,
          [user.postal_code, user.city].filter(Boolean).join(" "),
          user.country,
        ]
          .filter(Boolean)
          .join("\n");
        el.innerHTML = `
          <div class="panel row-actions">
            <button type="button" class="secondary" id="user-back">← Liste</button>
          </div>
          <div class="panel user-profile">
            <div class="user-profile-header">
              ${avatarMarkup(user)}
              <div class="user-profile-title">
                <h2>${escapeHtml(user.display_name || "(ohne Anzeigenamen)")}</h2>
                <p class="mono-small" style="margin:0 0 0.25rem;">${escapeHtml(user.email || "")} · ID ${user.id}</p>
                <div class="user-badges">${roleBadge}${verBadge}${suspBadge}</div>
              </div>
            </div>
            <div class="user-profile-grid">
              <div class="user-section">
                <h3>Über mich</h3>
                <div class="user-bio">${user.bio ? escapeHtml(user.bio) : '<span class="muted">—</span>'}</div>
              </div>
              <div class="user-section">
                <h3>Kontakt &amp; Adresse</h3>
                <div class="user-address">
                  ${user.legal_name ? `<p><strong>Name:</strong> ${escapeHtml(user.legal_name)}</p>` : ""}
                  ${user.phone ? `<p><strong>Telefon:</strong> ${escapeHtml(user.phone)}</p>` : ""}
                  ${addrLine ? `<p><strong>Anschrift:</strong><br/>${escapeHtml(addrLine).replace(/\n/g, "<br/>")}</p>` : ""}
                  ${user.address_extra ? `<p class="muted">${escapeHtml(user.address_extra)}</p>` : ""}
                  ${!user.legal_name && !user.phone && !addrLine ? '<p class="muted">Keine Angaben</p>' : ""}
                </div>
              </div>
              <div class="user-section">
                <h3>Statistik</h3>
                <p class="mono-small" style="margin:0;">
                  Listings: <strong>${stats.active_listings}</strong> aktiv ·
                  <strong>${stats.sold_listings}</strong> verkauft ·
                  <strong>${stats.total_listings}</strong> gesamt
                </p>
                <p class="mono-small" style="margin:0.5rem 0 0;">
                  Erstellt: ${formatDateTime(user.created_at)} ·
                  Aktualisiert: ${formatDateTime(user.updated_at)}
                </p>
              </div>
            </div>
            <details class="user-raw-json">
              <summary>Rohdaten (JSON, Avatar gekürzt)</summary>
              <pre>${escapeHtml(userJsonForDebug(user))}</pre>
            </details>
          </div>
          <div class="panel">
            <h3 style="margin:0 0 0.75rem; font-size:0.95rem;">Moderation</h3>
            <label>Verifiziert
              <select id="uf-verified"><option value="true">ja</option><option value="false">nein</option></select>
            </label>
            <label>Notiz (Verifizierung)<textarea id="uf-note" rows="2"></textarea></label>
            <label>Rolle
              <select id="uf-role"><option value="user">user</option><option value="admin">admin</option></select>
            </label>
            <label><input type="checkbox" id="uf-suspended" /> Konto sperren</label>
            <button type="button" id="uf-save">Speichern</button>
            <p id="uf-msg" class="muted"></p>
          </div>`;
        document.getElementById("uf-verified").value = user.is_verified ? "true" : "false";
        document.getElementById("uf-note").value = user.verification_note || "";
        document.getElementById("uf-role").value = user.role || "user";
        document.getElementById("uf-suspended").checked = !!user.suspended_at;
        document.getElementById("user-back").onclick = () => { loadUsers(); };
        document.getElementById("uf-save").onclick = async () => {
          const msg = document.getElementById("uf-msg");
          msg.textContent = "";
          try {
            await api("/users/" + id, {
              method: "PATCH",
              body: JSON.stringify({
                is_verified: document.getElementById("uf-verified").value === "true",
                verification_note: document.getElementById("uf-note").value,
                role: document.getElementById("uf-role").value,
                suspended: document.getElementById("uf-suspended").checked,
              }),
            });
            msg.textContent = "Gespeichert.";
            openUserDetail(id);
          } catch (e) {
            msg.textContent = e.message;
            msg.className = "error";
          }
        };
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + e.message + '</p><button type="button" class="secondary" id="ub">Zurück</button>';
        document.getElementById("ub").onclick = () => loadUsers();
      }
    }

    async function loadListings() {
      const el = document.getElementById("tab-listings");
      el.innerHTML = `
        <div class="panel panel-flush">
          <div class="panel-toolbar toolbar">
            <input type="search" id="list-search" placeholder="Spieler, Hersteller, E-Mail …" style="flex:1;min-width:180px;margin:0" />
            <select id="list-status" style="width:auto;min-width:9.5rem;margin:0">
              <option value="">Alle Status</option>
              <option>ACTIVE</option><option>SOLD</option><option>DRAFT</option><option>ARCHIVED</option>
            </select>
            <button type="button" class="secondary" id="list-refresh">Aktualisieren</button>
          </div>
          <div id="list-table-wrap">${loadingHtml("Listings werden geladen …")}</div>
        </div>`;
      const run = async () => {
        const wrap = document.getElementById("list-table-wrap");
        const q = document.getElementById("list-search").value.trim();
        const st = document.getElementById("list-status").value;
        let path = "/listings?limit=50";
        if (q) path += "&search=" + encodeURIComponent(q);
        if (st) path += "&status=" + encodeURIComponent(st);
        wrap.innerHTML = loadingHtml("Liste wird aktualisiert …");
        try {
          const data = await api(path);
          const rows = data.listings.map(l => `<tr>
            <td class="cell-mono">${l.id}</td>
            <td>${escapeHtml(l.player_name)}</td>
            <td><span class="pill pill-neutral">${escapeHtml(l.status)}</span></td>
            <td>${fmtCents(l.price_cents)}</td>
            <td>${escapeHtml(l.seller_email || "—")}</td>
            <td><button type="button" class="secondary list-detail" data-id="${l.id}">Details</button></td>
          </tr>`).join("");
          wrap.innerHTML = `
            <p class="muted" style="margin:0;padding:0.65rem 1rem 0.35rem;font-size:0.82rem;">${data.total} Treffer</p>
            <div class="table-scroll">
            <table class="data-table"><thead><tr><th>ID</th><th>Spieler</th><th>Status</th><th>Preis</th><th>Verkäufer</th><th></th></tr></thead>
            <tbody>${rows || "<tr><td colspan=\"6\" class=\"empty-hint\">Keine Listings gefunden.</td></tr>"}</tbody></table>
            </div>`;
          document.querySelectorAll(".list-detail").forEach(b => {
            b.onclick = () => openListingDetail(Number(b.dataset.id));
          });
        } catch (e) {
          wrap.innerHTML = "<p class=\"error\" style=\"padding:1rem;\">" + escapeHtml(e.message) + "</p>";
        }
      };
      document.getElementById("list-refresh").onclick = run;
      document.getElementById("list-search").onchange = run;
      document.getElementById("list-status").onchange = run;
      await run();
    }

    async function openListingDetail(id) {
      const el = document.getElementById("tab-listings");
      el.innerHTML = `<div class="panel">${loadingHtml("Listing wird geladen …")}</div>`;
      try {
        const { listing } = await api("/listings/" + id);
        el.innerHTML = `
          <div class="panel row-actions">
            <button type="button" class="secondary" id="ld-back">← Liste</button>
          </div>
          <div class="panel">
            <pre>${escapeHtml(JSON.stringify(listing, null, 2))}</pre>
            <label>Status ändern
              <select id="ld-status">
                <option>DRAFT</option><option>ACTIVE</option><option>SOLD</option><option>ARCHIVED</option>
              </select>
            </label>
            <button type="button" id="ld-save">Speichern</button>
            <p id="ld-msg" class="muted"></p>
          </div>`;
        document.getElementById("ld-status").value = listing.status;
        document.getElementById("ld-back").onclick = () => loadListings();
        document.getElementById("ld-save").onclick = async () => {
          const msg = document.getElementById("ld-msg");
          msg.textContent = "";
          try {
            await api("/listings/" + id, {
              method: "PATCH",
              body: JSON.stringify({ status: document.getElementById("ld-status").value }),
            });
            msg.textContent = "Gespeichert.";
          } catch (e) {
            msg.textContent = e.message;
            msg.className = "error";
          }
        };
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + e.message + '</p><button type="button" class="secondary" id="lb">Zurück</button>';
        document.getElementById("lb").onclick = () => loadListings();
      }
    }

    async function loadRevenue() {
      const el = document.getElementById("tab-revenue");
      el.innerHTML = `<div class="panel">${loadingHtml("Umsatz wird geladen …")}</div>`;
      try {
        const data = await api("/revenue");
        const rows = data.by_status.map(r => `<tr>
          <td><span class="pill pill-neutral">${escapeHtml(r.status)}</span></td>
          <td class="cell-mono">${r.c}</td>
          <td><strong>${fmtCents(r.total_cents)}</strong></td>
        </tr>`).join("");
        el.innerHTML = `
          <div class="panel panel-flush">
            <div class="panel-header" style="margin:0;padding:1rem 1.1rem;border-bottom:1px solid var(--border);">
              <h2 style="margin:0;font-size:1.02rem;">Umsatz nach Listing-Status</h2>
              <p class="muted" style="margin:0.35rem 0 0;">Aggregation aus <span class="inline-code">/api/admin/revenue</span></p>
            </div>
            <div class="table-scroll">
              <table class="data-table"><thead><tr><th>Status</th><th>Anzahl</th><th>Summe (Brutto)</th></tr></thead>
              <tbody>${rows || "<tr><td colspan=\"3\" class=\"empty-hint\">Keine Daten.</td></tr>"}</tbody></table>
            </div>
          </div>`;
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + escapeHtml(e.message) + "</p>";
      }
    }

    let supportTicketId = null;

    async function loadSupport() {
      supportTicketId = null;
      const el = document.getElementById("tab-support");
      el.innerHTML = `<div class="panel panel-flush" id="sup-list-wrap">${loadingHtml("Tickets werden geladen …")}</div>`;
      try {
        const data = await api("/support/tickets?limit=80");
        const rows = data.tickets.map(t => `<tr>
          <td class="cell-mono">${t.id}</td>
          <td>${escapeHtml(t.subject)}</td>
          <td><span class="pill pill-neutral">${escapeHtml(t.status)}</span></td>
          <td>${escapeHtml(t.user_email || "—")}</td>
          <td><button type="button" class="secondary sup-open" data-id="${t.id}">Öffnen</button></td>
        </tr>`).join("");
        document.getElementById("sup-list-wrap").innerHTML = `
          <p class="muted" style="margin:0;padding:0.65rem 1rem 0.35rem;font-size:0.82rem;">${data.total} Tickets</p>
          <div class="table-scroll">
          <table class="data-table"><thead><tr><th>ID</th><th>Betreff</th><th>Status</th><th>Nutzer</th><th></th></tr></thead>
          <tbody>${rows || "<tr><td colspan=\"5\" class=\"empty-hint\">Keine offenen Tickets.</td></tr>"}</tbody></table>
          </div>`;
        document.querySelectorAll(".sup-open").forEach(b => {
          b.onclick = () => openSupportTicket(Number(b.dataset.id));
        });
      } catch (e) {
        document.getElementById("sup-list-wrap").innerHTML = "<p class=\"error\" style=\"padding:1rem;\">" + escapeHtml(e.message) + "</p>";
      }
    }

    async function loadPrivateInvites() {
      const el = document.getElementById("tab-invites");
      el.innerHTML = `
        <div class="panel">
          <div class="panel-header">
            <h2>Einladungscodes</h2>
            <p class="muted">
              Hier erzeugst du Codes und verteilst sie z. B. per DM oder E-Mail.
              <strong>In der App</strong> lösen Nutzer sie ein unter <strong>Profil → Einladung</strong> (eingeloggt).
              Die Migration <span class="inline-code">016_private_market_invites.sql</span> muss auf der Datenbank gelaufen sein.
            </p>
          </div>
        </div>
        <div class="panel toolbar">
          <button type="button" class="secondary" id="inv-refresh">Aktualisieren</button>
          <button type="button" id="inv-create">Neuer Code (1×)</button>
        </div>
        <p id="inv-msg" class="muted" style="margin:0 0 0.5rem;"></p>
        <div id="inv-wrap">${loadingHtml("Codes werden geladen …")}</div>`;

      const render = async () => {
        const wrap = document.getElementById("inv-wrap");
        const msg = document.getElementById("inv-msg");
        msg.textContent = "";
        msg.style.color = "";
        wrap.innerHTML = loadingHtml("Codes werden geladen …");
        try {
          const data = await api("/private-market-invites?limit=100");
          const list = data.invites || [];
          wrap.innerHTML =
            list.length === 0
              ? "<p class=\"muted\">Noch keine Codes.</p>"
              : list
                  .map((inv) => {
                    const max =
                      inv.max_redemptions == null ? "∞" : String(inv.max_redemptions);
                    let creator = "—";
                    if (inv.created_by) {
                      const parts = [
                        String(inv.created_by.display_name || "").trim(),
                        String(inv.created_by.email || "").trim(),
                      ].filter(Boolean);
                      creator =
                        parts.length > 0
                          ? escapeHtml(parts.join(" · "))
                          : "Nutzer #" + inv.created_by.user_id;
                    }
                    const reds = Array.isArray(inv.redemptions) ? inv.redemptions : [];
                    const redRows =
                      reds.length === 0
                        ? "<p class=\"muted\" style=\"margin:0.35rem 0 0; font-size:0.85rem;\">Noch niemand eingelöst.</p>"
                        : "<ul style=\"margin:0.35rem 0 0; padding-left:1.1rem; font-size:0.85rem;\">" +
                          reds
                            .map(
                              (r) =>
                                `<li>${escapeHtml(
                                  String(r.display_name || "").trim() || "—"
                                )} · ${escapeHtml(
                                  r.email || ""
                                )} · ${formatDateTime(r.redeemed_at)}</li>`
                            )
                            .join("") +
                          "</ul>";
                    const revoked = inv.revoked_at
                      ? `<p class="muted" style="margin:0.35rem 0 0; font-size:0.85rem;">Widerrufen: ${formatDateTime(
                          inv.revoked_at
                        )}</p>`
                      : `<button type="button" class="secondary danger inv-revoke" data-id="${
                          inv.id
                        }" style="margin-top:0.5rem;">Widerrufen</button>`;
                    return `
              <div class="panel" style="margin-bottom:0.75rem;">
                <div class="row-actions" style="align-items:center; margin-bottom:0.35rem;">
                  <code style="font-size:1.05rem; letter-spacing:0.08em; flex:1;">${escapeHtml(
                    inv.code
                  )}</code>
                  <button type="button" class="secondary inv-copy" data-code="${escapeHtml(
                    inv.code
                  )}">Kopieren</button>
                </div>
                <p class="mono-small" style="margin:0;">${inv.redemption_count} / ${max} Einlösungen · Ablauf: ${formatDateTime(
                      inv.expires_at
                    )}</p>
                <p class="mono-small" style="margin:0.35rem 0 0;">Erstellt: ${formatDateTime(
                  inv.created_at
                )}</p>
                <p class="mono-small" style="margin:0.25rem 0 0;">Erstellt von: ${creator}</p>
                ${
                  inv.note
                    ? `<p class="muted" style="margin:0.35rem 0 0; font-size:0.85rem;">${escapeHtml(
                        inv.note
                      )}</p>`
                    : ""
                }
                <p style="margin:0.65rem 0 0; font-size:0.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em;">Eingelöst von</p>
                ${redRows}
                ${revoked}
              </div>`;
                  })
                  .join("");
          wrap.querySelectorAll(".inv-copy").forEach((b) => {
            b.onclick = async () => {
              const code = b.getAttribute("data-code") || "";
              try {
                await navigator.clipboard.writeText(code);
                msg.textContent = "Code kopiert.";
                msg.style.color = "var(--ok)";
              } catch {
                msg.textContent = "Kopieren fehlgeschlagen.";
                msg.style.color = "var(--danger)";
              }
            };
          });
          wrap.querySelectorAll(".inv-revoke").forEach((b) => {
            b.onclick = async () => {
              const id = Number(b.dataset.id);
              if (
                !window.confirm(
                  "Code widerrufen? Neue Einlösungen sind danach nicht mehr möglich."
                )
              ) {
                return;
              }
              try {
                await api("/private-market-invites/" + id, {
                  method: "PATCH",
                  body: JSON.stringify({ revoked: true }),
                });
                await render();
              } catch (e) {
                msg.textContent = e.message;
                msg.style.color = "var(--danger)";
              }
            };
          });
        } catch (e) {
          wrap.innerHTML =
            "<p class=\"error\">" + escapeHtml(e.message) + "</p>";
        }
      };

      document.getElementById("inv-refresh").onclick = () => {
        render();
      };
      document.getElementById("inv-create").onclick = async () => {
        const msg = document.getElementById("inv-msg");
        msg.textContent = "";
        msg.style.color = "";
        try {
          const res = await api("/private-market-invites", {
            method: "POST",
            body: JSON.stringify({ max_redemptions: 1, note: "Web-Admin" }),
          });
          const code = res.invite && res.invite.code;
          await render();
          if (code) {
            try {
              await navigator.clipboard.writeText(code);
              msg.textContent =
                "Neuer Code erstellt und in die Zwischenablage kopiert: " + code;
              msg.style.color = "var(--ok)";
            } catch {
              msg.textContent = "Neuer Code: " + code;
              msg.style.color = "var(--muted)";
            }
          }
        } catch (e) {
          msg.textContent = e.message;
          msg.style.color = "var(--danger)";
        }
      };

      await render();
    }

    async function loadReports() {
      const el = document.getElementById("tab-reports");
      el.innerHTML = `
        <div class="panel panel-flush">
          <div class="panel-toolbar toolbar">
            <select id="rep-filter" style="width:auto;min-width:10rem;margin:0">
              <option value="all">Alle Status</option>
              <option value="open">open</option>
              <option value="reviewed">reviewed</option>
              <option value="dismissed">dismissed</option>
            </select>
            <button type="button" class="secondary" id="rep-refresh">Aktualisieren</button>
          </div>
          <div id="rep-wrap">${loadingHtml("Meldungen werden geladen …")}</div>
        </div>`;
      const run = async () => {
        const wrap = document.getElementById("rep-wrap");
        const f = document.getElementById("rep-filter").value;
        let path = "/reports?limit=100";
        if (f && f !== "all") path += "&status=" + encodeURIComponent(f);
        wrap.innerHTML = loadingHtml("Filter wird angewendet …");
        try {
          const data = await api(path);
          const rows = data.reports.map(r => `<tr>
            <td class="cell-mono">${r.id}</td>
            <td>${escapeHtml(String(r.reason || ""))}</td>
            <td><span class="pill pill-neutral">${escapeHtml(String(r.status || ""))}</span></td>
            <td>${escapeHtml(r.reporter_email || "")}</td>
            <td>${escapeHtml(r.reported_email || "")}</td>
            <td class="cell-mono">${escapeHtml(String(r.created_at || ""))}</td>
            <td><button type="button" class="secondary rep-open" data-id="${r.id}">Details</button></td>
          </tr>`).join("");
          wrap.innerHTML = `
            <p class="muted" style="margin:0;padding:0.65rem 1rem 0.35rem;font-size:0.82rem;">${data.total} Meldungen</p>
            <div class="table-scroll">
            <table class="data-table"><thead><tr><th>ID</th><th>Grund</th><th>Status</th><th>Melder</th><th>Gemeldet</th><th>Zeit</th><th></th></tr></thead>
            <tbody>${rows || "<tr><td colspan=\"7\" class=\"empty-hint\">Keine Meldungen in diesem Filter.</td></tr>"}</tbody></table>
            </div>`;
          document.querySelectorAll(".rep-open").forEach(b => {
            b.onclick = () => openReportDetail(Number(b.dataset.id));
          });
        } catch (e) {
          wrap.innerHTML = "<p class=\"error\" style=\"padding:1rem;\">" + escapeHtml(e.message) + "</p>";
        }
      };
      document.getElementById("rep-refresh").onclick = run;
      document.getElementById("rep-filter").onchange = run;
      await run();
    }

    async function openReportDetail(id) {
      const el = document.getElementById("tab-reports");
      el.innerHTML = `<div class="panel">${loadingHtml("Meldung wird geladen …")}</div>`;
      try {
        const data = await api("/reports/" + id);
        const r = data.report;
        el.innerHTML = `
          <div class="panel row-actions">
            <button type="button" class="secondary" id="rep-back">← Liste</button>
            <select id="rep-st" style="width:auto;margin:0">
              <option value="open">open</option>
              <option value="reviewed">reviewed</option>
              <option value="dismissed">dismissed</option>
            </select>
            <button type="button" id="rep-save-st">Status speichern</button>
          </div>
          <div class="panel">
            <p><strong>Meldung #${r.id}</strong> · ${escapeHtml(String(r.created_at || ""))}</p>
            <p class="muted">Grund: ${escapeHtml(String(r.reason || ""))}</p>
            ${r.details ? "<pre style=\"white-space:pre-wrap\">" + escapeHtml(r.details) + "</pre>" : ""}
            <p>Melder: ${escapeHtml(r.reporter_display_name || "")} (${escapeHtml(r.reporter_email || "")}) · ID ${r.reporter_id}</p>
            <p>Gemeldet: ${escapeHtml(r.reported_display_name || "")} (${escapeHtml(r.reported_email || "")}) · ID ${r.reported_id}</p>
            <p id="rep-msg" class="muted"></p>
          </div>`;
        document.getElementById("rep-st").value = String(r.status || "open").toLowerCase();
        document.getElementById("rep-back").onclick = () => loadReports();
        document.getElementById("rep-save-st").onclick = async () => {
          const msg = document.getElementById("rep-msg");
          msg.textContent = "";
          msg.className = "muted";
          try {
            await api("/reports/" + id, {
              method: "PATCH",
              body: JSON.stringify({ status: document.getElementById("rep-st").value }),
            });
            msg.textContent = "Gespeichert.";
          } catch (e) {
            msg.textContent = e.message;
            msg.className = "error";
          }
        };
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + escapeHtml(e.message) + '</p><button type="button" class="secondary" id="rb">Zurück</button>';
        document.getElementById("rb").onclick = () => loadReports();
      }
    }

    async function openSupportTicket(id) {
      supportTicketId = id;
      const el = document.getElementById("tab-support");
      el.innerHTML = `<div class="panel">${loadingHtml("Ticket wird geladen …")}</div>`;
      try {
        const data = await api("/support/tickets/" + id);
        const msgs = data.messages.map(m =>
          `<div class="panel"><strong>${m.from_user ? "Nutzer" : "Team"}</strong> · ${m.created_at}<pre>${escapeHtml(m.body)}</pre></div>`
        ).join("");
        el.innerHTML = `
          <div class="panel row-actions">
            <button type="button" class="secondary" id="sup-back">← Liste</button>
            <select id="sup-st" style="width:auto;margin:0">
              <option>OPEN</option><option>WAITING_STAFF</option><option>ANSWERED</option><option>CLOSED</option>
            </select>
            <button type="button" id="sup-save-st">Status setzen</button>
          </div>
          <div class="panel"><strong>Ticket #${data.ticket.id}</strong> · ${escapeHtml(data.ticket.subject)}</div>
          ${msgs}
          <div class="panel">
            <label>Antwort (Staff)<textarea id="sup-reply" rows="4"></textarea></label>
            <button type="button" id="sup-send">Senden</button>
            <p id="sup-msg" class="muted"></p>
          </div>`;
        document.getElementById("sup-st").value = data.ticket.status;
        document.getElementById("sup-back").onclick = () => loadSupport();
        document.getElementById("sup-save-st").onclick = async () => {
          const msg = document.getElementById("sup-msg");
          try {
            await api("/support/tickets/" + id, {
              method: "PATCH",
              body: JSON.stringify({ status: document.getElementById("sup-st").value }),
            });
            msg.textContent = "Status gespeichert.";
          } catch (e) {
            msg.textContent = e.message;
            msg.className = "error";
          }
        };
        document.getElementById("sup-send").onclick = async () => {
          const body = document.getElementById("sup-reply").value;
          const msg = document.getElementById("sup-msg");
          try {
            await api("/support/tickets/" + id + "/messages", {
              method: "POST",
              body: JSON.stringify({ body }),
            });
            msg.textContent = "Gesendet.";
            openSupportTicket(id);
          } catch (e) {
            msg.textContent = e.message;
            msg.className = "error";
          }
        };
      } catch (e) {
        el.innerHTML = "<p class=\"error\">" + e.message + '</p><button type="button" class="secondary" id="sb">Zurück</button>';
        document.getElementById("sb").onclick = () => loadSupport();
      }
    }

    document.getElementById("btn-login").onclick = async () => {
      const err = document.getElementById("login-error");
      err.classList.add("hidden");
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      try {
        const r = await fetch(API + "/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const text = await r.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(
            text
              ? "Unerwartete Antwort vom Server (kein JSON). Prüfe API-URL / Proxy."
              : `Netzwerkfehler (HTTP ${r.status}).`
          );
        }
        if (!r.ok) {
          throw new Error(data.error || `Login fehlgeschlagen (HTTP ${r.status}).`);
        }
        if (!data.user || data.user.role !== "admin") {
          setToken(null);
          throw new Error("Kein Admin-Konto (Rolle muss „admin“ sein).");
        }
        setToken(data.token);
        showApp();
        setWhoLabel(data.user.email);
        renderTabs();
        showTab();
      } catch (e) {
        err.textContent =
          e && e.message
            ? e.message
            : "Verbindung fehlgeschlagen. Netzwerk / CORS / falsche API-Adresse?";
        err.classList.remove("hidden");
      }
    };

    document.getElementById("btn-logout").onclick = () => {
      setToken(null);
      showLogin();
    };

    if (token()) {
      showApp();
      setWhoLabel("(Session)");
      renderTabs();
      showTab();
    } else {
      showLogin();
    }