const cfg = window.VEXLA_CONFIG;

const form = document.getElementById("business-form");
const previewBtn = document.getElementById("preview-btn");
const checkoutBtn = document.getElementById("checkout-btn");
const previewContent = document.getElementById("preview-content");
const previewStatus = document.getElementById("preview-status");

let currentTempId = null;

hydrateForm();
handleCancelled();

if (form) {
  form.addEventListener("input", persistForm);
  form.addEventListener("submit", handleCheckout);
}

if (previewBtn) {
  previewBtn.addEventListener("click", handlePreview);
}

function getPayload() {
  const formData = new FormData(form);
  const raw = Object.fromEntries(formData.entries());

  return {
    ...raw,
    niche: raw.idea || ""
  };
}

function persistForm() {
  if (!form) return;
  localStorage.setItem("vexla_form", JSON.stringify(getPayload()));
}

function hydrateForm() {
  const saved = localStorage.getItem("vexla_form");
  if (!saved || !form) return;

  try {
    const data = JSON.parse(saved);
    Object.entries(data).forEach(([key, value]) => {
      const el = form.elements[key];
      if (el) el.value = value;
    });
  } catch (e) {
    console.error("Erreur localStorage :", e);
  }
}

function handleCancelled() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("cancelled") === "1") {
    renderError("Paiement annulé. Tu peux reprendre où tu t'es arrêté puis relancer le paiement.");
  }
}

function validateMainFields(payload) {
  return payload.idea && payload.audience && payload.budget && payload.experience && payload.goal;
}

async function createPreviewAndStoreTempId(payload) {
  if (!cfg || !cfg.BACKEND_BASE_URL || !cfg.PREVIEW_ENDPOINT) {
    throw new Error("Aucun endpoint d’aperçu configuré dans config.js");
  }

  const response = await fetch(`${cfg.BACKEND_BASE_URL}${cfg.PREVIEW_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || "Réponse backend invalide");
  }

  if (!response.ok) {
    throw new Error(data.error || text || "Impossible de générer l’aperçu");
  }

  if (!data.tempId) {
    throw new Error("Le backend n’a pas renvoyé de tempId");
  }

  currentTempId = data.tempId;
  return data;
}

async function handlePreview() {
  const payload = getPayload();

  if (!validateMainFields(payload)) {
    renderError("Complète d'abord les champs principaux pour générer un aperçu.");
    return;
  }

  previewStatus.textContent = "Aperçu en cours";
  previewContent.classList.remove("empty");
  previewContent.innerHTML = "<p>Génération de l’aperçu...</p>";

  try {
    const data = await createPreviewAndStoreTempId(payload);
    renderBusiness(data.preview || {});
    previewStatus.textContent = "Aperçu prêt";
  } catch (error) {
    renderError(error.message || "Erreur pendant l’aperçu");
  }
}

async function handleCheckout(event) {
  event.preventDefault();

  const payload = getPayload();

  if (!validateMainFields(payload)) {
    renderError("Merci de compléter tous les champs obligatoires avant de payer.");
    return;
  }

  if (!cfg || !cfg.BACKEND_BASE_URL || !cfg.CHECKOUT_ENDPOINT) {
    renderError("Le backend Stripe n’est pas configuré dans config.js");
    return;
  }

  persistForm();
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Redirection vers Stripe...";

  try {
    if (!currentTempId) {
      const previewData = await createPreviewAndStoreTempId(payload);
      if (previewData.preview) {
        renderBusiness(previewData.preview);
        previewStatus.textContent = "Aperçu prêt";
      }
    }

    const response = await fetch(`${cfg.BACKEND_BASE_URL}${cfg.CHECKOUT_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tempId: currentTempId
      })
    });

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text || "Réponse backend invalide");
    }

    if (!response.ok) {
      throw new Error(data.error || text || "Impossible de créer la session Stripe");
    }

    const url = data.url || data.checkoutUrl;

    if (!url) {
      throw new Error("Ton backend doit renvoyer { url }");
    }

    window.location.href = url;
  } catch (error) {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = `Débloquer mon business — ${cfg.PRICE_LABEL || "34,99€"}`;
    renderError(error.message || "Erreur de connexion à Stripe");
  }
}

function renderError(message) {
  previewStatus.textContent = "Erreur";
  previewContent.classList.remove("empty");
  previewContent.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

function renderBusiness(data) {
  const html = `
    ${section("Positionnement", data.positionnement)}
    ${section("Offre", data.offre)}
    ${section("Branding", data.branding)}
    ${section("Tunnel de vente", data.tunnel)}
    ${section("Plan 30 jours", data.plan30j)}
  `;

  previewContent.classList.remove("empty");
  previewContent.innerHTML = html;
}

function section(title, value) {
  return `<div class="preview-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(String(value || ""))}</p></div>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}