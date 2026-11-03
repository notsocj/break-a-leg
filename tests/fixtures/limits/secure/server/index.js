// Synthetic fixture: Express OTP endpoint behind express-rate-limit.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const twilio = require('twilio');

const app = express();
app.use(express.json({ limit: '1mb' }));
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 3 });
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

app.post('/otp', otpLimiter, async (req, res) => {
  await client.verify.v2.services(process.env.VERIFY_SID).verifications.create({ to: req.body.phone, channel: 'sms' });
  res.json({ sent: true });
});

app.listen(3000);
