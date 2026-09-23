// Chrome's native i18n: strings live in public/_locales/<locale>/messages.json
// (en, es, fr, zh_CN — every key in all four or none) and Chrome picks the
// locale from the browser UI language.
export function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/**
 * The user's preferred content language, e.g. `fr-FR` — the first of Chrome's
 * Accept-Language list.
 *
 * NOT `getUILanguage()`, which is what `t()` above resolves against: the UI
 * language is the language of the browser's own chrome, while this is the
 * language the user asked the web to talk to them in. They usually agree. The
 * extension's strings follow the first, the agent's prose follows this one.
 */
export async function userLanguage(): Promise<string> {
  try {
    const [first] = await chrome.i18n.getAcceptLanguages();
    if (first) return first;
  } catch {
    // An empty or unavailable list is not worth failing a run over.
  }
  return chrome.i18n.getUILanguage();
}
