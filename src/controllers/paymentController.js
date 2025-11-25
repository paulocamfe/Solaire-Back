const stripe = require('stripe')(process.env.STRIPE_SECRET);
const prisma = require('../prismaClient');

async function createPaymentIntent(req, res) {
  try {
    const { amount, currency = 'usd', userId, description } = req.body;
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { userId: userId ? String(userId) : undefined },
    });
    res.json({ clientSecret: intent.client_secret, id: intent.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar PaymentIntent' });
  }
}

async function stripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    await prisma.payment.create({
      data: {
        stripeId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: 'succeeded',
        description: intent.description || null,
        metadata: intent.metadata || {},
        userId: intent.metadata?.userId ? parseInt(intent.metadata.userId) : null,
      },
    });
  }

  res.json({ received: true });
}

module.exports = { createPaymentIntent, stripeWebhook };