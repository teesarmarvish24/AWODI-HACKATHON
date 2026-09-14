import express from "express";
import { env, hasTwilio } from "./config/env.js";
import { twilioWebhookHandler } from "./channels/whatsapp/webhook.js";

const app = express();
app.use(express.urlencoded({ extended: false })); // Twilio posts form-encoded webhooks
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "awodi", twilioConfigured: hasTwilio });
});

app.post("/webhooks/whatsapp", (req, res) => {
  void twilioWebhookHandler(req, res);
});

app.listen(env.port, () => {
  console.log(`Awòdì server listening on port ${env.port}`);
  console.log(`Health check:   http://localhost:${env.port}/health`);
  console.log(`Twilio webhook: http://localhost:${env.port}/webhooks/whatsapp`);
  if (!hasTwilio) {
    console.log(
      "Twilio env vars not set — the webhook route will reject requests. Run `npm run demo` for a WhatsApp-free CLI demo instead.",
    );
  }
});
