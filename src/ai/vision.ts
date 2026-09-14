import Anthropic from "@anthropic-ai/sdk";
import { env, hasAnthropic, hasGemini, required } from "../config/env.js";
import { describeImageGemini } from "./geminiClient.js";

const VISION_PROMPT =
  "This is a photo a Nigerian trader sent on WhatsApp of a market product, possibly with a price tag, a container (basket/paint rubber/bag), or a handwritten note visible. In one short sentence, describe what the product is, the approximate quantity/container if visible, and any price or number you can read. If nothing is legible, just describe the product.";

/**
 * Photo input is a bolt-on over the same text pipeline: this module's only
 * job is turning "a photo of a product" into the same short natural-language
 * description a typed message would give (e.g. "tomatoes in a paint rubber
 * bucket"), which then flows through the identical extractIntentFromText
 * path used for typed and transcribed messages. No separate vision-specific
 * pipeline branch exists — that keeps the core logic in one place.
 *
 * Provider priority matches languageAgent.ts: Anthropic (Claude vision) when
 * configured, otherwise Gemini (also free-tier and vision-capable) — so
 * photo input works on the same zero-cost path as text.
 */
export async function describeProductPhoto(imageBase64: string, mediaType: string): Promise<string> {
  if (hasAnthropic) {
    const anthropic = new Anthropic({ apiKey: required("ANTHROPIC_API_KEY") });

    const response = await anthropic.messages.create({
      model: env.anthropicModel,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 },
            },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    });

    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return block?.text.trim() ?? "";
  }

  if (hasGemini) {
    return describeImageGemini(imageBase64, mediaType, VISION_PROMPT);
  }

  throw new Error("Photo understanding requires ANTHROPIC_API_KEY or GEMINI_API_KEY to be set.");
}
