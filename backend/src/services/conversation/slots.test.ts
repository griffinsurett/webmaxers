import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptySlots, isIndustryRestatement, mergeModelSlots, missingRequired, type ModelSlots } from './slots.js';

const model = (over: Partial<ModelSlots>): ModelSlots => ({
  businessName: null, industry: null, services: [], serviceArea: null, primaryGoal: null, existingTools: [], mustHaves: [], ...over,
} as ModelSlots);

test('a service that only restates the industry is not a service', () => {
  assert.equal(isIndustryRestatement('plumbing', 'plumbing'), true);
  assert.equal(isIndustryRestatement('General Plumbing', 'plumbing'), true);
  assert.equal(isIndustryRestatement('plumbing services', 'plumbing'), true);
  assert.equal(isIndustryRestatement('Dental', 'Dental clinic'), true);
  assert.equal(isIndustryRestatement('drain cleaning', 'plumbing'), false);
  assert.equal(isIndustryRestatement('plumbing repair', 'plumbing'), false);
  assert.equal(isIndustryRestatement('anything', undefined), false);
  assert.equal(isIndustryRestatement('', 'plumbing'), false);
});

test('mergeModelSlots drops industry restatements but keeps real services', () => {
  const out = mergeModelSlots(emptySlots(), model({ industry: 'plumbing', services: ['plumbing', 'drain cleaning', 'General Plumbing', 'water heater repair and replacement'] }));
  assert.deepEqual(out.services, ['drain cleaning', 'water heater repair and replacement']);
});

test('the industry learned in an earlier turn also filters services from a later turn', () => {
  const first = mergeModelSlots(emptySlots(), model({ industry: 'plumbing' }));
  const second = mergeModelSlots(first, model({ services: ['plumbing', 'emergency leak repair'] }));
  assert.deepEqual(second.services, ['emergency leak repair']);
});

test('a single restating service is kept so the required slot can still be filled', () => {
  const out = mergeModelSlots(emptySlots(), model({ businessName: 'Maple', industry: 'plumbing', serviceArea: 'Austin', primaryGoal: 'calls', services: ['plumbing'] }));
  assert.deepEqual(out.services, ['plumbing']);
  assert.deepEqual(missingRequired(out), []);
  const heat = mergeModelSlots(emptySlots(), model({ industry: 'plumbing and heating', services: ['heating'] }));
  assert.deepEqual(heat.services, ['heating']);
});

test('the restating entry is dropped as soon as a real service arrives', () => {
  const first = mergeModelSlots(emptySlots(), model({ industry: 'plumbing', services: ['plumbing'] }));
  const second = mergeModelSlots(first, model({ services: ['drain cleaning'] }));
  assert.deepEqual(second.services, ['drain cleaning']);
});
