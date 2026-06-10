// Tauri types for model download functionality

/**
 * Ollama installation and model status
 */
export interface OllamaStatus {
  installed: boolean;
  running: boolean;
  model_installed: boolean;
  /** All model tags installed in Ollama (e.g. "llama3.2:latest", "phi3:mini"). */
  installed_models?: string[];
}

/**
 * Download progress event payload from Tauri
 */
export interface DownloadProgress {
  status: 'downloading' | 'verifying' | 'completed' | 'cancelled' | 'error';
  completed: number;
  total: number;
  percentage: number;
  digest: string | null;
  message: string;
}

/**
 * Installation log entry from Tauri
 */
export interface InstallationLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

/**
 * Disk space error event payload
 */
export interface DiskSpaceError {
  required_gb: number;
  available_gb: number;
  message: string;
}

/**
 * Total memory the host can bring to bear on running a model, in bytes.
 * `vram_total` is the largest single GPU's memory (0 when no discrete GPU is
 * detected — integrated graphics or Apple unified memory — where `ram_total` is
 * the figure to size a model against).
 */
export interface SystemMemory {
  ram_total: number;
  vram_total: number;
}

/**
 * Model download state for persistence across app restarts
 */
export interface ModelDownloadState {
  status:
    | 'idle'
    | 'checking'
    | 'downloading'
    | 'completed'
    | 'error'
    | 'cancelled';
  progress: number;
  message: string;
  logs: InstallationLog[];
  lastUpdated: string;
  error?: string;
  /** Ollama id of the model the active download targets (survives reopen). */
  activeModel?: string;
  /** True while the model manager (Ollama) is being installed/started. */
  managerInstalling?: boolean;
  managerInstallProgress?: number;
}

/**
 * Initial state for model download
 */
export const initialModelDownloadState: ModelDownloadState = {
  status: 'idle',
  progress: 0,
  message: '',
  logs: [],
  lastUpdated: new Date().toISOString(),
};

/**
 * Check if the app is running inside Tauri
 * In Tauri 2.0, the global is __TAURI_INTERNALS__ (with withGlobalTauri: true)
 * We also check for __TAURI__ for backwards compatibility
 */
export const isTauriApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
};

/**
 * Tauri event names
 */
export const TAURI_EVENTS = {
  DOWNLOAD_PROGRESS: 'model:download-progress',
  INSTALLATION_LOG: 'model:installation-log',
  DISK_SPACE_ERROR: 'model:disk-space-error',
  OLLAMA_STATUS: 'model:ollama-status',
} as const;

/**
 * Tauri command names
 */
export const TAURI_COMMANDS = {
  INSTALL_OLLAMA: 'install_ollama',
  STOP_OLLAMA: 'stop_ollama',
  CHECK_OLLAMA_STATUS: 'check_ollama_status',
  CHECK_DISK_SPACE: 'check_disk_space_for_model',
  GET_SYSTEM_MEMORY: 'get_system_memory',
  DOWNLOAD_MODEL: 'download_model',
  CANCEL_DOWNLOAD: 'cancel_model_download',
  CHECK_NETWORK_STATUS: 'check_network_status',
  GET_OS_TYPE: 'get_os_type',
  CHECK_FOUNDRY_STATUS: 'check_foundry_local_status',
  START_FOUNDRY_SERVICE: 'start_foundry_local_service',
  LOAD_FOUNDRY_MODEL: 'load_foundry_local_model',
  SET_SELECTED_FOUNDRY_MODEL: 'set_selected_foundry_model',
  GET_SELECTED_FOUNDRY_MODEL: 'get_selected_foundry_model',
  INSTALL_FOUNDRY: 'install_foundry',
  DOWNLOAD_FOUNDRY_MODEL: 'download_foundry_model_cmd',
  GET_RECOMMENDED_FOUNDRY_MODELS: 'get_recommended_foundry_models',
} as const;

/**
 * Foundry Local status returned by Tauri
 */
export interface FoundryModel {
  id: string;
  name: string;
  foundry_id: string;
  device?: string;
  size?: string;
  is_downloaded: boolean;
}

export interface FoundryStatus {
  is_windows: boolean;
  is_supported: boolean;
  is_available: boolean;
  has_models: boolean;
  models: FoundryModel[];
  endpoint: string | null;
}

/**
 * Operating system type returned by Tauri
 */
export type OsType = 'windows' | 'macos' | 'linux' | 'unknown';
