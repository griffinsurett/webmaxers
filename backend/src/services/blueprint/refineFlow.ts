// backend/src/services/blueprint/refineFlow.ts
// One refinement chat turn against the stored blueprint:
//   interpret (model, no locks) → apply + re-price on the LATEST blueprint (row lock) →
//   best-effort content for any newly added pages → save the conversation state.
import type { CatalogItem } from '../../types/index.js';
import type { ConversationState } from '../conversation/engine.js';
import {
  editBlueprint, loadBlueprintView, saveSession,
} from '../conversation/sessions.js';
import { buildContentPrompt } from './prompts.js';
import { applyAndPrice, interpretRefine, type RefineLlm, type RefineResult } from './refine.js';
import { contentSchema, type Blueprint, type BlueprintLlm } from './types.js';
import { verifyContent, type PageNode } from './verify.js';
import { log } from '../log/logger.js';

export interface RefineFlowDeps {
  refineLlm: RefineLlm;
  contentLlm: BlueprintLlm;
  getCatalog: () => Promise<CatalogItem[]>;
}

export async function runRefineTurn(
  sessionId: string, state: ConversationState, message: unknown, deps: RefineFlowDeps,
): Promise<RefineResult & { blueprint: Blueprint }> {
  const view = await loadBlueprintView(sessionId);
  if (!view.blueprint) throw new Error('refine stage without a blueprint');

  const interpreted = await interpretRefine(state, view.blueprint, message, deps.refineLlm);
  if (interpreted.kind === 'rejected') {
    await saveSession(sessionId, interpreted.result.state, state.stage);
    return { ...interpreted.result, blueprint: view.blueprint };
  }

  const catalog = await deps.getCatalog();
  let result!: RefineResult;
  const latest = await editBlueprint(sessionId, (bp) => {
    result = applyAndPrice(state, bp, interpreted.message, interpreted.output, catalog);
    return { blueprint: result.blueprint ?? null, result: result.blueprint ?? bp };
  });

  // New pages start as outlines; try to write real content for them (best effort, one call).
  let blueprint = latest;
  if (result.addedPageIds.length > 0) {
    try {
      const nodes: PageNode[] = latest.pages.filter((p) => result.addedPageIds.includes(p.id)).map((p) => ({
        id: p.id, parentId: p.parentId, title: p.title, slug: p.slug, category: p.category, classification: p.classification,
        sku: p.sku, purpose: p.purpose, why: p.whyRecommended, primaryCta: p.primaryCta, evidence: [], basis: p.basis,
      }));
      const raw = contentSchema.parse(await deps.contentLlm.content(
        buildContentPrompt({ slots: view.slots, research: view.research, catalog }, nodes, latest.summary.primaryAudience, latest.summary.recommendedStrategy, new Map()),
      ));
      const written = verifyContent(raw, nodes.map((n) => n.id));
      if (written.size > 0) {
        blueprint = await editBlueprint(sessionId, (bp) => {
          const next = { ...bp, pages: bp.pages.map((p) => (written.has(p.id) ? { ...p, sections: written.get(p.id)!, contentStatus: 'written' as const } : p)) };
          return { blueprint: next, result: next };
        });
      }
    } catch (err) {
      log.warn('content for added page failed', { err });
    }
  }

  await saveSession(sessionId, result.state, state.stage);
  return { ...result, blueprint };
}
