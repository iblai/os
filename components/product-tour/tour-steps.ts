import type { Step } from 'react-joyride';

import { isTourTargetVisible, TOUR_TARGET, tourSelector } from './tour-targets';

export type TourStepId =
  | 'prompt-input'
  | 'profile'
  | 'privacy-mode'
  | 'conversation-starters'
  | 'agents'
  | 'account';

export type TourStep = Step & { id: TourStepId };

/** The `productTour` message namespace, resolved by the caller. */
export type TourTranslate = (key: string) => string;

export type BuildTourStepsOptions = {
  /** Live admin (admin and not in User mode) — the same gate as the sidebar's admin tools. */
  isAdmin: boolean;
  t: TourTranslate;
};

/**
 * The tour opens on the chat input, then walks the navbar's profile menu and
 * privacy toggle, the conversation starters, the sidebar's Agents menu and
 * (admins only) the account tools in the sidebar footer.
 * Steps whose target isn't rendered are dropped by `filterVisibleTourSteps`.
 */
export function buildTourSteps({
  isAdmin,
  t,
}: BuildTourStepsOptions): TourStep[] {
  const steps: TourStep[] = [
    {
      id: 'prompt-input',
      target: tourSelector(TOUR_TARGET.promptInput),
      placement: 'top',
      title: t('promptInputTitle'),
      content: t('promptInputContent'),
    },
    {
      id: 'profile',
      target: tourSelector(TOUR_TARGET.profile),
      placement: 'bottom-end',
      title: t('profileTitle'),
      content: t('profileContent'),
    },
    {
      id: 'privacy-mode',
      target: tourSelector(TOUR_TARGET.privacyMode),
      placement: 'bottom-end',
      title: t('privacyModeTitle'),
      content: t('privacyModeContent'),
    },
    {
      id: 'conversation-starters',
      target: tourSelector(TOUR_TARGET.conversationStarters),
      placement: 'top',
      // The starters sit below the chat input and can be below the fold.
      skipScroll: false,
      title: t('conversationStartersTitle'),
      content: t('conversationStartersContent'),
    },
    {
      id: 'agents',
      target: tourSelector(TOUR_TARGET.agents),
      placement: 'right',
      // The sidebar is position: fixed.
      isFixed: true,
      title: t('agentsTitle'),
      content: t('agentsContent'),
    },
  ];

  if (isAdmin) {
    steps.push({
      id: 'account',
      target: tourSelector(TOUR_TARGET.account),
      placement: 'right-end',
      isFixed: true,
      title: t('accountTitle'),
      content: t('accountContent'),
    });
  }

  return steps;
}

/** Drop steps whose target isn't on the page, so "n of N" counts only real steps. */
export function filterVisibleTourSteps(steps: TourStep[]): TourStep[] {
  return steps.filter((step) => isTourTargetVisible(step.target));
}
