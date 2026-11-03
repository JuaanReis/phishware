(function (w, d) {
  "use strict";

  const P = w.Phishware;
  const cfg = w.PHISHWARE_CONFIG;
  const $ = function (id) { return d.getElementById(id); };

  const MODULES = {
    scurl: "Link ou QR Code", url: "Link", qr: "QR Code", scqr: "QR Code",
    scfs: "Arquivo", file: "Arquivo", scpix: "Pix", pix: "Pix", scimg: "Imagem", image: "Imagem"
  };

  const VERDICTS = {
    safe: "Seguro", likely_safe: "Provavelmente seguro", legitimate: "Legítimo", benign: "Sem ameaça",
    suspicious: "Suspeito", dangerous: "Perigoso", malicious: "Malicioso", likely_malicious: "Provavelmente malicioso",
    phishing: "Phishing", partial: "Parcial", inconclusive: "Inconclusivo"
  };

  const LEVELS = {
    low: "low", safe: "low", likely_safe: "low", legitimate: "low", benign: "low",
    medium: "medium", moderate: "medium", suspicious: "medium", partial: "medium",
    high: "high", critical: "high", dangerous: "high", malicious: "high", likely_malicious: "high", phishing: "high"
  };

  function asList(data) {
    if (Array.isArray(data)) return data;
    if (!data) return [];
    const keys = ["scans", "items", "results", "data", "history"];
    for (let i = 0; i < keys.length; i++) {
      const v = data[keys[i]];
      if (Array.isArray(v)) return v;
      if (v && Array.isArray(v.scans)) return v.scans;
    }
    return [];
  }

  function parseDate(value) {
    if (!value) return null;
    const text = String(value);
    const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(text) ? text : text + "Z");
    return isNaN(date) ? null : date;
  }

  function normalize(item) {
    const result = item.result || (item.scan && item.scan.result) || {};
    const meta = item.meta || (item.scan && item.scan.meta) || {};
    const verdict = String(result.verdict || item.verdict || "").toLowerCase();
    const risk = String(result.risk_level || item.risk_level || "").toLowerCase();
    const score = result.score !== undefined ? result.score : item.score;
    const module = String(item.module || item.type || item.tipo || (item.scan && item.scan.module) || "").toLowerCase();

    return {
      id: item.id || item.scan_id || meta.scan_id || item.url_hash || "—",
      module: MODULES[module] || (module ? module : "Análise"),
      target: item.url || item.target_url || item.filename || item.file_name || meta.url || "",
      verdict: VERDICTS[verdict] || (verdict ? verdict : (item.status || "Não informado")),
      level: LEVELS[verdict] || LEVELS[risk] || "",
      score: typeof score === "number" ? Math.round(score <= 1 ? score * 100 : score) : null,
      date: parseDate(item.created_at || item.createdAt || item.timestamp || meta.timestamp || item.date)
    };
  }

  function cell(text, cls) {
    const td = d.createElement("td");
    if (cls) td.className = cls;
    td.textContent = text == null ? "" : text;
    return td;
  }

  function render(items) {
    const body = $("listaHistorico");
    const empty = $("mensagemVazia");
    body.replaceChildren();

    const rows = items.map(normalize).sort(function (a, b) {
      return (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0);
    });

    const showTarget = rows.some(function (r) { return r.target; });
    $("colAlvo").classList.toggle("d-none", !showTarget);

    empty.classList.toggle("d-none", rows.length > 0);
    $("tabelaHistorico").classList.toggle("d-none", rows.length === 0);

    rows.forEach(function (r) {
      const tr = d.createElement("tr");

      tr.appendChild(cell(r.date ? r.date.toLocaleDateString("pt-BR") + " às " + r.date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"));
      tr.appendChild(cell(r.module));

      if (showTarget) {
        const t = cell(r.target.length > 60 ? r.target.slice(0, 57) + "…" : r.target);
        t.title = r.target;
        tr.appendChild(t);
      }

      const v = d.createElement("td");
      const pill = d.createElement("span");
      pill.className = "pill" + (r.level ? " risk-" + r.level : "");
      pill.textContent = r.verdict;
      v.appendChild(pill);
      tr.appendChild(v);

      tr.appendChild(cell(r.score === null ? "—" : r.score + " de 100", "num"));

      const id = cell(String(r.id).length > 12 ? String(r.id).slice(0, 8) + "…" : r.id, "mono");
      id.title = String(r.id);
      tr.appendChild(id);

      body.appendChild(tr);
    });
  }

  function show(which) {
    ["estadoCarregando", "estadoLogin", "estadoErro", "estadoLista"].forEach(function (id) {
      $(id).classList.toggle("d-none", id !== which);
    });
  }

  async function load() {
    show("estadoCarregando");

    const module = $("filtroModulo").value;

    try {
      const data = await P.Api.call("GET", cfg.HISTORY_ENDPOINT, { query: { module: module } });
      render(asList(data));
      show("estadoLista");

    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        P.Session.markLoggedOut();
        show("estadoLogin");
        return;
      }
      $("mensagemErro").textContent = err.message || "Não foi possível carregar o histórico.";
      show("estadoErro");
    }
  }

  d.addEventListener("DOMContentLoaded", function () {
    $("filtroModulo").addEventListener("change", load);
    $("btnRecarregar").addEventListener("click", load);
    $("btnTentarDeNovo").addEventListener("click", load);
    load();
  });
})(window, document);
