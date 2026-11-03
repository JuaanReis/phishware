
(function (w, d) {
  "use strict";

  const P = w.Phishware;
  const cfg = w.PHISHWARE_CONFIG;

  const PLANS = {
    standard: ["Standard", "5 verificações por dia em cada ferramenta."],
    go_pro: ["Go Pro", "25 verificações por dia em cada ferramenta."],
    plus_premium: ["Plus Premium", "Verificações sem limite diário."],
    admin: ["Administrador", "Verificações sem limite diário."],
    administrador: ["Administrador", "Verificações sem limite diário."]
  };


  function avatarFrom(data) {
    const u = (data && (data.user || data.profile)) || data || {};
    return u.avatar_url || u.avatar || u.url || u.path || u.foto || "";
  }

  d.addEventListener("DOMContentLoaded", async function () {
    const foto = d.getElementById("fotoPerfil");
    const input = d.getElementById("arquivoFoto");
    const botaoFoto = d.getElementById("botaoFoto");
    const form = d.getElementById("formConta");
    const btnSair = d.getElementById("btnSair");
    const btnSalvar = d.getElementById("btnSalvar");
    const campoNome = d.getElementById("nome");
    const campoEmail = d.getElementById("email");
    const planBox = d.getElementById("planBox");

    const limite = (Number(cfg.MAX_AVATAR_MB) || 5) * 1024 * 1024;

    foto.onerror = function () { this.onerror = null; this.src = P.Session.AVATAR_PADRAO; };



    let user;
    try {
      user = await P.Session.load({ force: true, fresh: true });
    } catch (err) {
      P.toast(err.message || "Não foi possível carregar seu perfil.", "danger");
      return;
    }

    if (!user) {
      w.location.replace("login.html?next=conta.html");
      return;
    }

    campoNome.value = user.name || "";
    campoEmail.value = user.email || "";
    foto.src = P.Session.avatarSrc(user.avatar);

    const key = user.plan.toLowerCase().replace(/[\s-]+/g, "_");
    const plan = PLANS[key];

    if (plan) {
      planBox.querySelector(".badge").textContent = plan[0];
      planBox.querySelector("p").textContent = plan[1];
      planBox.classList.remove("d-none");
    } else if (user.plan) {
      planBox.querySelector(".badge").textContent = user.plan;
      planBox.querySelector("p").textContent = "O limite diário de verificações depende do seu plano.";
      planBox.classList.remove("d-none");
    }

    let atual = foto.src;


    botaoFoto.addEventListener("click", function () { input.click(); });

    input.addEventListener("change", function () {
      const arquivo = input.files[0];
      if (!arquivo) return;

      if (arquivo.type.indexOf("image/") !== 0) {
        input.value = "";
        foto.src = atual;
        return P.toast("Escolha um arquivo de imagem.", "warning");
      }

      if (arquivo.size > limite) {
        input.value = "";
        foto.src = atual;
        return P.toast("Use uma foto de até " + cfg.MAX_AVATAR_MB + " MB.", "warning");
      }

      const leitor = new FileReader();
      leitor.onload = function () { foto.src = leitor.result; };
      leitor.onerror = function () {
        input.value = "";
        foto.src = atual;
        P.toast("Não foi possível abrir a imagem.", "danger");
      };
      leitor.readAsDataURL(arquivo);
    });



    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const arquivo = input.files[0];
      if (!arquivo) return P.toast("Escolha uma nova foto para salvar.", "info");

      const dados = new FormData();
      dados.append("file", arquivo);

      btnSalvar.disabled = true;
      btnSalvar.querySelector(".btn-label").textContent = "Salvando…";

      try {
        const resposta = await P.Api.call("POST", cfg.AVATAR.upload, {
          formData: dados,
          messages: {
            413: "A foto é maior do que o servidor aceita. Escolha uma imagem menor.",
            415: "Esse formato de imagem não é aceito. Use PNG, JPG ou WebP."
          }
        });

        let caminho = avatarFrom(resposta);

        if (!caminho) {
          const novo = await P.Session.load({ force: true, fresh: true });
          caminho = novo && novo.avatar;
        }
        if (!caminho) throw new Error("O servidor aceitou a foto, mas não informou onde ela foi guardada.");

        P.Session.setAvatar(caminho, user.email);

        atual = P.Session.avatarSrc(caminho, Date.now());
        foto.src = atual;
        input.value = "";

        P.toast("Foto de perfil atualizada.", "success");

      } catch (err) {
        console.error("Erro ao salvar a foto:", err);
        foto.src = atual;
        P.toast(err.message || "Não foi possível salvar sua foto.", "danger");

      } finally {
        btnSalvar.disabled = false;
        btnSalvar.querySelector(".btn-label").textContent = "Salvar alterações";
      }
    });

    btnSair.addEventListener("click", async function () {
      btnSair.disabled = true;
      try { await P.Api.call("POST", cfg.AUTH.logout); } catch (_) { /* sai mesmo assim */ }
      P.Session.markLoggedOut();
      w.location.href = "login.html";
    });
  });
})(window, document);
