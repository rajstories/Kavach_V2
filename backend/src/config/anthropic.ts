import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = "claude-opus-4-6";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
