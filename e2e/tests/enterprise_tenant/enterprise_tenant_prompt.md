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
Use the Playwright MCP server to navigate to the mentor app at `mentorai.stg.iblai.app`. You'll be redirected to the auth SPA at `https://login.stg.iblai.app/login?app=mentor&redirect-to=https://mentorai.stg.iblai.app&logout=1`.
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
### Test Suite 1: platform logo
**Steps:**
-  wait until the page is fully loaded and the loader isnt visible 
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory
- assert that user can open the sidebar and close it (get button with reg sidebar, if the full text is open sidebar then clicking on it should chnage to close sidebar and if its close sidebar clicking on it should open sidebar and the button text should be open )
### Test Suite 2: platform logo
**Steps:**
-wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory 
- get button with reg sidebar ( the aim here is to open the side bar if the side bar is close (it will have button text name as open sidebar) we click on it for the side bar to be open and assert its open when the button name changes to close sidebar and if the sidebar is already open we perform no action);
- we get button with name logo and expect to be visible 
- click on the logo 
- clicking the logo should redirect to the home page (having existing chats for this we assert that the mentor response div is visible (take this locator from the chat.spec file, and if there is no existing chat we assert the explore mentors heading is visible ))
---
## test suite 3: New chat
-wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory 
-get button new chat expect to be visible and click on it 
- wait for page and network to be completed 
- assert that the explore mentors heading is visible 
- expect mentors button is visible 
- click on each of this button in order (mentors, notifications button (in the sidebar),analytics ) button 
- expect that the url to have this format respectively <https://mentorai2.stg.iblai.app/platform/spa-tests/4be48987-07ab-4fe5-a097-ca99e5959b78/explore>, <https://mentorai2.stg.iblai.app/platform/spa-tests/4be48987-07ab-4fe5-a097-ca99e5959b78/notifications>, <https://mentorai2.stg.iblai.app/platform/spa-tests/4be48987-07ab-4fe5-a097-ca99e5959b78/analytics>
- click on the new chat button and assert that the explore heading is visible 
## test suite 4: New mentor creation from the sidebar
-wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory 
- get new mentor from the side bar expect to be visible click on it 
- expect a dialog to pop up which has text create mentor
- Note use existing function to from the create-mentor.spec.ts file to create the mentor
- close all open dialog by locating button with text close click on it and expect dialog close
- expect the newly created mentor is found on the home page (and example await page
    .locator('h1')
    .filter({ hasText: new RegExp(`^${formValues.mentorName}$`) })
    .waitFor();
  await expect(
    page
      .locator('h1')
      .filter({ hasText: new RegExp(`^${formValues.mentorName}$`) })
  ).toBeVisible({ timeout: 30000 });)
## test suite 5: New mentor creation from my mentors dialog
-wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory
- get the my mentors button expect to be visible and click on it
- expect a dialog to pop up which has text my mentors
- expect create button to be visible 
- click on the create button 
- expect a dialog to pop up which has text create mentor
- Note use existing function to from the create-mentor.spec.ts file to create the mentor
- close all open dialog by locating button with text close click on it and expect dialog close
- expect the newly created mentor is found on the home page (and example await page
    .locator('h1')
    .filter({ hasText: new RegExp(`^${formValues.mentorName}$`) })
    .waitFor();
  await expect(
    page
      .locator('h1')
      .filter({ hasText: new RegExp(`^${formValues.mentorName}$`) })
  ).toBeVisible({ timeout: 30000 });)
## test suite 6: New mentor creation from the mentors settings at the side bar
-wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory 
- get button settings from the side bar expect to be visible and click on it
- expect a dialog to pop up which has text settings
-get button create mentor found on the settings dialog expect to be visible and click on it
- expect a dialog to pop up which has text create mentor
- Note use existing function to from the create-mentor.spec.ts file to create the mentor
- close all open dialog by locating button with text close click on it and expect dialog close
- expect the newly created mentor is found on the home page (and example await page
    .locator('h1')
    .filter({ hasText: new RegExp(`^${formValues.mentorName}$`) })
    .waitFor();
  await expect(
    page
      .locator('h1')
      .filter({ hasText: new RegExp(`^${formValues.mentorName}$`) })
  ).toBeVisible({ timeout: 30000 });)
## test suite 7: project creation  (note for all the test suite that deals with project should have this before continuing to the actual test to be carried out)
-wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory 
- get new project button expect to be visible 
- click on the new project button
- wait until the dialog is fully loaded and ready for interaction (there should be no loader visible)
-expect a dialog should pop up with text New Project 
- get the project name input and fill it (fill a project name that makes sense (randomly generated names))
- under Select mentors get 1 mentor randomly from the list of mentor (locate the particular mentor to select take not of its name and click on it)
- expect a tick on the card of the mentor selected 
- get button save 
-click on the save button
- wait until the page is fully loaded  and the dialog isnt visible again 
- expect that the name of the project visible (this is done when the page is fully loaded and elements are visible no loader visible)
- expect that project mentors heading is visible
## test suite 8: rename project 
--wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory 
-Note (we should be able to access the name of the project that was created in test suite & find a reliable way for this);
- get Text with the project name and expect to be visible
- hover over the project name and expect a button to be visible beside the project name
- click on the button 
- expect a pop to be visible 
- the pop should have rename project button and delete project button 
- click on rename project
- expect a dialog to be visible with rename project text 
- get input field with place holder enter new project name expect to be visible 
-fill the input with randomly generated name
- click on rename project button 
- expect dialog shouldnt be visible
- expect the new name is visible on the page
## test suite 8 : delete project
--wait until the page is fully loaded and the loader isnt visible
-Assert that the user is an admin using the `checkAdminStatus` function from the test directory 
-Note (we should be able to access the name of the project that was created in test suite & find a reliable way for this);
- get Text with the project name and expect to be visible
- hover over the project name and expect a button to be visible beside the project name
- click on the button 
- expect a pop to be visible 
- the pop should have rename project button and delete project button 
- click on delete project
- expect a dialog to be visible with delete project text 
- click on delete project button 
- expect dialog shouldnt be visible
- expect project name isnt viisble on the page
### test suite 9 : user cant create more then on project with thesame name 
- as the user lands on the home page get the url of the home page
- use the already existing create project function (which is a test on its own too) create a project take not of the project name
- navigate to the url gotten initially 
- expect the mentor created is visible
- use the create project function again to create anther project note with thesame name 
- we expect the creation to fail and for this we are asserting that the create project dialog is still visible.
## test suite 10: user can add more mentors
-get the url of the home page
- user the create project function to create a project
-once creation is successful go to the url of the home page
- expect the project u created is visible 
- click on the project you created
- we expect the redirect url should contain projects
- take not of the available mentors found under the project mentors heading
- expect the add mentors button is visible
-click on add mentor button 
-a modal will pop up with `add mentor to` text  visible 
- expect the modal is full ready for interactions 
- select a mentor from the list of mentor apart from a mentor already having a tick
- click on done expect the dialog not to be visible 
- expect selected mentor is visible 
## test suite 11 : user shoud be able to remove a mentor from a project if the mentor isnt the last mentor
-get the url of the home page
- use the create project function to create a project
-once creation is successful go to the url of the home page
- expect the project you created is visible 
- click on the project you created
- we expect the redirect url should contain projects
- hover over the last mentor card (this button will be viisble <button data-slot="dropdown-menu-trigger" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&amp;_svg]:pointer-events-none [&amp;_svg:not([class*='size-'])]:size-4 shrink-0 [&amp;_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 size-9 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:opacity-100" type="button" id="radix-«r42»" aria-haspopup="menu" aria-expanded="true" data-state="open" aria-controls="radix-«r43»"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis h-4 w-4"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg></button>) get the button click on it a pop up will appear containing remove from project click on it and expect that particular mentor not to be visible  there is a cache if there is only one mentor we cant not remove it clicking the button will pop up a remove from project modal click on it a dialoge will pop up with a text cannot remove mentor  for this case we close the dialog by clicking the close button on the dialog
 
## test suite 12 : add files 
-get the url of the home page
- user the create project function to create a project
-once creation is successful go to the url of the home page
- expect the project u created is visible 
- click on the project you created
- we expect the redirect url should contain projects
- get the attach files button expect to be visible 
- click on the button 
- upload file same as that for the data set upload use same file directory
## Implementation Notes
- Use `getByRole` selectors for all element interactions
- When selecting mentors from a list, use random selection
- Generate unique random email for each test user
- Follow existing test patterns from `packages/playwright/tests/mentornextjs`
- Reference `packages/playwright/PR_REVIEW_PROMPT.md` for code review standards
- Ensure proper wait conditions for async operations (mentor responses, page navigations)
- Use the `checkAdminStatus` function from the test directory to verify non-admin status