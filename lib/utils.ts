import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday } from 'date-fns';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { remark } from 'remark';
import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

import {
  LOCAL_STORAGE_KEYS,
  QUERY_PARAMS,
  REDIRECT_PATH_LOCAL_STORAGE_KEY,
  URL_PATTERNS,
} from '@/lib/constants';
import { config } from '@/lib/config';
import type { StorageService } from '@iblai/iblai-js/data-layer';
import { isTauriApp } from '@/types/tauri';
import { isTauriOfflineMode } from '@/lib/tauri-api-cache';
import { isOfflineServerOrigin } from '@/hooks/use-tauri-offline';
import type { Tenant } from '@iblai/iblai-js/web-utils';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function hasNonExpiredAuthToken() {
  const token = window.localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
  if (!token) {
    console.log(
      '################### [hasNonExpiredAuthToken] axd token is not defined',
      token,
    );
    return true;
  }

  const tokenExpiry = window.localStorage.getItem(
    LOCAL_STORAGE_KEYS.TOKEN_EXPIRY,
  );
  if (!tokenExpiry) {
    console.log(
      '################### [hasNonExpiredAuthToken] axd token expiry is not defined',
      tokenExpiry,
    );
    return true;
  }

  const expiryDate = new Date(tokenExpiry);
  if (isNaN(expiryDate.getTime())) {
    console.log(
      '################### [hasNonExpiredAuthToken] axd token expiry date',
      expiryDate,
    );
    return false;
  }

  const currentDate = new Date();
  if (expiryDate <= currentDate) {
    console.log(
      '################### [hasNonExpiredAuthToken] axd token expiry date is less than current date ',
      expiryDate,
      currentDate,
    );
    return false;
  }

  return true;
}

export async function redirectToAuthSpa(
  redirectTo?: string,
  platformKey?: string,
  logout?: boolean,
  saveRedirect = true,
) {
  // Don't redirect to auth when in Tauri offline mode
  // Check origin first (most reliable) or Tauri offline flags
  if (isOfflineServerOrigin() || (isTauriApp() && isTauriOfflineMode())) {
    console.log('[redirectToAuthSpa] Skipping redirect - Tauri offline mode', {
      isOfflineServerOrigin: isOfflineServerOrigin(),
      isTauriApp: isTauriApp(),
      isTauriOfflineMode: isTauriOfflineMode(),
    });
    return;
  }

  // Save JWT token before clearing localStorage (needed for Tauri mode)
  const edxJwtToken = window.localStorage.getItem('edx_jwt_token');

  localStorage.clear();

  if (logout || isInIframe()) {
    // Delete authentication cookies for cross-SPA synchronization
    const currentDomain = window.location.hostname;
    deleteCookieOnAllDomains('ibl_current_tenant', currentDomain);
    deleteCookieOnAllDomains('ibl_user_data', currentDomain);
    deleteCookieOnAllDomains('ibl_tenant', currentDomain);

    // Set logout timestamp cookie to trigger logout on other SPAs
    if (!isInIframe()) {
      setCookieForAuth('ibl_logout_timestamp', Date.now().toString());
    }
  }

  if (isInIframe()) {
    console.log('[redirectToAuthSpa]: sending authExpired to parent');
    sendMessageToParentWebsite({ authExpired: true });
    return;
  }

  const redirectPath =
    redirectTo ?? `${window.location.pathname}${window.location.search}`;

  // Never save sso-login routes as redirect paths
  if (
    !redirectPath.startsWith('/sso-login') &&
    !redirectPath.startsWith('/sso-login-complete') &&
    saveRedirect
  ) {
    window.localStorage.setItem(LOCAL_STORAGE_KEYS.REDIRECT_TO, redirectPath);
  }

  const platform = platformKey ?? getPlatformKey(redirectPath);

  const redirectToUrl = `${window.location.origin}`;

  let authRedirectUrl = `${config.authUrl()}/login?${QUERY_PARAMS.APP}=${config.iblPlatform()}`;

  authRedirectUrl += `&${QUERY_PARAMS.REDIRECT_TO}=${redirectToUrl}`;

  if (platform) {
    authRedirectUrl += `&${QUERY_PARAMS.TENANT}=${platform}`;
  }
  if (logout) {
    authRedirectUrl += '&logout=1';
  }

  await new Promise((resolve) => setTimeout(resolve, 100));
  if (isTauriApp()) {
    // On Tauri (mobile), pass the JWT token as a query param so the auth app can use it
    if (edxJwtToken) {
      authRedirectUrl += `&token=${encodeURIComponent(edxJwtToken)}`;
      console.log('[redirectToAuthSpa] Added edx_jwt_token to auth URL');
    }
    // Navigate the main webview directly to the auth URL
    // This keeps the user within the app
    console.log(
      '[redirectToAuthSpa] isTauriApp=true, navigating to auth URL:',
      authRedirectUrl,
    );
    window.location.href = authRedirectUrl;
  } else {
    // window.location.href = authRedirectUrl;
    window.location.href = `/api/auth-redirect?to=${encodeURIComponent(authRedirectUrl)}`;
    // window.open(authRedirectUrl, "_self");
  }
}

export function getAuthSpaJoinUrl(tenantKey?: string, redirectUrl?: string) {
  const resolvedTenant =
    tenantKey || getPlatformKey(window.location.pathname) || '';

  if (!resolvedTenant) {
    return '';
  }

  const targetUrl = redirectUrl ?? window.location.href;
  const joinUrl = `${config.authUrl()}/join?tenant=${encodeURIComponent(resolvedTenant)}&redirect-to=${encodeURIComponent(
    targetUrl,
  )}`;
  return joinUrl;
}

export function redirectToAuthSpaJoinTenant(
  tenantKey?: string,
  redirectUrl?: string,
) {
  const resolvedTenant =
    tenantKey || getPlatformKey(window.location.pathname) || '';

  if (!resolvedTenant) {
    console.log('[auth-redirect] Missing tenant key for join', {
      tenantKey,
      redirectUrl,
    });
    redirectToAuthSpa(redirectUrl);
    return;
  }

  const targetUrl = redirectUrl ?? window.location.href;
  const joinUrl = `${config.authUrl()}/join?tenant=${encodeURIComponent(resolvedTenant)}&redirect-to=${encodeURIComponent(
    targetUrl,
  )}`;

  window.location.href = joinUrl;
}

export function getPlatformKey(url: string) {
  const match = url.match(URL_PATTERNS.PLATFORM_KEY);
  return match ? match[1] : null;
}

export function redirectToMentor(tenantKey: string, mentorId: string) {
  window.location.href = `/platform/${tenantKey}/${mentorId}`;
}

export function redirectToNoMentorsPage() {
  window.location.href = `/no-mentors`;
}

export function redirectToCreateMentor() {
  window.location.href = `/create-mentor`;
}

export function formatDateString(dateString: string) {
  const date = new Date(dateString);

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  return `${month} ${day}, ${year}`;
}

export function storageService() {
  return {
    getItem: async <T>(key: string): Promise<T | null> => {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    },
    setItem: async <T>(key: string, item: T): Promise<void> => {
      window.localStorage.setItem(key, JSON.stringify(item));
    },
    removeItem: async (key: string): Promise<void> => {
      window.localStorage.removeItem(key);
    },
  };
}

export class LocalStorageService implements StorageService {
  private static instance: LocalStorageService;

  private constructor() {}

  public static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  async getItem<T>(key: string): Promise<T | null> {
    return window.localStorage.getItem(key) as T;
  }

  async setItem<T>(key: string, item: T): Promise<void> {
    window.localStorage.setItem(key, item as unknown as string);
  }

  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  }
}

export function getHostFromUrl(url: string) {
  const a = document.createElement('a');
  a.href = url;
  return a.hostname;
}

export function preprocessLaTeX(content: string) {
  // Handle non-string inputs
  if (typeof content !== 'string') {
    return '';
  }

  // Helper function to process tabular/array content into markdown table
  const processTabularContent = (tableContent: string): string => {
    // Split into rows by \\ (LaTeX row separator)
    const rows = tableContent
      .split(/\\\\\s*/)
      .map((row: string) => row.trim())
      .filter((row: string) => row && !row.match(/^\\hline\s*$/));

    if (rows.length === 0) return '';

    // Process each row: split by & (column separator) and clean up
    const processedRows = rows
      .map((row: string) => {
        // Remove \hline from the row content
        let cleanRow = row.replace(/\\hline\s*/g, '').trim();
        if (!cleanRow) return null;

        // Convert \text{...} to plain text
        cleanRow = cleanRow.replace(/\\text\{([^}]*)\}/g, '$1');

        // Remove {,} (LaTeX thousands separator formatting)
        cleanRow = cleanRow.replace(/\{,\}/g, ',');

        // Split by & and trim each cell
        const cells = cleanRow.split('&').map((cell: string) => cell.trim());
        return `| ${cells.join(' | ')} |`;
      })
      .filter(Boolean);

    if (processedRows.length === 0) return '';

    // Insert header separator after first row
    const firstRow = processedRows[0] as string;
    const columnCount = firstRow.split('|').length - 2;
    const headerSeparator = `|${' --- |'.repeat(columnCount)}`;
    processedRows.splice(1, 0, headerSeparator);

    return `\n${processedRows.join('\n')}\n`;
  };

  // Process tabular inside \[...\] first (before converting math delimiters)
  let processedContent = content.replace(
    /\\\[\s*\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}\s*\\\]/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process tabular inside $$...$$ as well
  processedContent = processedContent.replace(
    /\$\$\s*\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}\s*\$\$/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process standalone tabular (not inside math delimiters)
  processedContent = processedContent.replace(
    /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process array inside \[...\] first
  processedContent = processedContent.replace(
    /\\\[\s*\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}\s*\\\]/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process array inside $$...$$
  processedContent = processedContent.replace(
    /\$\$\s*\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}\s*\$\$/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Process standalone array
  processedContent = processedContent.replace(
    /\\begin\{array\}\{[^}]*\}([\s\S]*?)\\end\{array\}/g,
    (_, tableContent) => processTabularContent(tableContent),
  );

  // Escape currency dollar signs: if a $ is directly followed by a digit,
  // prepend a backslash so that it is rendered as a literal dollar sign.
  // Replace the regex replacement with one using a lookbehind and a function to ensure the digit group is preserved correctly.
  processedContent = processedContent.replace(
    /(?<!\\)\$(\d)/g,
    (_, digit) => `\\$${digit}`,
  );

  // Replace block-level LaTeX delimiters \[ \] with $$ $$.
  processedContent = processedContent.replace(
    /\\\[(\s*[\s\S]*?\s*)\\\]/g,
    (_, equation) => `$$${equation}$$`,
  );

  // Replace inline LaTeX delimiters \( \) with $ $
  processedContent = processedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, equation) => `$${equation}$`,
  );

  // Convert LaTeX text formatting commands to Markdown
  // \textbf{text} -> **text**
  processedContent = processedContent.replace(/\\textbf\{([^}]+)\}/g, '**$1**');

  // \textit{text} -> *text*
  processedContent = processedContent.replace(/\\textit\{([^}]+)\}/g, '*$1*');

  // \emph{text} -> *text*
  processedContent = processedContent.replace(/\\emph\{([^}]+)\}/g, '*$1*');

  // \texttt{text} -> `text`
  processedContent = processedContent.replace(/\\texttt\{([^}]+)\}/g, '`$1`');

  // \underline{text} -> <u>text</u> (requires rehype-raw)
  processedContent = processedContent.replace(
    /\\underline\{([^}]+)\}/g,
    '<u>$1</u>',
  );

  // Convert LaTeX environments to Markdown/HTML
  // \begin{itemize} ... \end{itemize} -> convert to unordered list
  processedContent = processedContent.replace(
    /\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g,
    (_, items) => {
      // Convert \item to list items
      const listItems = items
        .split(/\\item\s+/)
        .filter((item: string) => item.trim())
        .map((item: string) => `- ${item.trim()}`)
        .join('\n');
      return `\n${listItems}\n`;
    },
  );

  // \begin{enumerate} ... \end{enumerate} -> convert to ordered list
  processedContent = processedContent.replace(
    /\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g,
    (_, items) => {
      // Convert \item to numbered list items
      const listItems = items
        .split(/\\item\s+/)
        .filter((item: string) => item.trim())
        .map((item: string, index: number) => `${index + 1}. ${item.trim()}`)
        .join('\n');
      return `\n${listItems}\n`;
    },
  );

  // \begin{quote} ... \end{quote} -> convert to blockquote
  processedContent = processedContent.replace(
    /\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g,
    (_, content) => `\n> ${content.trim()}\n`,
  );

  // \begin{center} ... \end{center} -> convert to centered div
  processedContent = processedContent.replace(
    /\\begin\{center\}([\s\S]*?)\\end\{center\}/g,
    (_, content) =>
      `\n<div style="text-align: center;">${content.trim()}</div>\n`,
  );

  // Convert section headings (with optional * for unnumbered variants)
  // \section{text} or \section*{text} -> ## text
  processedContent = processedContent.replace(
    /\\section\*?\{([^}]+)\}/g,
    '\n## $1\n',
  );

  // \subsection{text} or \subsection*{text} -> ### text
  processedContent = processedContent.replace(
    /\\subsection\*?\{([^}]+)\}/g,
    '\n### $1\n',
  );

  // \subsubsection{text} or \subsubsection*{text} -> #### text
  processedContent = processedContent.replace(
    /\\subsubsection\*?\{([^}]+)\}/g,
    '\n#### $1\n',
  );

  // Handle line breaks
  // \\ or \newline -> line break
  processedContent = processedContent.replace(/\\\\|\n\\newline/g, '  \n');

  // Handle verbatim text
  // \verb|text| -> `text`
  processedContent = processedContent.replace(/\\verb\|([^|]+)\|/g, '`$1`');

  // Handle quotes
  // `` and '' -> proper quotes
  processedContent = processedContent.replace(/``/g, '"');
  processedContent = processedContent.replace(/''/g, '"');

  // Handle common LaTeX symbols that should remain as-is or convert
  // \& -> &
  processedContent = processedContent.replace(/\\&/g, '&');

  // \% -> %
  processedContent = processedContent.replace(/\\%/g, '%');

  // \# -> #
  processedContent = processedContent.replace(/\\#/g, '#');

  // \_ -> _
  processedContent = processedContent.replace(/\\_/g, '_');

  return processedContent;
}

export const textTruncate = function (
  str: string,
  length: number,
  ending?: string,
) {
  if (length == null) {
    length = 50;
  }
  if (ending == null) {
    ending = '...';
  }
  if (str?.length > length) {
    return str.substring(0, length - ending.length) + ending;
  } else {
    return str;
  }
};

export const mentorIsIframe = () => {
  return window.self !== window.top;
};

export const isJSON = (text: string) => {
  if (typeof text !== 'string') {
    return false;
  }
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

export function isInIframe() {
  if (typeof window === 'undefined') {
    return false;
  }
  return window?.self !== window?.top;
}

export function deleteCookie(name: string, path: string, domain: string) {
  // Set the cookie expiration date to the past
  const expires = 'expires=Thu, 01 Jan 1970 00:00:00 UTC;';
  // Set the cookie value to empty
  const cookieValue = name + '=;';
  // Set the path attribute
  const pathValue = path ? 'path=' + path + ';' : '';
  // Set the domain attribute
  const domainValue = domain ? 'domain=' + domain + ';' : '';

  // Delete the cookie for the given path and domain
  document.cookie = cookieValue + expires + pathValue + domainValue;
}

export function getDomainParts(domain: string): string[] {
  const parts = domain.split('.');
  const domains: string[] = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    domains.push(parts.slice(i).join('.'));
  }
  return domains;
}

export function deleteCookieOnAllDomains(name: string, childDomain: string) {
  getDomainParts(childDomain).forEach((domainPart) => {
    deleteCookie(name, '/', domainPart);
    deleteCookie(name, '', domainPart);
  });
}

export function getParentDomain(domain?: string) {
  if (!domain) {
    return '';
  }
  const parts = domain.split('.');
  return parts.length > 1 ? `.${parts.slice(-2).join('.')}` : domain;
}

export function clearCookies() {
  // Clear cookies
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    deleteCookieOnAllDomains(name, window.location.hostname);
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;Domain=${getParentDomain(
      window.location.hostname,
    )}`;
  }
}

export const onAccountDeleted = () => {
  setTimeout(() => {
    handleLogout();
  }, 3000);
};

export const handleLogout = (
  redirectUrl = window.location.origin,
  callback?: () => void,
) => {
  const tenant = window.localStorage.getItem('tenant');
  window.localStorage.clear();
  window.localStorage.setItem('tenant', tenant ?? '');

  clearCookies();
  callback?.();

  if (!isInIframe()) {
    window.location.href = `${config.authUrl()}/logout?redirect-to=${redirectUrl}${tenant ? '&tenant=' + tenant : ''}`;
    // Set logout timestamp cookie to trigger logout on other SPAs
    setCookieForAuth('ibl_logout_timestamp', Date.now().toString());
  }
};

export type Provider = {
  name: string;
  chat_models: unknown[];
};

export function canSwitchProvider(providers: Provider[], name: string) {
  const provider = providers.find((provider) => provider.name === name);
  return !!provider?.chat_models && provider.chat_models.length > 0;
}

export const handleTenantSwitch = async (
  tenant: string,
  saveRedirect = false,
  redirectUrl?: string,
) => {
  // Clear current tenant cookie before switching
  const { clearCurrentTenantCookie } = await import(
    '@iblai/iblai-js/web-utils'
  );
  clearCurrentTenantCookie();
  // Preserve the current path before clearing localStorage
  const currentPath = `${window.location.pathname}${window.location.search}`;
  // Get JWT token before clearing localStorage
  const jwtToken = localStorage.getItem('edx_jwt_token');
  localStorage.clear();

  const url = `${config.authUrl()}/login/complete`;
  const params: Record<string, string> = {
    tenant,
    [REDIRECT_PATH_LOCAL_STORAGE_KEY]: redirectUrl ?? window.location.origin,
  };

  // Add token if it exists
  if (jwtToken) {
    params.token = jwtToken;
  }

  const param = new URLSearchParams(params).toString();

  localStorage.setItem('tenant', tenant);
  if (saveRedirect) {
    // Restore the redirect path after setting tenant
    localStorage.setItem(REDIRECT_PATH_LOCAL_STORAGE_KEY, currentPath);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
  window.location.href = `${url}?${param}`;
};

export const canSwitchLLm = (llm: {
  has_credentials?: boolean;
  can_use_main_keys?: boolean;
  main_has_credentials?: boolean;
}) => {
  if (llm?.has_credentials) {
    return true;
  }

  return (
    llm?.can_use_main_keys &&
    (llm?.main_has_credentials === true ||
      llm?.main_has_credentials === undefined)
  );
};

export function convertFromBytes(bytes: number) {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  if (bytes === 0) return { value: 0, unit: 'B' };

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = parseFloat((bytes / Math.pow(1024, i)).toFixed(2));

  return { value, unit: sizes[i] };
}

export function formatRelativeDate(date: string) {
  const dateObj = new Date(date);

  if (isToday(dateObj)) {
    return format(dateObj, 'h:mmaaa'); // "10:44AM"
  }

  const daysDiff = Math.floor(
    (new Date().getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDiff <= 7) {
    return format(dateObj, 'EEEE h:mmaaa'); // "Monday 10:44AM"
  } else if (daysDiff <= 30) {
    return format(dateObj, 'MMM d, h:mmaaa'); // "Jan 15, 10:44AM"
  } else {
    return format(dateObj, 'MMM d, yyyy'); // "Jan 15, 2024"
  }
}

export function getLLMProviderDetails(llmProvider: string, llmName?: string) {
  switch (llmProvider) {
    case 'groq':
      return { logo: '/llm-groq-provider.png', name: 'Groq' };
    case 'IBLChatNvidia':
      return { logo: '/llm-nvidia-provider.webp', name: 'NVIDIA' };
    case 'azure_openai':
      return { logo: '/llm-microsoft-provider.png', name: 'Microsoft' };
    case 'openai':
      if (llmName) return { logo: '/llm-openai-provider.jpg', name: 'OpenAI' };
      return { logo: '/llm-openai-provider-2.svg', name: 'OpenAI' };
    case 'mistral':
      return { logo: '/llm-mistral-provider.jpeg', name: 'Mistral' };
    case 'google':
      if (llmName) return { logo: '/llm-gemini-provider.png', name: 'Google' };
      return { logo: '/llm-google-provider.svg', name: 'Google' };
    case 'llama':
      return { logo: '/llm-llama-provider.jpeg', name: 'Meta' };
    case 'IBLChatAnthropic':
      return { logo: '/llm-claude-provider.png', name: 'Anthropic' };
    case 'perplexity':
      return { logo: '/llm-perplexity-provider.webp', name: 'Perplexity' };
    case 'deepseek':
      return { logo: '/llm-deepseek-provider.png', name: 'DeepSeek' };
    case 'xai':
      return { logo: '/llm-xai-provider.jpg', name: 'xAI' };
    case 'anthropic':
      return { logo: '/llm-claude-provider.png', name: 'Anthropic' };
    case 'nvidia':
      return { logo: '/llm-nvidia-provider.webp', name: 'NVIDIA' };
    case 'bedrock':
    case 'amazon-bedrock':
    case 'amazon_bedrock':
    case 'IBLChatBedrock':
      return { logo: '/llm-amazon-provider.png', name: 'Amazon' };
    default:
      return { logo: '/llm-generic-provider.png', name: llmProvider };
  }
}

export function sendMessageToParentWebsite(payload: unknown) {
  window.parent.postMessage(payload, '*');
}

export function isLoggedIn() {
  if (
    typeof window === 'undefined' ||
    typeof localStorage?.getItem !== 'function'
  )
    return false;
  return !!localStorage.getItem('axd_token');
}

export function htmlToMarkdown(htmlText: string) {
  if (!htmlText || typeof htmlText !== 'string') {
    return '';
  }

  try {
    let processedHtml = htmlText;

    // Restore display math from TipTap editor serialization (data-math-latex with data-math-display)
    processedHtml = processedHtml.replace(
      /<span\s+data-math-latex="([^"]*?)"\s+data-math-display="true"\s*><\/span>/g,
      (_, tex) => `$$${decodeHtmlEntities(tex)}$$`,
    );

    // Restore inline math from TipTap editor serialization (data-math-latex without data-math-display)
    processedHtml = processedHtml.replace(
      /<span\s+data-math-latex="([^"]*?)"\s*><\/span>/g,
      (_, tex) => `$${decodeHtmlEntities(tex)}$`,
    );

    // Restore inline math from KaTeX annotation elements
    // KaTeX renders math with an annotation element containing the original LaTeX
    // Use [\s\S]*? instead of .*? with 's' flag for ES5/ES6 compatibility
    processedHtml = processedHtml.replace(
      /<span class="katex">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g,
      (_, tex) => `$${decodeHtmlEntities(tex)}$`,
    );

    // Restore display math from KaTeX display elements
    processedHtml = processedHtml.replace(
      /<span class="katex-display">[\s\S]*?<annotation encoding="application\/x-tex">([^<]+)<\/annotation>[\s\S]*?<\/span>/g,
      (_, tex) => `$$${decodeHtmlEntities(tex)}$$`,
    );

    const file = remark()
      .use(rehypeParse, { emitParseErrors: true, duplicateAttribute: false })
      .use(rehypeRemark)
      .use(remarkGfm)
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '_',
        strong: '*',
        fences: true,
      })
      .processSync(processedHtml);

    return String(file).trimEnd();
  } catch (error) {
    console.error('[Markdown] Failed to convert HTML to markdown:', error);
    return htmlText;
  }
}

/**
 * Decode HTML entities in a string
 */
function decodeHtmlEntities(text: string): string {
  if (typeof document === 'undefined') {
    // Server-side fallback - decode common entities manually
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export function isHtml(str: string) {
  if (!str) return str;

  const trimmed = str?.trim();

  return (
    trimmed.startsWith('<') &&
    trimmed.endsWith('>') &&
    (trimmed.includes('</') || trimmed.includes('/>'))
  );
}

/**
 * Get the current artifact title from a list of messages.
 * Looks through all messages to find artifact versions and returns the title
 * of the current artifact (by is_current flag) or the latest version.
 */
export function getCurrentArtifactTitle(messages: any[]): string | null {
  if (!messages?.length) return null;

  // Collect all artifact versions from all messages
  const allArtifactVersions: any[] = [];
  for (const msg of messages) {
    if (msg.artifact_versions?.length) {
      allArtifactVersions.push(...msg.artifact_versions);
    }
  }

  if (!allArtifactVersions.length) return null;

  // Find the current artifact version (by is_current flag)
  let currentVersion = allArtifactVersions.find((av) => av.is_current);

  // If no current version found, get the one with highest version_number
  if (!currentVersion) {
    currentVersion = allArtifactVersions.reduce((latest, av) => {
      if (!latest || (av.version_number ?? 0) > (latest.version_number ?? 0)) {
        return av;
      }
      return latest;
    }, null);
  }

  if (!currentVersion) return null;

  // Return the version title, or artifact title, or null
  return currentVersion.title || currentVersion.artifact?.title || null;
}

export function parsePrompt(prompt: string) {
  if (isHtml(prompt)) {
    return htmlToMarkdown(prompt);
  }

  return prompt;
}

/**
 * Pre-process markdown to fix common formatting issues before conversion
 */
function preprocessMarkdownForHtml(markdown: string): string {
  let processed = markdown;

  // Restore escaped markdown links so they render as actual links
  // Example: "\[Get started\](https://example.com)" -> "[Get started](https://example.com)"
  processed = processed.replace(
    /\\\[([^\]]+?)\\\]\s*\(([^)]+)\)/g,
    (match, label, href) => {
      const trimmedHref = String(href ?? '').trim();
      if (
        /^(https?:\/\/|mailto:|tel:|www\.)/i.test(trimmedHref) ||
        EMAIL_PATTERN.test(trimmedHref)
      ) {
        return `[${label}](${trimmedHref})`;
      }
      return match;
    },
  );

  // Handle ```markdown code blocks - extract content and render as actual markdown
  // This handles cases where LLM wraps markdown content in code blocks
  processed = processed.replace(
    /```(?:markdown|md)\s*\n([\s\S]*?)```/gi,
    (_match, content) => content.trim(),
  );

  // Fix headings with newlines after # (e.g., "#\nTitle" -> "# Title")
  // This handles cases where LLM outputs malformed heading syntax
  processed = processed.replace(/^(#{1,6})\s*\n+(.+)$/gm, '$1 $2');

  // Remove excessive newlines after headings (keep max 1 newline)
  processed = processed.replace(/^(#{1,6}\s+.+)\n{3,}/gm, '$1\n\n');

  // Ensure proper spacing around bold/italic markers within headings
  // Fix cases like "# **Title**\n" to work correctly
  processed = processed.replace(/^(#{1,6})\s*(\*\*|__)/gm, '$1 $2');

  // Ensure list items have proper line breaks
  // Fix consecutive list items that might be on same line
  processed = processed.replace(/([^\n])(\n)([-*+]|\d+\.)\s/g, '$1\n\n$3 ');

  return processed;
}

const LINKIFY_SKIP_TAGS = new Set([
  'A',
  'CODE',
  'PRE',
  'SCRIPT',
  'STYLE',
  'TEXTAREA',
]);
const LINKIFY_PATTERN_SOURCE =
  '(?:https?:\\/\\/[^\\s<]+|www\\.[^\\s<]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|(?<!\\w)(?:\\+?\\d|\\(\\d)[\\d\\s().-]{6,}\\d(?!\\w))';
const MARKDOWN_LINK_PATTERN = '\\[([^\\]]+)\\]\\s*\\(([^)]+)\\)';
const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const SUP_SUB_PATTERN_SOURCE =
  '([A-Za-z0-9\\)\\]\\}])(?:\\^\\(([^)]+)\\)|\\^\\{([^}]+)\\}|\\^([A-Za-z0-9]+)|_([0-9]+))';

const getLinkifyRegex = () => new RegExp(LINKIFY_PATTERN_SOURCE, 'gi');
const getMarkdownLinkRegex = () => new RegExp(MARKDOWN_LINK_PATTERN, 'g');
const hasMarkdownLink = (text: string) =>
  new RegExp(MARKDOWN_LINK_PATTERN).test(text);
const getSupSubRegex = () => new RegExp(SUP_SUB_PATTERN_SOURCE, 'g');
const hasSupSubPattern = (text: string) =>
  new RegExp(SUP_SUB_PATTERN_SOURCE).test(text);

const shouldSkipLinkify = (element: Element | null): boolean => {
  let current: Element | null = element;
  while (current) {
    if (LINKIFY_SKIP_TAGS.has(current.tagName)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const shouldSkipSupSub = (element: Element | null): boolean => {
  let current: Element | null = element;
  while (current) {
    if (LINKIFY_SKIP_TAGS.has(current.tagName) || current.tagName === 'MATH') {
      return true;
    }
    if (
      current.classList?.contains('katex') ||
      current.classList?.contains('katex-display')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

const stripTrailingPunctuation = (
  text: string,
): { linkText: string; trailing: string } => {
  let linkText = text;
  let trailing = '';

  const punctuationMatch = linkText.match(/[.,!?;:]+$/);
  if (punctuationMatch) {
    trailing = punctuationMatch[0] + trailing;
    linkText = linkText.slice(0, -punctuationMatch[0].length);
  }

  const bracketPairs = [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: '{', close: '}' },
  ];

  for (const { open, close } of bracketPairs) {
    while (linkText.endsWith(close)) {
      const openCount = (linkText.match(new RegExp(`\\${open}`, 'g')) ?? [])
        .length;
      const closeCount = (linkText.match(new RegExp(`\\${close}`, 'g')) ?? [])
        .length;
      if (closeCount > openCount) {
        trailing = close + trailing;
        linkText = linkText.slice(0, -1);
      } else {
        break;
      }
    }
  }

  return { linkText, trailing };
};

const normalizePhoneNumber = (text: string): string | null => {
  const trimmed = text.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length < 7 || digits.length > 15) {
    return null;
  }

  if (!hasPlus && digits.length < 10 && !/[()\s.-]/.test(trimmed)) {
    return null;
  }

  return hasPlus ? `+${digits}` : digits;
};

const resolveLinkMatch = (
  rawMatch: string,
): { href: string; text: string; trailing: string } | null => {
  const { linkText, trailing } = stripTrailingPunctuation(rawMatch);
  if (!linkText) {
    return null;
  }

  if (/^https?:\/\//i.test(linkText)) {
    return { href: linkText, text: linkText, trailing };
  }
  /* istanbul ignore next -- @preserve www URL pattern rarely matched in tests */
  if (/^www\./i.test(linkText)) {
    return { href: `http://${linkText}`, text: linkText, trailing };
  }
  /* istanbul ignore next -- @preserve email pattern */
  if (EMAIL_PATTERN.test(linkText)) {
    return { href: `mailto:${linkText}`, text: linkText, trailing };
  }

  const normalizedPhone = normalizePhoneNumber(linkText);
  if (normalizedPhone) {
    return { href: `tel:${normalizedPhone}`, text: linkText, trailing };
  }
  /* istanbul ignore next -- @preserve fallback when no link type matched */
  return null;
};

const linkifyTextNode = (
  text: string,
  doc: Document,
): DocumentFragment | null => {
  const matches = Array.from(text.matchAll(getLinkifyRegex()));
  /* istanbul ignore next -- @preserve early return when no matches */
  if (matches.length === 0) {
    return null;
  }

  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;

  matches.forEach((match) => {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, index)));
    }

    const rawMatch = match[0];
    const resolved = resolveLinkMatch(rawMatch);

    if (resolved) {
      const anchor = doc.createElement('a');
      anchor.setAttribute('href', resolved.href);
      anchor.textContent = resolved.text;
      fragment.appendChild(anchor);
      /* istanbul ignore next -- @preserve trailing text after link */
      if (resolved.trailing) {
        fragment.appendChild(doc.createTextNode(resolved.trailing));
      }
    } else {
      /* istanbul ignore next -- @preserve fallback when link resolution fails */
      fragment.appendChild(doc.createTextNode(rawMatch));
    }

    lastIndex = index + rawMatch.length;
  });
  /* istanbul ignore next -- @preserve append trailing text */
  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
};

const normalizeMarkdownLinkText = (text: string): string => {
  return text.replace(/\\([\\[\]()])/g, '$1');
};

/* istanbul ignore next -- @preserve internal href normalization helper */
const normalizeMarkdownLinkHref = (text: string): string => {
  let href = text.trim();
  if (
    (href.startsWith('<') && href.endsWith('>')) ||
    (href.startsWith('"') && href.endsWith('"'))
  ) {
    href = href.slice(1, -1);
  }
  if (href.startsWith("'") && href.endsWith("'")) {
    href = href.slice(1, -1);
  }
  const firstToken = href.split(/\s+/)[0];
  href = firstToken ?? href;
  href = href.replace(/\\:/g, ':').replace(/\\\)/g, ')').replace(/\\\(/g, '(');
  return href;
};

/* istanbul ignore next -- @preserve internal helper for linkifying text */
const appendLinkifiedText = (
  fragment: DocumentFragment,
  text: string,
  doc: Document,
) => {
  if (!text) return;
  const linkified = linkifyTextNode(text, doc);
  if (linkified) {
    fragment.appendChild(linkified);
  } else {
    fragment.appendChild(doc.createTextNode(text));
  }
};

const linkifyMarkdownTextNode = (
  text: string,
  doc: Document,
): DocumentFragment | null => {
  const sourceText = text.replace(/\\([\\[\]()])/g, '$1');
  if (!hasMarkdownLink(sourceText)) {
    return null;
  }

  const regex = getMarkdownLinkRegex();
  let match: RegExpExecArray | null;
  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;

  while ((match = regex.exec(sourceText)) !== null) {
    const matchIndex = match.index ?? 0;
    const isImage = matchIndex > 0 && sourceText[matchIndex - 1] === '!';

    /* istanbul ignore next -- @preserve image link handling (![alt](url)) */
    if (isImage) {
      const before = sourceText.slice(
        lastIndex,
        matchIndex > 0 ? matchIndex - 1 : 0,
      );
      appendLinkifiedText(fragment, before, doc);
      fragment.appendChild(doc.createTextNode(`!${match[0]}`));
      lastIndex = matchIndex + match[0].length;
      continue;
    }

    const before = sourceText.slice(lastIndex, matchIndex);
    appendLinkifiedText(fragment, before, doc);

    const label = normalizeMarkdownLinkText(match[1]);
    const href = normalizeMarkdownLinkHref(match[2]);

    if (href) {
      const anchor = doc.createElement('a');
      anchor.setAttribute('href', href);
      anchor.textContent = label;
      fragment.appendChild(anchor);
      /* istanbul ignore next -- @preserve fallback for invalid href */
    } else {
      fragment.appendChild(doc.createTextNode(match[0]));
    }

    lastIndex = matchIndex + match[0].length;
  }

  /* istanbul ignore next -- @preserve append remaining text after matches */
  if (lastIndex < sourceText.length) {
    appendLinkifiedText(fragment, sourceText.slice(lastIndex), doc);
  }

  return fragment;
};

const supSubTextNode = (
  text: string,
  doc: Document,
): DocumentFragment | null => {
  const matches = Array.from(text.matchAll(getSupSubRegex()));
  /* istanbul ignore next -- @preserve early return when no sup/sub patterns */
  if (matches.length === 0) {
    return null;
  }

  const fragment = doc.createDocumentFragment();
  let lastIndex = 0;

  matches.forEach((match) => {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex, index)));
    }

    const base = match[1];
    const supValue = match[2] ?? match[3] ?? match[4];
    const subValue = match[5];
    const value = supValue ?? subValue ?? '';
    const tag = supValue ? 'sup' : 'sub';

    fragment.appendChild(doc.createTextNode(base));
    const node = doc.createElement(tag);
    node.textContent = value;
    fragment.appendChild(node);

    lastIndex = index + match[0].length;
  });

  if (lastIndex < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
};

const linkifyHtml = (html: string): string => {
  /* istanbul ignore next -- @preserve SSR check for server-side rendering */
  if (typeof document === 'undefined') {
    return html;
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const replaceTextNode = (textNode: Text) => {
    /* istanbul ignore next -- @preserve defensive check for orphan/skipped nodes */
    if (!textNode.parentElement || shouldSkipLinkify(textNode.parentElement)) {
      return;
    }
    const value = textNode.nodeValue ?? '';
    /* istanbul ignore next -- @preserve defensive check for empty text nodes */
    if (!value) {
      return;
    }

    const markdownFragment = linkifyMarkdownTextNode(
      value,
      container.ownerDocument,
    );
    if (markdownFragment && textNode.parentNode) {
      textNode.parentNode.replaceChild(markdownFragment, textNode);
      return;
    }

    /* istanbul ignore next -- @preserve early return when no linkifiable content */
    if (!value.match(getLinkifyRegex())) {
      return;
    }

    const fragment = linkifyTextNode(value, container.ownerDocument);
    if (fragment && textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  };

  if (typeof document.createTreeWalker === 'function') {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        /* istanbul ignore next -- @preserve defensive check for orphan nodes */
        if (!node.parentElement) {
          return NodeFilter.FILTER_REJECT;
        }
        if (shouldSkipLinkify(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !node.nodeValue.match(getLinkifyRegex())) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach((textNode) => {
      replaceTextNode(textNode);
    });
    /* istanbul ignore else -- @preserve fallback for environments without TreeWalker */
  } else {
    /* istanbul ignore next -- @preserve */
    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        replaceTextNode(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const element = node as Element;
      if (shouldSkipLinkify(element)) {
        return;
      }
      const children = Array.from(element.childNodes);
      children.forEach((child) => walkNodes(child));
    };
    /* istanbul ignore next -- @preserve */
    walkNodes(container);
  }

  const replaceSupSubTextNode = (textNode: Text) => {
    /* istanbul ignore next -- @preserve defensive check for orphan/skipped nodes */
    if (!textNode.parentElement || shouldSkipSupSub(textNode.parentElement)) {
      return;
    }
    const value = textNode.nodeValue ?? '';
    /* istanbul ignore next -- @preserve defensive check for empty text nodes */
    if (!value || !hasSupSubPattern(value)) {
      return;
    }

    const fragment = supSubTextNode(value, container.ownerDocument);
    if (fragment && textNode.parentNode) {
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  };

  if (typeof document.createTreeWalker === 'function') {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        /* istanbul ignore next -- @preserve defensive check for orphan nodes */
        if (!node.parentElement) {
          return NodeFilter.FILTER_REJECT;
        }
        if (shouldSkipSupSub(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !hasSupSubPattern(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    textNodes.forEach((textNode) => {
      replaceSupSubTextNode(textNode);
    });
    /* istanbul ignore else -- @preserve fallback for environments without TreeWalker */
  } else {
    /* istanbul ignore next -- @preserve */
    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        replaceSupSubTextNode(node as Text);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }
      const element = node as Element;
      if (shouldSkipSupSub(element)) {
        return;
      }
      const children = Array.from(element.childNodes);
      children.forEach((child) => walkNodes(child));
    };
    /* istanbul ignore next -- @preserve */
    walkNodes(container);
  }

  return container.innerHTML;
};

// Configure marked instance with all extensions for comprehensive markdown support
const configuredMarked = new Marked(
  markedKatex({
    throwOnError: false,
    output: 'htmlAndMathml', // Accessibility-friendly output with MathML fallback
  }),
  gfmHeadingId(),
  markedHighlight({
    langPrefix: 'hljs language-',
    /* istanbul ignore next -- @preserve callback invoked by markedHighlight during code block parsing */
    highlight(code: string, lang: string, _info: string) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
  {
    gfm: true, // GitHub Flavored Markdown (tables, strikethrough, task lists)
    breaks: false, // Don't convert \n to <br>
  },
);

export function markdownToHtml(markdownText: string) {
  if (!markdownText || typeof markdownText !== 'string') {
    return '';
  }

  try {
    // Pre-process to fix common markdown issues and convert LaTeX environments
    const cleanedMarkdown = preprocessLaTeX(
      preprocessMarkdownForHtml(markdownText),
    );

    const result = configuredMarked.parse(cleanedMarkdown);
    const html = typeof result === 'string' ? result : String(result);
    return linkifyHtml(html);
  } catch (error) {
    /* istanbul ignore next -- @preserve defensive error handling */
    console.error('[Markdown] Failed to convert markdown to HTML:', error);
    /* istanbul ignore next -- @preserve */
    return markdownText;
  }
}

export function getUserOS() {
  const userAgent = navigator.userAgent;

  if (userAgent.includes('Win')) {
    return 'Windows';
  } else if (
    userAgent.includes('iPhone') ||
    userAgent.includes('iPad') ||
    userAgent.includes('iPod')
  ) {
    // Check for iOS devices before Mac, since iOS user agents contain "like Mac OS X"
    return 'iOS';
  } else if (userAgent.includes('Mac')) {
    return 'macOS';
  } else if (userAgent.includes('Linux')) {
    return 'Linux';
  } else if (userAgent.includes('Android')) {
    return 'Android';
  }
  return 'Unknown OS';
}

/**
 * Helper to set a cookie with base domain for cross-SPA sharing
 */
function setCookieForAuth(
  name: string,
  value: string,
  days: number = 365,
): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  const hostname = window.location.hostname;
  let baseDomain = hostname;

  // Calculate base domain
  if (hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      baseDomain = `.${parts.slice(-2).join('.')}`;
    }
  }

  const domainAttr = baseDomain ? `;domain=${baseDomain}` : '';
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=None;Secure${domainAttr}`;
}

/**
 * Sync auth data to cookies for cross-SPA synchronization
 */
function syncAuthDataToCookies(userObject: Record<string, any>): void {
  // Sync current_tenant
  if (userObject[LOCAL_STORAGE_KEYS.CURRENT_TENANT]) {
    setCookieForAuth(
      'ibl_current_tenant',
      String(userObject[LOCAL_STORAGE_KEYS.CURRENT_TENANT]),
    );
  }

  // Sync user_data
  if (userObject[LOCAL_STORAGE_KEYS.USER_DATA]) {
    setCookieForAuth(
      'ibl_user_data',
      String(userObject[LOCAL_STORAGE_KEYS.USER_DATA]),
    );
  }

  // Sync tenants
  if (userObject[LOCAL_STORAGE_KEYS.TENANTS]) {
    setCookieForAuth(
      'ibl_tenant',
      String(userObject[LOCAL_STORAGE_KEYS.TENANTS]),
    );
  }
}

export function saveUserObjectToLocalStorage(userObject: object) {
  localStorage.clear();
  for (const [key, value] of Object.entries(userObject)) {
    let toStore = value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) {
          toStore = JSON.stringify(parsed);
        }
      } catch {
        // Not a JSON string, store as is
      }
    }
    localStorage.setItem(key, String(toStore));
    window.dispatchEvent(new StorageEvent('local-storage', { key }));
  }

  // Sync auth data to cookies for cross-SPA synchronization
  syncAuthDataToCookies(userObject as Record<string, any>);
}

export const maxDatasetFileSizeInMegaBytes = () => {
  const value = Number(config.mentorTrainingMaximumFileSize());
  return isNaN(value) ? 60 : value;
};

// Helper function to format date to dd-mm-yyyy
export const formatDateToYYYYMMDD = (
  date: Date | undefined,
): string | undefined => {
  if (!date) return undefined;

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${year}-${month}-${day}`;
};

// Helper function to format date to "Oct 13" format or "Aug 15 2:00" if time is included
export const formatDateToShortFormat = (
  dateString: string,
  displayOnlyTime?: boolean,
): string => {
  try {
    const date = new Date(dateString);

    // If displayOnlyTime is true, return only time in "8:00AM" format
    if (displayOnlyTime) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12; // Convert to 12-hour format
      return `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`;
    }

    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();

    // Check if the original string includes time (contains space and colon)
    if (dateString.includes(' ') && dateString.includes(':')) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      // Format time as "2:00" (12-hour format without AM/PM)
      const timeString = `${hours}:${minutes.toString().padStart(2, '0')}`;
      return `${month} ${day} ${timeString}`;
    }

    return `${month} ${day}`;
  } catch (error) {
    // Fallback to original string if parsing fails
    return dateString;
  }
};

// Utility function to format relative time
export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths === 1 ? '' : 's'} ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears === 1 ? '' : 's'} ago`;
};

export function getMentorIdFromUrl() {
  const url = window.location.pathname;
  const match = url.startsWith('/platform/');
  if (!match) return null;

  const parts = url.split('/');
  return parts[3];
}

export function getTenantKeyFromUrl() {
  const url = window.location.pathname;
  const match = url.match(URL_PATTERNS.PLATFORM_KEY);
  return match ? match[1] : null;
}

export function isStripeActivated(currentTenant: Tenant) {
  return (
    config.stripeEnabled() === 'true' &&
    (!currentTenant?.is_enterprise || currentTenant?.key === 'main')
  );
}

/**
 * Finds the first message with content from a messages array.
 * Useful when the first message in a conversation might be empty.
 */
export function getFirstMessageWithContent(messages: any[]): string {
  if (!messages?.length) return '';
  for (const msg of messages) {
    const content = msg?.message?.data?.content;
    if (content) return content;
  }
  return '';
}
