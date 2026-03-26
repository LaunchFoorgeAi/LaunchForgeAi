const cfg = window.VEXLA_CONFIG;
const form = document.getElementById('business-form');
const previewBtn = document.getElementById('preview-btn');
const checkoutBtn = document.getElementById('checkout-btn');
const previewContent = document.getElementById('preview-content');
const previewStatus = document.getElementById('preview-status');

hydrateForm();
handleCancelled();
form.addEventListener('input', persistForm);
previewBtn.addEventListener('click', handlePreview);
form.addEventListener('submit', handleCheckout);

function getPayload() {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function persistForm() {
  localStorage.setItem('vexla_form', JSON.stringify(getPayload()));
}

function hydrateForm() {
  const saved = localStorage.getItem('vexla_form');
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    Object.entries(data).forEach(([key, value]) => {
      const el = form.elements[key];
      if (el) el.value = value;
    });
  } catch {}
}

function handleCancelled() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('cancelled') === '1') {
    renderError('Paiement annulÃ©. Tu peux reprendre oÃ¹ tu tâes arrÃªtÃ© puis relancer le paiement.');
  }
}

async function handlePreview() {
  const payload = getPayload();
  if (!payload.idea || !payload.audience || !payload.budget || !payload.experience || !payload.goal) {
    renderError('ComplÃ¨te dâabord les champs principaux pour gÃ©nÃ©rer un aperÃ§u.');
    return;
  }

  previewStatus.textContent = 'AperÃ§u en cours';
  previewContent.classList.remove('empty');
  previewContent.innerHTML = '<p>GÃ©nÃ©ration de lâaperÃ§uâ¦</p>';

  if (!cfg.PREVIEW_ENDPOINT) {
    renderError('Aucun endpoint dâaperÃ§u configurÃ© dans config.js');
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
      throw new Error(txt || 'Impossible de gÃ©nÃ©rer lâaperÃ§u');
    }

    const data = await response.json();
    renderBusiness(data.preview || data);
    previewStatus.textContent = 'AperÃ§u prÃªt';
  } catch (error) {
    renderError(error.message || 'Erreur pendant lâaperÃ§u');
  }
}

async function handleCheckout(event) {
  event.preventDefault();
  const payload = getPayload();

  if (!payload.idea || !payload.audience || !payload.budget || !payload.experience || !payload.goal) {
    renderError('Merci de complÃ©ter tous les champs obligatoires avant de payer.');
    return;
  }

  persistForm();
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = 'Redirection vers Stripeâ¦';

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
      throw new Error(txt || 'Impossible de crÃ©er la session Stripe');
    }

    const data = await response.json();
    const url = data.url || data.checkoutUrl;
    if (!url) throw new Error('Ton backend doit renvoyer { url } ou { checkoutUrl }');

    window.location.href = url;
  } catch (error) {
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = `DÃ©bloquer mon business â ${cfg.PRICE_LABEL}`;
    renderError(error.message || 'Erreur de connexion Ã  Stripe');
  }
}

function renderError(message) {
  previewStatus.textContent = 'Erreur';
  previewContent.classList.remove('empty');
  previewContent.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

function renderBusiness(data) {
  const html = `
    ${section('Positionnement', data.positioning || data.positionnement || 'Non renvoyÃ© par le backend')}
    ${section('Offre', data.offer || data.offre || 'Non renvoyÃ© par le backend')}
    ${section('Branding', data.branding || data.brand || 'Non renvoyÃ© par le backend')}
    ${section('Tunnel de vente', data.funnel || data.tunnel || 'Non renvoyÃ© par le backend')}
    ${listSection('Plan 30 jours', data.plan30 || data.plan || data['30dayPlan'])}
  `;
  previewContent.innerHTML = html;
}

function section(title, value) {
  return `<div class="preview-card"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(String(value || ''))}</p></div>`;
}

function listSection(title, value) {
  let content = '<p>Non renvoyÃ© par le backend</p>';
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
