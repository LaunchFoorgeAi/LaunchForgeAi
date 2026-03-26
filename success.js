const cfg = window.VEXLA_CONFIG;
const message = document.getElementById('success-message');
const resultBox = document.getElementById('result-box');
const backHome = document.getElementById('back-home');

init();

async function init() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

  if (!sessionId) {
    showError('Aucun session_id trouvé dans l’URL. Vérifie le success_url envoyé à Stripe.');
    return;
  }

  message.textContent = 'Paiement détecté. Vérification et récupération du business en cours…';

  try {
    const data = await pollVerification(sessionId, 12, 2500);
    showSuccess(data.business || data.plan || data);
  } catch (error) {
    showError(error.message || 'Impossible de récupérer le business après paiement.');
  }
}

async function pollVerification(sessionId, tries, delay) {
  for (let i = 0; i < tries; i++) {
    const response = await fetch(`${cfg.BACKEND_BASE_URL}${cfg.VERIFY_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.paid || data.status === 'paid' || data.business || data.plan) return data;
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error('Le paiement semble validé, mais ton backend ne renvoie pas encore le résultat. Vérifie le webhook Stripe et ton endpoint de vérification.');
}

function showSuccess(data) {
  message.textContent = 'Paiement validé. Ton business VEXLA est prêt.';
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `
    <div class="success">Paiement confirmé et contenu récupéré avec succès.</div>
    ${section('Positionnement', data.positioning || data.positionnement || 'Non renvoyé')}
    ${section('Offre', data.offer || data.offre || 'Non renvoyé')}
    ${section('Branding', data.branding || data.brand || 'Non renvoyé')}
    ${section('Tunnel de vente', data.funnel || data.tunnel || 'Non renvoyé')}
    ${listSection('Plan 30 jours', data.plan30 || data.plan || data['30dayPlan'])}
  `;
  backHome.classList.remove('hidden');
}

function showError(text) {
  message.textContent = text;
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = `<div class="error">${escapeHtml(text)}</div>`;
  backHome.classList.remove('hidden');
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
