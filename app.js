const cfg = window.VEXLA_CONFIG;

const form = document.getElementById("business-form");
const previewBtn = document.getElementById("preview-btn");
const checkoutBtn = document.getElementById("checkout-btn");
const previewContent = document.getElementById("preview-content");
const previewStatus = document.getElementById("preview-status");

let currentTempId = null;

/* =========================================
   INIT
========================================= */
hydrateForm();
handleCancelled();

if (form) {
  form.addEventListener("input", persistForm);
  form.addEventListener("submit", handleCheckout);
}

if (previewBtn) {
  previewBtn.addEventListener("click", handlePreview);
}

/* =========================================
   FORM DATA
========================================= */
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

/* =========================================
   URL PARAMS
========================================= */
function handleCancelled() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("cancelled") === "1") {
    renderError("Paiement annulé. Tu peux reprendre puis relancer.");
  }
}

/* =========================================
   VALIDATION
========================================= */
function validateMainFields(payload) {
  return payload.idea && payload.audience && payload.budget && payload.experience && payload.goal;
}

/* =========================================
   BACKEND WAKE (fix Render sleep)
========================================= */
async function wakeBackend() {
  if (!cfg?.BACKEND_BASE_URL) {
    throw new Error("BACKEND_BASE_URL manquant dans config.js");
  }

  try {
    const res = await fetch(cfg.BACKEND_BASE_URL);
    if (!res.ok) throw new Error();
  } catch {
    throw new Error(`Impossible de joindre le backend à ${cfg.BACKEND_BASE_URL}`);
  }
}

/* =========================================
   PREVIEW API
========================================= */
async function createPreviewAndStoreTempId(payload) {
  if (!cfg?.BACKEND_BASE_URL || !cfg?.PREVIEW_ENDPOINT) {
    throw new Error("Endpoint preview manquant dans config.js");
  }

  await wakeBackend();

  const response = await fetch(`${cfg.BACKEND_BASE_URL}${cfg.PREVIEW_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Réponse backend invalide");
  }

  if (!response.ok) {
    throw new Error(data.error || "Erreur preview");
  }

  if (!data.tempId) {
    throw new Error("tempId manquant côté backend");
  }

  currentTempId = data.tempId;

  return data;
}

/* =========================================
   HANDLE PREVIEW
========================================= */
async function handlePreview() {
  const payload = getPayload();

  if (!validateMainFields(payload)) {
    renderError("Complète les champs principaux.");
    return;
  }

  previewStatus.textContent = "Chargement...";
  previewContent.classList.remove("empty");
  previewContent.innerHTML = "<p>Connexion au serveur...</p>";

  try {
    const data = await createPreviewAndStoreTempId(payload);

    renderBusiness(data.preview);
    previewStatus.textContent = "Aperçu prêt";

  } catch (err) {
    renderError(err.message);
  }
}

/* =========================================
   HANDLE CHECKOUT
========================================= */
async function handleCheckout(e) {
  e.preventDefault();

  const payload = getPayload();

  if (!validateMainFields(payload)) {
    renderError("Complète tous les champs avant paiement.");
    return;
  }

  if (!cfg?.BACKEND_BASE_URL || !cfg?.CHECKOUT_ENDPOINT) {
    renderError("Backend Stripe non configuré");
    return;
  }

  persistForm();

  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Redirection...";

  try {
    // Générer preview si pas encore fait
    if (!currentTempId) {
      const data = await createPreviewAndStoreTempId(payload);
      renderBusiness(data.preview);
    }

    await wakeBackend();

    const response = await fetch(`${cfg.BACKEND_BASE_URL}${cfg.CHECKOUT_ENDPOINT}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tempId: currentTempId
      })
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Réponse Stripe invalide");
    }

    if (!response.ok) {
      throw new Error(data.error || "Erreur Stripe");
    }

    if (!data.url) {
      throw new Error("Le backend doit renvoyer { url }");
    }

    window.location.href = data.url;

  } catch (err) {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "Débloquer mon business — 34,99€";
    renderError(err.message);
  }
}

/* =========================================
   RENDER
========================================= */
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
  return `
    <div class="preview-card">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(value || "")}</p>
    </div>
  `;
}

/* =========================================
   SECURITY
========================================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}