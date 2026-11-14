// backend/src/services/blueprint/llm.ts
// OpenAI implementation of the two blueprint passes. Structured output, re-validated.
import { zodResponseFormat } from 'openai/helpers/zod';
import { config } from '../../config/index.js';
import { LlmError, badOutput } from '../llm/errors.js';
import { callLlm } from '../llm/openai.js';
import { contentSchema, structureSchema, type BlueprintLlm, type ContentOutput, type StructureOutput } from './types.js';

export class OpenAiBlueprintLlm implements BlueprintLlm {
  async structure({ system, user }: { system: string; user: string }, signal?: AbortSignal): Promise<StructureOutput> {
    return callLlm('structure', async (client, opts) => {
      const res = await client.chat.completions.parse({
        model: config.openaiBlueprintModel,
        temperature: 0,
        seed: 7,
        max_completion_tokens: 7000,
        response_format: zodResponseFormat(structureSchema, 'blueprint_structure'),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }, opts);
      const parsed = res.choices[0]?.message.parsed;
      if (!parsed) throw badOutput('No structured output from structure pass');
      return structureSchema.parse(parsed);
    }, { signal });
  }

  async content({ system, user }: { system: string; user: string }, signal?: AbortSignal): Promise<ContentOutput> {
    return callLlm('content', async (client, opts) => {
      const res = await client.chat.completions.parse({
        model: config.openaiContentModel,
        temperature: 0,
        seed: 7,
        max_completion_tokens: 4500,
        response_format: zodResponseFormat(contentSchema, 'blueprint_content'),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }, opts);
      const parsed = res.choices[0]?.message.parsed;
      if (!parsed) throw badOutput('No structured output from content pass');
      return contentSchema.parse(parsed);
    }, { signal });
  }
}

/**
 * Stands in for the model when it cannot be used. Every pass fails at once, so the generator takes
 * its deterministic path: a blueprint built from the visitor's own answers and the pricing rules.
 */
export class OfflineBlueprintLlm implements BlueprintLlm {
  async structure(): Promise<StructureOutput> {
    throw new LlmError('unreachable', 'model unavailable: using the deterministic blueprint');
  }

  async content(): Promise<ContentOutput> {
    throw new LlmError('unreachable', 'model unavailable: using the deterministic blueprint');
  }
}
