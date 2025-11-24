const express = require('express');
const { createPaymentIntent, stripeWebhook } = require('../controllers/paymentController');
const router = express.Router();

// criar PaymentIntent
router.post('/create-intent', createPaymentIntent);

// stripe exige raw body para validar assinatura do webhook
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

module.exports = router;