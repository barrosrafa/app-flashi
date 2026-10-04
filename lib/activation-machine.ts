import { assign, setup } from 'xstate';

export type ActivationEvent =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS' }
  | { type: 'FAILURE'; error: string }
  | { type: 'RETRY' };

export const activationMachine = setup({
  types: {
    context: {} as { error: string | null; requestId: string | null },
    events: {} as ActivationEvent,
  },
  actions: {
    setError: assign(({ event }) => ({ error: event.type === 'FAILURE' ? event.error : null })),
    setRequestId: assign(({ event }) => ({ requestId: event.type === 'FAILURE' ? null : null })),
    clearError: assign({ error: null, requestId: null }),
  },
}).createMachine({
  id: 'activationFlow',
  initial: 'PENDING',
  context: { error: null, requestId: null },
  states: {
    PENDING: { on: { SUBMIT: 'VALIDATING' } },
    VALIDATING: {
      on: {
        SUCCESS: 'ACTIVE',
        FAILURE: { target: 'FAILED', actions: 'setError' },
      },
    },
    ACTIVE: { type: 'final' },
    SUSPENDED: { on: { RETRY: { target: 'PENDING', actions: 'clearError' } } },
    FAILED: { on: { RETRY: { target: 'PENDING', actions: 'clearError' } } },
  },
});
