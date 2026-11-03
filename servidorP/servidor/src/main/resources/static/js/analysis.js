(function (w, d) {
  "use strict";

  const P = w.Phishware;
  const cfg = w.PHISHWARE_CONFIG;
  const esc = P.esc;

  const KINDS = {
    url: { label: "link", button: "Verificar link", input: "json", endpoint: cfg.ENDPOINTS.url },
    qr: {
      label: "QR Code", button: "Verificar QR Code", input: "file", endpoint: cfg.ENDPOINTS.qr,
      types: ["image/png", "image/jpeg", "image/webp", "image/gif"], maxMb: cfg.MAX_IMAGE_MB,
      typeHint: "PNG, JPG, WebP ou GIF"
    },
    pix: { label: "Pix", button: "Verificar Pix", input: "pix", endpoint: cfg.ENDPOINTS.pix },
    file: {
      label: "arquivo", button: "Verificar arquivo", input: "file", endpoint: cfg.ENDPOINTS.file,
      types: null, maxMb: cfg.MAX_FILE_MB, typeHint: "executáveis e scripts"
    },
    image: {
      label: "imagem", button: "Verificar imagem", input: "file", endpoint: cfg.ENDPOINTS.image,
      types: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"], maxMb: cfg.MAX_IMAGE_MB,
      typeHint: "PNG, JPG, WebP, GIF ou BMP"
    }
  };

  const LEVEL_LABEL = {
    low: "Risco baixo",
    medium: "Risco médio",
    high: "Risco alto",
    unknown: "Sem classificação"
  };

  const VERDICTS = {
    safe: "Seguro",
    likely_safe: "Provavelmente seguro",
    legitimate: "Legítimo",
    benign: "Sem sinais de ameaça",
    suspicious: "Suspeito",
    dangerous: "Perigoso",
    malicious: "Malicioso",
    likely_malicious: "Provavelmente malicioso",
    phishing: "Phishing",
    likely_phishing: "Provável phishing",
    partial: "Parcial",
    inconclusive: "Inconclusivo"
  };

  const SECTION_LABEL = {
    identity: "Identidade", network: "Rede", tls: "Certificado TLS/SSL", dns: "DNS",
    http: "HTTP", content: "Conteúdo da página", domain: "Domínio"
  };

  const $ = function (id) { return d.getElementById(id); };

  function labelize(key) {
    const text = String(key).replace(/[_-]+/g, " ").trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function verdictLabel(value) {
    if (!value) return "—";
    return VERDICTS[String(value).toLowerCase()] || labelize(value);
  }

  function toPercent(score) {
    if (typeof score !== "number" || !isFinite(score)) return null;
    return Math.round(score <= 1 ? score * 100 : score);
  }

  function normalizeLevel(result, pct) {
    if (pct === null) return "unknown";

    const raw = String((result && result.risk_level) || "").toLowerCase();

    if (raw === "critical" || raw === "very_high") return "high";
    if (raw === "moderate") return "medium";
    if (LEVEL_LABEL[raw] && raw !== "unknown") return raw;

    return P.Gauge.levelFromPct(pct);
  }

  function formatValue(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (Array.isArray(value)) {
      if (!value.length) return "—";
      return value.map(function (item) {
        return typeof item === "object" ? JSON.stringify(item) : String(item);
      }).join(", ");
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function flatten(obj, prefix, depth) {
    const rows = [];
    Object.keys(obj || {}).forEach(function (key) {
      const value = obj[key];
      const name = prefix ? prefix + " › " + labelize(key) : labelize(key);

      if (value && typeof value === "object" && !Array.isArray(value) && depth < 3) {
        rows.push.apply(rows, flatten(value, name, depth + 1));
      } else {
        rows.push([name, formatValue(value)]);
      }
    });
    return rows;
  }

  function formatDate(timestamp) {
    const date = timestamp ? new Date(timestamp) : null;
    return date && !isNaN(date) ? date.toLocaleString("pt-BR") : "—";
  }


  function renderSummary(data, kind, targetName) {
    const scan = data.scan || {};
    const meta = scan.meta || {};
    const result = scan.result || {};
    const stats = scan.stats || {};
    const engine = scan.engine || {};

    const pct = toPercent(result.score);
    const level = normalizeLevel(result, pct);

    const rows = [
      ["ID da análise", meta.scan_id],
      [kind.input === "json" ? "Link analisado" : "Alvo", meta.url || targetName],
      ["Nível de risco", LEVEL_LABEL[level]],
      ["Pontuação", pct === null ? "Não calculada" : pct + " de 100"],
      ["Veredito", verdictLabel(result.verdict)],
      [
        "Regras acionadas",
        stats.rules_total !== undefined
          ? stats.rules_triggered + " de " + stats.rules_total +
            (typeof stats.trigger_rate === "number" ? " (" + Math.round(stats.trigger_rate * 100) + "%)" : "")
          : null
      ],
      ["Tempo de análise", typeof meta.scan_time_s === "number" ? meta.scan_time_s.toFixed(2) + " s" : null],
      ["Concluída em", formatDate(meta.timestamp)],
      ["Status", scan.status ? labelize(scan.status) : null],
      ["Motor", engine.name ? engine.name + (engine.version ? " v" + engine.version : "") : null]
    ];

    $("summaryBody").innerHTML = rows
      .filter(function (row) { return row[1] !== null && row[1] !== undefined; })
      .map(function (row) {
        return '<tr><th scope="row">' + esc(row[0]) + "</th><td>" + esc(formatValue(row[1])) + "</td></tr>";
      })
      .join("");

    return { pct: pct, level: level, result: result, stats: stats, scan: scan };
  }

  function renderGauge(summary) {
    const pct = summary.pct, level = summary.level, result = summary.result, scan = summary.scan;
    const inconclusive = scan.status === "inconclusive" || pct === null;

    P.Gauge.set($("gauge"), pct, level);

    const cls = "risk-" + level;
    $("resultBand").className = "result-band " + cls;

    const stamp = $("riskLabel");
    stamp.className = "stamp stamp-in " + cls;
    stamp.textContent = inconclusive && !result.verdict ? "Inconclusivo" : verdictLabel(result.verdict);

    $("verdictText").textContent = inconclusive ? "Sem pontuação calculada" : LEVEL_LABEL[level];

    const chips = [];

    if (summary.stats.rules_total !== undefined) {
      chips.push('<i class="ic ic-alert" aria-hidden="true"></i>' + esc(summary.stats.rules_triggered) + " regras acionadas");
    }
    if (scan.status === "partial") {
      chips.push('<i class="ic ic-info" aria-hidden="true"></i>Resultado parcial');
    }
    if (scan.status === "inconclusive") {
      chips.push('<i class="ic ic-info" aria-hidden="true"></i>Análise inconclusiva');
    }

    $("statChips").innerHTML = chips.map(function (c) { return '<span class="chip">' + c + "</span>"; }).join("");
  }

  function renderInsights(scan) {
    const list = Array.isArray(scan.insight) ? scan.insight : [];

    $("insightList").innerHTML = list.length
      ? list.map(function (item) {
          return '<li><i class="ic ic-alert" aria-hidden="true"></i><span>' +
            esc(typeof item === "object" ? JSON.stringify(item) : item) + "</span></li>";
        }).join("")
      : '<li class="ok"><i class="ic ic-check" aria-hidden="true"></i><span>Nenhum alerta relevante foi encontrado.</span></li>';
  }

  function renderHeuristics(scan) {
    const list = Array.isArray(scan.heuristics) ? scan.heuristics : [];

    $("heuristicsWrap").classList.toggle("d-none", !list.length);

    $("heuristicsBody").innerHTML = list.map(function (h) {
      if (typeof h !== "object" || h === null) {
        return '<tr><td colspan="3">' + esc(h) + "</td></tr>";
      }

      const name = h.name || h.id || h.rule || h.key || "Regra";
      const desc = h.description || h.message || h.reason || h.detail || "—";
      const weight = h.weight !== undefined ? h.weight : (h.score !== undefined ? h.score : h.points);

      return '<tr><th scope="row">' + esc(labelize(name)) + "</th><td>" + esc(desc) +
        '</td><td class="num">' + esc(formatValue(weight)) + "</td></tr>";
    }).join("");
  }

  function renderTarget(data) {
    const target = data.target && typeof data.target === "object" ? data.target : {};
    const keys = Object.keys(target);
    const box = $("targetAccordion");

    box.closest(".panel").classList.toggle("d-none", !keys.length);

    box.innerHTML = keys.map(function (key, index) {
      const section = target[key];
      const rows = section && typeof section === "object" && !Array.isArray(section)
        ? flatten(section, "", 0)
        : [[labelize(key), formatValue(section)]];

      return '<details class="details"' + (index === 0 ? " open" : "") + "><summary>" +
        esc(SECTION_LABEL[key] || labelize(key)) + '</summary><table class="kv"><tbody>' +
        rows.map(function (row) {
          return '<tr><th scope="row">' + esc(row[0]) + "</th><td>" + esc(row[1]) + "</td></tr>";
        }).join("") +
        "</tbody></table></details>";
    }).join("");
  }
  function setLoading(on, btn, kind) {
    btn.disabled = on;
    btn.classList.toggle("is-loading", on);

    btn.querySelector(".spinner").classList.toggle("d-none", !on);
    btn.querySelector(".btn-label").textContent = on ? "Analisando…" : kind.button;

    $("skeleton").classList.toggle("d-none", !on);
    if (on) $("resultSection").classList.add("d-none");
  }

  function showResult() {
    const section = $("resultSection");
    section.classList.remove("d-none");
    if (typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function validateFile(file, kind) {
    if (!file) return "Escolha um arquivo antes de verificar.";
    if (file.size === 0) return "O arquivo está vazio.";
    if (file.size > kind.maxMb * 1024 * 1024) return "O arquivo passa de " + kind.maxMb + " MB, o limite desta análise.";
    if (kind.types && kind.types.indexOf(file.type) === -1) return "Formato não aceito. Use " + kind.typeHint + ".";
    return null;
  }
  function validateUrl(value) {
    if (!value) return "Digite um link para analisar.";
    if (value.length > cfg.MAX_URL_LENGTH) return "O link pode ter no máximo " + cfg.MAX_URL_LENGTH + " caracteres.";

    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
    } catch (_) {
      return "Informe um link válido, começando com http:// ou https://.";
    }
    return null;
  }
  function buildPixPayload() {
    const code = $("pixInput").value.replace(/[\r\n]+/g, "").trim();

    if (!code) return { error: "Cole o código Pix copia e cola para analisar." };
    if (code.length > cfg.MAX_PIX_LENGTH) {
      return { error: "O código Pix pode ter no máximo " + cfg.MAX_PIX_LENGTH + " caracteres." };
    }
    const body = { payload: code };
    const merchant = $("pixMerchant").value.trim();
    let amount = $("pixAmount").value.trim();
    const expected = {};

    if (merchant) expected.merchant_name = merchant;

    if (amount) {
      if (!/^\d+([.,]\d{1,2})?$/.test(amount)) {
        return { error: "Informe o valor esperado só com números, por exemplo 35,90." };
      }
      expected.amount = amount.replace(",", ".");
    }

    if (Object.keys(expected).length) body.expected = expected;

    return { json: body };
  }
  function messageFor(err) {
    if (err.status === 401) {
      return P.Api.hasSessionHint()
        ? "Sua sessão expirou. Entre novamente e repita a análise."
        : "Você usou todas as verificações gratuitas de hoje sem conta. Entre ou crie uma conta para continuar.";
    }
    if (err.status === 429) {
      return "Você atingiu o limite de verificações do seu plano ou fez muitas tentativas seguidas. Aguarde um pouco e tente de novo.";
    }
    return err.message || "Não foi possível concluir a análise.";
  }
  function init() {
    const kind = KINDS[d.body.dataset.analysis];
    if (!kind) return;

    P.Gauge.mount($("gauge"));

    const form = $("analysisForm");
    const btn = $("btnAnalyze");
    if (!form || !btn) return;

    let selectedFile = null;

    if (kind.input === "file") {
      const zone = $("dropzone");
      const input = $("fileInput");
      const nameBox = $("fileName");
      const preview = $("previewBox");
      const previewImg = $("previewImg");

      const pick = function (file) {
        selectedFile = file || null;

        nameBox.textContent = file
          ? file.name + " (" + (file.size / 1024 / 1024).toFixed(2) + " MB)"
          : "Nenhum arquivo escolhido";

        if (preview && previewImg) {
          if (previewImg.dataset.url) {
            URL.revokeObjectURL(previewImg.dataset.url);
            delete previewImg.dataset.url;
          }
          if (file && file.type.indexOf("image/") === 0) {
            previewImg.dataset.url = URL.createObjectURL(file);
            previewImg.src = previewImg.dataset.url;
            preview.classList.add("has-img");
          } else {
            preview.classList.remove("has-img");
          }
        }
      };

      zone.addEventListener("click", function () { input.click(); });
      zone.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
      });
      input.addEventListener("change", function () { pick(input.files[0]); });

      ["dragenter", "dragover"].forEach(function (name) {
        zone.addEventListener(name, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
      });
      ["dragleave", "drop"].forEach(function (name) {
        zone.addEventListener(name, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
      });
      zone.addEventListener("drop", function (e) { pick(e.dataTransfer.files[0]); });
    }

    if (kind.input === "pix") {
      const area = $("pixInput");
      const counter = $("pixCount");
      const update = function () { counter.textContent = area.value.length + "/" + cfg.MAX_PIX_LENGTH; };
      area.maxLength = cfg.MAX_PIX_LENGTH + 200; // a validação mostra o aviso, em vez de cortar o texto
      area.addEventListener("input", update);
      update();
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      let payload;
      let targetName = "";

      if (kind.input === "json") {
        const url = $("urlInput").value.trim();
        const problem = validateUrl(url);
        if (problem) return P.toast(problem, "warning");

        payload = { json: { url: url, use_cache: false } };
        targetName = url;

      } else if (kind.input === "pix") {
        const built = buildPixPayload();
        if (built.error) return P.toast(built.error, "warning");

        payload = { json: built.json };
        targetName = "Código Pix informado";

      } else {
        const problem = validateFile(selectedFile, kind);
        if (problem) return P.toast(problem, "warning");

        const formData = new FormData();
        formData.append("file", selectedFile);

        payload = { formData: formData };
        targetName = selectedFile.name;
      }

      setLoading(true, btn, kind);

      try {
        const data = await P.Api.analyze(kind.endpoint, payload);

        if (!data || !data.scan) {
          throw new Error("O servidor retornou uma resposta de análise inválida.");
        }

        const summary = renderSummary(data, kind, targetName);
        renderGauge(summary);
        renderInsights(summary.scan);
        renderHeuristics(summary.scan);
        renderTarget(data);

        setLoading(false, btn, kind);
        showResult();

      } catch (err) {
        setLoading(false, btn, kind);
        console.error("Erro na análise:", err);
        P.toast(messageFor(err), err.status === 429 || err.status === 401 || err.status === 403 ? "warning" : "danger");
      }
    });
    if (kind.input === "json") {
      const params = new URLSearchParams(w.location.search);
      const incoming = params.get("u");

      if (incoming) {
        $("urlInput").value = incoming;
        w.history.replaceState(null, "", w.location.pathname);
        w.setTimeout(function () { form.requestSubmit(); }, 150);
      }
    }
  }

  d.addEventListener("DOMContentLoaded", init);

})(window, document);
