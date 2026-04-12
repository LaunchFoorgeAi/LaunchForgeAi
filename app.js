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
  if (!form) return {};

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
  return Boolean(
    payload.idea &&
    payload.audience &&
    payload.budget &&
    payload.experience &&
    payload.goal
  );
}

/* =========================================
   HELPERS FETCH
========================================= */
async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

/* =========================================
   BACKEND WAKE
========================================= */
async function wakeBackend() {
  const baseUrl = normalizeBaseUrl(cfg?.BACKEND_BASE_URL);

  if (!baseUrl) {
    throw new Error("BACKEND_BASE_URL manquant dans config.js");
  }

  try {
    const response = await fetchWithTimeout(baseUrl, {
      method: "GET",
      cache: "no-store"
    }, 25000);

    if (!response.ok) {
      throw new Error(`Backend inaccessible (${response.status})`);
    }

    return true;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Le backend met trop de temps à répondre. Réessaie dans 10 secondes.");
    }

    throw new Error(`Impossible de joindre le backend à ${baseUrl}`);
  }
}

/* =========================================
   PREVIEW API
========================================= */
async function createPreviewAndStoreTempId(payload) {
  const baseUrl = normalizeBaseUrl(cfg?.BACKEND_BASE_URL);
  const previewEndpoint = cfg?.PREVIEW_ENDPOINT;

  if (!baseUrl || !previewEndpoint) {
    throw new Error("Endpoint preview manquant dans config.js");
  }

  await wakeBackend();

  const response = await fetchWithTimeout(`${baseUrl}${previewEndpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  }, 30000);

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

  if (previewBtn) {
    previewBtn.disabled = true;
    previewBtn.textContent = "Chargement...";
  }

  previewStatus.textContent = "Chargement...";
  previewContent.classList.remove("empty");
  previewContent.innerHTML = "<p>Connexion au serveur...</p>";

  try {
    const data = await createPreviewAndStoreTempId(payload);

    renderBusiness(data.preview);
    previewStatus.textContent = "Aperçu prêt";
  } catch (err) {
    renderError(err.message || "Erreur inconnue");
  } finally {
    if (previewBtn) {
      previewBtn.disabled = false;
      previewBtn.textContent = "Voir un aperçu gratuit";
    }
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

  const baseUrl = normalizeBaseUrl(cfg?.BACKEND_BASE_URL);
  const checkoutEndpoint = cfg?.CHECKOUT_ENDPOINT;

  if (!baseUrl || !checkoutEndpoint) {
    renderError("Backend Stripe non configuré");
    return;
  }

  persistForm();

  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Redirection...";
  }

  try {
    if (!currentTempId) {
      const data = await createPreviewAndStoreTempId(payload);
      renderBusiness(data.preview);
    }

    const response = await fetchWithTimeout(`${baseUrl}${checkoutEndpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tempId: currentTempId
      })
    }, 30000);

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
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Débloquer mon business — 34,99€";
    }
    renderError(err.message || "Erreur inconnue");
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

function renderBusiness(data = {}) {
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
