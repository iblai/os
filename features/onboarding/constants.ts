// The sector catalog now ships with the SDK onboarding wizard — import
// ONBOARDING_SECTORS / getSectorById from '@iblai/iblai-js/web-containers' if
// needed. Only the app-side gating / persistence glue remains here.

/** Bump when the persisted onboarding metadata shape changes. */
export const ONBOARDING_METADATA_VERSION = 1;

/** Key under the user's platform metadata where onboarding state is stored. */
export const ONBOARDING_METADATA_KEY = 'onboarding';

/**
 * localStorage key (namespaced per platform) used as a fast-path so the gate can
 * short-circuit without re-hitting the API once onboarding is done/dismissed.
 * The API metadata remains the source of truth.
 */
export const onboardingDoneStorageKey = (tenantKey: string) =>
  `ibl_onboarding_done:${tenantKey}`;

/**
 * Routes where the onboarding overlay must never appear (auth / public / utility
 * routes). The gate also requires an authenticated admin, so this is defense in
 * depth.
 */
export const ONBOARDING_SKIP_ROUTES =
  /^\/(sso-login|mobile-sso-login|share|error|version|uploads|google-oauth-callback|provider-association|mobile)(\/|$)/;
