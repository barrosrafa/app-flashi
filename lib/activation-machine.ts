import { assign, setup } from 'xstate';

export type ActivationEvent =
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; requestId?: string | null }
  | { type: 'FAILURE'; error: string; requestId?: string | null; code?: string }
  | { type: 'RETRY' };

export const activationMachine = setup({
  types: {
    context: {} as { error: string | null; requestId: string | null; errorCode: string | null },
    events: {} as ActivationEvent,
  },
  actions: {
    setError: assign(({ event }) => ({ error: event.type === 'FAILURE' ? event.error : null, errorCode: event.type === 'FAILURE' ? event.code ?? null : null })),
    setRequestId: assign(({ event }) => ({ requestId: event.type === 'SUCCESS' || event.type === 'FAILURE' ? event.requestId ?? null : null })),
    clearError: assign({ error: null, requestId: null, errorCode: null }),
  },
}).createMachine({
  id: 'activationFlow',
  initial: 'PENDING',
  context: { error: null, requestId: null, errorCode: null },
  states: {
    PENDING: { on: { SUBMIT: 'VALIDATING' } },
    VALIDATING: {
      on: {
        SUCCESS: { target: 'ACTIVE', actions: 'setRequestId' },
        FAILURE: { target: 'FAILED', actions: ['setError', 'setRequestId'] },
      },
    },
    ACTIVE: { type: 'final' },
    SUSPENDED: { on: { RETRY: { target: 'PENDING', actions: 'clearError' } } },
    FAILED: { on: { RETRY: { target: 'PENDING', actions: 'clearError' } } },
  },
});
