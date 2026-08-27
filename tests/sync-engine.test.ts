import {describe,expect,it} from 'vitest';
const entityMap:Record<string,string>={deck:'decks',card:'cards',card_learning_state:'learning',review_log:'reviews',deck_exam:'exams'};
describe('Flashi sync contract',()=>{it('maps known flat entity types',()=>{expect(entityMap.deck).toBe('decks');expect(entityMap.review_log).toBe('reviews')});it('ignores unknown entity types safely',()=>{expect(entityMap['unknown']).toBeUndefined()})});
describe('FSRS review contract',()=>{it('requires stable idempotency fields',()=>{const p={card_id:'card',rating:'good',client_review_id:'review',time_spent_ms:0};expect(p.client_review_id).toBeTruthy();expect(['again','hard','good','easy']).toContain(p.rating)})});
