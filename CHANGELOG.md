# Changelog

## [0.39.0](https://github.com/iblai/mentorai/compare/v0.38.2...v0.39.0) (2026-03-30)

### Features

* add explore page layout component ([9fa63b8](https://github.com/iblai/mentorai/commit/9fa63b8165cdd0142e3b66f0142ff0cae93774d3))
* add navigation function to tenant explore page and implement E2E tests for non-admin and admin ([db1617b](https://github.com/iblai/mentorai/commit/db1617b82507fea448aabe039bc5159005296dba))
* add new chat and workflows buttons to sidebar ([37df152](https://github.com/iblai/mentorai/commit/37df152d9605a1cc42e9e6b17f661eb4a9895ad7))
* add notifications layout component ([91b9aab](https://github.com/iblai/mentorai/commit/91b9aab529aea98868cc23cf61a2d59f852f9809))
* update E2E coverage for Tenant Explore Page with new checkpoints ([6129059](https://github.com/iblai/mentorai/commit/6129059a647144df9db656c70171161e5e9b105e))

### Bug Fixes

* add explore and notifications layout files to skip coverage check ([6dc8d3c](https://github.com/iblai/mentorai/commit/6dc8d3c963eed2ec92551da47c9f9d7a39409b89))
* add skip condition to mentor public settings query ([813f1c8](https://github.com/iblai/mentorai/commit/813f1c896863691fdbfaaab391ecaf1212e3b4dc))
* prevent navigation to workflows without a selected mentor ([ec0dbe9](https://github.com/iblai/mentorai/commit/ec0dbe919a9fc0e9739198ae695db394f3435e31))
* update tenant explore page checkpoints for admin functionality ([316fce5](https://github.com/iblai/mentorai/commit/316fce5a1b7330075ab1e71b8e4e88b1ef3b2a2f))

### Tests

* add unit tests for NotificationsLayout component ([677bb24](https://github.com/iblai/mentorai/commit/677bb24809e8cac192e780048f0943eb77a2a12c))

## [0.38.2](https://github.com/iblai/mentorai/compare/v0.38.0...v0.38.2) (2026-03-30)

### Chores

* release 0.38.1 ([d7b8a06](https://github.com/iblai/mentorai/commit/d7b8a061bf1bbdb2f549fab3300c78229422cbe4))
* release 0.38.1 ([51adbe4](https://github.com/iblai/mentorai/commit/51adbe41aa7b021423ea08c46c1cfa2586f1f5af))

## [0.38.1]

- fix(web-containers): profile > basic > validation needed for fullname field 

## [0.38.0](https://github.com/iblai/mentorai/compare/v0.37.2...v0.38.0) (2026-03-30)

### Features

* ios restiction message modal feature ([6d910d8](https://github.com/iblai/mentorai/commit/6d910d88cde11beb83f3cc8bc412ceec8691c76b))
* ios restiction message modal feature > pnpm lock update ([c63f432](https://github.com/iblai/mentorai/commit/c63f4322d4aea72744b0aed0e7e14238d9a564f6))
* ios restiction message modal feature > test coverage ([4c25605](https://github.com/iblai/mentorai/commit/4c256059ed30ac5aa6866de13d284812fd4c1fdb))
* ios restriction on progress ([03358a4](https://github.com/iblai/mentorai/commit/03358a4a495a3f3da4c2ff9f1f6fd6b98063f9f4))
* ios restriction on progress ([e5a781f](https://github.com/iblai/mentorai/commit/e5a781f532b02c155afce61c011d1f617fd0584b))

### Chores

* bump @iblai/iblai-js to 1.1.7 ([6884d9c](https://github.com/iblai/mentorai/commit/6884d9c34fbefa205dd12caa4e48928a6e2b6a92))
* use localhost for tauri dev instead of org env ([62377c5](https://github.com/iblai/mentorai/commit/62377c5581031d3868ee80a92b29eada40cbdb02))

## [0.37.2](https://github.com/iblai/mentorai/compare/v0.37.1...v0.37.2) (2026-03-30)

### Chores

* switch Dependabot to grouped updates to reduce PR noise ([5b50d13](https://github.com/iblai/mentorai/commit/5b50d13b8e5ad4b2113377215dc757ee28ca5866))

## [0.37.1](https://github.com/iblai/mentorai/compare/v0.37.0...v0.37.1) (2026-03-30)

### Bug Fixes

* **e2e:** replace non-existent .react-flow selectors with actual DOM selectors ([8e465ac](https://github.com/iblai/mentorai/commit/8e465ac062156996c9007a14b9809b2e4e54a9bf))

## [0.37.0](https://github.com/iblai/mentorai/compare/v0.36.13...v0.37.0) (2026-03-30)

### Features

* **tauri:** add os plugin and fix e2e auth test ([88cba0d](https://github.com/iblai/mentorai/commit/88cba0d91628575ea6b989861e5c75c3221cdb46))

### Bug Fixes

* add chunk-retry coverage exclusion and headers test ([ad58cfc](https://github.com/iblai/mentorai/commit/ad58cfc93ddb66dd13acd8df1f059c371b3fa0f8))
* add webpack-level chunk retry and cache headers to prevent ChunkLoadError ([db293fc](https://github.com/iblai/mentorai/commit/db293fcdac0c3cf7296b195258d3608da1be973f))

## [0.36.13](https://github.com/iblai/mentorai/compare/v0.36.12...v0.36.13) (2026-03-30)

### Bug Fixes

* **ci:** add release-it devDep, fix node version; skip custom domain check on mentor origin ([118bfa7](https://github.com/iblai/mentorai/commit/118bfa70d18f82eadf9e38656cac11eeba266c5b))
* **ci:** disable husky hooks in release workflow to prevent OOM on CI ([50aa7ed](https://github.com/iblai/mentorai/commit/50aa7edf37eab3d0553c8a3ac9ed2544323e7758))
* **e2e:** increase timeout and re-enable Safari browser tests ([4cc718d](https://github.com/iblai/mentorai/commit/4cc718d61e02cffd32f5eb1189683dd5fc61c7b3))

### Chores

* add Dependabot configuration for dependency and security updates ([7eee7cf](https://github.com/iblai/mentorai/commit/7eee7cfadf540dfcd2ff988836228a83f82e35b2))
* **release:** v0.36.12 ([2c9fb64](https://github.com/iblai/mentorai/commit/2c9fb6475f28904b0f1e87e28dea87db38c86012))

* fix(ci): disable husky hooks in release workflow to prevent OOM on CI (50aa7ed)
* fix(ci): add release-it devDep, fix node version; skip custom domain check on mentor origin (118bfa7)
* fix(e2e): increase timeout and re-enable Safari browser tests (4cc718d)

## [0.36.12]

- iblai-js bump version to 1.1.6

## [0.36.11]

- ⁠Fixed chat height when empty
- Fixed welcome proactive messages in iframed anonymous mentors

## [0.36.10]

- chore(iblai-js): bump version of iblai-js to 1.1.5

## [0.36.9]

- chore(iblai-js): bump version of iblai-js to 1.1.1

## [0.36.8]

- chore(iblai-js): bump version of iblai-js to 1.1.0
- re-introduce legacy lms url and pass to data layer initialization

## [0.36.7]

- Add `hide-navbar` query param to hide the navbar in both embed and non-embed modes

## [0.36.6]

- Always show New Chat in mentor dropdown for non-admin users
- fix: update condition to call disclaimers when a user accesses the mentor with a shareable link
- tests: add playwright tests for the shareable link flow with disclaimers

## [0.36.5]

- Update logo to use dm url instead of axd url

## [0.36.4]

- NEXT_IMAGE_PATTERNS updated in github variables with new unified domain

## [0.36.3]

- bump iblai-js version to 1.0.36
- fix: use env-based git config for HTTPS rewrite in Docker build

## [0.36.2]

- bump version to 0.36.2

## [0.36.1]

- bump version to 0.36.1

## [0.36.0]

- iblai-js package version updated to 1.0.35
- feat: account deletion component integrated
- feat: mentor access > updated adding/updating user to sync with rbac & toggle manual/auto mode
- feat: mentor access > chat role added
- feat: mentor access > add groups field added

## [0.35.16]

- feat: derive lmsUrl, dmUrl, axdUrl from NEXT_PUBLIC_PLATFORM_BASE_DOMAIN when API base URL is unset
- default NEXT_PUBLIC_PLATFORM_BASE_DOMAIN to iblai.app

## [0.35.15]

- replaces multidomain use for different service with single api base domain

## [0.35.14]

- trigger-docker-build.yml: Pass next_image_patterns: ${{ vars.NEXT_IMAGE_PATTERNS }} as input to the reusable workflow
- next.config.ts: Treat empty string as unset so defaults always kick in as a safety net

## [0.35.13]

- fix: chat history > source payload passed to reports download hook
- feat: report download page calling AnalyticsReportDownload implemented
- feat: report download page calling AnalyticsReportDownload > playwright tests coverage
- iblai-js bump version to 1.0.24

## [0.35.12]

- bump iblai-js version to 1.0.23
- disable sending of message if session Id is not found

## [0.35.11]

- bump Update ibai-js version to 1.0.22

## [0.35.10]

- fix: analytics and billing issues fixed
- bump Update ibai-js version to 1.0.19

## [0.35.9]

- Fixes https://github.com/iblai/iblai-platform/issues/283
- https://github.com/user-attachments/assets/d0069dcf-5ef4-4ec5-abd7-1dba1a735c34
- fix(mentor): llm image issue on explore when swtiching to community mentors
- Fixes https://github.com/iblai/iblai-platform/issues/472
- Add RBAC permissions to MCP list
- bump iblai-js sdk version to 1.0.16

## [0.35.8]

- Fixes https://github.com/iblai/iblai-platform/issues/447
- Fixes https://github.com/iblai/iblai-platform/issues/450
- https://github.com/user-attachments/assets/b1b46059-bbae-4a50-b224-6db5b0268622
- Clicking the sidebar buttons navigates user to the auth spa
- Fixes https://github.com/iblai/iblai-platform/issues/298
- fix(mentor): student mode seeing billing tab fixed
- fix(mentor): account component showing on non admin mode fixed

## [0.35.7]

- fix(auth): extract tenant key from redirectPath matching /platform/<tenantKey>/<mentorId> pattern for cookie shortcut redirect

## [0.35.6]

- fix(auth): prevent redirect loops and properly handle redirect-path across SPAs
- fix(auth): skip Authorization header on password reset endpoint
- fix(mentor): add onAuthFailure handler to TenantProvider for custom domain access errors
- fix(mentor): fix semicolon syntax in embed code template

## [0.35.5]

- feat(mentor): ecommerce update implemented v2
- Fixes https://github.com/iblai/iblai-platform/issues/295
- Fixes https://github.com/iblai/iblai-platform/issues/306
- Fixes https://github.com/iblai/iblai-platform/issues/319
- Fixes https://github.com/iblai/iblai-platform/issues/486

## [0.35.4]

- feat(mentor): resync status with lost window opener via event source capture
- fix(mentor): sync mic and mentor audio state when toggled from PIP window
- fix(mentor): remove redundant mic mute handler from screensharing status listener
- fix(mentor): only render pinned messages for the current mentor
- feat(mentor): custom OAuth MCP connector with auth scope support
- fix(mentor): MCP endpoints fixed for connections and custom header
- feat(web-containers): analytics transcript coverage and session_id query param support
- fix(mentor): explore lack of clarity bug fixed
- feat(mentor): ecommerce update implemented
- Closes https://github.com/iblai/ibl-web-frontend/issues/1123
- Closes https://github.com/iblai/iblai-platform/issues/411
- Closes https://github.com/iblai/iblai-platform/issues/410
- Closes https://github.com/iblai/ibl-web-frontend/issues/1136
- Fixes https://github.com/iblai/iblai-platform/issues/484
- Fixes https://github.com/iblai/iblai-platform/issues/295
- Fixes https://github.com/iblai/iblai-platform/issues/306
- Fixes https://github.com/iblai/iblai-platform/issues/301
- Fixes https://github.com/iblai/iblai-platform/issues/305
- fix(skills): course outline display issue fixed
- chore: update api-ai and api-core packages

## [0.35.3]

- fix(mentor): refetch chats when screensharing stops (iframe and non-iframe)

## [0.35.2]

- fix(mentor): include sessionId in iframe screenshare and voicecall messages
- feat(web-containers): billing tab > subscription details added https://github.com/iblai/iblai-platform/issues/102
- https://www.loom.com/share/37a7d3408b5544e38a4fee84c799f406
- Fixes #1291
- https://github.com/user-attachments/assets/373f293b-da67-4cdb-bfdc-23388f10bd78
- feat(mentor): explore > redirect to auth on clicking create mentor when not logged in
- feat(mentor): explore > unit tests coverage for overall explore feature components
- https://www.loom.com/share/593119004c9745fa9e0b5d1cd46d44c5
- Fixes #331
- https://github.com/user-attachments/assets/58e91ec7-5ef8-404b-8a25-4c8ad752d31a
- Fixes https://github.com/iblai/iblai-platform/issues/9
- https://github.com/user-attachments/assets/ea10ffce-9afb-4d8a-853c-49fbe0fb0ac5
- Fixes https://github.com/iblai/iblai-platform/issues/11
- https://github.com/user-attachments/assets/703b2087-fc9a-434a-b30c-a6187132954f
- Fixes https://github.com/iblai/iblai-platform/issues/15
- fix(web-containers): notifications content with variables fixed
- Feat/playwright/setup credential per browser
- Fixes #1390
- Fixes https://github.com/iblai/iblai-platform/issues/193
- Added featured toggle to mentor settings tab.
- Fixed mentor feature toggle in settings modal.
- Added mentor feature filter in the mentor explore page.
- feat(skills): course advanced settings feature implemented
- feat(skills): program metadata settings implemented
- feat(skills): appropriate playwright & unit tests coverage in

## [0.35.1]

- feat(mentor): add PIP audio controls, stop sharing button, and message-based mute
- Fixes https://github.com/iblai/iblai-platform/issues/106
- feat(web-containers): billing tab > subscription details added https://github.com/iblai/iblai-platform/issues/102
- https://www.loom.com/share/37a7d3408b5544e38a4fee84c799f406
- Fixes #1291
- https://github.com/user-attachments/assets/373f293b-da67-4cdb-bfdc-23388f10bd78
- Fixes #1268
- https://github.com/user-attachments/assets/a7ac3351-55d5-415e-9475-6eddbb2bc5a5
- New Datasets UI
- Fixes #1045
- https://github.com/user-attachments/assets/d69cc24d-f993-44f3-a950-9f0a4943f123
- Fixes https://github.com/iblai/iblai-platform/issues/19
- feat(web-containers): billing tab > subscription details added https://github.com/iblai/iblai-platform/issues/102
- https://www.loom.com/share/37a7d3408b5544e38a4fee84c799f406
- Fixes #1291
- https://github.com/user-attachments/assets/373f293b-da67-4cdb-bfdc-23388f10bd78
- feat(web-containers): billing tab > subscription details added https://github.com/iblai/iblai-platform/issues/102
- https://www.loom.com/share/37a7d3408b5544e38a4fee84c799f406
- Fixes #1291
- https://github.com/user-attachments/assets/373f293b-da67-4cdb-bfdc-23388f10bd78

## [0.35.0]

- fix(mentor): hide initial loader on all pages that bypass MentorProvider (error pages, shared chats, OAuth callbacks, uploads, explore, notifications, etc.)
- Fix/mentor/171
- Feat/web containers/notification human support template
- fix(mentor): fix ssr issue
- Fixes https://github.com/iblai/iblai-platform/issues/139
- Fixes https://github.com/iblai/iblai-platform/issues/198
- Fixes https://github.com/iblai/iblai-platform/issues/148
- Fixes https://github.com/iblai/iblai-platform/issues/130
- feat(web-containers): combining recommendation reports now works with metadata instead of env flags https://github.com/iblai/ibl-web-frontend/issues/1402
- Hide screensharing if the browser does not support it. Fixes https://github.com/iblai/iblai-platform/issues/120
- Fixes https://github.com/iblai/iblai-platform/issues/131
- Fixes https://github.com/iblai/iblai-platform/issues/10
- Added mentor unique ID to the settings tab. Fixes #1280

## [0.34.5]

- fix(mentor): embed > advanced JS validator untightened security wise

## [0.34.4]

- fix(mentor): allow auth redirect to login.iblai.app in Tauri webview navigation
- fix(mentor): use separate bundle ID for macOS (ai.ibl.mentorai.macos) for App Store
- refactor(mentor): remove non-functional "Go Back" button from PIP and popup windows
- feat(mentor): add instruction banner in PIP for popup screen sharing sessions

## [0.34.3]

- fix(mentor): use postMessage for opener window focus to fix browser security restrictions
- feat(mentor): configure macOS App Store deployment with entitlements and signing
- chore(mentor): add /release command for automated release branch creation
- fix(mentor): explore page title issue on mobile fixed https://github.com/iblai/iblai-platform/issues/119

## [0.34.2]

- fix(mentor): explore > created by community sync issue fixed
- feat(web-containers): profile dropdown > truncate tenant name so we have one line
- fix(web-containers): analytics > different dates display issue fixed
- feat(web-containers): data reports > polling mechanism optimized to reduce calls
- feat(web-containers): data reports > csv deletion improved to show row fading out
- Fix/mentor/168
- Feat/web containers/profile dropdown truncate to allow one line
- feat(mentor): add Go Back button to blocking overlay and PIP window for returning to opener window
- fix(mentor): use text streams (lk.chat topic) for PIP chat to communicate with LiveKit Agents 1.0
- fix(mentor): update test mocks for live-kit-screen-sharing and ai-message-share components
- chore(mentor): remove unused @ts-expect-error directives for custom_javascript

## [0.34.1]

- feat(mentor): add mute command handling to useScreenSharing hook for MENTOR:SCREENSHARING_MUTE message

## [0.34.0]

- feat(mentor): add audio status bar to PIP window with speaking indicator, mute button, and privacy warning
- feat(mentor): add mute command handling for screen sharing via MENTOR:SCREENSHARING_MUTE message
- fix(auth): update spinner component to use Lucide Loader2 icon matching mentor app
- fix(mentor): add missing livekit-client exports (RoomEvent, ConnectionState, Track) to test mocks

## [0.33.0]

- feat(mentor): picture in picture mode implementation with screen sharing
- feat(mentor): Advanced JS feature implemented related to mentor embed #1444
- feat(mentor): explore contents not showcasing main mentors on new users until metadata toggle
- fix(mentor): access tab not returning all users fixed
- Updated the dropdown menu items RBAC list and permissions list to be in sync with the tab items.
- Updated the create session endpoint to take in the username
- Hide the new chat button when a user does not have chat permission. Disable the textarea when the user does not have chat permissions.

## [0.32.5]

- Closes #1580 and also remove pooling for the artifacts version api call

## [0.32.4]

- Fixes responsiveness issues for the canvas toggle, header toolbar, versions and outside/inside buttons when resizing the window in canvas state

## [0.32.3]

- Closes https://github.com/iblai/ibl-web-frontend/issues/1573
- Fixes artifact id
- Retries for the artifact versions api
- Artifacts version updates fixed to not have extra version for partial or full update
- Rich text editor to keep the cursor position once content is updated
- Code canvas removed for now to use the simple canvas with code preview
- Canvas only visible for the tenant admin/ all users from the env var of NEXT_PUBLIC_CANVAS_ADMIN_ONLY default to true
- Test files updated accordingly

## [0.32.2]

- Add detailed OAuth debug logging with visual status indicators (✅✓❌⚠️)
- Add `get_oauth_debug_log` Tauri command to fetch detailed Safari ViewController logs
- Enhance OAuth flow logging to track Safari ViewController creation and presentation
- Update debug banner to display last 10 log entries with color-coding
- Clear log file on each OAuth attempt for fresh debugging session

## [0.32.1]

- Add token to query param when switching tenantds

## [0.32.0]

- Add internationalization module
- Add sso-login-complete path to replace sso-login for completing sso
- fix(mentor): explore > show mentor results directly on search
- Fixed file upload rendering on refresh.
- Implement comprehensive Canvas artifact editor for document creation and editing
- Add rich text editing with TipTap editor (bold, italic, headings, code, quote, undo/redo)
- Add code canvas component with syntax highlighting for Python and other languages
- Implement real-time streaming content handling for AI-generated artifacts
- Add version history navigation with previous/next version support and restore functionality
- Implement auto-save with debouncing and save state tracking (idle/saving/saved/error)
- Add export capabilities for PDF, DOCX, and Markdown formats
- Implement text selection highlighting with "Ask Anything" popup for partial artifact updates
- Add canvas controls for content modification (length, reading level, polish)
- Implement canvas-chat integration with automatic artifact context in messages
- Add canvas message preview component in chat with "Open Canvas" button
- Add artifact rename dialog functionality
- Add canvas hooks for version navigation, chat integration, and context-aware message sending
- Add canvas utilities for markdown/HTML conversion and content processing
- Add 95% test coverage for chat and canvas components
- Add comprehensive Playwright E2E tests for canvas feature

## [0.31.15]

- Updated chat routing to use local LLM when toggle enabled (online or offline)
- Removed offline-only restriction from local LLM routing in use-chat-v2.ts
- Added image caching support with base64 encoding for binary data
- Updated caching logic to detect and cache images from S3, Gravatar, etc.
- Fixed Local LLM toggle enable/disable logic for Foundry and Ollama
- Removed offline mode restriction from Advanced Settings tab visibility
- Added base64 dependency for proper binary data handling

## [0.31.14]

- Support for npu models offline

## [0.31.13]

- foundry cli support

## [0.31.12]

- offline support skip sstup providers

## [0.31.11]

- offline support fix with https
  Mentor
- #1401 fixed: fix(mentor): google/onedrive/drive shouldn't display toast notification error when not creds not found
- fix(mentor): failing test due to getTenantKey on use-mentor-time-tracking hook fixed
- feat(web-containers): help center switch feature implemented #1476
- fix(mentor): notifications toast not displaying fixed by updating sonner package version #1413
- feat(web-containers): notifications validation not firing after fulfilled requirements fixed #1412
- fix(web-containers): notifications preview on inbox being empty fixed
- fix(mentor): islocalllmenabled typecheck issue fixed
- feat(web-containers): add source code editor mode to html editor feature
- feat(web-containers):resets edit template dialog form fields on close
- fix(mentor): ignore billing tab check endpoint /customer-portal when stripe is disabled

## [0.31.10]

- Adds mentor unique id to chat history filter endpoint

## [0.31.9]

- Fix rbac related issues with generating redirect tokens and chat history filtering|export
- Added error logging to RTK layer
- Made parts of the chat textarea match new Vercel version
- Fixed time tracking warning message on tenant key
- Fixed refreshing of chat messages for chats with reasoning models

## [0.31.8]

- Adds mentor unique id to chat history filter endpoint

## [0.31.7]

- Fix rbac related issues with generating redirect tokens and chat history filtering|export
- Added error logging to RTK layer
- Made parts of the chat textarea match new Vercel version
- Fixed time tracking warning message on tenant key
- Fixed refreshing of chat messages for chats with reasoning models

## [0.31.6]

- force runtime node in dockerfile to 25.3.0

## [0.31.5]

- force node 25.3.0 use to fix ALS vulnerability

## [0.31.4]

- Better manage offline support
- Fix ollama chat from prod due to https -> http

## [0.31.3]

- Remove download progress in windows and manage offline support
- Remove raw Markdown from error responses.
- Remove RBAC permission from the user agreement.
- Allow user scroll on the MCP card UI

## [0.31.2]

- remove tenants from local storage in sso-login path

## [0.31.1]

- fix(web-utils): is_advertising wrong logic injection on tenant provider fixed
- feat(web-utils): is_enterprise flag added to current tenant data
- feat(mentor): ecommerce not activated when is_enterprise flag is set to true
- feat(mentor): is_enterprise logic tests coverage in

## [0.31.0]

- chore: offline access with ollama and phi model 3 when in tauri web wrapper
- fix: https://github.com/iblai/ibl-web-frontend/issues/1158
- fix: https://github.com/iblai/ibl-web-frontend/issues/1299
- fix: https://github.com/iblai/ibl-web-frontend/issues/1264
- fix: https://github.com/iblai/ibl-web-frontend/issues/1207
- fix: https://github.com/iblai/ibl-web-frontend/issues/1300
- fix: https://github.com/iblai/ibl-web-frontend/issues/981
- fix: https://github.com/iblai/ibl-web-frontend/issues/984
- fix: https://github.com/iblai/ibl-web-frontend/issues/992
- fix: https://github.com/iblai/ibl-web-frontend/issues/1023
- fix: https://github.com/iblai/ibl-web-frontend/issues/933
- fix: https://github.com/iblai/ibl-web-frontend/issues/970
- fix: https://github.com/iblai/ibl-web-frontend/issues/1149
- fix(web-containers): use-tauri hook typecheck issue fixed
- fix(playwright): improve explore tests
- fix(mentor): service worker provider typecheck issue fixed

## [0.30.4]

- feat(web-containers): advanced tenant css implemented under advanced settings
- Fix: Add mentor-specific memory filter endpoint
- Commented out viewer and chat roles from the Access tab feature as they are not yet properly functional backend-wise. Only the editor role remains active for now.

## [0.30.3]

- Platform level rbac implementations and customizations

## [0.30.2]

- chore(mentor): replace Brain icon with Archive icon in multiple components for Memory
- fix(web-containers): prevent cursor jumps during internal updates
- fix(mentor): improve popup handling for Google authentication flow. Now the pop-up is considered a user event.
- feat(mentor): explore v2 UI implemented
- feat(mentor): explore v2 > star/unstar feature implemented
- feat(mentor): explore v2 > rbac wrapping on create custom mentor
- feat(mentor): explore v2 > overall search & filtering implemented
- feat(playwright): explore v2 > full coverage on feature

## [0.30.1]

- clear user cookie values not only when logout is forced but also when mentor is in iframe

## [0.30.0]

- refactor mentor, auth and tenant provider. allow them to skip for sso login and version urls
- proper cookie and local storage clearing on sso login complete

## [0.29.0]

- implement share chat functionality while maintain tenant and mentor shared chat came from
- implement session caching for recent messages

## [0.28.5]

- show the share chat option even for logged out users
- fix the share chat functionality to allow seeing chats when logged out and when logged into another tenant the chats weren't shared in

## [0.28.4]

- replace nextjs favicon with ibl favicon

## [0.28.3]

- chore(mentor): clear session when screen sharing and voice call will be opened up on a new tab

## [0.28.2]

- fix(mentor): runtime error on embed tab
- fix(mentor): sending proactive prompt multiple times in embed

## [0.28.1]

- fix(mentor): remove weclomenewchat component when first message is from assistant
- chore(web-utils): if app is in iframe and requested tenant is not amongst user tenants, redirect

## [0.28.0]

- ensure proactive prompts are not sent when a new session is not created
- updates maxretries to 10 in making api calls

## [0.27.0]

- implement comprehensive MCP (Model Context Protocol) connector management system
- add MCP connector dialog for creating and editing connectors with image upload support
- support multiple transport types (SSE, WebSocket, Streamable HTTP) for MCP connectors
- implement authentication methods for MCP connectors (no-auth, API key with Bearer/Basic/Token/OAuth)
- add featured connectors section with OAuth2 integration for services like Github
- add connect/disconnect functionality for OAuth-based MCP services
- implement filtering by search, date range, and transport type for MCP connectors
- implement toggle switches to activate/deactivate MCP connectors per mentor
- implement automatic tool_slugs and can_use_tools management when toggling MCP connectors

## [0.26.9]

- fix(mentor): no stringification during set item in storage service

## [0.26.8]

- Fix wrong jwt token access in web-utils

## [0.26.7]

- Enables cross context sharing across popup window for mentor AI
- Add console.error logs to the iblFetchBaseQuery function in the mentor app

## [0.26.6]

- Fixed mentor navigation from the explore mentors section
- Fix api creation time expiration bug
- Reduce the size of the scroll-to-bottom button on the chat interface
- Fix memory tab to refetch memory after deletion and creation.
- Fix memory tab fetch to use mentor id filter.
- Improve LLM switch error handling
- Fix scroll overflow in the mentor settings modal
- Fix project creation
- Fix(web-containers): non focusable search fields on catalog invite feature due to popover fixed
- Fix(playwright): existing mentor tests suites related to invite made shared feature
- Fix(playwright): playwright tests for whole invitation feature on skills implemented
- Fix(mentor): access tab role update user list search scrolling issue fix replacing popover UI with normal list view

## [0.26.5]

- feat(mentor): adds a data handler to parse ibl-data as a query param and fill up localstorage for authentication
- Remove the propagation issue when removing the mentor
- Fix navigation within the projects
- Ensure mentor switching search param is not added if user is navigating to the same mentor
- Add more context in the error messages. Tenant Key, Mentor Id, Username, Session Id
- Added new chat button in embed mode
- Added mentor logo in embed mode
- Clicking the mentor avatar on the nav-bar starts a new chat

## [0.26.4]

- fix(mentor): add visiting tenant in tenant provider

## [0.26.3]

- fix(mentor): viewable anyone access failing

## [0.26.2]

- feat(web-containers): added display_slide_panel_logo & authorize_only_password_login fields to Authentication customization setting

## [0.26.1]

- fix(rbac): get public settings for requested mentor if mentor is saved in tenant metadata without db ID
- fix(chat): ensures that during session persistence, only hides the first proactive prompt message if it is of type "ai"

## [0.26.0]

- feat(web-utils): updated pricing page endpoint to send source_platform_key payload
- fix(mentor): correct display of 'Access' settings base for admins-only
- fix(mentor): cross mentor session persistence conflicting. Saved sessions in the local storage now an object with the mentor as key and session id as value
- feat(mentor): mentor provider is now aware of mentor switches to allow fetching of new mentor rbac settings
- feat(mentor): moved from Sentry capture to console.error logs
- fix(mentor): dynamically change the position of accessibility button
- fix(mentor): fix chat history export time range format
- fix(mentor): add optional image description when training image dataset
- fix(mentor): add settings to control the visibility of the attachment, voice record and voice call buttons in-app separating the control from the embed settings.

## [0.25.1]

- chore(mentor): implements voice call and screensharing on a seperate tab
- fix(mentor): issue with image generation due to session persistence

## [0.25.0]

- chore(mentor): session persistence across refreshes
- feat(mentor): rbac use show_settings to display mentor settings dropdown
- feat(web-containers): added favicon assets upload to auth customization advanced settings
- feat(skills): updating skillsAI metatitle platform name instead
- feat(skills): authentication tenant customized favicon now appears on the skills SPA
- feat(skills): footer copyright shows the tenant name as default & fallback to env copyright variable
- feat(web-containers): fixed base url of upload file proxy url showing default app dm url
- feat(skills): update skillsAI metatitle from localstorage platform name to display_meta_title
- feat(web-containers): display_meta_title & display_favicon renamed to title & favicon
- Adds a textarea for users training images
- Adds new settings to control the attachment, voice record, and voice call in the main spa

## [0.24.3]

- fix(mentor): fix google service api layer
- fix(mentor): add more naming options for nvidia and anthropic modals
- fix(mentor): better error messages for datasets creation

## [0.24.2]

- feat(web-container): proactive learner notification integration
- feat(mentor): added explicit image handling in markdown.
- feat(mentor): added error handling for images in markdown.
- feat(mentor): added error handling for user uploaded images in chat.

## [0.24.1]

- feat(web-containers): replace s3 url from auth customization images field with new file proxy url endpoint
- feat(mentor): clear files when sessionId changes
- feat(mentor): added flagged prompts feature

## [0.24.0]

- feat(mentor): mentor access v1 feature integrated. Only users access for now
- feat(mentor): added new in-chat file upload feature

## [0.23.11]

- chore(web-utils): mentor provider select default mentor from meta data

## [0.23.10]

- chore: stringify error on public settings for visibility

## [0.23.9]

- chore(web-utils): check for empty array string for tenant before triggering refresh

## [0.23.8]

- chore(web-utils): updates redirectToAuthSpa to accept argument for saving redirect

## [0.23.7]

- fix(web-utils): looping call to get public settings for mentor due to call to determine auth before applying cookie sync check

## [0.23.6]

- chore(web-utils): auth provider updates to ensure tenant switching clears syncing cookies

## [0.23.5]

- feat(web-containers): rbac management feature updated

## [0.23.4]

- More syncing updates between cookie and localstorage

## [0.23.3]

- Better cookie and localstorage comparism sync checks

## [0.23.2]

- force redirect users with start chat failures
- add verbose logging for insights on sentry on errors
- stop sending time tracking when user data is not available

## [0.23.1]

- feat(auth): implement cross-SPA logout synchronization via cookies
- Set logout timestamp cookie in both `redirectToAuthSpa` and `handleLogout` functions
- Automatically trigger logout across all SPAs when any app initiates logout
- Migrate SSO login to reusable component from web-containers package

## [0.23.0]

- fix(rbac): settings form issue with "Who Can Chat?" and "Who Can View?" using defaults
- dm token and edx jwt token expiry checks and force logouts
- cookie with localstorage syncing
- fix: shareable token was not working with new implementation for force login

## [0.22.8]

- fix(mentor): update apitoken resource string
- feat(web-containers): rbac management feature implemented

## [0.22.7]

- fix(mentor): fixed rbac permission check for api tab

## [0.22.6]

- fix(mentor): fixed rbac permission check for api tab

## [0.22.5]

- feat(web-containers): updated mentor provider not to run logic when user is accessing public route and no mentor id is provided
- fix(mentor): fixed middleware route regex for open routes

## [0.22.4]

- fix(web-containers): RichTextEditor should handle HTML input correctly

## [0.22.3]

- feat(web-containers): auth spa customization upload endpoint integrated
- feat(web-containers): notification added on sidebar footer menu and route navigation improved

## [0.22.2]

- feat(web-containers): auth spa customization implemented

## [0.22.1]

- feat(web-containers): non mentor recommendation_type converted to catalog on payloads
- feat(web-containers): platformOrg payload added to use recommended courses endpoint
- feat(web-containers): recommendation > typecheck issues fixed

## [0.22.0]

- feat(web-containers): Implement notification v1 feature as a common component
- feat(mentor): Integrated notification feature on mentor
- feat(mentor): RichTextEditor made a common component and existing usage replace
- feat(web-containers): RichTextEditor replaces existing wysiwygEditor
- feat(web-containers): Alert template feature implemented

## [0.21.9]

- fix(mentor): hide attachment button, voice chat and voice call buttons for anonymous users

## [0.21.8]

- feat(web-containers): recommended prompts feature integrated
- feat(skills): recommended feature search endpoint integration on progress

## [0.21.7]

- feat(mentor): add google slides and google docs tools to the chat tools.
- fix(mentor): add user email and time lapsed to memory card.
- feat(mentor): move mentor embed settings from the URL to the mentor settings endpoint.

## [0.21.6]

- fix(web-containers): analytics > topics > when rating empty display conversation graph
- fix(web-containers): profile > consistency labels issue fixed
- fix(web-containers): invite > community course flag deactivated from catalog list
- fix(web-containers): analytics > topics > playwright tests updated

## [0.21.5]

- feat(web-containers): course & program catalog invite implemented

## [0.21.4]

- feat(mentor): update get credentials endpoint to allow students to fetch credentials.

## [0.21.3]

- chore(mentor): use mentor db to load rbac permissions for a mentor

## [0.21.2]

- feat(mentor): add filters to memory tab. Filter by date range, category and username.

## [0.21.1]

- chore: adds NEXT_PUBLIC_ENABLE_RBAC to the entrypoint.sh

## [0.21.0]

- feat(rbac): add WithPermissions component for resource-based access control
- feat(rbac): implement rbacPermissionToDisplay utility for field-level permission checking
- feat(rbac): add checkRbacPermission function for resource path validation
- feat(rbac): integrate RBAC permissions with mentor settings and user type determination
- feat(rbac): add support for read, write, and delete permissions at field level
- feat(rbac): implement RBAC slice for centralized permission state management
- feat(rbac): add configurable RBAC enablement with config.enableRBAC() support
- feat(rbac): integrate permissions with useUserType hook for comprehensive access control
- fix(rbac): handle null/undefined permission objects gracefully with fallback defaults
- fix(rbac): support both boolean and string RBAC configuration values

## [0.20.15]

- fix(web-containers): analytics > financial page 500 issue on hover of cost per day graph

## [0.20.14]

- fix: hide project action buttons from students
- fix: update projects datasets table UI to match what is in the DatasetsTab
- feat: hide accessibility menu in embed mode
- feat: add google slides and google docs tools to the chat tools.
- fix(web-containers): analytics > topics > conversation y-axis shouldn't be decimal
- fix(web-containers): analytics > optimize axis charts
- fix(web-containers): analytics > transcript > unify conversation transcript titles
- fix(web-containers): analytics > transcript > loader added on search & label unification
- fix(web-containers): patched analytics > data reports download not to use window.open
- feat(web-containers): csv uplaod editor implemented
- feat(web-containers): csv uplaod editor integrated on invite user feature

## [0.20.13]

- fix(mentor): update the vector documents api call to use username instead of user id.
- style(mentor): update the voice call modal to make it more UI/UX friendly.

## [0.20.12]

- feat(web-containers): custom dns now has a verification feature for domains
- feat(mentor); updated rich text editor to be more fluid and have more options

## [0.20.11]

- fix: implementation for advertising tenant with user exhausted credits

## [0.20.10]

- style: updated chat textarea to be smaller in small screens
- style: reduce the clutter in the embed when suggested prompts are showing
- feat(mentor): extend toast message error to sentry capture Mentor [#801](https://github.com/iblai/ibl-web-frontend/issues/801)
- fix unrelated typecheck & lint issues

## [0.20.9]

- fix: unauthenticated user in advertising tenant not seeing advert

## [0.20.8]

- chore: change tenant advertisement implementation to use is_advertising from tenant public metadata
- fix: issue with mentor viewable by anyone and chat requiring auth in share chat functionality

## [0.20.7]

- [#595](https://github.com/iblai/ibl-web-frontend/issues/595) - Custom DNS implemented
- feat: added new accessibility menu
- fix: updated memories tab text
- fix: updated LaTeX preprocessor to only process string values

## [0.20.6]

- fix(auth): add tenant membership check before initiating join tenant flow
- feat(web-utils): enhance tenant provider to fetch and merge platform metadata from user apps
- fix(mentor): add missing `selectShowingSharedChat` selector to test mocks

## [0.20.5]

- updated "Explore" text in sidebar to "Mentors"
- updated LLM Modal UI
- changed table view of the datasets
- added document retrain feature
- [#660](https://github.com/iblai/ibl-web-frontend/issues/660) - Extend Profile Component by including Education, Experience, Resume tabs

## [0.20.4]

- [#756](https://github.com/iblai/ibl-web-frontend/issues/756) - Enable community mentors by default

## [0.20.3]

- fix(mentor): fix the accessibility issues in the embed button
- chore(mentor): show advanced features for students in main tenant
- fix(mentor): missing divider in user profile dropdown
- fix(mentor): removed the alert on auto join tenant

## [0.20.2]

- fix(mentor): public access points edge issues

## [0.20.1]

- fix(web-containers): Analytics data reports issue with playwright tests fixed

## [0.20.0]

- feat(mentor): Implemented comprehensive access control system for mentors with support for anonymous access, visiting users, and tenant-based authentication
- feat(mentor): Added advertising controls for login prompts and feature upsells
- updated latex pre processor to handle more latex options
- fix navigation from the create-mentor route to take user to the newly created mentor
- added user agreement toggle to the user agreement card under disclaimers tab
- fixed accessibility with with the embed mentor button

## [0.19.9]

- fix(web-containers): Analytics > Data Reports investigate data report issue

## [0.19.8]

- fix(web-containers): Analytics > Data Reports Troubleshoot race condition issue on report display

## [0.19.7]

- feat(web-containers): Analytics > Data Reports feature implemented

## [0.19.6]

- chore(mentor): update the title texts in the error pages
- chore(mentor): use "Community" for main tenant in the user profile dropdown

## [0.19.5]

- chore(ci): resolve linting, typechecking issues

## [0.19.4]

- feat(mentor): hide new projects behind a paid feature
- feat(mentor): new ui for the public view of the anonymous mentor and mentor viewable by anyone
- fix(mentor): fix the vector documents title overflowing
- fix(mentor): fix the overflow in the share page
- feat(mentor): added auth popover to the public view if mentor is main
- feat(mentor): remove the auth modal in the share screen when a user tries to log in

## [0.19.3]

- chore(mentor): supress sentry time tracking logs
- chore(mentor): restructure user profile and account mangement. no extra api calls made to acheive

## [0.19.2]

- [#644](https://github.com/iblai/ibl-web-frontend/issues/644) - Remove min_message payload from transcript endpoint

## [0.19.1]

- [#594](https://github.com/iblai/ibl-web-frontend/issues/594) - integrated Analytics component from web-containers
- Increased size of ecommerce pricing modal to 95vw

## [0.19.0]

- fix(mentor): Ensures sessions are created for every new mentor switch (also considers mentors in projects)

## [0.18.7]

- fix(mentor): UI alignment in the sidebar
- fix(mentor): ellipsis issue on sidebar
- fix(mentor): fix tenant logo not rendering in the share page

# [0.18.6]

- fix(mentor): start "new chat" feature is fixed to make sure chats are explicitly started
- fix(mentor): fix "new chat" button height
- fix(mentor): fix "new chat" button to margin to match the design
- fix(mentor): fix sidebar scroll when the user is on the analytics page
- fix(mentor): show proper tenant logo in the share page

## [0.18.5]

- fix(mentor): [#600](https://github.com/iblai/ibl-web-frontend/issues/600) - update voice call feature
- fix(mentor): [#584](https://github.com/iblai/ibl-web-frontend/issues/584) - update sidebar to match v0

## [0.18.4]

- [#596](https://github.com/iblai/ibl-web-frontend/pull/596) - Public Registration join link updated

## [0.18.3]

- fix(mentor): add proper error message when updating tools
- fix(mentor): fix the order of tenant key to the logo component, props first then params

## [0.18.2]

- [#570](https://github.com/iblai/ibl-web-frontend/issues/570) - Mentor | Datasets > Add temporary env variable allowing to disable some datasets resources from being added
- [#557](https://github.com/iblai/ibl-web-frontend/issues/557) - Mentor | Advanced mentor embed should display Suggested prompts or guided prompt or the welcome message as fallback
- [#541](https://github.com/iblai/ibl-web-frontend/issues/541) - Mentor | Advanced Mentor should display suggested prompts instead of static ones
- feat(mentor): recent messages and pinned messages should navigate to the correct view.
- fix(mentor): update `AI Disclaimer` to `Advisory`
- fix(mentor): show current mentor image in the share page
- fix(mentor): show current tenant image in the share page
- fix(mentor): update the projects UI to reflect what's on v0

## [0.18.1]

- Removed the auth modal that pops up when a user clicks login. Now the user clicks log in button and is redirected to the auth SPA.
- Made the public mentors `mentors viewable by anyone`, publicly accessible without requiring auth

## [0.18.0]

- [#536](https://github.com/iblai/ibl-web-frontend/issues/536) - Remove "Delete All" button from "all" category in memory tab
- [#401](https://github.com/iblai/ibl-web-frontend/issues/401) - Add new disclaimers tab and user agreement modal
- [#400](https://github.com/iblai/ibl-web-frontend/issues/407) - Add new projects feature
- [#530](https://github.com/iblai/ibl-web-frontend/issues/530) - Add iframe permission for screen sharing

## [0.17.0]

- feat(mentor): add new mentor memory feature [#421](https://github.com/iblai/ibl-web-frontend/issues/421) [#446](https://github.com/iblai/ibl-web-frontend/issues/446)
- feat(web-containers-mentor): [#496](https://github.com/iblai/ibl-web-frontend/issues/496) Add a public platform membership toggle + join link when enabled

## [0.16.2]

- [#499](https://github.com/iblai/ibl-web-frontend/issues/499) - NEXT_PUBLIC_STRIPE_ENABLED env var missing on the entrypoint.sh

## [0.16.1]

- [#488](https://github.com/iblai/ibl-web-frontend/issues/488) - Analytics > Make sure the Today’s filter bring out hours instead of repetitive same date label
- [#491](https://github.com/iblai/ibl-web-frontend/issues/491) - Bring back the embed icon subtitle feature

## [0.16.0]

- [#461](https://github.com/iblai/ibl-web-frontend/issues/461) - Add new UI view for a non-logged-in user.
- Accessibility(mentor): remove alt text from My Mentors icon for accessibility purposes

## [0.15.23]

- [#477](https://github.com/iblai/ibl-web-frontend/issues/477) Web Containers | Account > Advanced : Implement setting tenant SMTP Credentials

## [0.15.22]

- [#475](https://github.com/iblai/ibl-web-frontend/issues/475) - Show tenant key at first before Organization name fetch from endpoint & should be cached & invalidated upon mutation

## [0.15.21]

- [#414](https://github.com/iblai/ibl-web-frontend/issues/414) Refactored user profile dropdown
- [#466](https://github.com/iblai/ibl-web-frontend/issues/466) Web containers > Account component > Management > Updating roles not updating row dropdown fixed
- [#424](https://github.com/iblai/ibl-web-frontend/issues/424)
- [#434](https://github.com/iblai/ibl-web-frontend/issues/434)

## [0.15.20]

- fix(mentor): fix the accessibility issues in the add prompt modal [#453](https://github.com/iblai/ibl-web-frontend/issues/453)

## [0.15.19]

- fix(mentor): fix the accessibility issues in the add prompt modal [#453](https://github.com/iblai/ibl-web-frontend/issues/453)

## [0.15.18]

- [#406](https://github.com/iblai/ibl-web-frontend/issues/406) - Analytics new fixes updated

## [0.15.17]

- feat(mentor): implements time tracking

## [0.15.16]

- feat(mentor): at start of embed, only add embed to the dom when the user clicks on the bubble to prevent loading when user has not clicked triggering login on every load

## [0.15.15]

- refactor: update how sentry initializes
- fix: get shareable token using undefined as userId

## [0.15.14]

- chore: CODE REFACTORING with linting checks, type checks, branch naming checks, test checks, build checks, commit message checks
- fix(ci): isServer is declared but never used in next.config.ts
- chore(sentry): update sentry config

## [0.15.13]

- Fix video training not working for datasets.

## [0.15.12]

- [#404](https://github.com/iblai/ibl-web-frontend/issues/404) - Fix mentor accessability issues

## [0.15.11]

- [#404](https://github.com/iblai/ibl-web-frontend/issues/404) - Fix mentor accessability issues

## [0.15.10]

- [#402](https://github.com/iblai/ibl-web-frontend/issues/402) - Mentor Settings dropdown menu (not New chat) shouldn't appear on PRE_FREE_MODE
- fix(mentor): fix the my mentors modal to close modal when the currently selected mentor is clicked

## [0.15.9]

- fix(mentor): fix the accessibility issues in the history tab

## [0.15.8]

- add(mentor): useIframeMessageHandler to main Providers

## [0.15.7]

- accessibility(mentor): fix the accessibility for the explore page
- feat(mentor): made the base mentor configurable via env variables
- feat(mentor): add line clamp to the mentor description on explore section on the home page

## [0.15.6]

- [#395](https://github.com/iblai/ibl-web-frontend/issues/395) - Chat History > Fix overflow + markdown bug mobile display of selected chat conversation

## [0.15.5]

- add(mentor): add stg.explainer.kaplan.ai to the next.config.ts file

## [0.15.4]

- add(mentor): expect mentor sso login to accept redirect-path to overide existing one in localStorage
- fix(mentor): convert enableRBAC config value to return a boolean directly

## [0.15.3]

- [#355](https://github.com/iblai/ibl-web-frontend/issues/355) - Fix accessibility issues in the mentor app

## [0.15.2]

- [#378](https://github.com/iblai/ibl-web-frontend/issues/378) - Analytics > Transcript tab integrated

## [0.15.1]

- [#387](https://github.com/iblai/ibl-web-frontend/issues/387) - New Analytics UI issues fixed

## [0.15.0]

- feat(mentor): add disclaimer text to the chat input form from the mentor settings
- feat(mentor): display the disclaimer based on if the disclaimer text exists or not
- feat(mentor): add new toggles to the embed tab

## [0.14.6]

- [#384](https://github.com/iblai/ibl-web-frontend/issues/384) - Fix issue related to mentor dropdown not showing on Syracuse + Miscelleanous

## [0.14.5]

- [#378](https://github.com/iblai/ibl-web-frontend/issues/378) - Integrate endpoints to New Analytics UI

## [0.14.4]

- feat(mentor): added a logging system to the mentor app
- feat(mentor): added logs around the log in process.

## [0.14.3]

- updates(mentor): adds missing event listener for postmessage in providers

## [0.14.2]

- updates(mentor): adds listener for axd token to Providers

## [0.14.1]

- [#372](https://github.com/iblai/ibl-web-frontend/issues/372)
- Clicking on Modify (fork) on a Community mentor under a PRE_FREE_TRIAL should open PRICING MODAL
- When org name isn't yet updated, use Account as display name on Tenant Switcher
- Update Try it now to View all

## [0.14.0]

- adds(mentor): extra sentry configuration files to ensure sentry works
- fix(mentor): create a redirect api to initiate redirect to auth SPA

## [0.13.18]

- fix(mentor): fix the redirect to auth spa to use window.open instead of window.location.href
- fix(mentor): remove finally block from auth provider to prevent rendering of the children component when an error occurs

## [0.13.17]

- [#361](https://github.com/iblai/ibl-web-frontend/issues/361) - Fix Admin features on PRE_FREE_TRIAL mode working fine instead of opening Stripe Pricing UI

## [0.13.16]

- fix(mentor): fix the positioning of the mentor name in the iframe component.
- fix(mentor): remove the add datasets from using the useNavigate hook to using the useState hook.

## [0.13.15]

- [#349](https://github.com/iblai/ibl-web-frontend/issues/349) For community mentors, Edit mentors modal and tabs shouldn't be available until forkable feature ready
- [#357](https://github.com/iblai/ibl-web-frontend/issues/357) Implement Community Mentor fork feature

## [0.13.14]

- fix(mentor): fix the logo to be responsive
- [#350](https://github.com/iblai/ibl-web-frontend/issues/350) - Edit Mentor > History | Chat History breaking app when Anonymous chat is clicked upon because of non existing email

## [0.13.13]

- fix(mentor): fix the welcome chat to use the username as empty string if no username is provided

## [0.13.12]

- [#342](https://github.com/iblai/ibl-web-frontend/issues/342) - on mobile, remove the banner's button containing array icon and on click, trigger default button action
- [#344](https://github.com/iblai/ibl-web-frontend/issues/344) - Implement Community Mentors Feature and make explore page loads community mentors when enabled

## [0.13.11]

- [#340](https://github.com/iblai/ibl-web-frontend/issues/340) - Fix Header mentor dropdown menu on mobile leading by default to settings tabs instead of targeted tab

## [0.13.10]

- [#315](https://github.com/iblai/ibl-web-frontend/issues/315) - Show proactive prompt in home page
- [#297](https://github.com/iblai/ibl-web-frontend/issues/297) - Update the mentor SPA sidebar to match v0
- [#296](https://github.com/iblai/ibl-web-frontend/issues/296) - Update the mentor SPA navbar to match v0
- [#295](https://github.com/iblai/ibl-web-frontend/issues/295) - Fix dropbox datasets upload

## [0.13.9]

- [#336](https://github.com/iblai/ibl-web-frontend/issues/336) - Update Edit Mentor > History tab UI + endpoints integration

## [0.13.8]

- updates(mentor): removes unneccessary fetchUserMetadata api call

## [0.13.7]

- [#334](https://github.com/iblai/ibl-web-frontend/issues/334) - Extend Invite feature to incorporate bulk upload + Catalog Invite

## [0.13.6]

- feat(mentor): display system prompts in markdown format
- feat(mentor): add retry logic for websocket connection
- fix(mentor): fix the prompts tab to be responsive

## [0.13.5]

- [#315](https://github.com/iblai/ibl-web-frontend/issues/315) - Show proactive prompt in home page v3.
- [#314](https://github.com/iblai/ibl-web-frontend/issues/314) - Show guided prompts for anonymous embeds.

## [0.13.4]

- [#322](https://github.com/iblai/ibl-web-frontend/issues/322) - Wrapped contact email in system dark mode appears not too visible

## [0.13.3]

- updates(mentor): allows redirect to auth spa without logout in redirectToAuthSPA callback in AuthProvider
- [#306](https://github.com/iblai/ibl-web-frontend/issues/307) - Wrap chat error toast message with contact us mailto link

## [0.13.2]

- fix(mentor): fix the dataset file upload initialization point

## [0.13.1]

- fix(|web-containers): remove sentry from web containers
- fix(mentor): add sentry as a server action

## [0.13.0]

- feat(mentor): add delete mentor feature
- feat(mentor): add config to hide analytics
- feat(mentor): add config for dataset file upload limit
- feat(mentor): add new explore page for mentors when no mentor is selected
- feat(mentor): add better error handling pages for depending on the error code
- feat(web-containers): add shareable error pages and components with sentry error reporting

## [0.12.17]

- updates(mentor): clear localstorage on redirectToAuthSPA
- updates(mentor): dispatch storage event on receiving new localstorage data via postmessage

## [0.12.16]

- [#284](https://github.com/iblai/ibl-web-frontend/issues/284) - Updating Advanced tab component

## [0.12.15]

- feat(mentor): add the mentor training maximum file size to be configurable via env variables
- fix(mentor): make sure the dropbox files sent to the backend are arrays

## [0.12.14]

- fix(mentor): hide the prompt button in chat if no prompts are available

## [0.12.13]

- [#284](https://github.com/iblai/ibl-web-frontend/issues/284) - Have an Advanced tab on the Account component handling metadatas for each SPA

## [0.12.12]

- fix(mentor): fix the prompt gallery add prompt button to only be visible to non students

## [0.12.11]

- fix(mentor): fix the starter templates, explore mentors and tools section to be visible to logged in users only
- fix(mentor): center the mentor name in the welcome chat new component

## [0.12.10]

- fix(mentor): fix the prompts tab to use the prompt search endpoint
- fix(mentor): add "All" category to the prompt gallery modal
- fix(mentor): starter templates automatically start the chat when clicked
- fix(mentor): guided prompts auto start chat in default embed mode
- fix(mentor): fix the add prompts button to match the new design

## [0.12.9]

- fix(mentor): fix the app banner to be configurable via env variables
- accessibility(mentor): fix the invite user dialog title and description

## [0.12.8]

- fix(mentor): fix the chat input form buttons to display relative to the window width
- accessibility(mentor): fix the send invite button html semantics.
- fix(mentor): hide the prompts button in embed mode.
- fix(mentor): hide disabled buttons in the inside buttons.

## [0.12.7]

- accessibility(mentor): fix the LLM provider modal button accessibility/semantic html

## [0.12.6]

- accessibility(mentor): fix the notitifications dropdown button aria-label
- accessibility(mentor): fix the explore mentors and tools section button height

## [0.12.5]

- [#275](https://github.com/iblai/ibl-web-frontend/issues/275) - Handle show Ecommerce banner whenever a 402 is received from any endpoint on all SPAs
- [#275](https://github.com/iblai/ibl-web-frontend/issues/275) - Making the chat toast error message on credit count exhausted persistent

## [0.12.4]

- fix(mentor): added back the same default mentor UI for the embed.

## [0.12.3]

- fix(mentor): mentor banner only appears for main tenant and make banner configurable
- fix(mentor): fixed chat textbox inner buttons to display relative to the window width
- fix(mentor): stop rendering of the use responsive hook to optimize app performance

## [0.12.2]

- [#271](https://github.com/iblai/ibl-web-frontend/issues/271) - Integrate new invite user UI

## [0.12.1]

- [#267](https://github.com/iblai/ibl-web-frontend/issues/267) - Have new notifications UI as common component

## [0.12.0]

- feat(mentor): added new mentor home page

## [0.11.7]

- [#254](https://github.com/iblai/ibl-web-frontend/issues/254) - Optimize Profile dropdown component fixing profile image on upload not showing up on the profile dropdown trigger

## [0.11.6]

- fix(mentor): add auth data while signalling loaded
- update(mentor): remove the use of useSearchParams from next/navigation in the useAdvancedChat
- [#246](https://github.com/iblai/ibl-web-frontend/issues/246) - Now using the Integration & credentials endpoints for Schema & LLMs

## [0.11.5]

- [#246](https://github.com/iblai/ibl-web-frontend/issues/246) - External Provider Keys integration on Account component

## [0.11.4]

- update(mentor): redirect to no mentors page only if mentor is not in embed mode
- update(mentor): reload the UI when mentor receive auth data while in embed mode

## [0.11.3]

- update(data-layer): Ensure that a token is defined before sending the authorization header

## [0.11.2]

- [#254](https://github.com/iblai/ibl-web-frontend/issues/254) - User Profile dropdown now a common component, in use, replacing old Profile dropdown component

## [0.11.1]

- updates(mentor): saveUserObjectToLocalStorage save stringified JSON data
- updates(mentor): tenant provider only determines user route when user is not accessing a public route

## [0.11.0]

- fix(mentor): redirect loop caused by 401s on logout getting user's metadata
- update(mentor): send loaded signal before ready signal
- update(web-container): add defaulthandler to useIframeHandler" -m "add default handler for auth data sent over postmessage

## [0.10.10]

- updates(mentor): initiate logout on 401 while redirecting to auth SPA

## [0.10.9]

- [246](https://github.com/iblai/ibl-web-frontend/issues/246) - Integration > External Provider feature 95% done but disabled until backend gives out appropriate provider fields list endpoint
- [#247](https://github.com/iblai/ibl-web-frontend/issues/247) - Account component > Organization > Dark logo container background set to dark
- [#247](https://github.com/iblai/ibl-web-frontend/issues/247) - Account component > Integration > Responsiveness optimized
- [#247](https://github.com/iblai/ibl-web-frontend/issues/247) - Profile component > Socials > Wrongful error message displayed on all socials input field on blur of one field

## [0.10.8]

- accessibility(mentor): add focus trap to the embed iframe
- accessibility(mentor): add proper ARIA to the embed navbar dropdown menu
- accessibility(mentor): fix the color of the chat input placeholder

## [0.10.7]

- [#225](https://github.com/iblai/ibl-web-frontend/issues/225) - Update Web Container Profile & Account UI + Add Organization Tab + API Key UI

## [0.10.6]

- update(mentor): remove extra padding bottom in mobile screens chat input form

## [0.10.5]

- add(mentor): create AutoResizeTextarea for growing textarea on mobile

## [0.10.4]

- fix(mentor): stop using flowbite tooltip for shadcn-ui tooltip component
- fix(mentor): fix the grammar and capitalization of the tooltip content

## [0.10.3]

- fix(web-utils): add error to to error handler interface in use-advanced-chat hook to make for more robust error handling
- fix(mentor): fix text overflow in the chat messages
- fix(mentor): add sentry reporting to the use advanced chat hook

## [0.10.2]

- fix(mentor): fix mentor image upload.
- fix(mentor): increase modal width and adjust form layout in CreateMentorModal
- fix(mentor): integrate screen sharing toggler in have real-time effect on the screen share button
- feat(web-utils): add screen sharing capability to advanced chat hook and update WEB_SEARCH tool name and add SCREEN_SHARE constant
- fix(mentor): enhance create mentor modal button feedback andupdate toast notifications and error handling in useCreateMentor hook

## [0.10.1]

- fix(mentor): fix error handling when initializing the screen sharing/call service
- fix(mentor): error handling when adding training document.

## [0.10.0]

- feat(mentor): integrate screen sharing with livekit

## [0.9.16]

- [#227](https://github.com/iblai/ibl-web-frontend/issues/227) - Embedded mentor bubble logo doesn't match default fallback icon when no image selected

## [0.9.15]

- fix(mentor): fix recent messages filter for logged in users
- fix(mentor): make help and support buttons work in embed mode

## [0.9.14]

- [#218](https://github.com/iblai/ibl-web-frontend/issues/218) - Ecommerce bug on new user showing banner despite credits count available

## [0.9.13]

- [#216](https://github.com/iblai/ibl-web-frontend/issues/216) - Add necessary CSS classnames to layout for embed customizations

## [0.9.12]

- [#210](https://github.com/iblai/ibl-web-frontend/issues/210) - Embed Custom Floating Icon should support more options : padding, image size, shadow flag, stroke etc added

- [#211](https://github.com/iblai/ibl-web-frontend/issues/211) - Profile picture upload feature implemented

- [#212](https://github.com/iblai/ibl-web-frontend/issues/212) - Gravatar fallback usage on profile pic now a flag under env variables

- [#213](https://github.com/iblai/ibl-web-frontend/issues/213) - Add Embed Default External CSS URL Env variable feature

## [0.9.11]

- fix(mentor): fixed iframe open by default not working

## [0.9.10]

- accessibility(mentor): add iframe accessibility when user clicks iframe chat bubble
- accessibility(mentor): mentor tab accessibility on small screens

## [0.9.9]

- [#201](https://github.com/iblai/ibl-web-frontend/issues/201) - Toast error message optimized to show backend error as priority
- feat(mentor): integrate react-syntax-highlighter for enhanced code formatting in markdown
- feat(mentor): add CopyButtonIcon component for clipboard functionality
- feat(mentor): add iframe check before setting external CSS in Providers component
- accessibility(mentor): made iframe accessibility when user clicks iframe chat bubble

## [0.9.8]

- [#201](https://github.com/iblai/ibl-web-frontend/issues/201) - Website Crawl Dataset Resource implemented + Accessibility features

## [0.9.7]

- add(mentor): show a permanent toast for a shareable link to inform the user that the token is disabled

## [0.9.6]

- [#194](https://github.com/iblai/ibl-web-frontend/issues/194) updated : Overall UI made consistent + optimization

## [0.9.5]

- fix(mentor): update iframe bubble image url

## [0.9.4]

- updates(mentor): Dockerfile to pnpm install from package.json

## [0.9.3]

- [#194](https://github.com/iblai/ibl-web-frontend/issues/194) - Embed Custom Floating Bubble integration added

## [0.9.2]

- fix(mentor): remove create mentor modal from the modal container
- fix(mentor): add sentry error handling to all catch blocks

## [0.9.1]

- fix(mentor): iframe chat bubble image
- fix(mentor): chat input form button alignment
- fix(web-utils): update tenant key handling in TenantProvider to use context
- accessibility(mentor): made the chat bubble button accessible

## [0.9.0]

- invalidate the shearable link api caches by just mutating on update instead of invalidating completely (which may lead to extra api calls)
- add sentry configurations

## [0.8.13]

- feat(web-utils): enhance loading state management in auth, mentor, and tenant providers
- refactor(web-utils): update tenant key handling in MentorProvider and TenantProvider to use context
- fix(mentor): adjust text alignment in LLM provider modal for improved readability

## [0.8.12]

- feat(web-utils): add custom hook for fetching mentor settings and integrate it into advanced chat
- fix(mentor): fix welcome message handling and WebSocket connection logic
- ui(web-containers): update SelectTrigger class for improved SVG visibility
- refactor(mentor): simplify user profile dropdown by consolidating help options into a single item

## [0.8.11]

- [#186](https://github.com/iblai/ibl-web-frontend/issues/186) - Mobile chat on safari browser weirdly zooms SPA + Mentor Settings modal to be made bigger
- [#188](https://github.com/iblai/ibl-web-frontend/issues/188) - Weird display bug issue on vertical very tight scroll

## [0.8.10]

- [#186](https://github.com/iblai/ibl-web-frontend/issues/186) - Mobile chat on safari browser weirdly zooms SPA + Mentor Settings modal to be made bigger

## [0.8.9]

- [#184](https://github.com/iblai/ibl-web-frontend/issues/184) - Ecommerce feature : Banner appears on users with old product skus & expiry date display issue fixed

- [#181](https://github.com/iblai/ibl-web-frontend/issues/181) - Newest Vercel UI Mentor Settings tabs header layout from horizontal display to vertical display update integration

## [0.8.8]

- [#179](https://github.com/iblai/ibl-web-frontend/issues/179) - Update Tenant Switching Component Props
- fix(mentor): add mentorId to useGetLllmsQuery as query param filer
- fix(mentor): adjust the rich text editor to not overflow the container

## [0.8.7]

- feat(mentor): add KaTeX support for rendering mathematical expressions in markdown
- feat(mentor): enhance help center navigation with keyboard accessibility
- feat(mentor): add Help Center URL to environment variables and user profile navigation to help users get help
- fix(mentor): standardize logout text casing in user profile navigation
- fix(mentor): adjust spacing in user profile navigation and update logout text for consistency
- fix(web-containers): adjust padding in tenant selection trigger for improved layout

## [0.8.6]

- accessibility(mentor): update the user profile dropdown to allow keyboard navigation
- accessibility(mentor): added auto complete to input fields

## [0.8.5]

- fix (mentor) : Ecommerce flow updated as no longer modal being displayed on executeWithTrialCheck function
- feat(mentor): integrate user role checks and free trial dialog in prompt card component
- feat(mentor): add 'metadata' field to nav bar and edit mentor modal
- fix(mentor): update aria-label and placeholder in EditPromptModal for clarity
- fix(mentor): re-enable disabled state for CopyButton in prompts tab && disable guided prompt when write is false
- refactor(mentor): rename 'mentor' field to 'mentor_name' in settings form and related components
- feat(mentor): update prompts and safety tabs to display 'Active' or 'Inactive' status based on settings
- fix(mentor): enable button functionality in settings tab and remove unnecessary class from input

## [0.8.4]

- fix(mentor): replace WithPermissionsView with WithFormPermissions

## [0.8.3]

- fix(mentor): remove validated values from the settings tab

## [0.8.2]

- feat(mentor): integrate WithPermissionsView for moderation and safety system toggles in SafetyTab
- feat(mentor): enhance settings tab to include additional mentor details in form submission
- feat(mentor): add WithPermissionsView component to manage field permissions in PromptsTab
- refactor(mentor | web-utils): rename setMessages to setMessage and update to handle single message instead of array
- fix(mentor): ensure username is checked before refetching recent messages
- refactor(web-utils): update chat hook export to use new version

## [0.8.1]

- Admins under main are excluded from Ecommerce Restrictions even when not having credits

## [0.8.0]

- implement shareable link in embed tab

## [0.7.3]

- fix(mentor): make the selected recent message highlighted.
- fix(mentor): refetch the recent messages after the first AI message is streamed.
- fix(mentor): update form data to properly update the mentor name.

## [0.7.2]

- [#160](https://github.com/iblai/ibl-web-frontend/issues/160) fix (mentor) : - Ecommerce Feature + Mentor SPA : Ecommerce new flow update + restrictions

## [0.7.1]

- feat(mentor): mentor public settings endpoint is now only used by non logged in users.
- feat(mentor): logged in users use the mentor settings endpoint.

## [0.7.0]

- feat(mentor): removed the get mentor details endpoint from

## [0.6.10]

- fix(mentor): make recent messages filter by the current mentor

## [0.6.9]

- fix(mentor): settings modal mentor list. Fixing the type errors, isLoading, isFetching not properly exported making the app to crash

## [0.6.8]

- feat(analytics): implemented comprehensive analytics system with mentor selection state management, replacing direct API calls with centralized state handling across analytics pages
- feat(mentor): enhanced mentor selection functionality for both analytics view and standard navigation workflows
- feat(mentor): integrated analytics actions with improved modal navigation and user interface updates
- fix(mentor): improved mentor name display in navigation bar by removing unnecessary text elements
- fix(mentor): enhanced API key management with proper handling of null values for creation and expiration dates
- chore(mentor): removed debug logging from useMentorsWithPagination hook for cleaner production code

## [0.6.7]

- fix(mentor): withPermissions delete functionality in api-tab

## [0.6.6]

- fix(mentor): withPermissions delete functionality

## [0.6.5]

- feat(mentor): implemented comprehensive RichTextEditor with toolbar and formatting options to replace basic Textarea components across modals (AddPromptModal, EditMentorModalDialog, EditPromptModal)
- feat(mentor): added Tiptap extensions and markdown-to-HTML conversion utilities for enhanced text editing
- fix(web-utils): improved WebSocket connection handling for better stability

## [0.6.4]

- updates(mentor): add permission wrappers for the api tab

## [0.6.3]

- fix(mentor): update Google Drive picker configuration to disable multiselect and improve accessibility by enabling pointer events on picker elements
- updates(data-layer): adds types to mentorReducer
- feat(mentor): introduce REDIRECT_PATH_LOCAL_STORAGE_KEY constant and update tenant switching logic to use it
- feat(mentor): add link functionality to document titles in DocumentSidebar for improved navigation
- refactor(mentor): simplify export chat history logic and improve loading state handling in HistoryTab
- refactor(mentor): utilize parsePrompt utility for rendering prompts in PromptsTab, SafetyTab, and PromptCard components
- feat(mentor): integrate rehype and remark for HTML to Markdown conversion in utils.ts
- refactor(mentor): update success toast messages to indicate documents are queued for training

## [0.6.2]

- fix(mentor): disable delete in datasetitem component if no delete permission is set

## [0.6.1]

- updates(mentor): enable field level permission access in rbacPermissionToDisplay

## [0.6.0]

- permissions update to make use of object level permission and field level permissions seperately
- updates(mentor): adds delete object level permission and expose canDelete to child of WithFormPermissions

## [0.5.1]

- refactor(mentor): improve layout and styling in PromptGalleryModal for better responsiveness
- fix(mentor): Update the tooltips to have capitalize texts
- fix(mentor): use the correct key for the payload for addTrainingDocument
- fix(mentor): correct xai image extension
- refactor(mentor): attempt to get all logos from backend even the main tenant logo
- fix(mentor): update S3 hostname configuration to allow wildcard subdomains
- feat(mentor): add new hostname configuration for AI manager
- refactor(chat-hook): optimize web browsing check with useMemo and add effect for tool dispatch
- feat(mentor): refactor web search button into a separate component for improved readability and maintainability
- fix(chat-hook): dispatch tools in useAdvancedChat after response
- fix(chat-hook): add TypeScript ignore comment for userId in editSession call
- fix(chat-hook): add type annotation for tool slug in mentor tools mapping
- fix(mentor): update can_use_tools logic to reflect tool availability based on selected tools
- fix(tenant-provider): update tenant determination logic to handle local storage and public route access
- feat(chat-input): integrate active tools management and update session tools functionality
- feat(constants): add TOOLS constant for web search tool
- feat(profile): add validation schema for social media usernames in profile form
- feat(advanced-chat): implement updateSessionTools function to manage active tools in chat sessions
- feat(session-api): add editSession mutation to update session data
- feat(chat-slice): add tools state and actions for managing chat tools
- fix(tools-tab): update tool handling to ensure proper slug mapping and include can_use_tools in formData
- refactor(mentor): enhance Google Drive picker integration with Next.js Script component and proper state management
- feat(mentor): add comprehensive error handling and force close functionality to Google Drive picker to prevent stuck modals
- feat(mentor): implement complete reset mechanism for Google Drive picker to ensure fresh start on each use
- fix(mentor): remove 'All' option from PromptGalleryModal and set first category as default selection
- fix(mentor): add type annotations for category in PromptGalleryModal to improve type safety
- chore(web-containers): update tsconfig.json to adjust rootDir and enhance path mappings for data-layer integration

## [0.5.0]

- updates(mentor): accept email param on the root route and use that to initiate login via otp into that email

## [0.1.0]

- Update @iblai/data-layer to 0.0.5
- Update @iblai/web-containers to 0.0.6
- Update tailwind configuration to pick up classnames from @iblai/web-containers

## [0.0.3]

- fix dynamic env load on runtime. Add .env.js reference to script
- hides the recent messages and pinned messages in mobile or when the sidenav is closed

## [0.0.2]

- adds the vector documents listing on the right side
- adds the recent messages and pinned messages on the left side
- update config to override build time environments with runtime environments

## [0.0.1]

- Initial Release
