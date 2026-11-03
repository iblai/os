/**
 * The SDK's "Enable Local Models" switch and the chat transport both read this
 * key (`isLocalLLMEnabled`). Kept free of SDK imports so hooks can write it
 * without pulling the SDK bundle in.
 */
export const LOCAL_LLM_ENABLED_KEY = 'ibl_local_llm_enabled';

/** The on-device model chat uses while Local Models is on (`getLocalLLMModel`). */
export const LOCAL_LLM_MODEL_KEY = 'ibl_local_llm_model';

/**
 * Window event other OS components dispatch after changing the device-global
 * on-device selection — a model pick in the LLM tab or the Local Models master
 * toggle in Profile → Advanced. `storage` events only fire cross-tab, so this
 * covers the same-tab case so the nav-bar badge updates immediately.
 */
export const LOCAL_LLM_CHANGED_EVENT = 'ibl:local-llm-changed';
