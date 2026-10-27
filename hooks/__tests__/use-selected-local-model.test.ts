import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  LOCAL_LLM_CHANGED_EVENT,
  useSelectedLocalModel,
} from '../use-selected-local-model';

const sdk = vi.hoisted(() => ({
  enabled: false,
  modelId: null as string | null,
  toolSupport: null as boolean | null,
  setToolSupport: vi.fn(),
}));

vi.mock('@iblai/iblai-js/web-containers', () => ({
  isLocalLLMEnabled: () => sdk.enabled,
  getLocalLLMModel: () => sdk.modelId,
  getLocalLLMToolSupport: () => sdk.toolSupport,
  setLocalLLMToolSupport: (v: boolean) => sdk.setToolSupport(v),
  LOCAL_MODELS: [
    {
      name: 'Qwen 3',
      provider: 'Alibaba',
      id: 'qwen3',
      size: '5.2 GB',
      tool_support: true,
    },
    {
      name: 'Gemma 3',
      provider: 'Google',
      id: 'gemma3',
      size: '3.3 GB',
      tool_support: false,
    },
    {
      name: 'Ministral 3 14B',
      provider: 'Mistral',
      id: 'ministral-3:14b',
      size: '9.1 GB',
      tool_support: true,
    },
  ],
}));

describe('useSelectedLocalModel', () => {
  beforeEach(() => {
    sdk.enabled = false;
    sdk.modelId = null;
    sdk.toolSupport = null;
    sdk.setToolSupport.mockClear();
  });

  it('reports nothing selected while Local Models is off', () => {
    const { result } = renderHook(() => useSelectedLocalModel());
    expect(result.current).toEqual({
      isLocal: false,
      model: null,
      modelId: null,
    });
  });

  it('resolves a stored "qwen3:latest" to the Qwen 3 catalog entry, ignoring the tag and case', () => {
    sdk.enabled = true;
    sdk.modelId = 'Qwen3:latest';
    sdk.toolSupport = true;
    const { result } = renderHook(() => useSelectedLocalModel());

    expect(result.current.isLocal).toBe(true);
    expect(result.current.model?.name).toBe('Qwen 3');
    expect(result.current.modelId).toBe('Qwen3:latest');
  });

  it('never resolves to a different size of the same model, nor writes its tool support', () => {
    sdk.enabled = true;
    sdk.modelId = 'ministral-3:8b';
    sdk.toolSupport = false;
    const { result } = renderHook(() => useSelectedLocalModel());

    expect(result.current).toEqual({
      isLocal: true,
      model: null,
      modelId: 'ministral-3:8b',
    });
    expect(sdk.setToolSupport).not.toHaveBeenCalled();
  });

  it.each(['ministral-3:14b', 'Ministral-3', 'ministral-3:latest'])(
    'resolves a stored "%s" to the tagged catalog entry',
    (stored) => {
      sdk.enabled = true;
      sdk.modelId = stored;
      sdk.toolSupport = true;
      const { result } = renderHook(() => useSelectedLocalModel());

      expect(result.current.model?.id).toBe('ministral-3:14b');
    },
  );

  it('keeps the raw id, with no catalog model, for an id the catalog does not know', () => {
    sdk.enabled = true;
    sdk.modelId = 'mystery-model';
    const { result } = renderHook(() => useSelectedLocalModel());

    expect(result.current).toEqual({
      isLocal: true,
      model: null,
      modelId: 'mystery-model',
    });
    expect(sdk.setToolSupport).not.toHaveBeenCalled();
  });

  it('repairs a stale tool-support cache from the catalog, and only on a real mismatch', () => {
    sdk.enabled = true;
    sdk.modelId = 'gemma3';
    sdk.toolSupport = true; // stale: Gemma 3 cannot call tools
    renderHook(() => useSelectedLocalModel());
    expect(sdk.setToolSupport).toHaveBeenCalledWith(false);

    sdk.setToolSupport.mockClear();
    sdk.toolSupport = false;
    renderHook(() => useSelectedLocalModel());
    expect(sdk.setToolSupport).not.toHaveBeenCalled();
  });

  it('re-reads on the same-tab change event and on cross-tab storage events', () => {
    const { result } = renderHook(() => useSelectedLocalModel());
    expect(result.current.isLocal).toBe(false);

    sdk.enabled = true;
    sdk.modelId = 'qwen3';
    sdk.toolSupport = true;
    act(() => window.dispatchEvent(new Event(LOCAL_LLM_CHANGED_EVENT)));
    expect(result.current.model?.name).toBe('Qwen 3');

    sdk.enabled = false;
    act(() => window.dispatchEvent(new Event('storage')));
    expect(result.current.isLocal).toBe(false);
  });

  it('stops listening once unmounted', () => {
    const { result, unmount } = renderHook(() => useSelectedLocalModel());
    unmount();
    sdk.enabled = true;
    sdk.modelId = 'qwen3';
    act(() => window.dispatchEvent(new Event(LOCAL_LLM_CHANGED_EVENT)));
    expect(result.current.isLocal).toBe(false);
  });
});
