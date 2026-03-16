## You are a Playwright test generator and an expert in TypeScript, Frontend development, and Playwright end-to-end testing.

## Instructions

## You are given a scenario and you need to generate a Playwright test for it.
## If you're asked to generate or create a Playwright test, use the tools provided by the Playwright MCP server to navigate the site and generate tests based on the current state and site snapshots.
## Do not generate tests based on assumptions. Use the Playwright MCP server to navigate and interact with sites.
## Access page snapshot before interacting with the page.
## Only after all steps are completed, emit a Playwright TypeScript
## When you generate the test code in the 'tests' directory, ALWAYS follow Playwright best practices.
## When the test is generated, always test and verify the generated code using `npx playwright test` and fix it if there are any issues.
## always run test generated untill its all successful

## Context
- **Monorepo structure:** Mentor app codebase: `apps/mentor`; Auth SPA app: `apps/auth`; Web Containers package: `packages/web-containers`; Web Utils package: `packages/web-utils`
- **Test location:** `packages/playwright/tests/mentornextjs`
- **Review guidelines:** Follow `packages/playwright/PR_REVIEW_PROMPT.md`
- **Selector strategy:** Use `getByRole` selectors exclusively for all interactions
- **Use existing Playwright test patterns** from `packages/playwright/tests/mentornextjs`

## Test Configuration
- **Base URL:** `mentorai1.stg.iblai.app`
- **Auth URL:** `login.stg.iblai.app`
- 


---

## Initial Setup and User Registration Flow

Use the Playwright MCP server to navigate to the mentor app at `mentorai1.stg.iblai.app`. You'll be redirected to the auth SPA at `https://login.stg.iblai.app/login?app=mentor&redirect-to=https://mentorai.stg.iblai.app&logout=1`.

### login Steps:
1. Wait for the URL to contain `<baseUrl>/login`
2. Expect we are on the correct page by asserting:
- "Create your own mentor" heading is visible using `getByRole`
- Sign-up button is visible using `getByRole`
3. Click on the continue with password button
4. Assert that the following fields are visible using `getByRole`:
- Email field
- Password field
5. fill the email field with : `iblaiuserone@ibleducation.com`
6. fill the password  field with: `ibledu_2024`
7. Click on "Continue" button using `getByRole`
8. Wait until URL is in this format: `<base-url>/platform/<platform_key>/<mentor_unique_id>`

9. Assert that the user is an admin using the `checkAdminStatus` function from the test directory

---



## Test Suites (Scenarios)

## beforeeach test suite 
**steps:**
1. navigate to mentorai1.stg.iblai.app
2. wait for url to be in this format `<base-url>/platform/<platform_key>/<mentor_unique_id>` 
3. expect that more options button is visible
4. click on the more options button 
5. expect to see 5 menu items 
6. click on select a tenant 
7. we click on this `spa-tests-advertising`
8. we have to wait for the redirects to be complete and expect to be in a url of this form `<base-url>/platform/<platform_key>/<mentor_unique_id>`
9. expect that the url contains `spa-tests-advertising`
10. expect more options button to be visible 
11. click on the more option button 
12. get the menu item with text `spa-tests-advertising` and click on it 
13. expect a dialog that has text organization to be visible 
14. click on button Advanced 
15. get the public registration switch (not it should be a reg that checks just for public registration button note attached to it could be enabled or disabled).
16. expect that the switch is visible
17. do a check if the switch is enabled already no click should be made and if its disabled click on it and expect its enabled 
18. get the button with text Close 
19. expect its visible click on it and expect that the dialog isnt visible 
20. click on the select mentor dropdown button 
21. expect settings menuitem is visible then click on it 
22. expect a dialog should pop up that has text Edit mentor 
23. expect conbobox who can view should be visible then click on it 
24. select option Anyone
25. expect combobox who can chat should be visible then click on it
26. select option authenticated user
27. expect save button to be visible 
28. click on save button 
29. click on close button and expect dialog not to be visible
30. get the url of the page

NOte : for the test suite below use `test.use({
  storageState: undefined
});` for us to have a new user session

### Test Suite 1: user can access this mentor
**Steps:**
- navigate to the url gotten from line 30 
- wait until page is fully loaded
- expect Log in button to be visible 
- expect sign up free button is visible
- expect invite user, new mentor, mentors, new chat, notifications, analytics, settings button are visible
- we have a button thats either open sidebar or close sidebar using reg we are getting sidebar if the button full text is open sidebar click on the button and expect its text to be close sidebar and if its close sidebar we arent performing any action
- when we highlight on mentors we expect that `all elements in this outerhtml are visible thats the text and button <div class="space-y-1.5"><h3 class="text-gray-900 font-medium">Try advanced features for free</h3><p class="text-sm text-gray-600">Get better responses, create mentors with your data, and more by logging in.</p><div class="mt-4 flex space-x-2"><button data-slot="button" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*='size-'])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 has-[&gt;svg]:px-3 ibl-button-primary">Log in</button><button data-slot="button" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*='size-'])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 px-4 py-2 has-[&gt;svg]:px-3">Sign up for free</button></div></div>`

---

### Test Suite 2: user can login to this mentor
**Steps:**
-navigate to the url gotten from line 30 
- wait until page is fully loaded
- expect Log in button to be visible
- click on the login button 
- Wait for the URL to contain `<baseUrl>/login`
- Expect we are on the correct page by asserting:
- "Create your own mentor" heading is visible using `getByRole`
- Sign-up button is visible using `getByRole`
- Click on the sign-up button using `getByRole`
- Assert that the URL contains `<baseUrl>/account/create` (e.g., `https://login.stg.iblai.app/account/create?app=mentor&redirect-to=https%3A%2F%2Fmentorai.stg.iblai.app&logout=1`)
- Assert we are on the sign-up page by expecting:
- Login button is visible using `getByRole`
- "Continue with password" button is visible using `getByRole`
-Click on "Continue with password" button using `getByRole`
- Assert that the following fields are visible using `getByRole`:
- Email field
- Password field
- Confirm password field
- Provide a randomly generated email to fill the email field
- For the password and confirm password fields use: `ibledu_2024`
- Click on "Create account" button using `getByRole`
- Wait until URL is in this format: `<base-url>/platform/<platform_key>/<mentor_unique_id>`
-wait for page to be fully loaded
-. Assert that the user is not an admin using the `checkAdminStatus` function from the test directory
- get the text area and fill hello 
- expect that the user message is visible
- wait until the mentor response and its not empty


---

## Implementation Notes
- Use `getByRole` selectors for all element interactions
- When selecting mentors from a list, use random selection
- Generate unique random email for each test user
- Follow existing test patterns from `packages/playwright/tests/mentornextjs`
- Reference `packages/playwright/PR_REVIEW_PROMPT.md` for code review standards
- Ensure proper wait conditions for async operations (mentor responses, page navigations)
- Use the `checkAdminStatus` function from the test directory to verify non-admin status