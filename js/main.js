(function () {
  "use strict";

  var config = window.PROCURO_CONFIG || {};
  var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || ""); };
  var emailOk = isEmail(config.email);
  var formEmail = isEmail(config.emailFormulaire) ? config.emailFormulaire : config.email;

  // --- Coordonnées issues de config.js ---
  document.querySelectorAll("[data-config]").forEach(function (el) {
    el.textContent = config[el.getAttribute("data-config")] || "";
  });
  document.querySelectorAll('[data-config-link="email"]').forEach(function (a) {
    a.textContent = config.email || "";
    if (emailOk) a.href = "mailto:" + config.email;
  });
  var digits = (config.telephone || "").replace(/[^\d+]/g, "");
  document.querySelectorAll('[data-config-link="telephone"]').forEach(function (a) {
    a.textContent = config.telephone || "";
    if (config.whatsapp) {
      a.href = "https://wa.me/" + config.whatsapp.replace(/\D/g, "");
      a.target = "_blank";
      a.rel = "noopener";
    } else if (digits.length >= 6) {
      a.href = "tel:" + digits;
    }
  });
  var annee = document.getElementById("annee");
  if (annee) annee.textContent = new Date().getFullYear();

  // --- Menu mobile ---
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    };
    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("open"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // --- Boutons de formule : présélection dans le formulaire ---
  var formuleSelect = document.getElementById("formule");
  document.querySelectorAll("[data-formule]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (formuleSelect) formuleSelect.value = btn.getAttribute("data-formule");
    });
  });

  // --- Simulateur de commission ---
  var montant = document.getElementById("montant");
  var simOut = document.getElementById("sim-out");
  var euros = function (n) {
    return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " € HT";
  };
  if (montant && simOut) {
    montant.addEventListener("input", function () {
      var v = parseFloat(montant.value.replace(",", "."));
      if (!v || v <= 0) {
        simOut.textContent = "Saisissez un montant pour voir l'estimation.";
        return;
      }
      if (v > 50000) {
        simOut.innerHTML = "Au-delà de 50 000 €, le taux est <strong>sur devis</strong>.";
        return;
      }
      var taux = v < 5000 ? 0.10 : v <= 20000 ? 0.08 : 0.06;
      var com = v * taux;
      var min = v < 5000 && com < 350;
      if (min) com = 350;
      simOut.innerHTML = "Commission estimée : <strong>" + euros(com) + "</strong> (" +
        (min ? "minimum de 350 €" : Math.round(taux * 100) + " %") + ")";
    });
  }

  // --- Formulaire de devis ---
  var form = document.getElementById("devis");
  if (!form) return;
  var statusBox = document.getElementById("form-status");
  var submitBtn = form.querySelector('button[type="submit"]');

  var messages = {
    nom: "Indiquez votre nom et votre société.",
    email: "Indiquez une adresse e-mail valide.",
    quantite: "Indiquez une quantité, même approximative.",
    produit: "Décrivez le produit en quelques mots (20 caractères minimum)."
  };

  function setError(id, msg) {
    var input = document.getElementById(id);
    var err = document.getElementById(id + "-err");
    input.closest(".field").classList.toggle("invalid", !!msg);
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) {
      err.textContent = msg || "";
      input.setAttribute("aria-describedby", id + "-err");
    }
  }

  function validate() {
    var first = null;
    var check = function (id, ok) {
      setError(id, ok ? "" : messages[id]);
      if (!ok && !first) first = document.getElementById(id);
    };
    check("nom", form.nom.value.trim().length >= 2);
    check("email", /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.value.trim()));
    check("quantite", form.quantite.value.trim().length >= 1);
    check("produit", form.produit.value.trim().length >= 20);
    var consentOk = form.consentement.checked;
    document.getElementById("consent-wrap").classList.toggle("invalid", !consentOk);
    if (!consentOk && !first) first = form.consentement;
    if (first) first.focus();
    return !first;
  }

  ["nom", "email", "quantite", "produit"].forEach(function (id) {
    document.getElementById(id).addEventListener("blur", function () {
      if (this.closest(".field").classList.contains("invalid")) validate();
    });
  });

  function showStatus(type, html) {
    statusBox.className = "form-status " + type;
    statusBox.innerHTML = html;
    statusBox.hidden = false;
  }

  function payload() {
    return {
      _subject: form._subject.value,
      _template: "table",
      _captcha: "false",
      _replyto: form.email.value.trim(),
      _honey: form._honey.value,
      "Nom et société": form.nom.value.trim(),
      "E-mail": form.email.value.trim(),
      "Téléphone": form.telephone.value.trim() || "—",
      "Formule": form.formule.value,
      "Quantité": form.quantite.value.trim(),
      "Produit": form.produit.value.trim()
    };
  }

  function mailtoFallback(data) {
    var body = ["Nom et société", "E-mail", "Téléphone", "Formule", "Quantité", "Produit"]
      .map(function (k) { return k + " : " + data[k]; }).join("\n");
    return "mailto:" + config.email + "?subject=" + encodeURIComponent(data._subject) +
      "&body=" + encodeURIComponent(body);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusBox.hidden = true;
    if (!validate()) return;
    if (form._honey.value) return; // robot

    var data = payload();
    if (!isEmail(formEmail)) {
      showStatus("err", "Le formulaire n'est pas encore configuré : renseignez l'adresse e-mail dans <code>js/config.js</code>.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours…";

    fetch("https://formsubmit.co/ajax/" + encodeURIComponent(formEmail), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = {};
          try { j = JSON.parse(t); } catch (err) { j = { message: "HTTP " + r.status }; }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (res) {
        if (!res.ok || String(res.j.success) !== "true") throw new Error(res.j.message || "Erreur inconnue");
        form.reset();
        showStatus("ok", "<strong>Merci, votre demande est bien envoyée.</strong> Nous revenons vers vous sous " +
          (config.delaiReponse || "peu") + ".");
      })
      .catch(function (err) {
        var msg = String((err && err.message) || "");
        var fallback = "<a href=\"" + mailtoFallback(data) +
          "\">Cliquez ici pour envoyer votre demande par e-mail</a> (elle est déjà rédigée).";
        if (/activat/i.test(msg)) {
          showStatus("err", "<strong>Formulaire en attente d'activation.</strong> Un e-mail d'activation vient d'être envoyé " +
            "au propriétaire du site. En attendant : " + fallback);
        } else if (location.protocol === "file:") {
          showStatus("err", "Le formulaire ne fonctionne que sur le site en ligne (pas en ouvrant le fichier sur l'ordinateur). " + fallback);
        } else {
          showStatus("err", "L'envoi n'a pas abouti. " + fallback +
            "<br><small>Détail : " + msg.replace(/[<>&]/g, "") + "</small>");
        }
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Envoyer ma demande";
        statusBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
  });
})();
