// `OnboardingSector` now ships with the SDK wizard
// (`@iblai/iblai-js/web-containers`). Only the app-side answer + persisted
// metadata shapes remain here.

/** Answers collected across the wizard steps. */
export interface OnboardingAnswers {
  organizationName: string;
  /** Selected sector id, or null until chosen. */
  sector: string | null;
}

/** Shape persisted under the user's platform metadata `onboarding` key. */
export interface OnboardingMetadata {
  version: number;
  completed: boolean;
  organization_name: string;
  sector: string | null;
  completed_at: string;
}
