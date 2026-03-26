import { Page } from "@playwright/test";

/**
 * Seed localStorage with redirect parameters via page.addInitScript.
 * Runs before any page JavaScript, so values are available immediately.
 */
export async function seedRedirectParams(
  page: Page,
  params: {
    redirectTo?: string;
    redirectPath?: string;
    redirectToken?: string;
    selectedTenant?: string;
    app?: string;
  },
): Promise<void> {
  await page.addInitScript((p) => {
    if (p.redirectTo) localStorage.setItem("redirectTo", p.redirectTo);
    if (p.redirectPath) localStorage.setItem("redirectPath", p.redirectPath);
    if (p.redirectToken) localStorage.setItem("redirectToken", p.redirectToken);
    if (p.selectedTenant)
      localStorage.setItem("selected_tenant", p.selectedTenant);
    if (p.app) localStorage.setItem("app", p.app);
  }, params);
}

/**
 * Seed localStorage with mock authentication tokens.
 */
export async function seedAuthTokens(
  page: Page,
  tokens: {
    dmToken?: string;
    dmTokenExpires?: string;
    axdToken?: string;
    axdTokenExpires?: string;
    edxJwtToken?: string;
  },
): Promise<void> {
  await page.addInitScript((t) => {
    if (t.dmToken) localStorage.setItem("dm_token", t.dmToken);
    if (t.dmTokenExpires)
      localStorage.setItem("dm_token_expires", t.dmTokenExpires);
    if (t.axdToken) localStorage.setItem("axd_token", t.axdToken);
    if (t.axdTokenExpires)
      localStorage.setItem("axd_token_expires", t.axdTokenExpires);
    if (t.edxJwtToken) localStorage.setItem("edx_jwt_token", t.edxJwtToken);
  }, tokens);
}

/**
 * Seed the ibl_current_tenant cookie (URL-encoded JSON).
 */
export async function seedTenantCookie(
  page: Page,
  tenantData: { key: string; is_admin?: boolean; org?: string },
): Promise<void> {
  const baseURL =
    (page.context() as any)._options?.baseURL || "http://localhost:3000";
  const url = new URL(baseURL);
  await page.context().addCookies([
    {
      name: "ibl_current_tenant",
      value: encodeURIComponent(JSON.stringify(tenantData)),
      domain: url.hostname,
      path: "/",
    },
  ]);
}
