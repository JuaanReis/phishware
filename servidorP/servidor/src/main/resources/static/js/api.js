(function (w) {
  "use strict";

  const Phishware = (w.Phishware = w.Phishware || {});
  const cfg = w.PHISHWARE_CONFIG || {};

  class ApiError extends Error {
    constructor(message, status, type) {
      super(message);
      this.name = "ApiError";
      this.status = status || 0;
      this.type = type || "";
    }
  }

  const TYPE_MESSAGES = {
    undetected_qr_code: "Não encontramos nenhum QR Code nessa imagem. Tente uma foto mais nítida e bem enquadrada.",
    unsupported_qr_type: "Esse QR Code não contém um link. Por enquanto só analisamos QR Codes com URL (http:// ou https://).",
    empty_qr_data: "O QR Code foi lido, mas está sem conteúdo."
  };

  const STATUS_MESSAGES = {
    400: "A análise não pôde ser concluída. Verifique o conteúdo enviado e tente novamente.",
    401: "Sua sessão não foi reconhecida. Entre na sua conta e tente de novo.",
    403: "Sua conta não tem permissão para esta operação.",
    404: "Este recurso não foi encontrado no servidor.",
    405: "Esta operação não está disponível no servidor.",
    409: "Este registro já existe.",
    413: "O arquivo é maior do que o limite aceito.",
    415: "Formato de arquivo não suportado por este tipo de análise.",
    422: "Dados inválidos. Confira o que foi informado e tente novamente.",
    429: "Muitas solicitações em pouco tempo ou limite do seu plano atingido. Aguarde um instante e tente novamente.",
    500: "Erro interno no servidor. Tente novamente mais tarde.",
    502: "O servidor de análise não respondeu corretamente.",
    503: "O servidor está ocupado no momento. Tente novamente em alguns segundos.",
    504: "O servidor de análise demorou demais para responder."
  };

  function readErrorBody(data) {
    if (!data || typeof data !== "object") return {};

    if (data.error && typeof data.error === "object") {
      return { type: data.error.type, message: data.error.message };
    }
    if (typeof data.error === "string") return { message: data.error };
    if (typeof data.detail === "string") return { message: data.detail };
    if (Array.isArray(data.detail) && data.detail[0]) {
      return { message: data.detail[0].msg };
    }
    if (typeof data.message === "string") return { message: data.message };
    return {};
  }

  async function readResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return { message: text };
    }
  }

  function buildUrl(path, query) {
    if (typeof path !== "string" || !path.trim()) {
      throw new ApiError("Caminho da API não informado.", 0, "invalid_path");
    }
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new ApiError("Caminho inválido. Use uma rota do servidor, como /login.", 0, "invalid_path");
    }

    let url = path;

    if (query && typeof query === "object") {
      const qs = new URLSearchParams();
      Object.keys(query).forEach(function (key) {
        const value = query[key];
        if (value === undefined || value === null || value === "") return;
        qs.set(key, String(value));
      });
      const params = qs.toString();
      if (params) url += (url.includes("?") ? "&" : "?") + params;
    }
    return url;
  }
  const HINT_KEY = "pw_session";

  function hasSessionHint() {
    try { return w.localStorage.getItem(HINT_KEY) === "1"; } catch (_) { return false; }
  }

  function setSessionHint(on) {
    try {
      if (on) w.localStorage.setItem(HINT_KEY, "1");
      else w.localStorage.removeItem(HINT_KEY);
    } catch (_) { /* armazenamento indisponível */ }
  }
  let refreshing = null;

  function refreshSession() {
    if (!refreshing) {
      refreshing = fetch(cfg.AUTH.refresh, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; })
        .then(function (ok) {
          setTimeout(function () { refreshing = null; }, 0);
          return ok;
        });
    }
    return refreshing;
  }

  function isAuthPath(path) {
    const auth = cfg.AUTH || {};
    return path === auth.login || path === auth.register ||
        path === auth.refresh || path === auth.logout;
  }

  async function request(method, path, opts, retried) {
    opts = opts || {};

    const timeout = Number(cfg.TIMEOUT_MS) || 120000;
    const url = buildUrl(path, opts.query);

    if (opts.json !== undefined && opts.formData !== undefined) {
      throw new ApiError("Não é possível enviar JSON e FormData na mesma requisição.", 0, "invalid_payload");
    }

    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeout);

    const headers = new Headers(opts.headers || {});
    headers.set("Accept", "application/json");

    const init = {
      method: method,
      credentials: "same-origin",
      signal: controller.signal,
      headers: headers
    };

    try {
      if (opts.formData !== undefined) {
        if (!(opts.formData instanceof FormData)) {
          throw new ApiError("O conteúdo enviado não é um FormData válido.", 0, "invalid_payload");
        }
        headers.delete("Content-Type"); // o navegador define o boundary
        init.body = opts.formData;
      } else if (opts.json !== undefined) {
        headers.set("Content-Type", "application/json");
        init.body = JSON.stringify(opts.json);
      }

      const response = await fetch(url, init);

      if (
        response.status === 401 &&
        !retried &&
        !opts.noRefresh &&
        !isAuthPath(path) &&
        (hasSessionHint() || opts.tryRefresh)
      ) {
        clearTimeout(timer);
        const renewed = await refreshSession();
        if (renewed) {
          // FormData e JSON podem ser reenviados sem problema.
          return request(method, path, opts, true);
        }
        setSessionHint(false);
      }

      const data = await readResponse(response);

      if (!response.ok) {
        const body = readErrorBody(data);
        const custom = opts.messages && opts.messages[response.status];

        const message =
            custom ||
            TYPE_MESSAGES[body.type] ||
            body.message ||
            STATUS_MESSAGES[response.status] ||
            "Erro inesperado (código " + response.status + ").";

        throw new ApiError(message, response.status, body.type);
      }

      return data;

    } catch (err) {
      if (err instanceof ApiError) throw err;

      if (err.name === "AbortError") {
        throw new ApiError("O servidor demorou mais do que o esperado. Tente novamente.", 0, "timeout");
      }

      console.error("Falha na requisição:", err);
      throw new ApiError(
        "Não foi possível conectar ao servidor. Verifique se a aplicação Spring Boot está rodando.",
        0,
        "network"
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function analyze(endpoint, payload) {
    payload = payload || {};

    const data = await request("POST", endpoint, {
      json: payload.json,
      formData: payload.formData
    });

    if (data && data.scan && data.scan.status === "error") {
      throw new ApiError("O motor de análise reportou um erro técnico. Tente novamente.", 400, "engine_error");
    }
    return data;
  }

  async function call(method, path, opts) {
    method = String(method || "GET").toUpperCase();
    if (["GET", "POST", "PUT", "PATCH", "DELETE"].indexOf(method) === -1) {
      throw new ApiError("Método HTTP não permitido.", 0, "invalid_method");
    }
    return request(method, path, opts);
  }

  Phishware.Api = {
    analyze: analyze,
    call: call,
    ApiError: ApiError,
    hasSessionHint: hasSessionHint,
    setSessionHint: setSessionHint
  };

})(window);
