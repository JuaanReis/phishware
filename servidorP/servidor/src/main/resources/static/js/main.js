(function (w, d) {
  "use strict";

  const Phishware = (w.Phishware = w.Phishware || {});
  const cfg = w.PHISHWARE_CONFIG || {};


  Phishware.esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  const icon = function (name) {
    const i = d.createElement("i");
    i.className = "ic ic-" + name;
    i.setAttribute("aria-hidden", "true");
    return i;
  };
  Phishware.icon = icon;


  let toastBox = null;

  Phishware.toast = function (message, type) {
    type = type || "danger";

    if (!toastBox || !toastBox.isConnected) {
      toastBox = d.createElement("div");
      toastBox.className = "toasts";
      toastBox.setAttribute("role", "status");
      toastBox.setAttribute("aria-live", "polite");
      d.body.appendChild(toastBox);
    }

    const icons = { danger: "alert", warning: "alert", success: "check", info: "info" };

    const el = d.createElement("div");
    el.className = "toast toast-" + type;

    const text = d.createElement("p");
    text.textContent = String(message == null ? "" : message);

    const close = d.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Fechar aviso");
    close.appendChild(icon("x"));

    el.append(icon(icons[type] || "info"), text, close);
    toastBox.appendChild(el);

    const remove = function () { el.remove(); };
    close.addEventListener("click", remove);
    w.setTimeout(remove, type === "danger" ? 9000 : 6000);
  };

  const AVATAR_PADRAO =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="100" height="100" fill="#243a63"/>' +
      '<circle cx="50" cy="38" r="17" fill="#22c58b"/>' +
      '<path d="M16 94c4-22 18-31 34-31s30 9 34 31z" fill="#22c58b"/></svg>'
    );

  const AVATAR_KEY = "pw_avatar";

  function readSaved() {
    try { return JSON.parse(w.localStorage.getItem(AVATAR_KEY) || "{}") || {}; } catch (_) { return {}; }
  }

  const state = { user: null, pending: null };


  function pickUser(data) {
    const u = (data && (data.user || data.profile || data.me)) || data || {};

    let plan = u.plan || u.plan_name || u.tier || u.subscription || (data && data.plan) || "";
    if (plan && typeof plan === "object") plan = plan.name || plan.id || plan.slug || "";
    if (!plan && u.role) plan = u.role;

    const email = u.email || "";
    const saved = readSaved()[String(email).toLowerCase()] || "";

    return {
      name: u.name || u.nome || u.full_name || "",
      email: email,
      plan: String(plan || ""),
      avatar: u.avatar_url || u.avatar || u.foto || u.picture || (data && data.avatar_url) || saved || ""
    };
  }

  function avatarSrc(url, bust) {
    if (!url) return AVATAR_PADRAO;
    url = String(url);

    if (/^(data:|blob:)/i.test(url)) return url;

    if (/^https?:\/\//i.test(url)) {
      try {
        if (new URL(url).origin === w.location.origin) return url + (bust ? (url.includes("?") ? "&" : "?") + "v=" + bust : "");
      } catch (_) { return AVATAR_PADRAO; }
      return url;
    }

    if (url.charAt(0) !== "/") url = "/" + url;

    return (cfg.AVATAR && cfg.AVATAR.media || "/midia") +
        "?path=" + encodeURIComponent(url) +
        (bust ? "&v=" + bust : "");
  }

  function paintAvatars(path, bust) {
    const src = avatarSrc(path, bust);
    d.querySelectorAll("[data-user-avatar]").forEach(function (img) {
      img.onerror = function () { this.onerror = null; this.src = AVATAR_PADRAO; };
      img.src = src;
    });
  }

  const Session = {
    AVATAR_PADRAO: AVATAR_PADRAO,
    avatarSrc: avatarSrc,

    get user() { return state.user; },

    load: function (opts) {
      opts = opts || {};
      const Api = Phishware.Api;

      if (!opts.force && !Api.hasSessionHint()) return Promise.resolve(null);

      if (!state.pending || opts.fresh) {
        state.pending = Api.call("GET", cfg.AUTH.me, { tryRefresh: !!opts.force })
          .then(function (data) {
            state.user = pickUser(data);
            Api.setSessionHint(true);
            return state.user;
          })
          .catch(function (err) {
            if (err.status === 401 || err.status === 403) {
              Api.setSessionHint(false);
              state.user = null;
              return null;
            }
            throw err;
          });
      }
      return state.pending;
    },

    markLoggedIn: function () {
      Phishware.Api.setSessionHint(true);
      state.pending = null;
    },

    markLoggedOut: function () {
      Phishware.Api.setSessionHint(false);
      state.user = null;
      state.pending = null;
    },

    setAvatar: function (path, email) {
      if (path && email) {
        const saved = readSaved();
        saved[String(email).toLowerCase()] = path;
        try { w.localStorage.setItem(AVATAR_KEY, JSON.stringify(saved)); } catch (_) { /* sem armazenamento */ }
      }
      if (state.user) state.user.avatar = path;
      paintAvatars(path, Date.now());
    }
  };

  Phishware.Session = Session;

  function closeMenus(except) {
    d.querySelectorAll("[data-menu].open").forEach(function (menu) {
      if (menu === except) return;
      menu.classList.remove("open");
      const btn = d.querySelector('[aria-controls="' + menu.id + '"]');
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function bindMenus(root) {
    (root || d).querySelectorAll("[data-menu-toggle]").forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "1";

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const menu = d.getElementById(btn.getAttribute("aria-controls"));
        if (!menu) return;
        const open = !menu.classList.contains("open");
        closeMenus(menu);
        menu.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", String(open));
      });
    });
  }

  d.addEventListener("click", function () { closeMenus(null); });
  d.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenus(null);
  });

  function bindNavToggle() {
    const toggle = d.getElementById("navToggle");
    const panel = d.getElementById("navPanel");
    if (!toggle || !panel) return;

    toggle.addEventListener("click", function () {
      const open = !panel.classList.contains("open");
      panel.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  function renderAccount(user) {
    const box = d.getElementById("navAccount");
    if (!box) return;

    box.replaceChildren();

    const wrap = d.createElement("div");
    wrap.style.position = "relative";

    const btn = d.createElement("button");
    btn.type = "button";
    btn.className = "avatar-btn";
    btn.id = "accountBtn";
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "accountMenu");
    btn.setAttribute("data-menu-toggle", "");

    const img = d.createElement("img");
    img.alt = "";
    img.width = 32;
    img.height = 32;
    img.setAttribute("data-user-avatar", "");
    img.src = avatarSrc(user.avatar);

    const label = d.createElement("span");
    label.textContent = user.name || user.email || "Minha conta";

    btn.append(img, label, icon("chevron"));

    const menu = d.createElement("ul");
    menu.className = "menu menu-account";
    menu.id = "accountMenu";
    menu.setAttribute("data-menu", "");

    [
      ["conta.html", "user", "Minha conta"],
      ["historico.html", "clock", "Histórico"]
    ].forEach(function (item) {
      const li = d.createElement("li");
      const a = d.createElement("a");
      a.href = item[0];
      a.append(icon(item[1]), d.createTextNode(item[2]));
      li.appendChild(a);
      menu.appendChild(li);
    });

    const liOut = d.createElement("li");
    const out = d.createElement("button");
    out.type = "button";
    out.append(icon("logout"), d.createTextNode("Sair"));
    out.addEventListener("click", async function () {
      try { await Phishware.Api.call("POST", cfg.AUTH.logout); } catch (_) { /* limpa mesmo assim */ }
      Session.markLoggedOut();
      w.location.href = "login.html";
    });
    liOut.appendChild(out);
    menu.appendChild(liOut);

    wrap.append(btn, menu);
    box.appendChild(wrap);

    const onerr = function () { this.onerror = null; this.src = AVATAR_PADRAO; };
    img.onerror = onerr;

    bindMenus(box);
  }

  async function checkHealth() {
    const el = d.getElementById("siteStatus");
    if (!el || !cfg.HEALTH) return;

    try {
      const res = await fetch(cfg.HEALTH, { headers: { Accept: "application/json" } });
      const data = await res.json().catch(function () { return {}; });

      if (res.ok && (data.status === "ok" || data.status === "healthy" || data.status === undefined)) {
        el.className = "status is-on";
        el.textContent = data.db === "error"
          ? "Servidor no ar, banco de dados com falha"
          : "Servidor de análise no ar";
      } else {
        throw new Error("indisponível");
      }
    } catch (_) {
      el.className = "status is-off";
      el.textContent = "Servidor de análise indisponível";
    }
  }

  d.addEventListener("DOMContentLoaded", function () {
    bindMenus(d);
    bindNavToggle();

    const year = d.getElementById("anoAtual");
    if (year) year.textContent = new Date().getFullYear();

    Session.load().then(function (user) {
      if (user) renderAccount(user);
    }).catch(function (err) {
      console.error("Não foi possível carregar a sessão:", err);
    });

    checkHealth();
  });

})(window, document);
