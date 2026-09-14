import "dotenv/config";

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return v;
}

export const env = {
  anthropicApiKey: optional("ANTHROPIC_API_KEY"),
  anthropicModel: optional("ANTHROPIC_MODEL") ?? "claude-sonnet-5",

  supabaseUrl: optional("SUPABASE_URL"),
  supabaseServiceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY"),

  twilioAccountSid: optional("TWILIO_ACCOUNT_SID"),
  twilioAuthToken: optional("TWILIO_AUTH_TOKEN"),
  twilioWhatsappFrom: optional("TWILIO_WHATSAPP_FROM"),

  openaiApiKey: optional("OPENAI_API_KEY"),

  yarnGptEndpointUrl: optional("YARNGPT_HF_ENDPOINT_URL"),
  yarnGptApiToken: optional("YARNGPT_HF_API_TOKEN"),

  port: Number(optional("PORT") ?? 3000),
} as const;

/** True once both Supabase vars are set; otherwise the app runs on the local JSON store. */
export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);

/** True once Twilio credentials are present; the CLI demo works without this. */
export const hasTwilio = Boolean(
  env.twilioAccountSid && env.twilioAuthToken && env.twilioWhatsappFrom,
);

/** Voice input is a bolt-on — the text pipeline never depends on this. */
export const hasTranscription = Boolean(env.openaiApiKey);

/** Voice output is a bolt-on — enabled only once both YarnGPT vars are set. */
export const hasYarnGpt = Boolean(env.yarnGptEndpointUrl && env.yarnGptApiToken);

export { required };
