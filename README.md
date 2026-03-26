# VEXLA — site frontend prêt à connecter

Ce dossier contient un site statique premium pour vendre VEXLA et connecter ton backend + Stripe.

## Fichiers

- `index.html` → landing page + formulaire + bouton paiement
- `success.html` → page de retour après Stripe
- `styles.css` → design premium
- `app.js` → logique formulaire + appel checkout + aperçu
- `success.js` → vérification du paiement + récupération du business
- `config.js` → seul fichier à modifier pour brancher ton backend

## Étape 1 — modifier `config.js`

Remplace :

```js
BACKEND_BASE_URL: "https://TON-BACKEND.onrender.com"
```

par l'URL réelle de ton backend Render.

Ensuite adapte si besoin les endpoints :

```js
CHECKOUT_ENDPOINT: "/create-checkout-session"
PREVIEW_ENDPOINT: "/preview-business"
VERIFY_ENDPOINT: "/verify-session"
```

## Étape 2 — ton backend doit renvoyer ces formats

### 1) Création checkout
Le frontend envoie un POST sur `CHECKOUT_ENDPOINT` avec :

```json
{
  "idea": "...",
  "audience": "...",
  "budget": "...",
  "experience": "...",
  "goal": "...",
  "details": "...",
  "origin": "https://ton-site.com",
  "successUrl": "https://ton-site.com/success.html?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://ton-site.com/index.html?cancelled=1"
}
```

Ton backend doit répondre :

```json
{ "url": "https://checkout.stripe.com/..." }
```

ou

```json
{ "checkoutUrl": "https://checkout.stripe.com/..." }
```

### 2) Vérification après paiement
Le frontend envoie un POST sur `VERIFY_ENDPOINT` avec :

```json
{ "sessionId": "cs_test_..." }
```

Ton backend peut répondre par exemple :

```json
{
  "paid": true,
  "business": {
    "positioning": "...",
    "offer": "...",
    "branding": "...",
    "funnel": "...",
    "plan30": ["Jour 1 ...", "Jour 2 ..."]
  }
}
```

### 3) Aperçu gratuit (optionnel)
Si tu n'as pas d'endpoint d'aperçu, retire simplement le bouton ou laisse-le inutilisé.

## Étape 3 — déployer le site

Tu peux déployer ce site sur :

- Netlify
- Vercel
- GitHub Pages

Le plus simple :
1. crée un dossier GitHub
2. mets tous les fichiers dedans
3. connecte à Netlify ou Vercel
4. déploie

## Étape 4 — configurer Stripe

Dans ton backend, le `success_url` Stripe doit accepter la valeur envoyée par le frontend :

```js
success_url: req.body.successUrl,
cancel_url: req.body.cancelUrl,
```

## Étape 5 — CORS

Ton backend doit autoriser le domaine du site :

```js
app.use(cors({
  origin: [
    'https://ton-site.netlify.app',
    'https://ton-domaine.com'
  ]
}));
```

## Exemple minimal backend checkout

```js
app.post('/create-checkout-session', async (req, res) => {
  const { idea, audience, budget, experience, goal, details, successUrl, cancelUrl } = req.body;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: { name: 'VEXLA Business Pack' },
          unit_amount: 3499,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { idea, audience, budget, experience, goal, details }
  });

  res.json({ url: session.url });
});
```

## Exemple minimal backend verify

```js
app.post('/verify-session', async (req, res) => {
  const { sessionId } = req.body;
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    return res.status(202).json({ paid: false, status: session.payment_status });
  }

  // Ici tu récupères ton business généré depuis ta DB
  // ou tu le génères à partir des metadata / webhook

  return res.json({
    paid: true,
    business: {
      positioning: 'Offre IA pour entrepreneurs débutants',
      offer: 'Pack business prêt à lancer',
      branding: 'Positionnement premium, ton direct, design noir et bleu',
      funnel: 'Landing page → Checkout Stripe → Delivery page',
      plan30: ['Jour 1 : définir l’offre', 'Jour 2 : créer la page', 'Jour 3 : publier un TikTok']
    }
  });
});
```

## Les 3 choses à changer en priorité

1. `config.js`
2. CORS de ton backend
3. réponse JSON de tes endpoints

## Si ton backend actuel est différent

Tu peux garder le design tel quel et simplement adapter :
- les noms d'endpoints
- les clés JSON renvoyées

