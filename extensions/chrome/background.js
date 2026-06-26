// Open the side panel when the toolbar icon is clicked.
// (setPanelBehavior is the supported MV3 way to bind the action to the panel.)
function enablePanelOnActionClick() {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[ibl.ai] setPanelBehavior failed:', err));
}

chrome.runtime.onInstalled.addListener(enablePanelOnActionClick);
chrome.runtime.onStartup.addListener(enablePanelOnActionClick);
// Also run on service-worker (re)spawn so the behavior survives SW restarts.
enablePanelOnActionClick();
