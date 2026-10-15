import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  coworkAnswersInsteadOfCode,
  coworkCanTakeTheTurn,
} from '@/lib/cowork-routing';

const sdk = vi.hoisted(() => ({
  remote: true,
  cowork: true,
  localEnabled: false,
  localModel: null as string | null,
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  hasRemoteAiConfig: () => sdk.remote,
}));
vi.mock('@iblai/iblai-js/web-containers', () => ({
  isCoworkEnabled: () => sdk.cowork,
  isLocalLLMEnabled: () => sdk.localEnabled,
  getLocalLLMModel: () => sdk.localModel,
}));

describe('cowork routing', () => {
  beforeEach(() => {
    sdk.remote = true;
    sdk.cowork = true;
    sdk.localEnabled = false;
    sdk.localModel = null;
  });

  it('answers in Code’s place when signed in and no local model takes the turn', () => {
    expect(coworkCanTakeTheTurn()).toBe(true);
    expect(coworkAnswersInsteadOfCode()).toBe(true);
  });

  it('cannot take the turn without the platform session', () => {
    sdk.remote = false;
    expect(coworkCanTakeTheTurn()).toBe(false);
    expect(coworkAnswersInsteadOfCode()).toBe(false);
  });

  it('cannot take the turn while a local model is in use', () => {
    sdk.localEnabled = true;
    sdk.localModel = 'llama3.2';
    expect(coworkCanTakeTheTurn()).toBe(false);
  });

  it('still can when Local Models is on with no model picked', () => {
    // Mirrors the SDK's hasLocalLLMInUse: the local branch needs both.
    sdk.localEnabled = true;
    expect(coworkCanTakeTheTurn()).toBe(true);
  });

  it('never answers in Code’s place while Cowork is off', () => {
    sdk.cowork = false;
    expect(coworkAnswersInsteadOfCode()).toBe(false);
  });
});
