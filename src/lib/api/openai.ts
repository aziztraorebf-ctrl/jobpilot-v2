import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getEnv } from "@/lib/env";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const { OPENAI_API_KEY } = getEnv();
    client = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: 30000 });
  }
  return client;
}

export interface AiCallResult<T> {
  data: T;
  tokensInput: number;
  tokensOutput: number;
}

export async function callStructured<T>(options: {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  model?: string;
}): Promise<AiCallResult<T>> {
  const openai = getClient();
  const model = options.model || "gpt-4o-mini";

  const response = await openai.responses.parse({
    model,
    instructions: options.systemPrompt,
    input: options.userPrompt,
    text: {
      format: zodTextFormat(options.schema, options.schemaName),
    },
  });

  if (!response.output_parsed) {
    throw new Error("OpenAI returned no parsed output");
  }

  return {
    data: response.output_parsed as T,
    tokensInput: response.usage?.input_tokens ?? 0,
    tokensOutput: response.usage?.output_tokens ?? 0,
  };
}
