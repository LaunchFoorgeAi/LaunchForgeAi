const cfg = window.VEXLA_CONFIG;

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function setMessage(text) {
  const message = document.getElementById("message");
  if (message) {
    message.textContent = text;
  }
}

function setBusiness(business = {}) {
  const positionnement = document.getElementById("positionnement");
  const offre = document.getElementById("offre");
  const branding = document.getElementById("branding");
  const tunnel = document.getElementById("tunnel");
  const plan30j = document.getElementById("plan30j");

  if (positionnement) positionnement.textContent = business.positionnement || "";
  if (offre) offre.textContent = business.offre || "";
  if (branding) branding.textContent = business.branding || "";
  if (tunnel) tunnel.textContent = business.tunnel || "";
  if (plan30j) plan30j.textContent = business.plan30j || "";
}

async function loadBusiness() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  if (!sessionId) {
    setMessage("Erreur : session introuvable.");
    return;
  }

  const baseUrl = normalizeBaseUrl(cfg?.BACKEND_BASE_URL);
  const verifyEndpoint = cfg?.VERIFY_ENDPOINT || "/verify-session";

  if (!baseUrl) {
    setMessage("Erreur : backend non configuré.");
    return;
  }

  setMessage("Paiement en cours de vérification...");

  try {
    const res = await fetch(
      `${baseUrl}${verifyEndpoint}?session_id=${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        cache: "no-store"
      }
    );

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Réponse backend invalide");
    }

    if (!res.ok) {
      setMessage(data.error || "Erreur lors de la vérification du paiement.");
      return;
    }

    if (data.status === "pending") {
      setMessage("Paiement détecté mais pas encore confirmé. Recharge la page dans quelques secondes.");
      return;
    }

    if (data.status === "success" && data.business) {
      setMessage("Paiement confirmé. Ton business a bien été débloqué.");
      setBusiness(data.business);
      localStorage.removeItem("vexla_form");
      return;
    }

    setMessage("Aucun contenu disponible.");
  } catch (error) {
    console.error("Erreur success.js :", error);
    setMessage(error.message || "Erreur serveur.");
  }
}

loadBusiness();