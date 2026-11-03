(function (w, d) {
  "use strict";

  const P = w.Phishware;
  const cfg = w.PHISHWARE_CONFIG;

  d.addEventListener("DOMContentLoaded", function () {
    const form = d.getElementById("formCadastro");
    const btn = d.getElementById("botaoCadastro");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const nome = d.getElementById("nomeCadastro").value.trim();
      const email = d.getElementById("emailCadastro").value.trim().toLowerCase();
      const senha = d.getElementById("senhaCadastro").value;
      const confirmar = d.getElementById("confirmarSenha").value;

      if (!nome || !email) return P.toast("Preencha nome e e-mail.", "warning");
      if (senha.length < 8) return P.toast("A senha precisa ter pelo menos 8 caracteres.", "warning");
      if (senha !== confirmar) return P.toast("As senhas não conferem.", "warning");

      btn.disabled = true;
      btn.querySelector(".btn-label").textContent = "Criando conta…";

      try {
        await P.Api.call("POST", cfg.AUTH.register, {
          json: { name: nome, email: email, password: senha },
          messages: {
            409: "Esse e-mail já está cadastrado. Use a tela de login.",
            422: "Confira os dados: o e-mail precisa ser válido e a senha ter pelo menos 8 caracteres."
          }
        });

        P.Session.markLoggedIn();
        P.toast("Conta criada. Você já está logado.", "success");
        form.reset();
        w.setTimeout(function () { w.location.href = "conta.html"; }, 700);

      } catch (err) {
        P.toast(err.message, err.status === 409 ? "warning" : "danger");
        btn.disabled = false;
        btn.querySelector(".btn-label").textContent = "Criar conta";
      }
    });
  });
})(window, document);
