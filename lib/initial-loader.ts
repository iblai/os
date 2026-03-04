/**
 * Hides the initial loader that shows before React hydrates.
 * Call this when the app is ready to be displayed.
 * Note: We only hide the loader (not remove it) to avoid React hydration errors.
 */
export function hideInitialLoader() {
  if (typeof window === 'undefined') return;

  const loader = document.getElementById('initial-loader');
  if (loader && !loader.classList.contains('hidden')) {
    loader.classList.add('hidden');
  }
}
