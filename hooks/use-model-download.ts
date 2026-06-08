'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useTauri } from './use-tauri';
import { useLocalStorage } from './use-local-storage';
import {
  DownloadProgress,
  DiskSpaceError,
  InstallationLog,
  isTauriApp,
  ModelDownloadState,
  OllamaStatus,
  OsType,
  SystemMemory,
  FoundryModel,
  FoundryStatus,
  initialModelDownloadState,
  TAURI_COMMANDS,
  TAURI_EVENTS,
} from '@/types/tauri';

const LOCAL_STORAGE_KEY = 'model_download_state';
const FIRST_LAUNCH_DISMISSED_KEY = 'model_download_prompt_dismissed';
const MAX_LOGS = 100;

// Manager/download status is authoritative from Tauri, never the persisted
// snapshot. This flips true the first time any hook instance mounts in a page
// session so we wipe the persisted state exactly once — clearing a stale
// `managerInstalling`/`downloading`/`checking` flag (e.g. left behind by an
// operation interrupted by an app reload) that would otherwise wedge the UI in
// a permanent "loading" state — then fall back to a fresh backend status check.
let didResetPersistedState = false;

/**
 * Hook to manage Phi3 Mini model download via Ollama through Tauri
 *
 * Features:
 * - Checks Ollama installation and model status
 * - Downloads the model with real-time progress updates
 * - Persists download state across app restarts
 * - Provides installation logs
 */
export function useModelDownload() {
  const { isAvailable, invoke, listen } = useTauri();
  const [state, setState] = useLocalStorage<ModelDownloadState>(
    LOCAL_STORAGE_KEY,
    initialModelDownloadState,
  );
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [systemMemory, setSystemMemory] = useState<SystemMemory | null>(null);
  const [osType, setOsType] = useState<OsType | null>(null);
  const [isFirstLaunchDismissed, setIsFirstLaunchDismissed] =
    useLocalStorage<boolean>(FIRST_LAUNCH_DISMISSED_KEY, false);
  const [isUsingFoundry, setIsUsingFoundry] = useState<boolean>(false);
  const [foundryModels, setFoundryModels] = useState<FoundryModel[]>([]);
  const [selectedFoundryModel, setSelectedFoundryModel] = useState<
    string | null
  >(null);
  const [foundryStatus, setFoundryStatus] = useState<FoundryStatus | null>(
    null,
  );
  const [foundryStatusLoaded, setFoundryStatusLoaded] =
    useState<boolean>(false);
  const unlistenRefs = useRef<Array<() => void>>([]);
  const hasCheckedStatus = useRef(false);
  // Stable handle to the latest checkStatus so the mount-time event listeners
  // can refresh status (e.g. after a download completes) without re-subscribing.
  const checkStatusRef = useRef<() => void>(() => {});

  console.log(
    '[useModelDownload] Hook render - isAvailable:',
    isAvailable,
    'hasCheckedStatus:',
    hasCheckedStatus.current,
    'foundryStatus:',
    foundryStatus,
    'foundryStatusLoaded:',
    foundryStatusLoaded,
  );

  /**
   * Add a log entry to the state
   */
  const addLog = useCallback(
    (log: InstallationLog) => {
      setState((prev) => ({
        ...prev,
        logs: [...prev.logs.slice(-(MAX_LOGS - 1)), log],
        lastUpdated: new Date().toISOString(),
      }));
    },
    [setState],
  );

  /**
   * Setup Tauri event listeners
   */
  useEffect(() => {
    if (!isAvailable) return;

    const setupListeners = async () => {
      try {
        // Download progress updates
        const unlistenProgress = await listen<DownloadProgress>(
          TAURI_EVENTS.DOWNLOAD_PROGRESS,
          (payload) => {
            console.log(
              '[useModelDownload] Received progress event:',
              JSON.stringify(payload),
            );

            const newStatus: ModelDownloadState['status'] =
              payload.status === 'completed'
                ? 'completed'
                : payload.status === 'cancelled'
                  ? 'cancelled'
                  : payload.status === 'error'
                    ? 'error'
                    : 'downloading';

            console.log(
              '[useModelDownload] Setting state - newStatus:',
              newStatus,
              'progress:',
              payload.percentage,
            );

            setState((prev) => {
              console.log(
                '[useModelDownload] setState callback - prev:',
                JSON.stringify(prev),
              );
              const newState: ModelDownloadState = {
                ...prev,
                status: newStatus,
                progress: payload.percentage,
                message: payload.message,
                lastUpdated: new Date().toISOString(),
              };
              console.log(
                '[useModelDownload] setState callback - newState:',
                JSON.stringify(newState),
              );
              return newState;
            });

            if (payload.status === 'completed') {
              // Refresh Ollama status so the freshly pulled model shows up in
              // `installed_models` — keeps the row marked "Ready" and selectable
              // even after the modal is closed and reopened. The success toast is
              // shown by startDownload (once per initiated download) to avoid a
              // duplicate from each mounted useModelDownload instance.
              checkStatusRef.current();
            }
          },
        );
        unlistenRefs.current.push(unlistenProgress);

        // Installation logs
        const unlistenLogs = await listen<InstallationLog>(
          TAURI_EVENTS.INSTALLATION_LOG,
          addLog,
        );
        unlistenRefs.current.push(unlistenLogs);

        // Disk space errors
        const unlistenDiskError = await listen<DiskSpaceError>(
          TAURI_EVENTS.DISK_SPACE_ERROR,
          (payload) => {
            setState((prev) => ({
              ...prev,
              status: 'error',
              error: payload.message,
              lastUpdated: new Date().toISOString(),
            }));
            toast.error(payload.message);
          },
        );
        unlistenRefs.current.push(unlistenDiskError);

        // Ollama status updates
        const unlistenStatus = await listen<OllamaStatus>(
          TAURI_EVENTS.OLLAMA_STATUS,
          setOllamaStatus,
        );
        unlistenRefs.current.push(unlistenStatus);
      } catch (error) {
        console.error('Failed to setup Tauri event listeners:', error);
      }
    };

    setupListeners();

    return () => {
      unlistenRefs.current.forEach((unlisten) => unlisten());
      unlistenRefs.current = [];
    };
  }, [isAvailable, listen, setState, addLog]);

  /**
   * Check Ollama status and OS type on mount
   */
  useEffect(() => {
    console.log(
      '[useModelDownload] Mount useEffect - isAvailable:',
      isAvailable,
      'hasCheckedStatus:',
      hasCheckedStatus.current,
      'foundryStatus:',
      foundryStatus,
      'foundryStatusLoaded:',
      foundryStatusLoaded,
    );

    if (!isAvailable) {
      // If not in Tauri, mark as loaded immediately
      console.log(
        '[useModelDownload] Not in Tauri, setting foundryStatusLoaded to true',
      );
      setFoundryStatusLoaded(true);
      return;
    }

    // Reset hasCheckedStatus if foundryStatus is null/undefined AND not loaded yet
    // This handles hot reload scenarios where the ref persists but state resets
    if (
      !foundryStatusLoaded &&
      foundryStatus === null &&
      hasCheckedStatus.current
    ) {
      console.log(
        '[useModelDownload] Resetting hasCheckedStatus due to missing foundryStatus after hot reload',
      );
      hasCheckedStatus.current = false;
    }

    // Only check once on mount (or after reset)
    if (!hasCheckedStatus.current) {
      console.log(
        '[useModelDownload] First mount (or after reset) - calling checkStatus',
      );
      hasCheckedStatus.current = true;

      // Wipe any stale persisted manager/download state once per page load, so a
      // leftover `managerInstalling`/`downloading` flag can't keep the toggle or
      // status card stuck "loading". Tauri is the source of truth from here on.
      if (!didResetPersistedState) {
        didResetPersistedState = true;
        setState(initialModelDownloadState);
      }

      checkStatus();

      // Get OS type
      invoke<OsType>(TAURI_COMMANDS.GET_OS_TYPE)
        .then(setOsType)
        .catch((err) => console.error('Failed to get OS type:', err));

      // Read system memory (RAM/VRAM) so the UI can warn before downloading a
      // model that is large relative to what this machine can run.
      invoke<SystemMemory>(TAURI_COMMANDS.GET_SYSTEM_MEMORY)
        .then(setSystemMemory)
        .catch((err) => console.error('Failed to read system memory:', err));
    } else {
      console.log(
        '[useModelDownload] Skipping checkStatus - already checked (hasCheckedStatus.current = true)',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // checkStatus is intentionally omitted - we only want to run once on mount using hasCheckedStatus ref guard
  }, [isAvailable, invoke, foundryStatus, foundryStatusLoaded]);

  /**
   * Check Ollama installation and model status
   */
  const checkStatus = useCallback(async () => {
    console.log(
      '[useModelDownload] checkStatus called - isAvailable:',
      isAvailable,
    );
    if (!isAvailable) {
      console.log(
        '[useModelDownload] checkStatus early return - isAvailable is false',
      );
      return;
    }

    try {
      console.log('[useModelDownload] Setting state to checking...');
      setState((prev) => ({ ...prev, status: 'checking' }));

      // First check if Foundry Local has models available (PREFERRED option)
      // Foundry is prioritized over Ollama due to better performance and efficiency
      // Note: We check has_models regardless of service running status
      console.log(
        '[useModelDownload] Invoking CHECK_FOUNDRY_STATUS command...',
      );
      const foundryStatusResult = await invoke<any>(
        TAURI_COMMANDS.CHECK_FOUNDRY_STATUS,
      );
      console.log(
        '[useModelDownload] ✓ Foundry status received:',
        JSON.stringify(foundryStatusResult),
      );
      console.log(
        '[useModelDownload]   - is_supported:',
        foundryStatusResult?.is_supported,
      );
      console.log(
        '[useModelDownload]   - has_models:',
        foundryStatusResult?.has_models,
      );
      console.log('[useModelDownload] About to setFoundryStatus...');
      setFoundryStatus(foundryStatusResult);
      setFoundryStatusLoaded(true);
      console.log(
        '[useModelDownload] ✓ setFoundryStatus completed - this should trigger re-render',
      );

      if (
        foundryStatusResult &&
        foundryStatusResult.is_supported &&
        foundryStatusResult.has_models
      ) {
        console.log(
          '[useModelDownload] ✓ Using Foundry Local (preferred option) - Ollama UI will be hidden',
        );
        // Set flag to indicate Foundry is being used
        setIsUsingFoundry(true);
        // Store available models
        setFoundryModels(foundryStatusResult.models || []);

        // Load selected model from backend or default to first model
        try {
          const selected = await invoke<string | null>(
            TAURI_COMMANDS.GET_SELECTED_FOUNDRY_MODEL,
          );
          let modelToLoad: string | null = null;

          if (selected) {
            console.log(
              '[useModelDownload] Found saved model selection:',
              selected,
            );
            // Verify the saved model exists in current model list
            const savedModel = foundryStatusResult.models.find(
              (m: FoundryModel) => m.id === selected,
            );
            if (savedModel) {
              setSelectedFoundryModel(selected);
              modelToLoad = selected;
            } else {
              console.log(
                '[useModelDownload] Saved model not found in current list, using first available',
              );
              // Saved model doesn't exist anymore, use first available
              if (
                foundryStatusResult.models &&
                foundryStatusResult.models.length > 0
              ) {
                const firstModel = foundryStatusResult.models[0].id;
                setSelectedFoundryModel(firstModel);
                await invoke(TAURI_COMMANDS.SET_SELECTED_FOUNDRY_MODEL, {
                  modelId: firstModel,
                });
                modelToLoad = firstModel;
              }
            }
          } else if (
            foundryStatusResult.models &&
            foundryStatusResult.models.length > 0
          ) {
            // Default to first model and save it
            const firstModel = foundryStatusResult.models[0].id;
            console.log(
              '[useModelDownload] No saved selection, defaulting to first model:',
              firstModel,
            );
            setSelectedFoundryModel(firstModel);
            await invoke(TAURI_COMMANDS.SET_SELECTED_FOUNDRY_MODEL, {
              modelId: firstModel,
            });
            modelToLoad = firstModel;
          }

          // Actually load the model into Foundry Local ONLY if it's downloaded
          if (modelToLoad) {
            const modelToLoadObj = foundryStatusResult.models.find(
              (m: FoundryModel) => m.id === modelToLoad,
            );
            if (modelToLoadObj) {
              if (modelToLoadObj.is_downloaded) {
                console.log(
                  '[useModelDownload] Loading downloaded model into Foundry:',
                  modelToLoad,
                );
                await invoke(TAURI_COMMANDS.LOAD_FOUNDRY_MODEL, {
                  modelId: modelToLoadObj.foundry_id,
                });
                console.log(
                  '[useModelDownload] ✓ Model loaded successfully:',
                  modelToLoadObj.foundry_id,
                );
              } else {
                console.log(
                  '[useModelDownload] Model selected but not downloaded yet, skipping auto-load:',
                  modelToLoad,
                );
              }
            } else {
              console.error(
                '[useModelDownload] Could not find model object for ID:',
                modelToLoad,
              );
            }
          }
        } catch (error) {
          console.error(
            '[useModelDownload] Failed to load selected model:',
            error,
          );
          // Default to first model
          if (
            foundryStatusResult.models &&
            foundryStatusResult.models.length > 0
          ) {
            setSelectedFoundryModel(foundryStatusResult.models[0].id);
          }
        }

        // Set status to completed so UI doesn't show download prompts
        setState((prev) => ({
          ...prev,
          status: 'completed',
          progress: 100,
          message: 'Local LLM available via Foundry Local (preferred)',
        }));
        // Still set ollama status from backend (which will return "ready" when Foundry is available)
        const status = await invoke<OllamaStatus>(
          TAURI_COMMANDS.CHECK_OLLAMA_STATUS,
        );
        setOllamaStatus(status);
        return;
      }

      // Foundry not available - check if device supports it
      if (
        foundryStatusResult &&
        foundryStatusResult.is_supported &&
        !foundryStatusResult.has_models
      ) {
        console.log(
          '[useModelDownload] ℹ️ Device supports Foundry Local (preferred) but not installed - showing install prompt',
        );
      }

      // Fallback to Ollama (alternative option)
      console.log('[useModelDownload] Using Ollama as fallback option');
      const status = await invoke<OllamaStatus>(
        TAURI_COMMANDS.CHECK_OLLAMA_STATUS,
      );
      setOllamaStatus(status);

      if (status.model_installed) {
        setState((prev) => ({
          ...prev,
          status: 'completed',
          progress: 100,
          message: 'Model installed',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: 'idle',
        }));
      }
    } catch (error) {
      console.error('Failed to check status:', error);
      setState((prev) => ({
        ...prev,
        status: 'idle',
      }));
    }
  }, [isAvailable, invoke, setState]);

  // Keep the ref pointed at the latest checkStatus for use inside the once-on-mount
  // event listeners (which must not depend on checkStatus to avoid re-subscribing).
  useEffect(() => {
    checkStatusRef.current = checkStatus;
  }, [checkStatus]);

  /**
   * Start downloading the Phi3 Mini model
   */
  const startDownload = useCallback(
    async (modelId?: string) => {
      if (!isAvailable) {
        toast.error('Desktop app required for local model download');
        return;
      }

      try {
        setState((prev) => ({
          ...prev,
          status: 'downloading',
          progress: 0,
          message: 'Starting download...',
          error: undefined,
          logs: [],
          // Record which model is downloading so the right row shows progress even
          // if the dialog is closed and reopened mid-download (state is persisted).
          activeModel: modelId ?? 'phi3:mini',
        }));

        // Check disk space first
        const hasSpace = await invoke<boolean>(TAURI_COMMANDS.CHECK_DISK_SPACE);
        if (!hasSpace) {
          return; // Error will be emitted via event
        }

        // Start the download. The selected model identifier is forwarded so the
        // backend can pull it; the current backend defaults to Phi-3 Mini.
        // `invoke` resolves only once the Rust pull has fully finished, so treat a
        // successful resolution as completion. This guarantees the UI leaves the
        // "downloading" state even if the terminal progress event was missed (live
        // progress still streams from the progress events while the pull runs).
        await invoke(
          TAURI_COMMANDS.DOWNLOAD_MODEL,
          modelId ? { model: modelId } : undefined,
        );

        let didComplete = false;
        setState((prev) => {
          // Don't clobber a cancellation/error that landed while awaiting.
          if (prev.status !== 'downloading') return prev;
          didComplete = true;
          return {
            ...prev,
            status: 'completed',
            progress: 100,
            message: 'Download complete',
          };
        });
        if (didComplete) {
          toast.success('Model downloaded successfully!');
        }
        // Refresh installed models so the row flips to "Ready" and is selectable.
        checkStatusRef.current();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        let wasCancelled = false;
        setState((prev) => {
          if (prev.status === 'cancelled') {
            wasCancelled = true;
            return prev;
          }
          return { ...prev, status: 'error', error: errorMessage };
        });
        if (!wasCancelled) {
          toast.error(`Download failed: ${errorMessage}`);
        }
      }
    },
    [isAvailable, invoke, setState],
  );

  /**
   * Cancel the ongoing download
   */
  const cancelDownload = useCallback(async () => {
    if (!isAvailable) return;

    // Mark cancelled up front so the in-flight download promise (which resolves
    // cleanly once the backend aborts the pull) can't race ahead and mark the
    // row "completed".
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
      progress: 0,
      message: 'Download cancelled',
    }));

    try {
      await invoke(TAURI_COMMANDS.CANCEL_DOWNLOAD);
      toast.info('Download cancelled');
    } catch (error) {
      console.error('Failed to cancel download:', error);
    }
  }, [isAvailable, invoke, setState]);

  /**
   * Install Ollama on the system
   */
  const installOllama = useCallback(async () => {
    if (!isAvailable) return;

    try {
      // Drive the toggle's loading state. "Enable Local Models" ensures the model
      // manager is installed AND running; the install_ollama command does both.
      setState((prev) => ({
        ...prev,
        managerInstalling: true,
        error: undefined,
      }));

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Enabling local models (installing/starting model manager)...',
      });

      // Add timeout to prevent indefinite waiting
      const installPromise = invoke<string>(TAURI_COMMANDS.INSTALL_OLLAMA);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Installation timeout after 5 minutes')),
          5 * 60 * 1000,
        );
      });

      const result = await Promise.race([installPromise, timeoutPromise]);

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: result,
      });

      toast.success(result);
      setState((prev) => ({ ...prev, managerInstalling: false }));
      await checkStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Always clear the loading state on error to allow retry
      setState((prev) => ({
        ...prev,
        managerInstalling: false,
        status: 'error',
        error: errorMessage,
      }));

      toast.error(`Failed to enable local models: ${errorMessage}`);
      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Installation failed: ${errorMessage}`,
      });
    }
  }, [isAvailable, invoke, addLog, checkStatus, setState]);

  /**
   * Stop the model manager (Ollama). Backs turning "Enable Local Models" off.
   */
  const stopManager = useCallback(async () => {
    if (!isAvailable) return;

    try {
      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Stopping model manager...',
      });
      await invoke(TAURI_COMMANDS.STOP_OLLAMA);
      await checkStatus();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error('Failed to stop model manager:', errorMessage);
    }
  }, [isAvailable, invoke, addLog, checkStatus]);

  /**
   * Clear all logs
   */
  const clearLogs = useCallback(() => {
    setState((prev) => ({
      ...prev,
      logs: [],
    }));
  }, [setState]);

  /**
   * Dismiss the first launch prompt
   */
  const dismissFirstLaunchPrompt = useCallback(() => {
    setIsFirstLaunchDismissed(true);
  }, [setIsFirstLaunchDismissed]);

  /**
   * Reset the download state (for retrying)
   */
  const resetState = useCallback(() => {
    setState(initialModelDownloadState);
  }, [setState]);

  /**
   * Handle Foundry model selection
   */
  const handleSelectFoundryModel = useCallback(
    async (modelId: string) => {
      if (!isAvailable) return;

      try {
        console.log('[useModelDownload] Selecting Foundry model:', modelId);
        const model = foundryModels.find((m) => m.id === modelId);

        if (!model) {
          console.error('[useModelDownload] Model not found:', modelId);
          toast.error('Model not found');
          return;
        }

        // Check if model is downloaded
        if (!model.is_downloaded) {
          console.log(
            '[useModelDownload] Model not downloaded, starting download:',
            modelId,
          );
          setSelectedFoundryModel(modelId);

          // Update state to show downloading progress
          setState((prev) => ({
            ...prev,
            status: 'downloading',
            progress: 0,
            message: `Downloading ${model.name || modelId}...`,
            error: undefined,
          }));

          addLog({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Downloading model: ${model.name || modelId}`,
          });

          // Save selection to storage
          await invoke(TAURI_COMMANDS.SET_SELECTED_FOUNDRY_MODEL, { modelId });
          console.log('[useModelDownload] ✓ Saved selected model to storage');

          // Download the model (use foundry_id)
          try {
            await invoke(TAURI_COMMANDS.DOWNLOAD_FOUNDRY_MODEL, {
              modelId: model.foundry_id,
            });
            console.log(
              '[useModelDownload] ✓ Model downloaded successfully:',
              model.foundry_id,
            );

            setState((prev) => ({
              ...prev,
              status: 'downloading',
              progress: 100,
              message: `Loading ${model.name || modelId}...`,
            }));

            // Now load the model into Foundry Local (use foundry_id)
            await invoke(TAURI_COMMANDS.LOAD_FOUNDRY_MODEL, {
              modelId: model.foundry_id,
            });
            console.log(
              '[useModelDownload] ✓ Model loaded into Foundry Local:',
              model.foundry_id,
            );

            setState((prev) => ({
              ...prev,
              status: 'completed',
              progress: 100,
              message: `Model ready: ${model.name || modelId}`,
            }));

            addLog({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `Model ready: ${model.name || modelId}`,
            });

            toast.success(
              `Model downloaded and loaded: ${model.name || modelId}`,
            );

            // Refresh status to update the downloaded flag
            await checkStatus();
          } catch (downloadError) {
            const errorMessage =
              downloadError instanceof Error
                ? downloadError.message
                : String(downloadError);
            console.error(
              '[useModelDownload] Failed to download model:',
              errorMessage,
            );

            setState((prev) => ({
              ...prev,
              status: 'error',
              error: errorMessage,
              message: `Failed to download ${model.name || modelId}`,
            }));

            addLog({
              timestamp: new Date().toISOString(),
              level: 'error',
              message: `Download failed: ${errorMessage}`,
            });

            toast.error(`Failed to download model: ${errorMessage}`);
          }
        } else {
          // Model already downloaded, just load it
          console.log(
            '[useModelDownload] Model already downloaded, loading:',
            modelId,
          );
          setSelectedFoundryModel(modelId);

          setState((prev) => ({
            ...prev,
            status: 'downloading',
            progress: 50,
            message: `Loading ${model.name || modelId}...`,
          }));

          // Save selection to storage
          await invoke(TAURI_COMMANDS.SET_SELECTED_FOUNDRY_MODEL, { modelId });
          console.log('[useModelDownload] ✓ Saved selected model to storage');

          // Load the model into Foundry Local (use foundry_id)
          await invoke(TAURI_COMMANDS.LOAD_FOUNDRY_MODEL, {
            modelId: model.foundry_id,
          });
          console.log(
            '[useModelDownload] ✓ Model loaded into Foundry Local:',
            model.foundry_id,
          );

          setState((prev) => ({
            ...prev,
            status: 'completed',
            progress: 100,
            message: `Model ready: ${model.name || modelId}`,
          }));

          toast.success(`Loaded model: ${model.name || modelId}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          '[useModelDownload] Failed to handle model selection:',
          errorMessage,
        );
        toast.error(`Failed to load model: ${errorMessage}`);

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
        }));
      }
    },
    [isAvailable, invoke, foundryModels, setState, addLog, checkStatus],
  );

  /**
   * Install Foundry Local
   */
  const installFoundry = useCallback(async () => {
    if (!isAvailable) return;

    try {
      setState((prev) => ({
        ...prev,
        status: 'downloading',
        progress: 0,
        message: 'Installing Foundry Local...',
      }));

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Starting Foundry Local installation',
      });

      const result = await invoke<string>(TAURI_COMMANDS.INSTALL_FOUNDRY);
      console.log('[useModelDownload] Foundry installation result:', result);

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: result,
      });

      // Download default model (qwen2.5-0.5b)
      setState((prev) => ({
        ...prev,
        progress: 50,
        message: 'Downloading default model (qwen2.5-0.5b)...',
      }));

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Downloading default model: qwen2.5-0.5b',
      });

      await invoke(TAURI_COMMANDS.DOWNLOAD_FOUNDRY_MODEL, {
        modelId: 'qwen2.5-0.5b',
      });

      setState((prev) => ({
        ...prev,
        status: 'completed',
        progress: 100,
        message: 'Foundry Local installed successfully',
      }));

      addLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Foundry Local setup completed',
      });

      // Refresh status
      await checkStatus();
    } catch (error) {
      console.error('[useModelDownload] Foundry installation failed:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        message: 'Failed to install Foundry Local',
      }));

      addLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Installation failed: ${errorMessage}`,
      });
    }
  }, [isAvailable, invoke, addLog, checkStatus]);

  /**
   * Check if the first launch prompt should be shown
   */
  const shouldShowFirstLaunchPrompt =
    isAvailable &&
    !isFirstLaunchDismissed &&
    ollamaStatus?.installed &&
    !ollamaStatus?.model_installed &&
    state.status === 'idle';

  // Check if we're in Tauri offline mode (should not show Local LLM settings)
  const isInOfflineMode = (() => {
    if (typeof window === 'undefined') return false;
    // Check global variable (set by Tauri initialization script)
    if (
      (window as unknown as Record<string, unknown>).__TAURI_OFFLINE_MODE__ ===
      true
    )
      return true;
    // Fallback to localStorage
    if (typeof localStorage?.getItem !== 'function') return false;
    return localStorage.getItem('tauri_offline_mode') === 'true';
  })();

  // Show Local LLM settings in Tauri app (both online and offline mode)
  // Advanced settings should be available to configure Foundry even in offline mode
  const finalIsAvailable = isAvailable && isTauriApp();
  console.log(
    '[useModelDownload] isAvailable from useTauri:',
    isAvailable,
    'isTauriApp():',
    isTauriApp(),
    'isInOfflineMode:',
    isInOfflineMode,
    'final:',
    finalIsAvailable,
  );

  console.log('[useModelDownload] Returning foundryStatus:', foundryStatus);

  return {
    // State
    isAvailable: finalIsAvailable,
    state,
    ollamaStatus,
    systemMemory,
    osType,
    shouldShowFirstLaunchPrompt,
    isUsingFoundry,
    foundryModels,
    selectedFoundryModel,
    foundryStatus,
    foundryStatusLoaded,

    // Actions
    checkStatus,
    startDownload,
    cancelDownload,
    installOllama,
    stopManager,
    installFoundry,
    clearLogs,
    resetState,
    dismissFirstLaunchPrompt,
    onSelectFoundryModel: handleSelectFoundryModel,
  };
}
