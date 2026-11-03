// Synthetic fixture: Express OTP endpoint. A body-size limit is not a rate limit.
const express = require('express');
const twilio = require('twilio');

const app = express();
app.use(express.json({ limit: '1mb' }));
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

app.post('/otp', async (req, res) => {
  await client.verify.v2.services(process.env.VERIFY_SID).verifications.create({ to: req.body.phone, channel: 'sms' });
  res.json({ sent: true });
});

app.listen(3000);
