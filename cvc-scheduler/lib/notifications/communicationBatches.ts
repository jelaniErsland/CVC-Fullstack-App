import type { CommunicationActionState } from "./communications.ts";

// One confirmation authorizes this operation's selected recipients, not future
// volunteers or another operation. Each bounded server call rechecks its claims.
export async function finishConfirmedCommunication(
  initial: CommunicationActionState,
  operationId: string,
  action: (form: FormData) => Promise<CommunicationActionState>,
  progress: (state: CommunicationActionState) => void,
): Promise<CommunicationActionState> {
  let state = initial;
  let previousCount = 201;
  for (let batch = 0; batch < 40 && state.kind === "results"; batch++) {
    progress(state);
    const queued = state.history.filter(row => row.operation_id === operationId && row.state === "ready");
    if (!queued.length) return state;
    if (queued.length >= previousCount || queued.length > 200) return { kind: "error", message: "Delivery progress could not be confirmed. Refresh history before continuing." };
    previousCount = queued.length;
    const form = new FormData();
    form.set("command", "continue"); form.set("operationId", operationId);
    form.set("confirmedRecipients", String(queued.length));
    state = await action(form);
  }
  return state;
}
