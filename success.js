const BACKEND_URL = "https://backhend-render.onrender.com",

async function loadBusiness() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  const message = document.getElementById("message");
  const positionnement = document.getElementById("positionnement");
  const offre = document.getElementById("offre");
  const branding = document.getElementById("branding");
  const tunnel = document.getElementById("tunnel");
  const plan30j = document.getElementById("plan30j");

  if (!sessionId) {
    if (message) {
      message.textContent = "Erreur : session introuvable.";
    }
    return;
  }

  if (message) {
    message.textContent = "Paiement en cours de vérification...";
  }

  try {
    const res = await fetch(`${BACKEND_URL}/verify?session_id=${sessionId}`);
    const data = await res.json();

    if (data.status === "pending") {
      if (message) {
        message.textContent = "Paiement validé, mais contenu pas encore disponible. Recharge la page dans quelques secondes.";
      }
      return;
    }

    if (data.status === "success" && data.business) {
      if (message) {
        message.textContent = "Paiement confirmé et contenu récupéré avec succès.";
      }

      if (positionnement) {
        positionnement.textContent = data.business.positionnement || "";
      }

      if (offre) {
        offre.textContent = data.business.offre || "";
      }

      if (branding) {
        branding.textContent = data.business.branding || "";
      }

      if (tunnel) {
        tunnel.textContent = data.business.tunnel || "";
      }

      if (plan30j) {
        plan30j.textContent = data.business.plan30j || "";
      }

      return;
    }

    if (message) {
      message.textContent = "Erreur lors de la récupération du business.";
    }
  } catch (error) {
    console.error("Erreur success.js :", error);

    if (message) {
      message.textContent = "Erreur serveur.";
    }
  }
}

loadBusiness();