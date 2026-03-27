window.VEXLA_CONFIG = {
  BACKEND_BASE_URL: "https://launchforgeai.onrender.com",

  // Endpoint qui crée la session Stripe et renvoie { url } ou { checkoutUrl }
  CHECKOUT_ENDPOINT: "/create-checkout-session",

  // Endpoint optionnel pour l'aperçu gratuit
  PREVIEW_ENDPOINT: "/preview-business",

  // Endpoint qui vérifie la session Stripe et renvoie le business final
  // Reçoit en POST: { sessionId }
  VERIFY_ENDPOINT: "/verify-session",

  // Si ton backend veut le succès Stripe sur cette page
  SUCCESS_URL: `${window.location.origin}${window.location.pathname.replace(/index\.html$/, '')}success.html?session_id={CHECKOUT_SESSION_ID}`,
  CANCEL_URL: `${window.location.origin}${window.location.pathname.replace(/index\.html$/, '')}index.html?cancelled=1`,

  PRICE_LABEL: "34,99€"
};
