window.VEXLA_CONFIG = {
  BACKEND_BASE_URL: "https://backhend-render.onrender.com",

  CHECKOUT_ENDPOINT: "/create-checkout-session",
  PREVIEW_ENDPOINT: "/preview-business",
  VERIFY_ENDPOINT: "/verify-session",

  SUCCESS_URL: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
  CANCEL_URL: `${window.location.origin}/index.html?cancelled=1`,

  PRICE_LABEL: "34,99€"
};