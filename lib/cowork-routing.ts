import { hasRemoteAiConfig } from '@iblai/iblai-js/web-utils';
import {
  getLocalLLMModel,
  isCoworkEnabled,
  isLocalLLMEnabled,
} from '@iblai/iblai-js/web-containers';

/**
 * Whether a turn would reach Cowork's screen tools. Mirrors the SDK chat hook
 * (`coworkTakesTheTurn` in web-utils `use-chat-v2.ts`), which hands Cowork a
 * turn Code would otherwise take only then: the tools ride the remote AI alone,
 * so it needs the platform session, and a local model in use takes the turn
 * first. Keep the two in step — this decides what the composer tells the user.
 */
export function coworkCanTakeTheTurn(): boolean {
  return hasRemoteAiConfig() && !(isLocalLLMEnabled() && !!getLocalLLMModel());
}

/** Whether Cowork is on and answering in Code's place. Desktop only. */
export function coworkAnswersInsteadOfCode(): boolean {
  return isCoworkEnabled() && coworkCanTakeTheTurn();
}
