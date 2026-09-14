import { getPriceRepository } from "../data/index.js";
import { getTraderRepository, hashWhatsappNumber } from "../data/traderRepository.js";
import type { SupportedLanguage } from "../types.js";

/**
 * Location handling per the build notes: ask once, remember it against the
 * trader's hashed WhatsApp number, and use it for every lookup after that.
 * The MVP only needs the 1-2 seeded pilot markets to prove the mechanism —
 * nationwide coverage is a roadmap item, not a demo requirement.
 */
export type OnboardingOutcome =
  | { status: "resolved"; marketId: string; whatsappHash: string; justResolved: boolean; welcomeText?: string }
  | { status: "ask"; prompt: string; whatsappHash: string };

export async function resolveTraderMarket(
  whatsappNumber: string,
  latestMessageText: string,
): Promise<OnboardingOutcome> {
  const whatsappHash = hashWhatsappNumber(whatsappNumber);
  const traderRepo = getTraderRepository();
  const priceRepo = getPriceRepository();

  const existing = await traderRepo.get(whatsappHash);
  if (existing?.marketId) {
    return { status: "resolved", marketId: existing.marketId, whatsappHash, justResolved: false };
  }

  const markets = await priceRepo.listMarkets();
  const needle = latestMessageText.toLowerCase();
  const match = markets.find(
    (m) => needle.includes(m.name.toLowerCase()) || needle.includes(m.id.replace(/-/g, " ")),
  );

  if (match) {
    await traderRepo.upsert({
      whatsappHash,
      preferredLanguage: (existing?.preferredLanguage ?? "en") as SupportedLanguage,
      marketId: match.id,
      state: match.state,
    });

    // If the message was essentially just naming the market ("Mile 12"),
    // acknowledge it and stop there instead of also feeding that same text
    // into the pricing pipeline, where it would read as an unintelligible
    // product query. A message that names the market *and* asks about a
    // product in the same breath ("I'm at Mile 12, how much is tomato?")
    // still flows through to the pipeline as normal.
    const residual = needle
      .replace(match.name.toLowerCase(), "")
      .replace(match.id.replace(/-/g, " "), "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
    const residualWordCount = residual.length === 0 ? 0 : residual.split(/\s+/).length;
    const justResolved = residualWordCount <= 2;

    return {
      status: "resolved",
      marketId: match.id,
      whatsappHash,
      justResolved,
      welcomeText: justResolved
        ? `Got it — ${match.name}, ${match.state} ✅ Now send me an item and price, e.g. "someone wan sell me tomato for 4000 for one paint rubber", and I'll check if it's fair.`
        : undefined,
    };
  }

  const marketList = markets.map((m) => `${m.name} (${m.state})`).join(" or ");
  return {
    status: "ask",
    prompt: `Welcome to Awòdì 👋 Before I check prices for you, which market are you in? Reply with: ${marketList}.`,
    whatsappHash,
  };
}
