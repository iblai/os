'use client';

import { useTranslations } from 'next-intl';
import type { LLMTabLabels } from '@iblai/iblai-js/web-containers/next';

/**
 * The OS wording for the SDK's LLM Selection dialog (`LLMProviderModal`): the
 * `modalsLlmProviderModal` strings, shipped in all four locales, mapped onto the
 * SDK's label contract (parameterised slots are ICU messages here, functions
 * there). Shared by the LLM tab and the Code agent model picker, so the dialog
 * reads identically wherever it opens.
 */
export function useLlmProviderModalLabels(): LLMTabLabels['providerModal'] {
  const tProviderModal = useTranslations('modalsLlmProviderModal');
  return {
    title: tProviderModal('title'),
    description: (providerName) =>
      tProviderModal('dialogDescription', { providerName }),
    searchPlaceholder: tProviderModal('searchPlaceholder'),
    // OS calls this string the modal's "subtitle"; the SDK calls it helpText.
    helpText: tProviderModal('subtitle'),
    providerIconAlt: (providerName) =>
      tProviderModal('providerIconAlt', { providerName }),
    tooLargeTitle: tProviderModal('tooLargeTitle'),
    tooLargeDescription: (modelName, modelSize) =>
      tProviderModal('tooLargeDescription', { modelName, modelSize }),
    cancel: tProviderModal('cancel'),
    downloadAnyway: tProviderModal('downloadAnyway'),
    alreadyDownloadingTitle: tProviderModal('alreadyDownloadingTitle'),
    unnamedModel: tProviderModal('unnamedModel'),
    alreadyDownloadingDescription: (modelName) =>
      tProviderModal('alreadyDownloadingDescription', { modelName }),
    gotIt: tProviderModal('gotIt'),
    announceDownloaded: (modelName) =>
      tProviderModal('announceDownloaded', { modelName }),
    announceCancelled: tProviderModal('announceCancelled'),
    announceFailed: tProviderModal('announceFailed'),
    announceStarted: (modelName) =>
      tProviderModal('announceStarted', { modelName }),
    localModel: {
      onDevice: tProviderModal('localModel.onDevice'),
      starting: tProviderModal('localModel.starting'),
      cancel: tProviderModal('localModel.cancel'),
      inUse: tProviderModal('localModel.inUse'),
      downloadFailedRetry: tProviderModal('localModel.downloadFailedRetry'),
      ariaDownload: (modelName, modelSize) =>
        tProviderModal('localModel.ariaDownload', { modelName, modelSize }),
      ariaStarting: (modelName) =>
        tProviderModal('localModel.ariaStarting', { modelName }),
      ariaDownloading: (modelName, percent) =>
        tProviderModal('localModel.ariaDownloading', { modelName, percent }),
      ariaInstalled: (modelName) =>
        tProviderModal('localModel.ariaInstalled', { modelName }),
      ariaSelected: (modelName) =>
        tProviderModal('localModel.ariaSelected', { modelName }),
      ariaError: (modelName) =>
        tProviderModal('localModel.ariaError', { modelName }),
      ariaErrorWithReason: (modelName, reason) =>
        tProviderModal('localModel.ariaErrorWithReason', {
          modelName,
          reason,
        }),
    },
  };
}
