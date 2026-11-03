(function (w, d) {
  "use strict";

  const P = w.Phishware;
  const cfg = w.PHISHWARE_CONFIG;


  function safeNext() {
    const next = new URLSearchParams(w.location.search).get("next") || "";
    return /^[a-z0-9\-]+\.html$/i.test(next) ? next : "conta.html";
  }

  d.addEventListener("DOMContentLoaded", function () {
    const form = d.getElementById("formLogin");
    const btn = d.getElementById("botaoLogin");
    if (!form) return;

    // Quem já está logado vai direto para o destino.
    P.Session.load().then(function (user) {
      if (user) w.location.replace(safeNext());
    }).catch(function () { /* segue na tela de login */ });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = d.getElementById("emailLogin").value.trim().toLowerCase();
      const senha = d.getElementById("senhaLogin").value;
      const remember = d.getElementById("lembrar").checked;

      if (!email || !senha) return P.toast("Preencha o e-mail e a senha.", "warning");

      btn.disabled = true;
      btn.querySelector(".btn-label").textContent = "Entrando…";

      try {
        await P.Api.call("POST", cfg.AUTH.login, {
          json: { email: email, password: senha, remember: remember },
          messages: {
            401: "E-mail ou senha incorretos.",
            403: "Esta conta está desativada ou sem acesso.",
            429: "Muitas tentativas de login. Aguarde um minuto e tente de novo."
          }
        });

        P.Session.markLoggedIn();
        P.toast("Login realizado.", "success");
        w.setTimeout(function () { w.location.href = safeNext(); }, 500);

      } catch (err) {
        P.toast(err.message, err.status === 401 ? "warning" : "danger");
        btn.disabled = false;
        btn.querySelector(".btn-label").textContent = "Entrar";
      }
    });
  });
})(window, document);
