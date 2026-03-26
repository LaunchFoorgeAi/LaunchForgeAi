const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const fetch = require("node-fetch");

const app = express();

app.use(cors());

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") return next();
  express.json()(req, res, next);
});

let generatedPlans = {};

// 1) Création session Stripe
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { idea, budget, type } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Business Plan IA Complet" },
            unit_amount: 4900,
          },
          quantity: 1,
        },
      ],
      metadata: { idea, budget, type },
      success_url:
        "https://launchforgeai.onrender.com/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://launchforgeai.onrender.com/cancel",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.log("Erreur Stripe:", err);
    res.status(500).json({ error: "Impossible de créer session Stripe" });
  }
});

// 2) Webhook Stripe
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log("Signature invalide :", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const prompt = `
Crée un business complet structuré en JSON avec ces sections :
- strategie
- marque
- marketing
- suivi_ia_30_jours
- plan_action

Idée : ${session.metadata?.idea}
Budget : ${session.metadata?.budget}
Type : ${session.metadata?.type}
`;

      try {
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + process.env.OPENAI_KEY,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
            }),
          }
        );

        const data = await response.json();
        generatedPlans[session.id] =
          data?.choices?.[0]?.message?.content || null;

        console.log("Plan généré :", session.id);
      } catch (err) {
        console.log("Erreur OpenAI :", err);
      }
    }

    res.json({ received: true });
  }
);

// 3) Récupérer le plan
app.get("/plan/:sessionId", (req, res) => {
  const id = req.params.sessionId;
  const plan = generatedPlans[id];

  if (!plan) {
    return res.json({ status: "processing" });
  }

  res.json({ status: "ready", plan });
});

// 4) Pages de retour Stripe
app.get("/success", (req, res) => {
  const sessionId = req.query.session_id;

  res.send(`
    <h1>Paiement réussi ✅</h1>
    <p>Ton session ID :</p>
    <pre>${sessionId}</pre>
    <p>Ouvre ce lien pour voir ton business :</p>
    <a href="/plan/${sessionId}">Voir mon business</a>
  `);
});

app.get("/cancel", (req, res) => {
  res.send("<h1>Paiement annulé ❌</h1>");
});

// 5) Lancer serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend lancé sur port ${PORT}`));
