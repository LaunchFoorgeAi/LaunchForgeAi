const cfg = window.VEXLA_CONFIG;
const form = document.getElementById('business-form');
const previewBtn = document.getElementById('preview-btn');
const checkoutBtn = document.getElementById('checkout-btn');
const previewContent = document.getElementById('preview-content');
const previewStatus = document.getElementById('preview-status');

hydrateForm();
handleCancelled();

if (form) {
  form.addEventListener('input', persistForm);
  form.addEventListener('submit', handleCheckout);
}

if (previewBtn) {
  previewBtn.addEventListener('click', handlePreview);
}

function getPayload() {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function persistForm() {
  localStorage.setItem('vexla_form', JSON.stringify(getPayload()));
}

function hydrateForm() {
  const saved = localStorage.getItem('vexla_form');
  if (!saved || !form) return;

  try {
    const data = JSON.parse(saved);
    Object.entries(data).forEach(([key, value]) => {
      const el = form.elements[key];
      if (el) el.value = value;
    });
  } catch (e) {
    console.error('Erreur localStorage:', e);
  }
}

function handleCancelled() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('cancelled') === '1') {
    renderError("Paiement annulé. Tu peux reprendre où tu t'es arrêté puis relancer le paiement.");
  }
}

async function handlePreview() {
  const payload = getPayload();

  if (!payload.idea || !payload.audience || !payload.budget || !payload.experience || !payload.goal) {
    renderError("Complète d'abord les champs principaux pour générer un aperçu.");
    return;
  }

  previewStatus.textContent = 'Aperçu en cours';
  previewContent.classList.remove('empty');
  previewContent.innerHTML = '<p>Génération de l’aperçu...</p>';

  if (!cfg || !cfg.BACKEND_BASE_URL || !cfg.PREVIEW_ENDPOINT) {
    renderError("Aucun endpoint d’aperçu configuré dans config.js");
    return;
  }

  try {
    const response = await fetch(`${cfg.BACKEND_BASE_URL}${cfg.PREVIEW_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(txt || "Impossible de générer l’aperçu");
    }

    const data = await response.json();
    renderBusiness(data.preview || data);
    previewStatus.textContent = 'Aperçu prêt';
  } catch (error) {
    renderError(error.message || "Erreur pendant l’aperçu");
  }
}

async function handleCheckout(event) {
  event.preventDefault();

  const payload = getPayload();

  if (!payload.idea || !payload.audience || !payload.budget || !payload.experience || !payload.goal) {
    renderError("Merci de compléter tous les champs obligatoires avant de payer.");
    return;
  }

  if (!cfg || !cfg.BACKEND_BASE_URL || !cfg.CHECKOUT_ENDPOINT) {
    renderError("Le backend Stripe n’est pas configuré dans config.js");
    return;
  }

  persistForm();
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Redirection vers Stripe...';

  try {
    const response = await fetch(`${cfg.BACKEND_BASE_URL}${cfg.CHECKOUT_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        origin: window.location.origin,
        successUrl: cfg.SUCCESS_URL,
        cancelUrl: cfg.CANCEL_URL
      })
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(txt || "Impossible de créer la session Stripe");
    }

    const data = await response.json();
    const url = data.url || data.checkoutUrl;

    if (!url) {
      throw new Error("Ton backend doit renvoyer { url } ou { checkoutUrl }");
    }

    window.location.href = url;
  } catch (error) {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = `Débloquer mon business — ${cfg.PRICE_LABEL || '34,99€'}`;
    renderError(error.message || "Erreur de connexion à Stripe");
  }
}

function renderError(message) {
  previewStatus.textContent = 'Erreur';
  previewContent.classList.remove('empty');
  previewContent.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

function renderBusiness(data) {
  const html = `
    ${section('Positionnement', data.positioning || data.positionnement || 'Non renvoyé par le backend')}
    ${section('Offre', data.offer || data.offre || 'Non renvoyé par le backend')}
    ${section('Branding', data.branding || data.brand || 'Non renvoyé par le backend')}
    ${section('Tunnel de vente', data.funnel || data.tunnel || 'Non renvoyé par le backend')}
    ${listSection('Plan 30 jours', data.plan30 || data.plan || data['30dayPlan'])}
  `;
  previewContent.innerHTML = html;
}

function section(title, value) {
  return `<div class="preview-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(String(value || ''))}</p></div>`;
}

function listSection(title, value) {
  let content = '<p>Non renvoyé par le backend</p>';

  if (Array.isArray(value)) {
    content = `<ul>${value.map(item => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>`;
  } else if (typeof value === 'string' && value.trim()) {
    content = `<p>${escapeHtml(value)}</p>`;
  }

  return `<div class="preview-card"><h4>${escapeHtml(title)}</h4>${content}</div>`;
}

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}