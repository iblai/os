# MentorAI E2E Coverage — User Journey Checklist

> Last updated: 2026-05-05 | 370 checkpoints (361 active, 9 deprecated in #1431) | 43 journeys (42 active, 1 deprecated in #1431) | 100% covered | Auth: admin + non-admin storageState

## How This Works

Each **checkpoint** maps to a concrete user action or verification within a spec file.
Coverage = `covered_checkpoints / total_checkpoints * 100`.

When adding a new page or modifying an existing user flow:

1. Add checkpoints to the relevant journey below (or create a new journey)
2. Write Playwright tests for each checkpoint
3. Mark the checkpoint `[x]` once the test is in the suite and passing
4. The pre-push hook and CI workflow will block pushes with uncovered routes

---

## Journey 1: Authentication (4 checkpoints) — `journeys/01-authentication.spec.ts`

**Source files:** `app/sso-login/page.tsx`, `app/sso-login-complete/page.tsx`

- [x] Unauthenticated user can sign up with email and password via the auth service signup form _(uses mailnesia.com for email)_
- [x] Newly signed-up non-admin can log in and is redirected to the mentor platform
- [x] Non-admin can reset password via the forgot password flow _(uses mailnesia.com for email verification)_
- [x] Unauthenticated user with invalid credentials sees an error message

---

## Journey 2: First-Time User Chat & Navigation (7 checkpoints) — `journeys/02-first-time-user-chat-and-navigation.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/page.tsx`, `components/chat/index.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/app-sidebar/index.tsx`, `components/welcome-chat.tsx`, `components/advanced-chat/ui-tags/default-tag.tsx`

- [x] Newly created user can send a message and receive an AI response
- [x] Newly created user can start a new chat session after chatting
- [x] Newly created user can navigate to the Explore page via sidebar
- [x] Newly created user can log out via the profile dropdown
- [x] Sidebar can be toggled open and closed
- [x] Help button opens the docs link in a new tab
- [x] Suggested prompts authored with Markdown render via the Markdown component (issue #1179, fixme until a seeded mentor fixture is available)

---

## Journey 3: New User UI & Profile Dropdown (4 checkpoints) — `journeys/03-new-user-ui-and-profile-dropdown.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/user-profile.tsx`

- [x] Mentor dropdown shows "New chat" item; non-admin sees at most 2 items
- [x] "My Mentors" button is NOT present in the header (removed in feat-1431); mentor dropdown still shows New Chat item
- [x] Profile dropdown shows exactly 3 items: Profile, Help, Log out
- [x] Sidebar admin-only buttons (Settings, Analytics, New Project, Invite Users, New Mentor) show Stripe/upgrade dialog for non-admins

---

## Journey 4: User Profile Management (14 checkpoints) — `journeys/04-user-profile-management.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/user-profile.tsx`, `components/modals/edit-mentor-modal/tabs/settings-tab.tsx`

- [x] Profile modal opens from the user dropdown
- [x] Profile modal closes when clicking the close button
- [x] All profile tabs (Basic, Social, Education, Experience, Resume, Security) are navigable
- [x] Basic tab: Full Name and Email fields are pre-populated
- [x] Basic tab: Title and About fields are editable and save successfully
- [x] Basic tab: Language selector is present
- [x] Social tab: All fields have URL prefixes and are editable
- [x] Education tab: Add education dialog opens with all required fields; "I currently study here" disables end date
- [x] Education tab: Add Institution sub-dialog opens, has form fields, and can be cancelled
- [x] Experience tab: Add experience dialog opens with all required fields; "I currently work here" disables end date
- [x] Resume tab: Upload resume or Add resume button is visible
- [x] Security tab: Send Password Reset Link button is visible; no Save button present
- [x] Profile modal has proper ARIA attributes (tablist, tabpanel, aria-selected, aria-controls)
- [x] User avatar with initials and Admin badge (for admins) are visible

---

## Journey 5: Mentor Discovery — Explore Page (13 checkpoints) — `journeys/05-mentor-discovery-explore-page.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/explore/page.tsx`, `app/platform/[tenantKey]/[mentorId]/explore/_components/explore-page-content.tsx`, `app/platform/[tenantKey]/[mentorId]/explore/_components/search-section.tsx`

- [x] Explore page title ("All Mentors") and description are visible
- [x] Mentor cards display correct information
- [x] Search input filters the mentor list
- [x] "See more" button loads additional mentors
- [x] Featured section is displayed when configured
- [x] Filter by LLM Provider narrows results
- [x] Filter by Subject narrows results
- [x] Filter by Type narrows results
- [x] Filter by "Created by Me" narrows results
- [x] Filter by "Created by Community" narrows results
- [x] Clicking a mentor card navigates to that mentor and allows chatting
- [x] Custom mentor creation button is visible for admins
- [x] Star/unstar a mentor updates the Favorites section

---

## Journey 6: Mentor Management — Admin (10 checkpoints) — `journeys/06-mentor-management-admin.spec.ts`

**Source files:** `components/modals/create-mentor-modal.tsx`, `components/modals/edit-mentor-modal/index.tsx`, `components/modals/edit-mentor-modal/tabs/settings-tab.tsx`, `components/modals/edit-mentor-modal/tabs/llm-tab.tsx`, `components/modals/edit-mentor-modal/tabs/tools-tab.tsx`, `components/modals/edit-mentor-modal/tabs/prompts-tab.tsx`

- [x] Admin can update mentor profile (name, description, category, visibility), save, and close
- [x] Non-admin does not see the Settings or Tools menu items
- [x] Admin can change LLM provider and select a model
- [x] Admin can toggle tools on/off in the Tools tab
- [x] Admin can apply custom CSS via the Advanced CSS editor (embed preview reflects change)
- [x] Admin can reset custom CSS back to default
- [x] Admin can apply valid custom JavaScript; invalid JS shows warnings
- [x] Admin can edit the system prompt in the Prompts tab
- [x] Admin can send a message to a newly created mentor and receive a response
- [x] Admin can delete a mentor from the Settings tab

---

## Journey 7: Mentor Settings Tab — Unique ID (8 checkpoints) — `journeys/07-mentor-settings-tab-unique-id.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/settings-tab.tsx`

- [x] Unique ID field is read-only and cannot be edited
- [x] Copy button for unique ID is visible
- [x] Copy button copies unique ID to clipboard
- [x] Visual feedback is shown after successful copy
- [x] Tooltip info icons have `type="button"` and do not submit the settings form
- [x] Enhance Document Retrieval toggle is visible with correct label and defaults to OFF
- [x] Enhance Document Retrieval tooltip contains wording about multiple search queries
- [x] Enhance Document Retrieval toggle persists ON and OFF across save/reopen cycles

---

## Journey 8: Chat File Upload (9 checkpoints) — `journeys/08-chat-file-upload.spec.ts`

**Source files:** `components/chat-input-form/upload-menu.tsx`, `components/chat-input-form/file-attachments-list.tsx`, `hooks/use-chat-file-upload.ts`, `hooks/use-file-drag-drop.ts`

- [x] Image, PDF, and text files can be uploaded via the upload button
- [x] File input `accept` attribute correctly includes supported and excludes unsupported types
- [x] Uploaded file can be removed from the attachments list
- [x] Drag overlay appears on dragover and disappears on dragleave
- [x] Accepted files (image, PDF, text) can be dropped onto the chat area
- [x] Rejected file types (JSON, XML, EXE) show a rejection toast and are not added
- [x] Mixed valid/invalid drop shows partial rejection toast with correct singular/plural grammar
- [x] Multiple files can be selected and uploaded simultaneously via the button
- [x] Send button is enabled when a file is attached with no text typed

---

## Journey 9: Voice Chat (6 checkpoints) — `journeys/09-voice-chat.spec.ts`

**Source files:** `components/live-kit-voice-chat.tsx`, `components/modals/voice-chat-modal.tsx`, `components/chat-input-form/voice-call-button.tsx`, `hooks/use-voice-chat.ts`, `hooks/use-show-voice-call.ts`

- [x] Voice call dialog opens with heading, mute button, and end-call button (Chromium)
- [x] Voice call dialog opens correctly on Firefox and WebKit
- [x] Voice call button is hidden when "Show voice call" is toggled off in settings
- [x] Voice call button reappears after re-enabling the toggle
- [x] Full voice call flow: user speaks and receives an AI audio response _(mocked: page.route() intercepts call-credentials + STT APIs — Chromium only)_
- [x] Full voice call with real LiveKit _(skipped — requires real LiveKit server, audio device, and STT pipeline)_

---

## Journey 10: Canvas — AI Document Editor (11 checkpoints) — `journeys/10-canvas-ai-document-editor.spec.ts`

**Source files:** `components/canvas/canvas-component.tsx`, `components/canvas/canvas-rich-text-editor.tsx`, `components/canvas/canvas-view.tsx`, `components/canvas/canvas-controls.tsx`, `components/canvas/canvas-export-handlers.tsx`, `hooks/use-canvas-aware-send.ts`, `hooks/use-canvas-version-navigation.tsx`

- [x] Canvas mode can be enabled and disabled via the toggle button
- [x] AI can generate a business report document in the canvas
- [x] AI can generate technical API documentation in the canvas
- [x] Bold, italic, and heading formatting can be applied; undo/redo works correctly
- [x] Version history menu opens and user can navigate between document versions
- [x] "Back to latest version" button returns to the most recent version
- [x] Text selection shows highlight popup; partial update and Escape to close work
- [x] Canvas controls panel expands on hover; "Polish" action updates the document
- [x] Export dropdown shows PDF and Markdown options and triggers download
- [x] Canvas panel can be closed; artifact card remains in chat and reopens canvas
- [x] Follow-up chat message referencing canvas modifies the document content

---

## Journey 11: Canvas — Embed (1 checkpoint) — `journeys/11-canvas-embed.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/embed-tab.tsx`, `components/canvas/canvas-view.tsx`

- [x] Canvas embed within an external site displays correctly and allows chatting _(env-gated: requires CANVAS_URL, CANVAS_EMAIL, CANVAS_PASSWORD)_

---

## Journey 12: Chat Sharing (8 checkpoints) — `journeys/12-chat-sharing.spec.ts`

**Source files:** `app/share/chat/[sessionId]/page.tsx`, `app/share/chat/[sessionId]/[tenantKey]/[mentorId]/page.tsx`, `components/chat/ai-message-share.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`, `hooks/use-shared-chat-messages.ts`

- [x] Shared chat URL is created and matches the `/share/chat/{uuid}` pattern
- [x] Unauthenticated user can access shared chat and sees the chat history
- [x] Authenticated user accessing a shared chat URL is redirected to the platform
- [x] Shared chat page loads correctly and displays the chat interface
- [x] "Sign up for Free" button on shared chat redirects to the auth host
- [x] Chat textarea is not shown (or is disabled) for unauthenticated users on shared chat
- [x] Share button renders exactly once per session in the navbar, not per AI message (issue #645)
- [x] Share button is hidden on non-chat pages like `/explore` (issue #645)

---

## Journey 13: Shareable Links & Embed Integration (4 checkpoints) — `journeys/13-shareable-links-and-embed-integration.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/embed-tab.tsx`, `components/chat-input-form/voice-call-button.tsx`, `components/chat-input-form/voice-chat-button.tsx`, `components/chat-input-form/screen-sharing-button.tsx`

- [x] Non-anonymous embed with voice call, voice record, and attachment buttons renders correctly
- [x] Authenticated flow in embed: user can send a message and receive an AI response
- [x] Advanced anonymous embed (Anyone visibility, no context awareness) renders and allows chatting
- [x] Advanced anonymous embed with context awareness sends message with injected context

---

## Journey 14: Anonymous / Public Access (7 checkpoints; 1 deprecated) — `journeys/14-anonymous-public-access.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/page.tsx`, `components/login-required-banner.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/app-sidebar/app-sidebar-footer.tsx`, `components/chat-input-form/inside-buttons.tsx`

- [x] Anonymous user sees "Log in" button on a public mentor page
- [x] Clicking "Log in" redirects to the auth host login page
- [x] Anonymous user can navigate to the Explore page via the sidebar
- [x] Anonymous user can chat with a mentor configured for "Anyone" and start a new chat
- [x] Collapsed sidebar admin buttons redirect anonymous user to the auth host
- [x] Memory button is hidden in the chat input for unauthenticated users
- [x] ~~Anonymous user can open My Mentors modal; "Create" button is not visible~~ _(deprecated in #1431 — MyMentorsModal removed)_

---

## Journey 15: Mentor Switching (6 checkpoints; 3 deprecated) — `journeys/15-mentor-switching.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/explore/page.tsx`, `hooks/use-mentors.ts`

- [x] User can switch mentor by clicking a card on the Explore Mentors page
- [x] Switch between mentors via Explore page (dedicated spec)
- [x] Switch between mentors via home page Explore section
- [x] ~~User can switch mentor via My Mentors modal and continue chatting~~ _(deprecated in #1431 — covered by Explore via exp-11)_
- [x] ~~User can switch mentor via My Mentors modal (alternate path)~~ _(deprecated in #1431 — covered by Explore via exp-11)_
- [x] ~~Switch between mentors via My Mentors modal (dedicated spec)~~ _(deprecated in #1431 — covered by Explore via exp-11)_

---

## Journey 16: My Mentors Modal (3 checkpoints; deprecated in #1431) — `journeys/16-my-mentors-modal.spec.ts`

> **Deprecated in #1431.** The MyMentorsModal feature was removed and agent discovery was consolidated into the Explore sidebar. The spec file is a stub (`test.describe.skip`) that exists only to satisfy `validateSpecFiles` in the journey-coverage script. The checkpoints below are kept in the ledger to preserve the pre-push regression baseline.

**Source files:** `components/modals/my-mentors-modal.tsx` _(deleted)_

- [x] ~~User can access a mentor through the My Mentors dropdown~~ _(deprecated in #1431)_
- [x] ~~"Next" pagination button in My Mentors modal navigates to the next page~~ _(deprecated in #1431)_
- [x] ~~Admin can invite a user from the My Mentors modal~~ _(deprecated in #1431)_

---

## Journey 17: Notifications (6 checkpoints) — `journeys/17-notifications.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/notifications/page.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`

- [x] Notification page is reachable from the notification bell in the sidebar
- [x] Notification page is reachable and shows a dropdown from the navbar bell
- [x] Admin can create a new notification
- [x] "Mark all as read" button is visible on the notifications page
- [x] Alerts tab exposes proactive fields with proper accessible ARIA attributes
- [x] Alerts tab auto-opens when inbox is empty

---

## Journey 18: Analytics Dashboard (5 checkpoints) — `journeys/18-analytics-dashboard.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/analytics/page.tsx`, `app/platform/[tenantKey]/[mentorId]/analytics/users/page.tsx`, `app/platform/[tenantKey]/[mentorId]/analytics/topics/page.tsx`, `app/platform/[tenantKey]/[mentorId]/analytics/transcripts/page.tsx`, `app/platform/[tenantKey]/[mentorId]/analytics/financial/page.tsx`

- [x] Overview tab loads with mini-cards (Messages, Active Users, Topics, Conversations), charts, and working time filters
- [x] Users tab loads with user metric cards and charts (Active Users, Access Times, User Details)
- [x] Topics tab loads with topic/conversation/message cards and rating/topics charts
- [x] Transcripts tab loads with average message, cost, and rating cards
- [x] Financial tab loads with cost cards and charts (per Day, by Provider, by LLM, per User)

---

## Journey 19: Data Reports (18 checkpoints) — `journeys/19-data-reports.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/analytics/reports/page.tsx`, `app/reports/[tenantKey]/[reportName]/page.tsx`

- [x] Navigate to Data Reports tab from the Analytics page _(skips gracefully when no report data exists in env)_
- [x] All report cards display with download buttons _(skips gracefully when no report data exists in env)_
- [x] CSV editor dialog opens when clicking download on the User Report _(skips gracefully when no report data exists in env)_
- [x] CSV data is displayed in an editable table format _(skips gracefully when no report data exists in env)_
- [x] Cell values can be edited in the CSV editor _(skips gracefully when no report data exists in env)_
- [x] New row can be added in the CSV editor _(skips gracefully when no report data exists in env)_
- [x] Edited CSV saves successfully and triggers a file download _(skips gracefully when no report data exists in env)_
- [x] CSV editor closes without saving when Cancel is clicked _(skips gracefully when no report data exists in env)_
- [x] CSV editor closes when clicking the Close button _(skips gracefully when no report data exists in env)_
- [x] CSV editor has proper ARIA labels and roles _(skips gracefully when no report data exists in env)_
- [x] CSV editor opens for the User Metadata Report _(skips gracefully when no report data exists in env)_
- [x] Chat History report downloads directly without opening the CSV editor _(skips gracefully when no report data exists in env)_
- [x] Other download buttons are disabled while a report is generating _(skips gracefully when no report data exists in env)_
- [x] Report download page shows the preparing phase
- [x] Full report download flow completes end-to-end
- [x] Download Again button works after a completed download
- [x] Back Home button navigates to root
- [x] Error phase is shown for an invalid report name

---

## Journey 20: Dataset Management (18 checkpoints) — `journeys/20-dataset-management.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/datasets-tab/index.tsx`, `components/modals/edit-mentor-modal/tabs/datasets-tab/dataset-item.tsx`, `components/modals/edit-mentor-modal/tabs/datasets-tab/retrain-schedule-modal.tsx`, `components/modals/edit-mentor-modal/tabs/datasets-tab/train-or-delete-modal.tsx`, `components/modals/edit-mentor-modal/tabs/datasets-tab/resource-types.tsx`, `hooks/use-datasets.ts`

- [x] Datasets tab header and description display correctly (TC01)
- [x] Search input is visible and filters the dataset list (TC02–TC03)
- [x] "Add Resource" button opens the modal showing all resource types (TC04–TC05)
- [x] Table headers and dataset list (or empty state) render correctly (TC06–TC07)
- [x] Pagination controls work when datasets exist (TC08)
- [x] Visibility toggle and training status switch function correctly (TC09–TC10)
- [x] Schedule Retrain button opens the retrain modal and modal actions work (TC11)
- [x] Delete Dataset flow opens confirmation modal and completes deletion (TC12–TC13)
- [x] In Progress badge displays during training; dataset link is clickable; dialog closes properly (TC14–TC16)
- [x] Loading states, token count format, and button tooltips are correct (TC17–TC19)
- [x] State (search input) is preserved after modal close and reopen (TC20)
- [x] PDF file can be uploaded successfully (TC21)
- [x] Image file can be uploaded successfully (TC22)
- [x] Multiple different file types can be uploaded in one session (TC23)
- [x] Untrained dataset can be trained (TC24)
- [x] Untrained dataset can be deleted; trained dataset can be untrained then deleted; retraining can be scheduled; file upload cancellation is handled gracefully (TC25–TC28)
- [x] Markdown resource type is available in the Add Resources modal (TC30, issue #1117)
- [x] Markdown (.md) file can be uploaded and appears in the dataset list (TC31, issue #1117)

---

## Journey 21: Billing & Subscription (18 checkpoints) — `journeys/21-billing-and-subscription.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/user-profile.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/subscription-wrapper/index.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/subscription-wrapper/mentor-e-commerce-wrapper.tsx`

Driven by the shared paywall helpers in `@iblai/iblai-js/playwright`. All tests skip gracefully when `current_tenant.show_paywall=false`.

**A. CreditBalance dropdown (nav-bar)**

- [x] CreditBalance trigger visibility matches `current_tenant.show_paywall`
- [x] CreditBalance trigger exposes accessible aria-label with credits info _(paywall-gated)_
- [x] Dropdown shows the plan badge (Free / Trial / Premium) _(paywall-gated)_
- [x] Dropdown footer matches the active plan via `expectCreditBalanceForCurrentPlan` (Upgrade Plan / Manage Usage + Add Credits / Manage Billing) _(paywall-gated)_
- [x] Premium + payment method shows Manage Usage, Add Credits, and the inline Auto Recharge section _(paywall-gated; skips on Free/Trial or no payment method)_
- [x] Dropdown shows the Remaining credits row with a numeric value _(paywall-gated)_
- [x] Manage Usage opens the Auto Recharge modal _(payment-gated)_
- [x] Add Credits opens the Add Credits modal _(payment-gated)_
- [x] Escape closes the dropdown

**B. Billing tab (User Profile dialog)**

- [x] Billing tab opens via `?profileTab=billing` and the Plan section mounts _(paywall-gated)_
- [x] Plan / Credits / Auto Recharge sections match the active plan via `expectBillingTabForCurrentPlan` _(paywall-gated)_
- [x] Auto Recharge section is hidden on Free plan and shown on non-Free + payment method _(paywall-gated)_
- [x] Manage Usage opens Auto Recharge modal with toggle, threshold, amount, Cancel, Save Settings _(payment-gated)_
- [x] Auto Recharge toggle inverts on click and restores on a second click _(payment-gated)_
- [x] Auto Recharge threshold and amount inputs accept values _(payment-gated)_
- [x] Add Credits button opens the Add Credits modal _(non-Free + payment method)_
- [x] Plan label is consistent between the CreditBalance dropdown and the Billing tab _(paywall-gated)_

**C. Non-admin pricing**

- [x] Non-admin without subscription sees Stripe pricing modal when creating a mentor _(skips when paywall is off)_

---

## Journey 22: Disclaimers & User Agreement (14 checkpoints) — `journeys/22-disclaimers-and-user-agreement.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/disclaimers-tab/index.tsx`, `components/modals/edit-mentor-modal/tabs/disclaimers-tab/edit-user-agreement-modal.tsx`, `components/modals/edit-mentor-modal/tabs/disclaimers-tab/edit-disclaimer-modal.tsx`, `components/modals/disclaimer-modal.tsx`, `hooks/use-user-agreement.ts`, `constants/disclaimer.ts`

- [x] Admin enables User Agreement toggle and sees Active status _(creates fresh mentor; skips if non-admin)_
- [x] Admin disables User Agreement toggle and sees Inactive status _(creates fresh mentor; skips if non-admin)_
- [x] Admin edits User Agreement content and saves _(creates fresh mentor; skips if non-admin)_
- [x] Admin edits Advisory content and saves _(creates fresh mentor; skips if non-admin)_
- [x] Admin cancels User Agreement edit without saving — preview content unchanged _(creates fresh mentor; skips if non-admin)_
- [x] Save button is disabled when User Agreement content is empty _(creates fresh mentor; skips if non-admin)_
- [x] Admin copies User Agreement content to clipboard _(creates fresh mentor; skips if non-admin)_
- [x] Admin copies Advisory content to clipboard _(creates fresh mentor; skips if non-admin)_
- [x] Admin enables user agreement and non-admin must accept it before chatting _(creates fresh mentor; uses non-admin browser context)_
- [x] Admin disables user agreement and non-admin sends message without seeing agreement modal _(creates fresh mentor; uses non-admin browser context)_
- [x] Non-admin accepts user agreement and subsequent messages do not trigger modal again _(creates fresh mentor; uses non-admin browser context)_
- [x] Disclaimers tab shows both User Agreement and Advisory sections with correct controls _(creates fresh mentor; skips if non-admin)_
- [x] Advisory Edit modal opens with correct title, textarea, and Cancel/Save buttons _(creates fresh mentor; skips if non-admin)_
- [x] User Agreement Edit modal opens with correct title, textarea, and Cancel/Save buttons _(creates fresh mentor; skips if non-admin)_

---

## Journey 23: Mentor History Tab (5 checkpoints) — `journeys/23-mentor-history-tab.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/history-tab.tsx`, `hooks/use-history.ts`, `hooks/use-history/use-export-chat-history.ts`

- [x] History dialog is accessible (no WCAG violations)
- [x] Chat history list loads with conversations and supports pagination
- [x] Sentiment and topic filters narrow the conversation list
- [x] Individual conversation can be expanded to view the full transcript
- [x] Export button triggers a file download

---

## Journey 24: Mentor Memory Tab (8 checkpoints) — `journeys/24-mentor-memory-tab.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/memory-tab/index.tsx`, `components/modals/edit-mentor-modal/tabs/memory-tab/manage-memories.tsx`, `components/modals/edit-mentor-modal/tabs/memory-tab/learners-memories.tsx`, `components/modals/edit-mentor-modal/tabs/settings-tab.tsx`

- [x] CP-24.1: Memory tab is visible in Edit Mentor modal
- [x] CP-24.2: Memory toggle (Settings tab) can be enabled and disabled (sends enable_memory_component on Save)
- [x] CP-24.3: Memory entries list shows entries or empty state with Add Memory button
- [x] CP-24.4: Admin can add a new memory entry via Add Memory dialog
- [x] CP-24.5: Admin can edit a memory entry via action menu
- [x] CP-24.6: Admin can delete a memory entry via action menu with confirmation
- [x] CP-24.7: User filter and date range filter are visible in manage memories
- [x] CP-24.8: Memory button visibility in chat input reflects mentor memory setting (Settings tab toggle)

---

## Journey 25: MCP (Model Context Protocol) Tab (4 checkpoints) — `journeys/25-mentor-mcp-tab.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/mcp-tab/index.tsx`, `components/modals/edit-mentor-modal/tabs/mcp-tab/connector-management-content.tsx`, `components/modals/edit-mentor-modal/tabs/mcp-tab/connector-dialogs.tsx`

- [x] MCP tab is visible in the Edit Mentor modal
- [x] MCP tab shows connector list or empty state
- [x] A new MCP connector can be added and appears in the list
- [x] An MCP connector can be deleted

---

## Journey 26: Projects (8 checkpoints) — `journeys/26-projects.spec.ts`

**Source files:** `app/platform/[tenantKey]/projects/[projectId]/[mentorId]/page.tsx`, `components/projects/project-landing-page.tsx`, `components/projects/create-project-modal.tsx`, `components/projects/project-mentors-list.tsx`, `components/projects/project-action-buttons.tsx`, `components/projects/project-files-modal.tsx`, `components/projects/project-instructions-modal.tsx`, `components/projects/rename-project-modal.tsx`, `components/projects/delete-project-modal.tsx`

- [x] A new project can be created from the sidebar
- [x] Project landing page shows the assigned mentor list and action buttons
- [x] A mentor can be added to a project
- [x] Project instructions (system prompt) can be set and saved
- [x] Project files modal opens with search input and Add Files button
- [x] Chatting within a project creates a session
- [x] A project can be renamed
- [x] A project can be deleted

---

## Journey 27: User Invitations & Default Mentor (5 checkpoints) — `journeys/27-user-invitations-and-default-mentor.spec.ts`

**Source files:** `components/modals/settings-modal.tsx`, `app/platform/[tenantKey]/[mentorId]/page.tsx`

- [x] Admin can invite a user via email from the Settings modal
- [x] Invited user can sign up via the invite link (clean session)
- [x] Accepted invite is reflected correctly for the admin
- [x] Admin can set a default mentor in Advanced settings
- [x] Newly invited and registered user lands on the configured default mentor

---

## Journey 28: App Overview & Navigation UI (7 checkpoints) — `journeys/28-app-overview-and-navigation-ui.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/_components/nav-bar/index.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/app-sidebar/index.tsx`, `components/modals/llm-provider-selection-modal.tsx`

- [x] Header renders all expected components
- [x] Current mentor dropdown responds to clicks
- [x] User profile dropdown buttons function correctly
- [x] Sidebar renders all expected components including Vector document button
- [x] Vector document button is visible in the sidebar
- [x] LLM provider modal opened from the navbar hides the configuration header
- [x] LLM provider modal inside Edit Mentor retains the configuration header

---

## Journey 29: Accessibility — WCAG 2.1 AA (23 checkpoints; 1 deprecated) — `journeys/29-accessibility-wcag.spec.ts`

**Source files:** `components/accessibility/accessibility-toolbar.tsx`, `components/accessibility/floating-accessibility-button.tsx`, `components/chat/stop-streaming-button.tsx`, `components/chat/ai-message-copy.tsx`, `components/chat/index.tsx`, `components/chat-input-form.tsx`, `components/chat-input-form/voice-chat-button.tsx`, `components/chat-input-form/voice-call-button.tsx`, `components/chat-input-form/upload-menu.tsx`, all major modals and dialogs

- [x] Homepage has no accessibility violations
- [x] Mentors catalog (Explore page) has no accessibility violations
- [x] Create Mentor modal meets accessibility guidelines
- [x] Invite Users modal meets accessibility guidelines
- [x] Settings modal meets accessibility guidelines
- [x] Embed dialog is accessible
- [x] Dataset dialog is accessible
- [x] Mentor Settings dialog is accessible
- [x] LLM provider dialog is accessible
- [x] Prompts dialog is accessible
- [x] Tools dialog is accessible
- [x] Add Resources dialog is accessible
- [x] History dialog is accessible
- [x] Safety dialog is accessible
- [x] API key dialog is accessible
- [x] Stop-streaming tooltip does not flash when the stop button mounts mid-stream (issue #576, fixme until CI-verified)
- [x] Copy-to-clipboard tooltip does not flash when the copy button mounts after streaming (issue #576, fixme until CI-verified)
- [x] Keyboard Tab onto the copy button still opens the tooltip via `:focus-visible` (issue #576, fixme until CI-verified)
- [x] ~~My Mentors dialog meets accessibility guidelines~~ _(deprecated in #1431 — MyMentorsModal removed)_
- [x] Composer buttons have accessible names (Attach file, Voice input, Voice call, Send message) and form has `aria-label="Chat composer"` (issue #1596)
- [x] Chat composer stays visible at 640 px viewport width when canvas is open — WCAG 1.4.10 Reflow (issue #1596)
- [x] Exactly one `#chat-input-textarea` exists in the DOM when canvas is open at 640 px — no duplicate mobile composer (issue #1596)
- [x] Skip-link keyboard journey: Tab makes "Skip to chat input" link visible, Enter moves focus to `#chat-input-textarea` — WCAG 2.4.1 (issue #1596)

---

## Journey 30: Advanced CSS / JS Customization (8 checkpoints) — `journeys/30-advanced-css-js-customization.spec.ts`

**Source files:** `components/modals/advanced-settings-modal.tsx`

- [x] Advanced CSS section is displayed in the Advanced settings tab
- [x] Advanced CSS section can be expanded and collapsed
- [x] Save button is disabled when no CSS changes have been made
- [x] Save and Discard buttons become enabled when CSS is modified
- [x] Discarding CSS changes restores the previous value
- [x] Valid CSS shows a success validation status
- [x] Invalid CSS shows a validation error message
- [x] Advanced CSS section has proper accessibility attributes

---

## Journey 31: Mobile View (7 checkpoints) — `journeys/31-mobile-view.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/page.tsx`, `app/platform/[tenantKey]/[mentorId]/explore/page.tsx`, `components/modals/edit-mentor-modal/tabs/datasets-tab/index.tsx`

- [x] Sidebar navigation displays correct menu items on mobile (Pixel 5 viewport)
- [x] Mentor dropdown works correctly in mobile view
- [x] User profile button works correctly in mobile view
- [x] Navbar components render correctly in mobile view
- [x] Explore page title, description, and tabs display correctly on mobile
- [x] Search and mentor cards work correctly on mobile
- [x] Dataset upload and untrain/delete flow works on mobile

---

## Journey 32: Multi-Tenancy, Advertising & Auth Customization (11 checkpoints; 1 deprecated) — `journeys/32-multi-tenancy-advertising-and-auth-customization.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/page.tsx`, `app/platform/[tenantKey]/[mentorId]/_components/app-sidebar/index.tsx`, `components/modals/create-mentor-modal.tsx`, `app/sso-login/page.tsx`

- [x] Enterprise tenant: new mentor can be created from the sidebar dialog
- [x] Enterprise tenant: new mentor can be created from the Settings dialog
- [x] Enterprise tenant: sidebar open/close behavior works correctly
- [x] Enterprise tenant: platform logo navigates home
- [x] Enterprise tenant: New Chat navigation and sidebar items function correctly
- [x] Advertising tenant: anonymous user can access a public mentor without logging in
- [x] Admin can customize authentication SPA branding; unauthenticated user sees customization
- [x] Advertising tenant: user can log in to the advertising tenant mentor _(env-gated: set ENABLE_ADVERTISING_LOGIN_TEST=true after the session_id UUID bug is fixed in new-user onboarding)_
- [x] Help Center toggle controls dropdown and embed visibility _(serial mode added to prevent parallel browser interference)_
- [x] Help Center URL updates correctly in the dropdown and embed menu _(serial mode added)_
- [x] ~~Enterprise tenant: new mentor can be created from the My Mentors dialog~~ _(deprecated in #1431 — MyMentorsModal removed; covered by sidebar dialog flow above)_

---

## Journey 33: UI Render Console Errors (1 checkpoint) — `journeys/33-ui-render-console-errors.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/page.tsx`

- [x] Non-admin goes to the platform URL and sees no render failures or console errors

---

## Journey 34: Workflows (15 checkpoints) — `journeys/34-workflows.spec.ts`

**Source files:** `app/platform/[tenantKey]/workflows/[mentorId]/page.tsx`, `app/platform/[tenantKey]/workflows/[mentorId]/[id]/page.tsx`, `components/workflows/workflow-canvas.tsx`, `components/workflows/node-config-panel.tsx`, `components/workflows/workflow-preview-chat.tsx`

- [x] Workflows page displays heading, description, and Create Workflow button
- [x] Search input is visible on the workflows list page
- [x] Search filters the workflows list by name
- [x] A new workflow can be created and shows the canvas with a Start node
- [x] An existing workflow can be opened from the list
- [x] A workflow can be deleted and no longer appears in the list
- [x] Workflow editor displays Save, Publish, and Preview buttons in the toolbar
- [x] New workflow shows Draft status badge
- [x] Workflow name can be renamed inline via the pencil button
- [x] Workflow can be saved without errors
- [x] Default nodes (Start and Mentor) are visible with an edge connecting them
- [x] More options menu shows Activate and Delete items
- [x] Preview mode can be entered and exited; Close preview, New Chat, and Publish are visible
- [x] Canvas and chat panel are visible in preview mode
- [x] Workflow can be published; active workflow can be deactivated back to Draft

---

## Journey 35: Tenant Explore Page (9 checkpoints) — `journeys/35-tenant-explore-page.spec.ts`

**Source files:** `app/platform/[tenantKey]/explore/page.tsx`, `app/platform/[tenantKey]/notifications/layout.tsx`, `hooks/user-navigate.ts`

- [x] Tenant explore page renders with sidebar and navbar visible
- [x] Mentor cards render on tenant explore page
- [x] Mentors button stays on explore page
- [x] Clicking a mentor card navigates to that mentor from tenant explore page
- [x] New Chat button shows "No Mentor Selected" modal on tenant explore page (admin)
- [x] Workflows button shows "No Mentor Selected" modal on tenant explore page (admin)
- [x] "Explore Mentors" button in No Mentor Selected modal navigates to explore
- [x] Notifications button navigates to notifications page with sidebar and navbar
- [x] No 404 API calls for mentor public settings when mentorId is undefined

---

## Journey 36: Copy Mentor (10 checkpoints) — `journeys/36-copy-mentor.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/settings-tab.tsx`, `components/modals/edit-mentor-modal/tabs/settings-tab/copy-mentor-modal.tsx`

- [x] Allow Copies toggle shows Copy button when enabled and hides it when disabled
- [x] Copy Mentor modal opens with correct defaults (pre-filled name, training data toggle, Cancel/Copy buttons)
- [x] Copy Mentor modal closes via Escape key
- [x] Mentor can be copied with default name and user navigates to the new mentor
- [x] Mentor can be copied with a custom name
- [x] Copy button is disabled when mentor name is empty
- [x] Mentor can be copied without including training data
- [x] Mentor copied with training data has datasets on the copy
- [x] Mentor copied without training data has no datasets on the copy
- [x] Mentor can be copied to a different tenant _(env-gated: requires user with multiple admin tenants)_

---

## Journey 37: Voice Call and Screen Share in Canvas (9 checkpoints) — `journeys/37-voice-call-and-screen-share-in-canvas.spec.ts`

**Source files:** `components/chat-input-form/screen-sharing-button.tsx`, `components/chat/index.tsx`

- [x] Non-admin screen share button has `type="button"` and does not submit the chat form
- [x] Non-admin clicking screen share activates screen sharing, not form submit
- [x] Non-admin voice call button has `type="button"`
- [x] Admin screen share button has `type="button"` and does not submit the chat form
- [x] Admin clicking screen share activates screen sharing, not form submit
- [x] Admin voice call button has `type="button"`
- [x] Admin creates mentor, enables tools, opens canvas; voice call opens dialog
- [x] Admin creates mentor, enables tools, opens canvas; screen share activates
- [x] Admin creates mentor, enables tools, opens canvas; screen share does not submit form

---

## Journey 38: Tenant Memory System Toggle (1 checkpoint) — `journeys/38-tenant-memory-system-toggle.spec.ts`

**Source files:** `components/modals/settings-modal.tsx`

- [x] TMS-38.1: Admin toggles Memory System in Advanced tab and the chat Memory button reflects it

---

## Journey 39: Audit Log (9 checkpoints) — `journeys/39-audit-log.spec.ts`

**Source files:** `app/platform/[tenantKey]/[mentorId]/analytics/audit/page.tsx`, `app/platform/[tenantKey]/[mentorId]/analytics/layout.tsx`, `components/modals/edit-mentor-modal/tabs/audit-log-tab.tsx`, `hooks/use-mentor-segments.ts`

- [x] AL-39.1: Admin opens Analytics and navigates to Audit tab, sees audit content or empty state
- [x] AL-39.2: Admin opens Edit Mentor and selects Audit tab, sees audit content or empty state
- [x] AL-39.3: Admin opens Audit Log tab from navbar mentor dropdown
- [x] AL-39.4: Audit tab header shows correct title and description in Edit Mentor
- [x] AL-39.5: Admin can navigate between Audit and other tabs in Edit Mentor
- [x] AL-39.6: Audit Log analytics page is accessible via direct URL navigation
- [x] AL-39.7: Non-admin user does not see Audit tab in the mentor dropdown
- [x] AL-39.8: Non-admin user does not see Audit tab in the Analytics tab bar (view_audit_logs RBAC)
- [x] AL-39.9: Non-admin user visiting audit page directly does not see audit content (view_audit_logs RBAC)

---

## Journey 40: AI Message Read Aloud (3 checkpoints) — `journeys/40-ai-message-read-aloud.spec.ts`

**Source files:** `components/chat/ai-message-bubble.tsx`, `components/chat/ai-message-speak.tsx`, `components/chat/chat-messages/index.tsx`

- [x] SPEAK-40.1: Read Aloud button is visible on an AI response with `aria-pressed="false"`
- [x] SPEAK-40.2: Clicking Read Aloud toggles label to Stop Reading Aloud with `aria-pressed="true"` and triggers `speechSynthesis.speak`
- [x] SPEAK-40.3: Clicking Stop Reading Aloud resets to Read Aloud with `aria-pressed="false"` and calls `speechSynthesis.cancel`

---

## Journey 41: Mentor Access Tab (10 checkpoints) — `journeys/41-mentor-access-tab.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/access-tab/index.tsx`, `components/modals/edit-mentor-modal/tabs/access-tab/add-access.tsx`, `components/modals/edit-mentor-modal/tabs/access-tab/update-access.tsx`, `components/modals/edit-mentor-modal/tabs/access-tab/shared.ts`

- [x] AC-41.1: Access tab label is visible in the Edit Mentor modal sidebar
- [x] AC-41.2: Access control heading and description render correctly
- [x] AC-41.3: Access tab shows roles table or empty state — never a blank crash screen
- [x] AC-41.4: Each policy row shows role name, user count badge, and edit button
- [x] AC-41.5: Create role access dialog opens with role selector and can be cancelled
- [x] AC-41.6: Pencil edit button opens "Manage \<Role\> access" dialog with RoleAccessPanel
- [x] AC-41.7: Selecting a role in Create dialog enables the Create button
- [x] AC-41.8: Manage access dialog shows assigned users section or no-users placeholder
- [x] AC-41.9: Error state Try again button is present when the error banner renders
- [x] AC-41.10: Closing the manage dialog via Escape or click-outside clears editing state

---

## Journey 42: Suggested Prompts (12 checkpoints) — `journeys/42-suggested-prompts.spec.ts`

**Source files:** `components/modals/edit-mentor-modal/tabs/prompts-tab.tsx`, `components/modals/edit-mentor-modal/tabs/prompts-tab/copy-button.tsx`

- [x] Admin opens the Prompts tab and sees the Suggested Prompts section
- [x] Admin adds a new suggested prompt from the Prompts tab
- [x] Admin edits a suggested prompt from the Prompts tab
- [x] Admin sees Run buttons on suggested prompts in the Prompts tab
- [x] Admin runs a suggested prompt and the chat input is populated
- [x] Admin sees the See More button when more than the page size of prompts exist
- [x] Admin sees Delete buttons on suggested prompts in the Prompts tab
- [x] Admin deletes a suggested prompt from the Prompts tab
- [x] Admin opens the Prompt Gallery from the chat area
- [x] Admin sees prompt cards with Delete buttons in the Prompt Gallery
- [x] Admin deletes a prompt from the Prompt Gallery in the chat area
- [x] Admin in learner mode can see and run admin-created prompts but cannot edit, delete, or add

---

## Journey 43: Persistent Chat Input Label — WCAG 3.3.2 (10 checkpoints) — `journeys/43-persistent-chat-input-label.spec.ts`

**Source files:** `components/chat-input-form.tsx`

Requires `DM_URL` env var. Tests are skipped when `DM_URL` is unset.

- [x] PCIL-43.1: Label has `sr-only` class when `persistent_chat_input_label` flag is `false`
- [x] PCIL-43.2: Textarea placeholder is `"Ask anything"` when flag is `false`
- [x] PCIL-43.3: `aria-labelledby` wires textarea to label element when flag is `false`
- [x] PCIL-43.4: User can send a message when flag is `false`
- [x] PCIL-43.5: Label is visually visible (`block`, not `sr-only`) when flag is `true`
- [x] PCIL-43.6: Textarea placeholder is empty string when flag is `true`
- [x] PCIL-43.7: `aria-labelledby` and label text are intact when flag is `true`
- [x] PCIL-43.8: User can send a message when flag is `true`
- [x] PCIL-43.9: `setTenantMetadataFlag` helper reads `dm_token` from localStorage and PATCHes the DM API
- [x] PCIL-43.10: Flag is restored to its original value in `afterEach` to avoid contaminating subsequent runs

---

> **Note:** `cleanup.spec.ts` runs after all journeys to delete test artifacts. It is not a user journey.
