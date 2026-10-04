import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { activationMachine } from '../lib/activation-machine';

describe('activation machine', () => {
  it('prevents duplicate submit while validation is running', () => {
    const actor = createActor(activationMachine).start();
    actor.send({ type: 'SUBMIT' });
    actor.send({ type: 'SUBMIT' });
    expect(actor.getSnapshot().value).toBe('VALIDATING');
  });

  it('transitions to active only after success', () => {
    const actor = createActor(activationMachine).start();
    actor.send({ type: 'SUBMIT' });
    actor.send({ type: 'SUCCESS', requestId: 'req-123' });
    expect(actor.getSnapshot().value).toBe('ACTIVE');
    expect(actor.getSnapshot().context.requestId).toBe('req-123');
  });

  it('keeps the failure message and supports retry', () => {
    const actor = createActor(activationMachine).start();
    actor.send({ type: 'SUBMIT' });
    actor.send({ type: 'FAILURE', error: 'network unavailable', requestId: 'req-456', code: 'NETWORK_ERROR' });
    expect(actor.getSnapshot().context.error).toBe('network unavailable');
    expect(actor.getSnapshot().context.requestId).toBe('req-456');
    expect(actor.getSnapshot().context.errorCode).toBe('NETWORK_ERROR');
    actor.send({ type: 'RETRY' });
    expect(actor.getSnapshot().value).toBe('PENDING');
    expect(actor.getSnapshot().context.error).toBeNull();
  });
});
