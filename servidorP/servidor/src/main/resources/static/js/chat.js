(function (w, d) {
  "use strict";

  const P = w.Phishware;
  const cfg = w.PHISHWARE_CONFIG;
  const C = cfg.CHAT;
  const $ = function (id) { return d.getElementById(id); };

  const state = {
    me: null, messages: [], ids: new Set(), hasMore: true,
    loadingOlder: false, sending: false, ws: null, retry: 0,
    closing: false, unseen: 0, poll: null, reconnectTimer: null
  };
  function asList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.messages)) return data.messages;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    return null;
  }

  function asMessage(data) {
    return data && (data.message || data.data) && typeof (data.message || data.data) === "object"
      ? (data.message || data.data)
      : data;
  }

  function parseDate(value) {
    if (!value) return new Date(NaN);
    const text = String(value);
    return new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + "Z");
  }

  const dayKey = function (date) { return date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate(); };

  function dayLabel(date) {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (dayKey(date) === dayKey(today)) return "Hoje";
    if (dayKey(date) === dayKey(yesterday)) return "Ontem";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  }

  const timeLabel = function (date) { return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };

  function compare(a, b) {
    return parseDate(a.sent_at) - parseDate(b.sent_at) || Number(a.id) - Number(b.id);
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2)
      .map(function (part) { return part.charAt(0); }).join("").toUpperCase() || "?";
  }

  function isOwn(msg) {
    if (!state.me) return false;
    if (msg.email && state.me.email) return String(msg.email).toLowerCase() === String(state.me.email).toLowerCase();
    return String(msg.name) === String(state.me.name);
  }

  const authed = function (method, path, opts) { return P.Api.call(method, path, opts); };
  function showGate() {
    stopSocket();
    stopPolling();
    state.me = null;

    $("chatBoot").classList.add("d-none");
    $("chatApp").classList.add("d-none");
    $("authGate").classList.remove("d-none");
  }

  function showChat() {
    $("chatBoot").classList.add("d-none");
    $("authGate").classList.add("d-none");
    $("chatApp").classList.remove("d-none");
    $("meName").textContent = state.me.name;
  }

  async function enter() {
    try {
      const user = await P.Session.load({ force: true, fresh: true });

      if (!user) {
        showGate();
        return false;
      }

      state.me = { name: user.name || user.email || "Você", email: user.email };
    } catch (err) {
      P.toast(err.message, "danger");
      showGate();
      return false;
    }

    showChat();
    await loadHistory();
    if (state.me) startSocket();
    return true;
  }

  function setupGate() {
    const tabs = d.querySelectorAll("[data-tab]");

    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        tabs.forEach(function (b) {
          const on = b === btn;
          b.setAttribute("aria-selected", String(on));
          $(b.dataset.tab).classList.toggle("d-none", !on);
        });
      });
    });

    const handle = function (formId, build) {
      const form = $(formId);
      if (!form) return;

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const btn = form.querySelector("button[type=submit]");
        btn.disabled = true;

        try {
          const req = build(form);
          await P.Api.call("POST", req.path, { json: req.json, messages: req.messages });
          P.Session.markLoggedIn();

          const ok = await enter();
          if (!ok) P.toast("A conta foi autenticada, mas a sessão não foi reconhecida. Confira o repasse de cookies no Spring Boot.", "warning");
        } catch (err) {
          P.toast(err.message, err.status === 409 || err.status === 401 ? "warning" : "danger");
        } finally {
          btn.disabled = false;
        }
      });
    };

    handle("formChatLogin", function (form) {
      return {
        path: cfg.AUTH.login,
        json: { email: form.email.value.trim().toLowerCase(), password: form.password.value, remember: true },
        messages: { 401: "E-mail ou senha incorretos.", 403: "Esta conta está desativada." }
      };
    });

    handle("formChatRegister", function (form) {
      return {
        path: cfg.AUTH.register,
        json: { name: form.nome.value.trim(), email: form.email.value.trim().toLowerCase(), password: form.password.value },
        messages: { 409: "Esse e-mail já está cadastrado. Use a aba Entrar." }
      };
    });
  }
  function buildAvatar(msg) {
    const box = d.createElement("div");
    box.className = "msg-avatar";
    box.setAttribute("aria-hidden", "true");

    if (msg.avatar_url) {
      const img = d.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = P.Session.avatarSrc(msg.avatar_url);
      img.addEventListener("error", function () {
        img.remove();
        box.textContent = initials(msg.name);
      });
      box.appendChild(img);
    } else {
      box.textContent = initials(msg.name);
    }
    return box;
  }

  function buildNode(msg, prev, isNew) {
    const frag = d.createDocumentFragment();
    const date = parseDate(msg.sent_at);

    if (!prev || dayKey(parseDate(prev.sent_at)) !== dayKey(date)) {
      const sep = d.createElement("li");
      sep.className = "day-sep";
      sep.textContent = isNaN(date) ? "" : dayLabel(date);
      frag.appendChild(sep);
    }

    const li = d.createElement("li");
    li.className = "msg" + (isOwn(msg) ? " own" : "") + (isNew ? " is-new" : "");
    li.dataset.id = msg.id;

    const bubble = d.createElement("div");
    bubble.className = "msg-bubble";

    const author = d.createElement("span");
    author.className = "msg-author";
    author.textContent = msg.name || "Usuário";

    const text = d.createElement("p");
    text.className = "msg-text";
    text.textContent = msg.content;

    const time = d.createElement("time");
    time.className = "msg-time";
    time.dateTime = isNaN(date) ? "" : date.toISOString();
    time.textContent = isNaN(date) ? "" : timeLabel(date);

    bubble.append(author, text, time);
    li.append(buildAvatar(msg), bubble);
    frag.appendChild(li);

    return frag;
  }

  function renderAll() {
    const list = $("messageList");
    list.replaceChildren();

    state.messages.forEach(function (msg, index) {
      list.appendChild(buildNode(msg, state.messages[index - 1], false));
    });

    $("emptyChat").classList.toggle("d-none", state.messages.length > 0);
  }

  const box = function () { return $("messages"); };
  const nearBottom = function () { return box().scrollHeight - box().scrollTop - box().clientHeight < 90; };

  function scrollToBottom(smooth) {
    box().scrollTo({ top: box().scrollHeight, behavior: smooth ? "smooth" : "auto" });
    state.unseen = 0;
    $("newMsgBtn").classList.add("d-none");
  }
  function merge(list) {
    const added = list.filter(function (msg) {
      return msg && msg.id !== undefined && !state.ids.has(String(msg.id));
    });

    added.forEach(function (msg) { state.ids.add(String(msg.id)); });
    state.messages = state.messages.concat(added).sort(compare);
    return added;
  }

  async function loadHistory() {
    $("historySkeleton").classList.remove("d-none");

    try {
      const data = await authed("GET", C.messages, { query: { limit: C.HISTORY_LIMIT } });
      const list = asList(data);
      if (!list) throw new Error("O servidor retornou um histórico de mensagens inválido.");

      state.hasMore = list.length >= C.HISTORY_LIMIT;
      merge(list);
      renderAll();
      $("btnOlder").classList.toggle("d-none", !state.hasMore);
      scrollToBottom(false);

    } catch (err) {
      if (err.status === 401) { showGate(); return; }
      P.toast(err.message, "danger");
    } finally {
      $("historySkeleton").classList.add("d-none");
    }
  }

  async function loadOlder() {
    if (state.loadingOlder || !state.hasMore || !state.messages.length) return;

    state.loadingOlder = true;
    const btn = $("btnOlder");
    btn.disabled = true;

    try {
      const data = await authed("GET", C.messages, {
        query: { limit: C.HISTORY_LIMIT, before_id: state.messages[0].id }
      });
      const list = asList(data);
      if (!list) throw new Error("O servidor retornou um histórico de mensagens inválido.");

      state.hasMore = list.length >= C.HISTORY_LIMIT;

      const before = box().scrollHeight;
      merge(list);
      renderAll();
      box().scrollTop += box().scrollHeight - before;
      btn.classList.toggle("d-none", !state.hasMore);

    } catch (err) {
      P.toast(err.message, "danger");
    } finally {
      state.loadingOlder = false;
      btn.disabled = false;
    }
  }

  function receive(msg) {
    const stick = nearBottom();
    const last = state.messages[state.messages.length - 1];
    const added = merge([msg]);

    if (!added.length) return;

    if (!last || compare(last, msg) <= 0) {
      $("emptyChat").classList.add("d-none");
      const prev = state.messages[state.messages.length - 2];
      $("messageList").appendChild(buildNode(msg, prev, true));
    } else {
      renderAll();
    }

    if (isOwn(msg) || stick) {
      scrollToBottom(true);
    } else {
      state.unseen += 1;
      const btn = $("newMsgBtn");
      btn.textContent = state.unseen + (state.unseen === 1 ? " nova mensagem ↓" : " novas mensagens ↓");
      btn.classList.remove("d-none");
    }
  }
  async function send(text) {
    if (state.sending) return;

    state.sending = true;
    $("btnSend").disabled = true;

    try {
      const data = await authed("POST", C.messages, {
        json: { content: text, sent_at: new Date().toISOString() },
        messages: { 422: "Mensagem inválida. Escreva entre 1 e " + C.MAX_LENGTH + " caracteres." }
      });

      $("messageInput").value = "";
      updateComposer();

      const msg = asMessage(data);
      if (msg && msg.id !== undefined) receive(msg);

    } catch (err) {
      if (err.status === 401) {
        P.toast("Sua sessão expirou. Entre novamente.", "warning");
        showGate();
      } else {
        P.toast(err.message, "danger");
      }
    } finally {
      state.sending = false;
      updateComposer();
      $("messageInput").focus();
    }
  }

  function updateComposer() {
    const input = $("messageInput");

    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";

    const len = input.value.length;
    const counter = $("charCount");

    counter.textContent = len + "/" + C.MAX_LENGTH;
    counter.style.color = len > C.MAX_LENGTH * 0.95 ? "var(--danger)" : "";
    $("btnSend").disabled = state.sending || !input.value.trim();
  }

  function setupComposer() {
    const input = $("messageInput");

    input.maxLength = C.MAX_LENGTH;
    input.addEventListener("input", updateComposer);

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        $("composer").requestSubmit();
      }
    });

    $("composer").addEventListener("submit", function (event) {
      event.preventDefault();
      const text = input.value.trim();
      if (text) send(text);
    });

    updateComposer();
  }

  function setStatus(kind) {
    const map = {
      on: ["conn conn-on", "Ao vivo"],
      wait: ["conn conn-wait", "Reconectando…"],
      poll: ["conn conn-wait", "Atualizando a cada poucos segundos"],
      off: ["conn conn-off", "Desconectado"]
    };
    const el = $("connStatus");
    el.className = map[kind][0];
    el.textContent = map[kind][1];
  }

  function startSocket() {
    stopSocket();
    state.closing = false;
    setStatus("wait");

    const protocol = w.location.protocol === "https:" ? "wss:" : "ws:";
    let socket;

    try {
      socket = new WebSocket(protocol + "//" + w.location.host + C.ws);
    } catch (err) {
      console.error("Erro ao criar WebSocket:", err);
      scheduleReconnect();
      return;
    }

    state.ws = socket;

    socket.addEventListener("open", async function () {
      const wasRetry = state.retry > 0;
      state.retry = 0;
      stopPolling();
      setStatus("on");
      if (wasRetry) await catchUp();
    });

    socket.addEventListener("message", function (event) {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === "message") receive(data);
      } catch (err) {
        console.error("Mensagem WebSocket inválida:", err);
      }
    });

    socket.addEventListener("close", async function (event) {
      if (state.closing || state.ws !== socket) return;

      setStatus("off");

      if (event.code === 1008) {
        try {
          await P.Api.call("POST", cfg.AUTH.refresh);
        } catch (_) {
          P.toast("Sua sessão expirou. Entre novamente.", "warning");
          P.Session.markLoggedOut();
          showGate();
          return;
        }
      }
      scheduleReconnect();
    });
  }

  function stopSocket() {
    state.closing = true;
    if (state.reconnectTimer) { w.clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }

    if (state.ws) {
      const socket = state.ws;
      state.ws = null;
      try { socket.close(); } catch (_) { /* já encerrada */ }
    }
  }

  function scheduleReconnect() {
    if (state.closing || !state.me) return;

    state.retry += 1;

    if (state.retry >= 3) startPolling();
    else setStatus("wait");

    const delay = Math.min(1000 * Math.pow(2, state.retry - 1), 20000);

    state.reconnectTimer = w.setTimeout(function () {
      state.reconnectTimer = null;
      if (!state.closing && state.me) startSocket();
    }, delay);
  }

  function startPolling() {
    if (state.poll) return;
    setStatus("poll");
    state.poll = w.setInterval(catchUp, 6000);
  }

  function stopPolling() {
    if (state.poll) { w.clearInterval(state.poll); state.poll = null; }
  }

  async function catchUp() {
    try {
      const data = await authed("GET", C.messages, { query: { limit: C.HISTORY_LIMIT } });
      const list = asList(data);
      if (list) list.slice().sort(compare).forEach(receive);
    } catch (err) {
      if (err.status === 401) { showGate(); return; }
      console.error("Erro ao buscar mensagens:", err);
    }
  }
  d.addEventListener("DOMContentLoaded", async function () {
    setupGate();
    setupComposer();

    $("btnOlder").addEventListener("click", loadOlder);
    $("newMsgBtn").addEventListener("click", function () { scrollToBottom(true); });

    box().addEventListener("scroll", function () {
      if (nearBottom()) {
        state.unseen = 0;
        $("newMsgBtn").classList.add("d-none");
      }
    }, { passive: true });

    $("btnLogout").addEventListener("click", async function () {
      try { await P.Api.call("POST", cfg.AUTH.logout); } catch (_) { /* limpa a tela mesmo assim */ }

      P.Session.markLoggedOut();
      state.messages = [];
      state.ids.clear();
      renderAll();
      showGate();
      w.location.reload();
    });

    w.addEventListener("beforeunload", stopSocket);

    const ok = await enter();
    if (!ok) $("chatBoot").classList.add("d-none");
  });

})(window, document);
