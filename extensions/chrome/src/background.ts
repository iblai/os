// The service worker's entry point: nothing but the wiring, so the protocol in
// browse-worker.ts can be exercised without these listeners firing on import.
import { enablePanelOnActionClick, registerBrowsePort } from './browse-worker';

// FIRST, and before anything that calls into a chrome.* binding: a synchronous
// throw above this line would leave the worker running with no onConnect
// listener, and the panel would report every run as a dead extension.
registerBrowsePort();

chrome.runtime.onInstalled.addListener(enablePanelOnActionClick);
chrome.runtime.onStartup.addListener(enablePanelOnActionClick);
// Also run on service-worker (re)spawn so the behavior survives SW restarts.
enablePanelOnActionClick();
