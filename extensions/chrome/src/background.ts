// The service worker's entry point: nothing but the wiring, so the protocol in
// browse-worker.ts can be exercised without these listeners firing on import.
import { enablePanelOnActionClick, registerBrowsePort } from './browse-worker';
import { sweepStaleMarks } from './tab-group';

// FIRST, and before anything that calls into a chrome.* binding: a synchronous
// throw above this line would leave the worker running with no onConnect
// listener, and the panel would report every run as a dead extension.
registerBrowsePort();

chrome.runtime.onInstalled.addListener(enablePanelOnActionClick);
chrome.runtime.onStartup.addListener(enablePanelOnActionClick);
// Also run on service-worker (re)spawn so the behavior survives SW restarts.
enablePanelOnActionClick();
// A worker killed mid-run leaves its tab in our group with nothing left to take
// it back out. This start is the one moment no run can be live, so it is where
// those are swept — and until they are, the next run finds the tab already
// grouped and leaves it unmarked.
void sweepStaleMarks();
