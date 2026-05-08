# Changelog

## [0.63.10](https://github.com/iblai/mentorai/compare/v0.63.9...v0.63.10) (2026-05-08)

### CI

- **pr-e2e:** add runs-on to reusable workflow calls ([52490ef](https://github.com/iblai/mentorai/commit/52490ef98a41cc04d9e2b86e626fe61068c6130d))

## [0.63.9](https://github.com/iblai/mentorai/compare/v0.63.8...v0.63.9) (2026-05-08)

### Bug Fixes

- **ci:** use generic sed pattern to match any image URI in docker-compose ([33d89c6](https://github.com/iblai/mentorai/commit/33d89c60d7cef4d807bf7541505cf9b1a60e5d79))

## [0.63.8](https://github.com/iblai/mentorai/compare/v0.63.7...v0.63.8) (2026-05-08)

### Tests

- add unit tests for Version and FileUpload components ([a291ad0](https://github.com/iblai/mentorai/commit/a291ad0a9f5e7d0356018b1f0302e6a29df52961))

## [0.63.7](https://github.com/iblai/mentorai/compare/v0.63.6...v0.63.7) (2026-05-08)

### Bug Fixes

- unit test failures from tenant switching cookie and missing mock ([5429638](https://github.com/iblai/mentorai/commit/54296385f1ee3d0252601e135ad3d2cfbaa3f855))

## [0.63.6](https://github.com/iblai/mentorai/compare/v0.63.5...v0.63.6) (2026-05-07)

### CI

- remove aws ecr docker login from pr-e2e-tests.yml ([e56a40e](https://github.com/iblai/mentorai/commit/e56a40e215a0ebfea630ab9e56d915177628787b))

## [0.63.5](https://github.com/iblai/mentorai/compare/v0.63.4...v0.63.5) (2026-05-07)

### CI

- remove aws ecr docker login from pr-e2e-tests.yml ([b06d956](https://github.com/iblai/mentorai/commit/b06d956d5cf7b0032532439f88b8be9ac3fd07d5))

## [0.63.4](https://github.com/iblai/mentorai/compare/v0.63.3...v0.63.4) (2026-05-07)

### CI

- remove aws ecr docker login from pr-e2e-tests.yml ([7e9eb0d](https://github.com/iblai/mentorai/commit/7e9eb0d014cbad1b2e381a884c0f89629c97401d))

## [0.63.3](https://github.com/iblai/mentorai/compare/v0.63.2...v0.63.3) (2026-05-07)

### CI

- use only chrome browser for tests ([4a350a9](https://github.com/iblai/mentorai/commit/4a350a9741de9d61a75bae578953e32bf2a24b7e))

## [0.63.2](https://github.com/iblai/mentorai/compare/v0.63.1...v0.63.2) (2026-05-07)

### CI

- **pr-e2e:** update sed replacement to use OCIR registry for PR image ([14f2b70](https://github.com/iblai/mentorai/commit/14f2b701e7378f4751dde3770582e61c1ae7f70c))

## [0.63.1](https://github.com/iblai/mentorai/compare/v0.63.0...v0.63.1) (2026-05-07)

### CI

- **pr-e2e:** rename runner to iblai-stg-runner ([bda9d2f](https://github.com/iblai/mentorai/commit/bda9d2f58f9167bff3c72620b67a39541e66217e))

## [0.63.0](https://github.com/iblai/mentorai/compare/v0.62.1...v0.63.0) (2026-05-07)

### Features

- add BroadcastChannel for cross-tab tenant switch sync & update CI runner ([1471104](https://github.com/iblai/mentorai/commit/1471104ed78e71476ede15593c610b3241c78f3f))
- set ibl_tenant_switching cookie during tenant switch ([0bc909e](https://github.com/iblai/mentorai/commit/0bc909ec9be65f9a3f4635dbefa0c35c125345b8))

## [0.62.1](https://github.com/iblai/mentorai/compare/v0.62.0...v0.62.1) (2026-05-06)

### Bug Fixes

- ecommerce main tenant update ([87c6ff0](https://github.com/iblai/mentorai/commit/87c6ff012a5631133155c476732848332ea98f9c))
- ecommerce main tenant update ([f401333](https://github.com/iblai/mentorai/commit/f401333e48c31ff5f5c197e5c5d6ca1785f02c36))
- ecommerce main tenant update > test coverage ([a36869c](https://github.com/iblai/mentorai/commit/a36869c8590d9b5ea6c33e48f039328cdd8e7b4a))
- ecommerce main tenant update > test coverage ([7bf86bf](https://github.com/iblai/mentorai/commit/7bf86bf3f10165f882017be3c7294e73dbe6dda3))
- ecommerce main tenant update > test coverage ([df6fcaa](https://github.com/iblai/mentorai/commit/df6fcaa8291ca9c82571e879e1a2c1e7231a9553))

## [0.62.0](https://github.com/iblai/mentorai/compare/v0.61.2...v0.62.0) (2026-05-05)

### Features

- **settings:** add Enhance Document Retrieval toggle ([#1411](https://github.com/iblai/mentorai/issues/1411)) ([0f22af5](https://github.com/iblai/mentorai/commit/0f22af58d18ffea15d1713f9a69b3a9d27225890))

### Tests

- **e2e:** cover Enhance Document Retrieval toggle in Journey 7 ([#1411](https://github.com/iblai/mentorai/issues/1411)) ([2d629d9](https://github.com/iblai/mentorai/commit/2d629d9300591b5cd440ea9c4890af89b9a7159c))

## [0.61.2](https://github.com/iblai/mentorai/compare/v0.61.1...v0.61.2) (2026-05-05)

### Bug Fixes

- render suggested prompts as Markdown in welcome and advanced chat ([e2393d5](https://github.com/iblai/mentorai/commit/e2393d53bf152e916533f8fc056c87fadeb0d06f))

### Tests

- **mentor:** cover Markdown rendering in suggested prompts ([#1179](https://github.com/iblai/mentorai/issues/1179)) ([a3acfbf](https://github.com/iblai/mentorai/commit/a3acfbf717a2253f5ab1e8e5f6d4fb3c05b69aec))

## [0.61.1](https://github.com/iblai/mentorai/compare/v0.61.0...v0.61.1) (2026-05-05)

### Bug Fixes

- **a11y:** add aria-labels to icon-only composer buttons ([93d0f90](https://github.com/iblai/mentorai/commit/93d0f90a5c14ef5b02c375f2090385e2f3abbabe)), closes [#778](https://github.com/iblai/mentorai/issues/778)
- **a11y:** reflow chat composer at narrow viewport and add skip link ([df46180](https://github.com/iblai/mentorai/commit/df46180dc493d9351e0ac0d7c704f75dd51a13c6))

### Chores

- apply prettier formatting drift in unrelated files ([d273263](https://github.com/iblai/mentorai/commit/d27326369dab2221a134b47ef60a6a396a36c57c))

### Tests

- **e2e:** cover composer a11y, reflow, and skip-link journey ([15fe71a](https://github.com/iblai/mentorai/commit/15fe71a6cb251d029cbc8d7bb84d8f58f7bfa3b5)), closes [#chat-input-textarea](https://github.com/iblai/mentorai/issues/chat-input-textarea)

## [0.61.0](https://github.com/iblai/mentorai/compare/v0.60.0...v0.61.0) (2026-05-05)

### Features

- add label to chat input textarea ([b9ac136](https://github.com/iblai/mentorai/commit/b9ac136be241d81cd924547fd38e7abc6c47ca35))

### Bug Fixes

- mark test for flag OFF as FIXME in persistent chat input label journey ([0eeb1dd](https://github.com/iblai/mentorai/commit/0eeb1dd602e1062c945f21e5348427f1d8357ec5))

### Chores

- add playwright tests for chat input label ([ff189d7](https://github.com/iblai/mentorai/commit/ff189d7fbc4e02090ee63deabbe8d7f6615d768a))
- update iblai-js to 1.6.2 ([e59739c](https://github.com/iblai/mentorai/commit/e59739c1d2415f0ecc50a0c4cc47a626b16609c5))
- update unit tests ([6cf1190](https://github.com/iblai/mentorai/commit/6cf11909434705e43ea4db1efcba639f8dc82782))

## [0.60.0](https://github.com/iblai/mentorai/compare/v0.59.6...v0.60.0) (2026-05-04)

### Features

- new chat post message event added to iframe handlers ([761db2a](https://github.com/iblai/mentorai/commit/761db2ad13ac9f1ae9774d0193cb264018f04d2c))

### Bug Fixes

- setting tab playwright test updated and memory tab fixme added for later ([c52f709](https://github.com/iblai/mentorai/commit/c52f70938d4561cdf4622579ed4d69a9f2fab674))

### Chores

- bump iblai-js version to 1.6.1 & pnpm lock updated ([6893d6a](https://github.com/iblai/mentorai/commit/6893d6a441eb5358a4ef00a7dbfed7e04d25bb46))

## [0.59.6](https://github.com/iblai/mentorai/compare/v0.59.5...v0.59.6) (2026-05-04)

### CI

- **pr-e2e:** add unlabeled trigger to allow re-running via label toggle ([3e2ac89](https://github.com/iblai/mentorai/commit/3e2ac8980a3c0eb0b1c24a990a064fb807b4ebcb))

## [0.59.5](https://github.com/iblai/mentorai/compare/v0.59.4...v0.59.5) (2026-05-03)

### CI

- **pr-e2e:** rename ec2-command to ec2-commands to match reusable workflow ([7a9ceb7](https://github.com/iblai/mentorai/commit/7a9ceb7f544da405b90de453086874157d235ccb))

## [0.59.4](https://github.com/iblai/mentorai/compare/v0.59.3...v0.59.4) (2026-05-03)

### CI

- fix pr-e2e-tests ([7365aae](https://github.com/iblai/mentorai/commit/7365aae1ee38c8ee8f94d5065b00b6269d986ae4))
- **pr-e2e:** fix secrets handling and add EC2 deploy step ([e4c85f2](https://github.com/iblai/mentorai/commit/e4c85f24d3ab4a516e4e1ff098625a03515f2036))

## [0.59.3](https://github.com/iblai/mentorai/compare/v0.59.2...v0.59.3) (2026-05-03)

### CI

- **pr-e2e:** add app image build job and EC2 deploy step ([8ad671c](https://github.com/iblai/mentorai/commit/8ad671c7571d9ca22a8d690cb9af6f24b5b08527))

## [0.59.2](https://github.com/iblai/mentorai/compare/v0.59.1...v0.59.2) (2026-05-01)

### Bug Fixes

- **public:** add Amazon provider logo asset ([5066a84](https://github.com/iblai/mentorai/commit/5066a84086a5e913e76c1e09b9d5634c6afa658f))

### Chores

- update iblai-js to 1.5.1 ([160095c](https://github.com/iblai/mentorai/commit/160095c77b1f25457850ac0a3985023aeef558c2))
- update pnpm-lock.yaml file ([978f3e9](https://github.com/iblai/mentorai/commit/978f3e919a600a6bc948b00260b7ca53e026f21e))
- updated pnpm-lock file ([276cf2d](https://github.com/iblai/mentorai/commit/276cf2d05fcd7f5c30995483d834617c436c8e41))

### Tests

- **utils:** cover isLoggedIn missing-localStorage and KaTeX annotation paths ([e5a6bba](https://github.com/iblai/mentorai/commit/e5a6bbacf5ffb8e1b5aaa2fb5e9cde53eae3b285))

## [0.59.1](https://github.com/iblai/mentorai/compare/v0.59.0...v0.59.1) (2026-05-01)

### Chores

- **security:** add pnpm supply chain protections ([055e263](https://github.com/iblai/mentorai/commit/055e263bda4d371b8a547ed51871a58d753f1b0e))

## [0.59.0](https://github.com/iblai/mentorai/compare/v0.58.1...v0.59.0) (2026-05-01)

### Features

- credit coin component integration on header navbar on progress ([585a3f9](https://github.com/iblai/mentorai/commit/585a3f9c836c5e5e8e331fd3e360eaedf39390d4))
- integrating credit balance component + ecommerce update ([ec350f6](https://github.com/iblai/mentorai/commit/ec350f6e4914543fc3eddc85abe2d818d5d70ca3))
- integrating credit balance component + ecommerce update > lint & typechecks issue fixed ([4a447cd](https://github.com/iblai/mentorai/commit/4a447cdc6d5e4666c33e1963f341063b6a3c5725))
- integrating credit balance component + ecommerce update > test issues fixed ([bc065a5](https://github.com/iblai/mentorai/commit/bc065a5ae1565f9f1642532d511f375caa76c428))
- integrating credit balance component + ecommerce update > test issues fixed ([c7a7c28](https://github.com/iblai/mentorai/commit/c7a7c28333d3e4e4ad067931ead172fffbffb1dd))
- integrating credit balance component + ecommerce update > test issues fixed ([fbf6da2](https://github.com/iblai/mentorai/commit/fbf6da2c66dedd09281f4ebf38e3f1401eb30c57))
- integrating credit balance component + ecommerce update > test issues fixed ([958ff1c](https://github.com/iblai/mentorai/commit/958ff1c69203a0eee30558a0556e4efdb544475c))
- integrating credit balance component + ecommerce update > tests coverage included ([545402d](https://github.com/iblai/mentorai/commit/545402d0b2cba3029c3e1558e38ffef67f861254))

### Bug Fixes

- is_enterprise flag replaced to show_paywall ([7e56cd2](https://github.com/iblai/mentorai/commit/7e56cd2ef9413dd9f45ea5c03ea1f38159415c05))
- replace yalc @iblai/iblai-js with registry version 1.1.9 ([d9329eb](https://github.com/iblai/mentorai/commit/d9329ebb87f15f272426ca2594c242d99fde2878))

### Chores

- iblai-js package version bump ([e7ba803](https://github.com/iblai/mentorai/commit/e7ba80395ec896a01831dcda471171a4cc9d9be6))
- pnpm lock update ([eb14c33](https://github.com/iblai/mentorai/commit/eb14c33bf0c0da475a3aaf80272fe2003126e18b))
- pnpm lock updated ([5e0048b](https://github.com/iblai/mentorai/commit/5e0048b922d0d2eddc5682cffb5d942a7204640d))

## [0.58.1](https://github.com/iblai/mentorai/compare/v0.58.0...v0.58.1) (2026-05-01)

### Bug Fixes

- **mentor:** adding fixed for the memory tab ([1930322](https://github.com/iblai/mentorai/commit/1930322c8e0dc75afc8f02991b2a790b6ac5fa1f))

## [0.58.0](https://github.com/iblai/mentorai/compare/v0.57.2...v0.58.0) (2026-04-30)

### Features

- polish "mentorAI" brand mentions in user-visible copy ([ab8ea4e](https://github.com/iblai/mentorai/commit/ab8ea4e5a1781078d2e5f1dae79f1fb80d617652))
- replace "Mentor" with "Agent" across the SPA UI ([f26db9b](https://github.com/iblai/mentorai/commit/f26db9b8f74d8442c079a8b6070e2c01bc051aed))

### Tests

- **e2e:** align Playwright assertions with the Mentor → Agent rename ([ca99a93](https://github.com/iblai/mentorai/commit/ca99a93e1f86cba48bdc263514eea351d7a06570))
- **e2e:** extend explore-page wait timeouts to 2 min for cold-load race ([4fd87c8](https://github.com/iblai/mentorai/commit/4fd87c8dca4bf6bdcdf9706ace5f162db22e31e4))
- **e2e:** mark non-admin "no Audit tab" test as fixme ([55889a0](https://github.com/iblai/mentorai/commit/55889a0aaefe3449612221d2b6657548b35b7c13))
- **e2e:** restructure memory-tab tests to isolate per-test setup ([9931bb0](https://github.com/iblai/mentorai/commit/9931bb06dbcecb88bf5336ba4da0c19a996e939e))

## [0.57.2](https://github.com/iblai/mentorai/compare/v0.57.1...v0.57.2) (2026-04-30)

### CI

- add PR E2E pipeline and make legacy SPA validations dispatch-only ([99d3454](https://github.com/iblai/mentorai/commit/99d3454cc80a60400769d7e52dcb29569c50837d))

## [0.57.1](https://github.com/iblai/mentorai/compare/v0.57.0...v0.57.1) (2026-04-29)

### Bug Fixes

- replace non-existent chatActions.setMetadata with setIframeContext and add react-paginate dep ([349387e](https://github.com/iblai/mentorai/commit/349387ec4945094f56cb2e018e93e2ccb0c9d053))

## [0.57.0](https://github.com/iblai/mentorai/compare/v0.56.6...v0.57.0) (2026-04-29)

### Features

- **header:** remove "My Mentors" trigger from header ([15b9e4b](https://github.com/iblai/mentorai/commit/15b9e4b6dca2f08af356944a21f928cec5820735))
- **nav-bar:** remove "My Mentors" button from platform navbar ([4e66c75](https://github.com/iblai/mentorai/commit/4e66c75fec4894cabab6231f54c076be963ea1b6))

### Refactors

- **constants:** drop MODALS.MY_MENTORS ([cb33817](https://github.com/iblai/mentorai/commit/cb3381799e813f493c210a5864b5b59ed3b5a53a))
- **hooks:** drop My Mentors navigation helpers and meta+shift+e shortcut ([6938e17](https://github.com/iblai/mentorai/commit/6938e17cd63d1d87bd7c42185cfcda31cb3db5cb))
- **modals:** delete MyMentorsModal and unwire from container ([b1035f8](https://github.com/iblai/mentorai/commit/b1035f8fb4fa71d7b76456d06defbd7f218808c2))

### Chores

- **projects:** remove dead MyMentorsModal mount in project landing page ([1f20892](https://github.com/iblai/mentorai/commit/1f2089237b9a0bd9d3a8fe8b8b537cd42ac36b51))

### Documentation

- **e2e:** drop coverage entries for My Mentors removal ([b04b189](https://github.com/iblai/mentorai/commit/b04b1890318ea9226523242717ab586c4baf6aab))
- **e2e:** mark My Mentors entries deprecated instead of deleting ([e210cbf](https://github.com/iblai/mentorai/commit/e210cbf08953cb2f1d8df24c718934641ff1f8b0))

### Tests

- **e2e:** remove My Mentors specs and page-object helpers ([fa107c5](https://github.com/iblai/mentorai/commit/fa107c54262b6d647d5cff1b6883c60ec7fbb43c))
- **hot-keys-wrapper:** cover useShortcuts wiring and null render ([3dd6a93](https://github.com/iblai/mentorai/commit/3dd6a93052f296a9e6895b0a8c2ef02bdb1154e0))
- **user-navigate:** cover sidebar rbacResource branches and Workflows no-mentor early return ([43d9953](https://github.com/iblai/mentorai/commit/43d99535f3009bcbfb06f97b5da047a89dc000b5))

## [0.56.6](https://github.com/iblai/mentorai/compare/v0.56.5...v0.56.6) (2026-04-29)

### Bug Fixes

- **e2e:** fixes for memory tests ([a90f749](https://github.com/iblai/mentorai/commit/a90f7490ec5192c7fbd8f3186ba33f881a87a65c))
- **mentor:** adding fix for the audit log RBAC ([c6d2389](https://github.com/iblai/mentorai/commit/c6d23896dcd1d6c6a81648518c8a7f3d423fad77))
- **mentor:** adding memory fixes for the playwright and memory categories ([b7d1759](https://github.com/iblai/mentorai/commit/b7d1759f3ec7c8ee64461fc8d39514a7d58f9f5b))
- **mentor:** analytics to use real username and memory validations in forms ([80b4ddd](https://github.com/iblai/mentorai/commit/80b4ddda94d64a9c57d0661105665b58ae2fa92a))

## [0.56.5](https://github.com/iblai/mentorai/compare/v0.56.4...v0.56.5) (2026-04-28)

### Bug Fixes

- **e2e:** correct spec file names in coverage files [skip ci] ([3d10224](https://github.com/iblai/mentorai/commit/3d10224cbfaa09527b6d3848e91a7e74caddfa91))
- **e2e:** increase timeout for anonymous chat response assertion ([8c32aaa](https://github.com/iblai/mentorai/commit/8c32aaaab8b4855a040d2217082310df31c70ca3))
- **e2e:** update audit log URL and replace fixed timeouts in suggested prompts spec ([8494641](https://github.com/iblai/mentorai/commit/84946418a38be1f0112598119df992de732c9e03))
- **prompts:** add delete, run and pagination for suggested prompts ([c0d7959](https://github.com/iblai/mentorai/commit/c0d7959ad572635a868e5d875d17a3f2706481b5)), closes [#1176](https://github.com/iblai/mentorai/issues/1176)
- **providers:** preserve Error object in getMentorPublicSettings catch ([#343](https://github.com/iblai/mentorai/issues/343)) ([096ff67](https://github.com/iblai/mentorai/commit/096ff67591ab2a1ac276adfa0f50400e116a825c))

### Chores

- **e2e:** update coverage for suggested prompts feature [skip ci] ([afb262b](https://github.com/iblai/mentorai/commit/afb262bafa9b95d3943609e078abb606900cadca))
- **prompts:** remove unused cn import ([94060a5](https://github.com/iblai/mentorai/commit/94060a51f7566c2cc0f4a9f323a5d9e3f18ae965))

### Tests

- **prompts-tab:** add unit tests for CopyButton ([aa8bf9b](https://github.com/iblai/mentorai/commit/aa8bf9b6b3b5f4cffdc856d87b22b0de120cb3c6))
- **prompts:** add non-admin RBAC test for suggested prompts ([203f593](https://github.com/iblai/mentorai/commit/203f5934c955f1e32985e98ae5c95628b9eb993f))

## [0.56.4](https://github.com/iblai/mentorai/compare/v0.56.3...v0.56.4) (2026-04-27)

### Chores

- **deps:** bump @iblai/iblai-js to 1.4.17 ([20bd931](https://github.com/iblai/mentorai/commit/20bd9318c2ad972165ff0ba3bf3c9940854b73d0))

## [0.56.3](https://github.com/iblai/mentorai/compare/v0.56.2...v0.56.3) (2026-04-27)

### Chores

- **deps:** bump @iblai/iblai-js to 1.4.13 ([74a1eff](https://github.com/iblai/mentorai/commit/74a1efffe2f70ed48fd1a367e70bfcca4d513533))

## [0.56.2](https://github.com/iblai/mentorai/compare/v0.56.1...v0.56.2) (2026-04-27)

### Bug Fixes

- **e2e:** correct audit log URL pattern to match /analytics/audit ([6db3bfd](https://github.com/iblai/mentorai/commit/6db3bfd595758b0a2d57e7f2b39d5dcbe21fbc5c))

## [0.56.1](https://github.com/iblai/mentorai/compare/v0.56.0...v0.56.1) (2026-04-24)

### Bug Fixes

- **mentor:** adding fix for the playwright test for workflows preview new chat ([8c4ccc2](https://github.com/iblai/mentorai/commit/8c4ccc2f067bad622ee5a7033447681125c783c4))

## [0.56.0](https://github.com/iblai/mentorai/compare/v0.55.0...v0.56.0) (2026-04-24)

### Features

- proactive message via postmessage API on progress ([a688217](https://github.com/iblai/mentorai/commit/a688217811d431f015f647171fdb1fd05a3f35c2))
- proactive messaging via post message API ([804d274](https://github.com/iblai/mentorai/commit/804d274dd3954f0ed14695af18ace6a55a2c7b60))
- proactive messaging via postmessage API functionality added ([cee2662](https://github.com/iblai/mentorai/commit/cee266275ecb00287369aeda753457c69c7e852d))
- proactive messaging via postmessage API functionality added > test coverage added ([bdd86d8](https://github.com/iblai/mentorai/commit/bdd86d88cd1cae95a8c7e614ca4b1f588707dc4c))
- proactive messaging via postmessage API functionality added > test coverage added ([2625768](https://github.com/iblai/mentorai/commit/2625768d0b87f0a5ca3b1da573acb56478f304af))
- proactive messaging via postmessage API functionality added > test coverage added ([78e0574](https://github.com/iblai/mentorai/commit/78e05748e8b0c45eea4145bde9a8c33bd248f4fc))

### Bug Fixes

- typing sendChatMessageHandler props ([47b7f2c](https://github.com/iblai/mentorai/commit/47b7f2c6aa2a37ab7bf7d2326b07470692d9c069))

## [0.55.0](https://github.com/iblai/mentorai/compare/v0.54.1...v0.55.0) (2026-04-23)

### Features

- **mentor:** Adding playwright test memory hide for non authenticates user ([3da9390](https://github.com/iblai/mentorai/commit/3da9390385e4524623cc744f9119248044d1fd11))

### Bug Fixes

- **mentor:** fixing user data schema for full name as optional ([0dfdb35](https://github.com/iblai/mentorai/commit/0dfdb359a41c9ec9a7b286213bde833700a37e6f))
- **mentor:** full name as nullable and anonymous mentor to have memory ([404e750](https://github.com/iblai/mentorai/commit/404e7504edcc30ad1f9bd94dc7d3217ce6fabc22))

## [0.54.1](https://github.com/iblai/mentorai/compare/v0.54.0...v0.54.1) (2026-04-23)

### Bug Fixes

- **a11y:** harden ESC handler and add tests for embed close ([#772](https://github.com/iblai/mentorai/issues/772)) ([5c82442](https://github.com/iblai/mentorai/commit/5c82442d62d98ba83a9b81ce15cc7d157d6cf243))

## [0.54.0](https://github.com/iblai/mentorai/compare/v0.53.1...v0.54.0) (2026-04-23)

### Features

- **mentor:** add Markdown file support to dataset ingestion ([e83fb7d](https://github.com/iblai/mentorai/commit/e83fb7d41bf1ae927eb9fefd854dd64d9a35ec01))

## [0.53.1](https://github.com/iblai/mentorai/compare/v0.53.0...v0.53.1) (2026-04-23)

### Bug Fixes

- **e2e:** fall back to Cancel button when Escape fails on Copy Mentor dialog ([ed22103](https://github.com/iblai/mentorai/commit/ed22103404d709091243db4f1739054f89eb10ce))

## [0.53.0](https://github.com/iblai/mentorai/compare/v0.52.1...v0.53.0) (2026-04-23)

### Features

- data reports mentor id query param added > test coverage added ([6082569](https://github.com/iblai/mentorai/commit/6082569a1e509bec5b2111d5aad85debfc6fed09))

## [0.51.2-patch-1](https://github.com/iblai/mentorai/compare/v0.52.1...v0.53.0) (2026-04-22)

### Features

- bump version to 0.51.2-patch-1 ([6e9ab07](https://github.com/iblai/mentorai/commit/6e9ab07341a123cec6161dc2fb48166947051a5d))
- data reports mentor id query param added ([2ad1b35](https://github.com/iblai/mentorai/commit/2ad1b354af4ad7462d20960083a75da9b797bee3))

## [0.52.1](https://github.com/iblai/mentorai/compare/v0.52.0...v0.52.1) (2026-04-23)

### Bug Fixes

- **mentor:** suppress chat tooltip flash on non-keyboard focus ([98fd45c](https://github.com/iblai/mentorai/commit/98fd45cf592c4222bae69eedad64a5379d1d1000))
- **tests:** update unit tests to 100% coverage ([35b99c2](https://github.com/iblai/mentorai/commit/35b99c2a927c13991050f8bef995d068b26b9d0f))

### Chores

- **e2e:** reconcile COVERAGE.md and coverage.json to 323/41 ([aad0476](https://github.com/iblai/mentorai/commit/aad04765ccc659c7564af722a8e64cd2c2cf09f5))

### Tests

- **mentor:** add fixme e2e coverage for [#576](https://github.com/iblai/mentorai/issues/576) tooltip focus fix ([aed2562](https://github.com/iblai/mentorai/commit/aed25629b8a85abd397de8769014e394cd73d23f))

## [0.52.0](https://github.com/iblai/mentorai/compare/v0.51.5...v0.52.0) (2026-04-23)

### Features

- **chat:** add loading spinner for cached session message retrieval ([3b70a63](https://github.com/iblai/mentorai/commit/3b70a6347db2782559bc5e130352795d47495026))

### Bug Fixes

- **e2e:** update heading role queries for workflows to include level and exact match ([4a9c025](https://github.com/iblai/mentorai/commit/4a9c0256a96520e037b375158a79cc7210b7fc0f))

### Tests

- **chat:** add tests for loading spinner behavior during cached session retrieval ([e8c1f3b](https://github.com/iblai/mentorai/commit/e8c1f3b15044a9663782e2fc8f79a7224488a95b))

## [0.51.5](https://github.com/iblai/mentorai/compare/v0.51.4...v0.51.5) (2026-04-23)

### Bug Fixes

- **e2e:** rewrite journey 14 to properly test anonymous public access ([fa99431](https://github.com/iblai/mentorai/commit/fa9943173df8529398d3b7eadfcc253520391050))

## [0.51.4](https://github.com/iblai/mentorai/compare/v0.51.3...v0.51.4) (2026-04-22)

### Bug Fixes

- bump iblai-js to 1.4.9, increase auth setup timeouts, fix entity decode order ([31d9f12](https://github.com/iblai/mentorai/commit/31d9f12309c622df5a8c4cb983da978024231678))

### Chores

- updates pnpm lock file ([94f6f44](https://github.com/iblai/mentorai/commit/94f6f443e9e3e3b341901c87e05fd916918dc62d))

## [0.51.3](https://github.com/iblai/mentorai/compare/v0.51.2...v0.51.3) (2026-04-22)

### Bug Fixes

- **e2e:** deduplicate 401-triggered auth redirects in setup ([2991709](https://github.com/iblai/mentorai/commit/299170980f83aad70728058e074fe5abf86c3fbb))

## [0.51.2](https://github.com/iblai/mentorai/compare/v0.51.1...v0.51.2) (2026-04-22)

### Bug Fixes

- **e2e:** handle Chromium net::ERR_ABORTED in navigation retry logic ([a6a534a](https://github.com/iblai/mentorai/commit/a6a534a06ecb79f19e5619eecf1460d1db2fdf01))

## [0.51.1](https://github.com/iblai/mentorai/compare/v0.51.0...v0.51.1) (2026-04-22)

### Bug Fixes

- **test-full-pipeline:** wrap run-tests `if:` with always() to bypass GHA transitive-skip ([168911e](https://github.com/iblai/mentorai/commit/168911ed7b300197254eaa911dd16b4c92734b47)), closes [#24792062653](https://github.com/iblai/mentorai/issues/24792062653)

## [0.51.0](https://github.com/iblai/mentorai/compare/v0.50.3...v0.51.0) (2026-04-22)

### Features

- **test-full-pipeline:** add skip-infra-launch input (default true) ([073afdb](https://github.com/iblai/mentorai/commit/073afdb4820bd0d32ca93e58148040bf52106c13))

## [0.50.3](https://github.com/iblai/mentorai/compare/v0.50.2...v0.50.3) (2026-04-22)

### Bug Fixes

- **mentor:** adding fix for the audit and memory for email ([28b08a6](https://github.com/iblai/mentorai/commit/28b08a6fb4811bc0d83f8144670ecc670fe422f6))

### Chores

- **mentor:** version bump for iblai-js ([3c64534](https://github.com/iblai/mentorai/commit/3c6453431d0fd1c81bab6f58868a822489b4c45e))

## [0.50.2](https://github.com/iblai/mentorai/compare/v0.50.1...v0.50.2) (2026-04-21)

### CI

- grant contents:read to GITHUB_TOKEN so checkout can fetch the repo ([43f84e9](https://github.com/iblai/mentorai/commit/43f84e9775afce21b22f142df9826ea7ce33f406))

## [0.50.1](https://github.com/iblai/mentorai/compare/v0.50.0...v0.50.1) (2026-04-21)

### CI

- grant contents:read to GITHUB_TOKEN so checkout can fetch the repo ([483b2ca](https://github.com/iblai/mentorai/commit/483b2caa062121cf0b3c3997b2db8b0e8a5f496e))

## [0.50.0](https://github.com/iblai/mentorai/compare/v0.49.1...v0.50.0) (2026-04-21)

### Features

- access tab > analytics viewer role added ([30e0e7a](https://github.com/iblai/mentorai/commit/30e0e7a9947d9c1c4848ca6eb500aff99fa680ce))
- access tab > analytics viewer role added > playwright test coverage ([90a9ba5](https://github.com/iblai/mentorai/commit/90a9ba551f5e0148818d528aca489941fad9073d))
- access tab > analytics viewer role added > unit test coverage ([e2a2178](https://github.com/iblai/mentorai/commit/e2a217811ce2900cf06f5cf1f3022ebd3e2c0b1e))

## [0.49.1](https://github.com/iblai/mentorai/compare/v0.49.0...v0.49.1) (2026-04-21)

### Bug Fixes

- **mentor:** close welcome WebSocket with explicit status code 1000 ([3bd0a9f](https://github.com/iblai/mentorai/commit/3bd0a9f13da7386544f709bd182c531c6ca28088))

## [0.49.0](https://github.com/iblai/mentorai/compare/v0.48.0...v0.49.0) (2026-04-21)

### Features

- **chat:** add speaker button to read AI messages aloud ([ba31e0f](https://github.com/iblai/mentorai/commit/ba31e0f48f1d92e83cd0ae4fa44bd146b246fe23))
- **chat:** use stop icon while speaking aloud ([00c7193](https://github.com/iblai/mentorai/commit/00c71933d15296d168c8e19a64b824226a957d9e))

### Bug Fixes

- **chat:** update button label for speech control to improve readability ([b1ae4b0](https://github.com/iblai/mentorai/commit/b1ae4b01cf740dafe1c8e58c1caa1523717bf3cb))

### Tests

- **e2e:** add journey 40 for AI message read aloud button ([112f318](https://github.com/iblai/mentorai/commit/112f31885d0f72e281cc044019b0a51931c952e5))

## [0.48.0](https://github.com/iblai/mentorai/compare/v0.47.13...v0.48.0) (2026-04-21)

### Features

- add prod-images-tag input to test-full-pipeline workflow ([bb8b6c8](https://github.com/iblai/mentorai/commit/bb8b6c8bd4f6400b925ef6d74bd35314ba51e459))

## [0.47.13](https://github.com/iblai/mentorai/compare/v0.47.12...v0.47.13) (2026-04-20)

### CI

- **test-full-pipeline:** grant contents:read so reusable checkout works ([6cc9660](https://github.com/iblai/mentorai/commit/6cc966087a3b28da983ca72bccffa365ef9a7de8))

## [0.47.12](https://github.com/iblai/mentorai/compare/v0.47.11...v0.47.12) (2026-04-20)

### CI

- **test-full-pipeline:** make EC2 termination optional ([53709e5](https://github.com/iblai/mentorai/commit/53709e55121791acc42010f2d6fe2ba6d5bf9922))

## [0.47.11](https://github.com/iblai/mentorai/compare/v0.47.10...v0.47.11) (2026-04-20)

### Bug Fixes

- update page objects and playwright coverage ([0f04c6e](https://github.com/iblai/mentorai/commit/0f04c6e4c9eff02e31c7d6dcd8760bfc425f51fa))

### Refactors

- **e2e:** remove toast visibility checks for user agreement toggle tests ([451dc72](https://github.com/iblai/mentorai/commit/451dc72639520387b0267e74c1870319730f5e7e))

## [0.47.10](https://github.com/iblai/mentorai/compare/v0.47.9...v0.47.10) (2026-04-20)

### Bug Fixes

- **security:** add permissions: {} to all workflows ([d18796d](https://github.com/iblai/mentorai/commit/d18796d8d90ffab9fc4fce2b8ce90e63491b3392))
- **security:** address CodeQL alerts - SSRF, TLS, redirect, sanitization ([7d8a96e](https://github.com/iblai/mentorai/commit/7d8a96e25edff3e36e9eb890c5f9381a87c59c57))

## [0.47.9](https://github.com/iblai/mentorai/compare/v0.47.8...v0.47.9) (2026-04-20)

### CI

- double max-wait for full pipeline tests to 3 hours ([6c668bb](https://github.com/iblai/mentorai/commit/6c668bb8778e1a58f3d60070422b668fda93d309))

## [0.47.8](https://github.com/iblai/mentorai/compare/v0.47.7...v0.47.8) (2026-04-19)

### Bug Fixes

- **security:** add SSRF protection to WebCache fetch_from_network ([ed5999b](https://github.com/iblai/mentorai/commit/ed5999bb45f7ace1dac1d8054ac0e44c997f333e))

## [0.47.7](https://github.com/iblai/mentorai/compare/v0.47.6...v0.47.7) (2026-04-19)

### Chores

- **deps:** cargo update all Tauri dependencies ([d1b0bbc](https://github.com/iblai/mentorai/commit/d1b0bbcb5a6f9da2b09724caad84090ea529b3da))

## [0.47.6](https://github.com/iblai/mentorai/compare/v0.47.5...v0.47.6) (2026-04-19)

### Bug Fixes

- **deps:** update bytes 1.11.0 -> 1.11.1 in Cargo.lock ([68915ec](https://github.com/iblai/mentorai/commit/68915ecf851a1f12834ba036bf6099a7131ddf92)), closes [#46](https://github.com/iblai/mentorai/issues/46)

## [0.47.5](https://github.com/iblai/mentorai/compare/v0.47.4...v0.47.5) (2026-04-19)

### Bug Fixes

- **deps:** fix misspelled lodash/lodash-es overrides ([bc615f2](https://github.com/iblai/mentorai/commit/bc615f2042e2885be3598b587d9f9c3d36d4af84))
- **deps:** remove bogus npm overrides and update Cargo.lock ([b95371a](https://github.com/iblai/mentorai/commit/b95371ae481015e969768f731ca99f016637537e))

## [0.47.4](https://github.com/iblai/mentorai/compare/v0.47.3...v0.47.4) (2026-04-19)

### Bug Fixes

- **deps:** add more security overrides for transitive vulnerabilities ([a0c6632](https://github.com/iblai/mentorai/commit/a0c663287807762c535b9b7cd11c47a4519299ee))
- **deps:** add security overrides and bump next to 15.5.15 ([ebdf831](https://github.com/iblai/mentorai/commit/ebdf831a546d1cca34654dd4efa25cc3465ee91c))
- **deps:** override basic-ftp and follow-redirects for security patches ([22e5b4d](https://github.com/iblai/mentorai/commit/22e5b4d68244fcb2a41e20322da9aef61957a555)), closes [#143](https://github.com/iblai/mentorai/issues/143)

### Chores

- **release:** v0.47.3 ([438c209](https://github.com/iblai/mentorai/commit/438c2097e154f718ee94c099dfc1d191865243df))

- fix(deps): add security overrides and bump next to 15.5.15 (ebdf831)
- fix(deps): override basic-ftp and follow-redirects for security patches (22e5b4d)

## [0.47.3](https://github.com/iblai/mentorai/compare/v0.47.2...v0.47.3) (2026-04-19)

### Chores

- bump nextjs version ([1a650f0](https://github.com/iblai/mentorai/commit/1a650f01e1eed67700a0d7b08b965b69e3e566c0))

## [0.47.2](https://github.com/iblai/mentorai/compare/v0.47.1...v0.47.2) (2026-04-19)

### Chores

- bump next from 15.3.6 to 15.5.14 ([dfd1435](https://github.com/iblai/mentorai/commit/dfd143506c2beb60c809da3642646346dad358a3))
- update pnpm-lock.yaml ([ec9cf09](https://github.com/iblai/mentorai/commit/ec9cf094cc68fa5ac0ff696c63359cb63397084a))

## [0.47.1](https://github.com/iblai/mentorai/compare/v0.47.0...v0.47.1) (2026-04-19)

### Chores

- remove electron and electron-builder ([517028e](https://github.com/iblai/mentorai/commit/517028efd1ba5f483ad618850c575c2ae99bbe25)), closes [#54](https://github.com/iblai/mentorai/issues/54)

## [0.47.0](https://github.com/iblai/mentorai/compare/v0.46.5...v0.47.0) (2026-04-17)

### Features

- **mentor:** adding audit logs for analytics and edit mentor ([7bf80fa](https://github.com/iblai/mentorai/commit/7bf80fa828b4e7bd655f387211ca27dea986fb26))

### Bug Fixes

- **e2e:** adding coverage json fixes for the test mapping ([9bcc469](https://github.com/iblai/mentorai/commit/9bcc4690e87b4780e205016c2cb3f669f05a64e1))
- **e2e:** adding e2e coverage changelogs ([b202b18](https://github.com/iblai/mentorai/commit/b202b18e3aefb9444e2f0e92a0c1602a0b474216))
- **e2e:** adding fix for workflow tests ([aed038b](https://github.com/iblai/mentorai/commit/aed038bc896ef5419907a6ea9eb867b9b203fcbc))
- **mentor:** pre push hook debug fixes ([260c1f4](https://github.com/iblai/mentorai/commit/260c1f46dbcd15b9188eaeb1d1b7021587acc337))
- **mentor:** pre push hook debug fixes ([93192ad](https://github.com/iblai/mentorai/commit/93192adf2bbcbb568c8941e828ce0e45bda75c16))
- **mentor:** test coverage for header component ([e3a7a84](https://github.com/iblai/mentorai/commit/e3a7a84750949dd4b87bebe1ec0c3841e62e011e))
- replace yalc @iblai/iblai-js with registry version 1.1.9 ([bf26f7a](https://github.com/iblai/mentorai/commit/bf26f7adf69082351cd927e6206900332f4ce67f))

### Chores

- **mentor:** adding playwright tests and hooks changes ([a8f9380](https://github.com/iblai/mentorai/commit/a8f9380dc497895047e2d299a501c858fb9a96bc))
- **mentor:** removing yalc ([c7a29fb](https://github.com/iblai/mentorai/commit/c7a29fb9058857a3e42ee43f6cab17e457744453))

## [0.46.5](https://github.com/iblai/mentorai/compare/v0.46.4...v0.46.5) (2026-04-16)

### Bug Fixes

- expand the chat widgets to 100% ([cc37c1f](https://github.com/iblai/mentorai/commit/cc37c1fcb83f2d7e42a6600d9446d44f7b18b805))
- **tests:** fixed playwright tests ([236460f](https://github.com/iblai/mentorai/commit/236460f102a46b2c2416c7591e0384a6858df25d))

## [0.46.4](https://github.com/iblai/mentorai/compare/v0.46.3...v0.46.4) (2026-04-16)

### Bug Fixes

- **e2e:** re-enable analytics tab tests and fixme financial/CSV editor tests ([e3e3b9f](https://github.com/iblai/mentorai/commit/e3e3b9f3c2a268af1228f91d0c098573266e5f99))

## [0.46.3](https://github.com/iblai/mentorai/compare/v0.46.2...v0.46.3) (2026-04-15)

### Bug Fixes

- **mentor:** adding fixes for unit tests in memory ([7d7f2dd](https://github.com/iblai/mentorai/commit/7d7f2ddb712e3b1f363e10ab7723d8f80084b751))
- **mentor:** lint check fixes ([93c5b77](https://github.com/iblai/mentorai/commit/93c5b7798034d59e95a875e5f18378272b924abc))

### Chores

- **e2e:** update coverage for memory category management and tenant memory toggle [skip ci] ([7852d66](https://github.com/iblai/mentorai/commit/7852d66f110d19a9fad246bb7d0085217a86f8f6))
- **mentor:** adding memory categories and students memory ([48744c4](https://github.com/iblai/mentorai/commit/48744c4ae3f4405b268d5ac0632e3963894e302c))
- **mentor:** fixes for the mem search status ([0cd1578](https://github.com/iblai/mentorai/commit/0cd1578d5c871fc19c31df958a2ce4ffb60dcbb5))
- **mentor:** version bump for iblai-js ([ab7e0af](https://github.com/iblai/mentorai/commit/ab7e0af8ecc6c5c0ca8c194933f90688985f3f85))

### Tests

- **mentor:** 95% coverage for unit tests ([27794f0](https://github.com/iblai/mentorai/commit/27794f0c0fedc663e1f6a34e35e5b6cb86a6d007))

## [0.46.2](https://github.com/iblai/mentorai/compare/v0.46.1...v0.46.2) (2026-04-10)

### Bug Fixes

- **e2e:** use accessible locator for workflow name input ([82fffc4](https://github.com/iblai/mentorai/commit/82fffc4b7d2fab3e714b87cca70b7db40ef11517))

## [0.46.1](https://github.com/iblai/mentorai/compare/v0.46.0...v0.46.1) (2026-04-10)

### Bug Fixes

- **e2e:** replace arbitrary timeout with waitForResponse and fix workflow locators ([23443e3](https://github.com/iblai/mentorai/commit/23443e3f21156257d6fbed3520cb637d39ed1d0f))

## [0.46.0](https://github.com/iblai/mentorai/compare/v0.45.17...v0.46.0) (2026-04-10)

### Features

- pass metadata from CONTEXT_UPDATE iframe message and bump @iblai/iblai-js to 1.3.10 ([abda55a](https://github.com/iblai/mentorai/commit/abda55a1eb9961638144655acdd48d4f101e644e))

## [0.45.17](https://github.com/iblai/mentorai/compare/v0.45.16...v0.45.17) (2026-04-10)

### Bug Fixes

- failing chat history export test fixed ([3acfb44](https://github.com/iblai/mentorai/commit/3acfb44bf152939bc3a9b6b0b1ccaddadedadb1c))
- multi aria-labels in workflow detail ([7abf327](https://github.com/iblai/mentorai/commit/7abf327e8badb08da27f8ed233ad743a13303c57))

## [0.45.16](https://github.com/iblai/mentorai/compare/v0.45.15...v0.45.16) (2026-04-09)

### Bug Fixes

- resolve strict mode violation for "More options" button and allow CI bot tools ([d35161b](https://github.com/iblai/mentorai/commit/d35161b34452dcfe53aa8138fd4296a01228e0e8)), closes [#main-content-container](https://github.com/iblai/mentorai/issues/main-content-container)

## [0.45.15](https://github.com/iblai/mentorai/compare/v0.45.14...v0.45.15) (2026-04-09)

### Bug Fixes

- **ci:** instruct coverage bot to actually execute gh pr review command ([d8df598](https://github.com/iblai/mentorai/commit/d8df598a452c069c78adeb7eaeff3c16978db1eb))

## [0.45.14](https://github.com/iblai/mentorai/compare/v0.45.13...v0.45.14) (2026-04-09)

### Bug Fixes

- **ci:** skip e2e coverage bot for Dependabot PRs ([c4ec729](https://github.com/iblai/mentorai/commit/c4ec72925a35389c267cdbbfd4993f36a2bdcc60))

## [0.45.13](https://github.com/iblai/mentorai/compare/v0.45.12...v0.45.13) (2026-04-09)

### Bug Fixes

- **ci:** remove claude-review-coverage job references from spa-pr-validation ([d3156df](https://github.com/iblai/mentorai/commit/d3156df4b631db7fa266a27f80d2ae3d6280a501))

## [0.45.12](https://github.com/iblai/mentorai/compare/v0.45.11...v0.45.12) (2026-04-09)

### Bug Fixes

- **e2e:** fix workflow bot if condition and improve workflow test utils ([a4b2154](https://github.com/iblai/mentorai/commit/a4b215432b44f5f14042a8aeb316bb3fb97cee5d))

## [0.45.11](https://github.com/iblai/mentorai/compare/v0.45.10...v0.45.11) (2026-04-08)

### Bug Fixes

- register new ALB target before deregistering old ([54bff2f](https://github.com/iblai/mentorai/commit/54bff2f94f93ff2e76a0f19f265c7b5bf6a6fc71))

## [0.45.10](https://github.com/iblai/mentorai/compare/v0.45.9...v0.45.10) (2026-04-08)

### Chores

- add mamigot as code owner for entire repo ([613f0ea](https://github.com/iblai/mentorai/commit/613f0ea8cb476f433fe9343a9aab62d064037bbc))

## [0.45.9](https://github.com/iblai/mentorai/compare/v0.45.8...v0.45.9) (2026-04-08)

## [0.45.8](https://github.com/iblai/mentorai/compare/v0.45.7...v0.45.8) (2026-04-08)

### Tests

- full pipeline — launch → OCI playwright tests → terminate ([5d89faa](https://github.com/iblai/mentorai/commit/5d89faa6fdf48e5279a3c1a5fe2ee10d79d90516))

## [0.45.7](https://github.com/iblai/mentorai/compare/v0.45.6...v0.45.7) (2026-04-08)

### Chores

- remove test workflows ([c382836](https://github.com/iblai/mentorai/commit/c3828360e80cd5f12acb968804815d39cc85ef3d))

## [0.45.6](https://github.com/iblai/mentorai/compare/v0.45.5...v0.45.6) (2026-04-08)

### Bug Fixes

- **e2e:** fix auth setup redirect loop and add e2e coverage bot ([9c278a7](https://github.com/iblai/mentorai/commit/9c278a74dc79711940caca5092c083e59861aa42))

## [0.45.5](https://github.com/iblai/mentorai/compare/v0.45.4...v0.45.5) (2026-04-08)

### Tests

- add focused launch flow test workflow ([4e5b639](https://github.com/iblai/mentorai/commit/4e5b63919d815968a8d38811e302fbd61d98b382))

## [0.45.4](https://github.com/iblai/mentorai/compare/v0.45.3...v0.45.4) (2026-04-08)

### Bug Fixes

- handle workflow_dispatch — skip PR-specific jobs, fallback pr-number ([5559f13](https://github.com/iblai/mentorai/commit/5559f130b0bcd3bd84f61a4644715c9f9c6de7f8))

### Tests

- add minimal workflow to debug startup_failure ([fcabf61](https://github.com/iblai/mentorai/commit/fcabf6144136076e55feec144e07c5301efa326d))

## [0.45.3](https://github.com/iblai/mentorai/compare/v0.45.2...v0.45.3) (2026-04-08)

### Bug Fixes

- address TypeScript ignore comments in prompts and safety tabs for better type handling ([a6d6739](https://github.com/iblai/mentorai/commit/a6d67396469d84b6fbf0abed826162390dcb6fde))
- mark tests in mentor history and memory tabs as FIXME due to flow changes ([d5deb78](https://github.com/iblai/mentorai/commit/d5deb78bf63de35b97761899681d6be78af1ec05))
- **tests:** update button mock implementation and enhance accessibility in command items ([9bfae2c](https://github.com/iblai/mentorai/commit/9bfae2c0eec45565c8f5d7fb0631e048d75e1e4b))
- update unit tests ([187d35c](https://github.com/iblai/mentorai/commit/187d35cd24162833f31419748e39a599fa32ea37))

### Chores

- fixed typecheck issues ([e352b3e](https://github.com/iblai/mentorai/commit/e352b3ea048b9e0e473010c1da9aa1baeabb4c19))
- **tests:** update unit tests coverage for use screen sharing hook ([727a883](https://github.com/iblai/mentorai/commit/727a883cc286f0e3426728cb2bc8ed914c414f21))

## [0.45.2](https://github.com/iblai/mentorai/compare/v0.45.1...v0.45.2) (2026-04-08)

### Bug Fixes

- simplify run-name expression ([e3d14bd](https://github.com/iblai/mentorai/commit/e3d14bdbe48a13efcdb410721c37e0eef92f1d13))

## [0.45.1](https://github.com/iblai/mentorai/compare/v0.45.0...v0.45.1) (2026-04-08)

### Bug Fixes

- handle workflow_dispatch in run-name and concurrency group ([a9faeb8](https://github.com/iblai/mentorai/commit/a9faeb8418bef2c9be8bc0155e6ce3d2f2685255))

## [0.45.0](https://github.com/iblai/mentorai/compare/v0.44.8...v0.45.0) (2026-04-08)

### Features

- add spa-pr-validation-new.yml to main for testing ([9cf949f](https://github.com/iblai/mentorai/commit/9cf949fa58da0407cfe5eb07b1f918c53f7b8f55))

## [0.44.8](https://github.com/iblai/mentorai/compare/v0.44.7...v0.44.8) (2026-04-07)

### Bug Fixes

- add check for Schedule Retrain button enabled state in dataset management journey ([bb3b1e2](https://github.com/iblai/mentorai/commit/bb3b1e2dd8e37d4ddc2244c8bc7b25d75b15dcd5))
- **chore:** comment out a use effect that determines the save current tenant flow and not in the tenant provider ([f2d3d2d](https://github.com/iblai/mentorai/commit/f2d3d2de96d83de1569185ee9be63e63f15cca07))
- increase download event timeout in HistoryTab to improve export reliability ([eaee906](https://github.com/iblai/mentorai/commit/eaee90625c48052307325882be991ba8a85b1118))
- increase download event timeout in mentor history tab to enhance export reliability ([6ad3606](https://github.com/iblai/mentorai/commit/6ad360652d2796796f29c75a87277e612db3e4d8))
- update deleteMentor method to use alertdialog for confirmation ([cc5ffa0](https://github.com/iblai/mentorai/commit/cc5ffa0b75109cfd4abacef89932d1cea2328147))
- update sidebar navigation to conditionally set rbacResource based on mentorId ([cd9fd16](https://github.com/iblai/mentorai/commit/cd9fd167f8e4ade215a37408bec9aef46ac9c8f5))

### Refactors

- streamline nav-bar and edit-mentor-modal components to utilize mentor segments ([efc2402](https://github.com/iblai/mentorai/commit/efc2402ba4cda8c328e3f815072dd7acc09fc380))
- update memory management components to use new mentor memory API ([0a93e4f](https://github.com/iblai/mentorai/commit/0a93e4f9429031b31bd260dd1e0f6df31aae2997))

## [0.44.7](https://github.com/iblai/mentorai/compare/v0.44.6...v0.44.7) (2026-04-07)

### Bug Fixes

- close billing modal tab on upgrade button click ([4333887](https://github.com/iblai/mentorai/commit/43338879939e130afd972470d501d3eb82e01ce4))
- close billing modal tab on upgrade button click > test coverage ([de21e58](https://github.com/iblai/mentorai/commit/de21e5803afba839536ff0ed2dccd6afe7268806))

## [0.44.6](https://github.com/iblai/mentorai/compare/v0.44.5...v0.44.6) (2026-04-06)

### Bug Fixes

- memoize middleware map to stabilize AuthProvider cookie sync interval ([3eb1e86](https://github.com/iblai/mentorai/commit/3eb1e8604aafa33058ad45b0976e02e4be662919))

## [0.44.5](https://github.com/iblai/mentorai/compare/v0.44.4...v0.44.5) (2026-04-06)

### Chores

- bump iblai-js to 1.3.5 and set e2e workers to 1 ([e75dff8](https://github.com/iblai/mentorai/commit/e75dff87e81cddd8526b78f1bfd0c50dc80c581d))

## [0.44.4](https://github.com/iblai/mentorai/compare/v0.44.3...v0.44.4) (2026-04-02)

### Styles

- format entire codebase with prettier and update pre-commit hook ([3cd6f15](https://github.com/iblai/mentorai/commit/3cd6f15b2cfa734b7250a395fc08eee3e88fe4c3))

## [0.44.3](https://github.com/iblai/mentorai/compare/v0.44.2...v0.44.3) (2026-04-02)

### Bug Fixes

- **mentor:** adding test coverage ([eaf4842](https://github.com/iblai/mentorai/commit/eaf4842e798f0390b19146a2b05ac9f9fc9dfb11))
- **mentor:** fixes for memory and tests ([4de9071](https://github.com/iblai/mentorai/commit/4de90715ac921a82e6a9d36a8d52803aaf7fe8fa))
- **mentor:** fixes for memory, unit tests ([b3f974c](https://github.com/iblai/mentorai/commit/b3f974c42b1a0343510ed2b724220299320ea972))
- **mentor:** merge conflicts fixes ([8938a07](https://github.com/iblai/mentorai/commit/8938a07b077ad82de81b2bf0ae67598251612824))
- **mentor:** prop for the enable memory in profile dropdown ([9dbbd1f](https://github.com/iblai/mentorai/commit/9dbbd1f9d943fb72652df90031d0711482dd6b21))

## [0.44.2](https://github.com/iblai/mentorai/compare/v0.44.1...v0.44.2) (2026-04-02)

### Chores

- bump iblai-js to 1.3.4, track .npmrc, update .gitignore ([acc8bbb](https://github.com/iblai/mentorai/commit/acc8bbbadf2aaabdbad008d0daeac110009270d4))

## [0.44.1](https://github.com/iblai/mentorai/compare/v0.44.0...v0.44.1) (2026-04-02)

### Chores

- pin all dependency versions and enforce via hook + CI ([0deb73d](https://github.com/iblai/mentorai/commit/0deb73d2b53d4c7282f6574b34a684b5d57689aa))

## [0.44.0](https://github.com/iblai/mentorai/compare/v0.43.0...v0.44.0) (2026-04-01)

### Features

- **chat:** implement screen sharing and voice call modals in canvas view ([d5e3d9b](https://github.com/iblai/mentorai/commit/d5e3d9b2da39a313c9ad719e1d48a9d234b4c27e))
- **e2e:** add journey 35 for voice call and screen share regression tests in canvas view ([1a41cbf](https://github.com/iblai/mentorai/commit/1a41cbf0bf23e7a21ad55e15ffb3e3992fddd2fe))
- **tests:** add tests for voice call and screen sharing modals in mobile canvas view ([29ac899](https://github.com/iblai/mentorai/commit/29ac899aed2a9b9ddade162ea0ba519379106702))
- **voice-call-screen-share:** add new journey tests for voice call and screen share flow ([269dfdf](https://github.com/iblai/mentorai/commit/269dfdf3cb500f02ce2de16b4ed070d2d540f9c8))

### Bug Fixes

- **chat:** add type="button" to ScreenSharingButton to prevent form submission ([af0642f](https://github.com/iblai/mentorai/commit/af0642ff64865f43baad2ac1942e2f8928c44257))

### Refactors

- **e2e:** extract tool and voice call toggles into page-objects ([7901c65](https://github.com/iblai/mentorai/commit/7901c6555e84df7ebc3ca44871a29b0e94206fe0))

### Chores

- **dependencies:** update package versions in pnpm-lock.yaml ([8f85ed7](https://github.com/iblai/mentorai/commit/8f85ed73973df2f06974c101cb13159217b5a8af))
- **deps:** update Playwright and related dependencies ([cb733fb](https://github.com/iblai/mentorai/commit/cb733fb9def380d41a8a2a495e3388166bb8f595))

## [0.43.0](https://github.com/iblai/mentorai/compare/v0.42.0...v0.43.0) (2026-04-01)

### Features

- add playwright-e2e-engineer agent for Playwright E2E testing ([466fc72](https://github.com/iblai/mentorai/commit/466fc7296f4fd76252a206af8e99412a99d82482))
- **dataset:** add CSV resource type to datasets tab in edit mentor modal ([c45115a](https://github.com/iblai/mentorai/commit/c45115a72c5fe975b0349457984168a1c3c68866))
- **e2e:** add CSV file upload tests for chat and dataset management journeys ([0780a68](https://github.com/iblai/mentorai/commit/0780a68d63eaf670c45e1840a5aec864b253c949))
- **playwright:** add test-data.csv for CSV file upload tests and update resource types ([588e41f](https://github.com/iblai/mentorai/commit/588e41f8d92c75496bca64804f3b6c09d71659b0))

### Bug Fixes

- force reinstall tauri-cli to avoid stale rust-cache metadata ([2e0d8f6](https://github.com/iblai/mentorai/commit/2e0d8f6ea2a035c9b1e5dca4048c46ccc4cffe99))
- replace yalc @iblai/iblai-js with registry version 1.0.36 ([561ee2a](https://github.com/iblai/mentorai/commit/561ee2ad4e38dc974c1ae306c046cdc260e427a1))
- update sourceFiles for dataset-management journey to include resource-types.tsx ([9d9b16b](https://github.com/iblai/mentorai/commit/9d9b16b9ec2935b81b3908156a64e5155dc24ba5))
- window.setTimeout replaced with setTimeout ([89c2ae6](https://github.com/iblai/mentorai/commit/89c2ae69f43af7847dae7d23495ef6ca9e12d610))
- window.setTimeout replaced with setTimeout ([9590fa9](https://github.com/iblai/mentorai/commit/9590fa95fce2ae0ddab2b6425416d82d4df50bfc))
- window.setTimeout replaced with setTimeout ([acb9da9](https://github.com/iblai/mentorai/commit/acb9da9871ef2a64aea629f6257724f5629b3e4a))

### Refactors

- **nav-bar:** remove unused import of menuItems in tests ([ca13261](https://github.com/iblai/mentorai/commit/ca132614875ea50660c92734af18989b56b46aba))
- streamline CSV file upload process in dataset management tests ([d7c036e](https://github.com/iblai/mentorai/commit/d7c036e7e54ae8b167fa76a54fac4d3dddcc822b))
- update playwright-e2e-engineer agent description and capabilities ([3d5cc56](https://github.com/iblai/mentorai/commit/3d5cc56b1ee1a393658b7413a3189aabf5cf7484))

### Chores

- **ci:** update pnpm lock file ([ab5f663](https://github.com/iblai/mentorai/commit/ab5f663e8bebb87c02f85820b1488937f4f5cad8))
- update dependencies in pnpm-lock.yaml ([eaf368d](https://github.com/iblai/mentorai/commit/eaf368d89b4d67133a0632f56869218f23cadaf4))
- update dependencies in pnpm-lock.yaml ([8242d18](https://github.com/iblai/mentorai/commit/8242d18942820e5bca8b6eb459fdf97f8fcbcf17))

### Tests

- **add-access-dialog:** enhance focus event handling in search input tests ([24c1eec](https://github.com/iblai/mentorai/commit/24c1eecf98d08df86f1e57e6d7072874f950154f))
- **dataset:** add comprehensive tests for resource types and local file upload modal ([848df2b](https://github.com/iblai/mentorai/commit/848df2b352131387b81b0d7fb2b09a435783b9bf))
- **providers:** add legacyLmsUrl to config mock and update error handler index ([696b0ef](https://github.com/iblai/mentorai/commit/696b0efcf41cc55694ca130cb70305edef1944d3))

## [0.42.0](https://github.com/iblai/mentorai/compare/v0.41.2...v0.42.0) (2026-04-01)

### Features

- add optional NSIS EXE installer output to Windows build workflow ([3dcd340](https://github.com/iblai/mentorai/commit/3dcd340ef80dc46c341ecdbaad273d2ed2e8da81))

## [0.41.2](https://github.com/iblai/mentorai/compare/v0.41.1...v0.41.2) (2026-04-01)

### Performance

- speed up MSIX workflow by using rust-cache and pre-built cargo-binstall ([715abed](https://github.com/iblai/mentorai/commit/715abedc58becc7e9ea21a8208abc0f77c881fa4))

## [0.41.1](https://github.com/iblai/mentorai/compare/v0.41.0...v0.41.1) (2026-03-31)

### Bug Fixes

- guard window access in email redirect for SSR compatibility ([afbbf01](https://github.com/iblai/mentorai/commit/afbbf011cb66fa8cacd8a430b4ccb4eef87292a8))

## [0.41.0](https://github.com/iblai/mentorai/compare/v0.40.3...v0.41.0) (2026-03-31)

### Features

- **copy-mentor:** add functionality to copy mentor without including training data and coverage ([67eccb7](https://github.com/iblai/mentorai/commit/67eccb77ccae5be9c422b74e4217166dc01bacc1))
- **copy-mentor:** expand Copy Mentor journey with additional checkpoints and update coverage metric ([a388ed5](https://github.com/iblai/mentorai/commit/a388ed5ff56d69906c940ee5356581eb276f691c))
- **copy-mentor:** implement Allow Copies toggle and enhance Copy Mentor functionality ([2dc3daf](https://github.com/iblai/mentorai/commit/2dc3daf16e4a32c47b629708aa9f48f57ae0d36a))
- **copy-mentor:** implement Copy Mentor journey with 7 checkpoints and update coverage metrics ([0e48905](https://github.com/iblai/mentorai/commit/0e48905cebd2e6402806d93204cd69d746dcff67))
- **create-mentor:** add CreateMentorPage class and integrate into Copy Mentor journey ([c440d7e](https://github.com/iblai/mentorai/commit/c440d7e35fb2aa34c638cce60099f4d8a385950b))
- **mentor-copy:** add CopyMentorModal component with associated tests ([0d728fc](https://github.com/iblai/mentorai/commit/0d728fc22ad25bf1848fd96edf37e18e80c40b42))
- **playwright:** enhance video reporting and cleanup test results in Makefile ([bedccd0](https://github.com/iblai/mentorai/commit/bedccd0314eaf21cea4c276a0f06e4e9a0bdb355))
- **release:** add Makefile target for versioned releases with tagging ([b1bc902](https://github.com/iblai/mentorai/commit/b1bc902d623a12939c1e87945d310b11a17aeca0))
- **settings-tab:** implement Allow Copies feature with associated tests and update dynamic modal ([f52ea6d](https://github.com/iblai/mentorai/commit/f52ea6db85875f5f07bc5cb2d58948162f8d7338))

### Bug Fixes

- **copy-mentor.spec:** improve visibility check for destination tenant combobox in Copy Mentor ([1260e14](https://github.com/iblai/mentorai/commit/1260e143e740e86581d8d97f05cf47aa36a4e6d6))
- **copy-mentor:** add gap class to DialogFooter for improved layout ([b563453](https://github.com/iblai/mentorai/commit/b5634539d4061d984c686660bfdb5c6634466e85))
- **copy-mentor:** update source file path in coverage documentation for accuracy ([1c96f86](https://github.com/iblai/mentorai/commit/1c96f86a281e3ed9b8b20311182ba7921dc85284))
- **copy-mentor:** update success toast message to remove ellipsis ([bf0804f](https://github.com/iblai/mentorai/commit/bf0804fdf40843a26c7f8a28d03552badc17ce25))
- **create-mentor:** update name input visibility check to be enabled with extended timeout ([65e6dc0](https://github.com/iblai/mentorai/commit/65e6dc0c0e29823b89b85cf93bbed444aad7ed9c))
- **edit-mentor-modal:** standardize modal title to 'Edit Mentor' ([7f7acfc](https://github.com/iblai/mentorai/commit/7f7acfc903d294b6d6bc0f066eb9a3a603cdf696))
- **settings-tab.test:** specify return type for mockUsername function in CopyMentorModal tests ([b381a92](https://github.com/iblai/mentorai/commit/b381a923e13ee6cc57ead0bb1e80754d449ce31f))
- **settings-tab.test:** update LTI Accessible toggle text for consistency in tests ([b4d8da0](https://github.com/iblai/mentorai/commit/b4d8da096a98f46be92866b19cf9b347a8a39acd))

### Refactors

- **copy-mentor-modal:** enhance tenant handling during mentor copy process ([2e3e129](https://github.com/iblai/mentorai/commit/2e3e129b45784269407a5b34eee54a8cd2f8b41e))
- **copy-mentor.spec:** remove unused dialog handling functions and cleanup code ([52a5e01](https://github.com/iblai/mentorai/commit/52a5e01af63c079bb30c83b83d5dbffbcae5a0d1))
- **copy-mentor:** simplify modal stack handling in CopyMentorModal component ([a595ca6](https://github.com/iblai/mentorai/commit/a595ca6319c4c4a5f349eeb864be487ea5d28c89))
- **copy-mentor:** update dataset verification method to use navigateToTab for clarity ([38e8c3a](https://github.com/iblai/mentorai/commit/38e8c3ace44704ef6e38e955f0d9464c6fd11f84))
- **settings-tab.test:** replace inline modal mocks with named functions for better readability ([d29b196](https://github.com/iblai/mentorai/commit/d29b196c3faca9324352a8233d765e27e942d140))

### Chores

- add Prettier configuration and ignore file for code formatting ([e192b83](https://github.com/iblai/mentorai/commit/e192b834eda7c7cd811cce18bc2ebad047916ebc))

### Tests

- **apple-restriction-modal:** enhance tests for pricing link interactions and Tauri app behavior ([7d9f3ba](https://github.com/iblai/mentorai/commit/7d9f3ba193e50b9a927ed15d6bc89bd4b9f672c9))
- **edit-mentor-modal:** update test to reflect standardized modal title 'Edit Mentor' ([103db66](https://github.com/iblai/mentorai/commit/103db66e16739f8ea1b742ae8efdd5b0ae279d14))
- **settings-tab:** add error handling test for missing username in CopyMentorModal ([b2da8a4](https://github.com/iblai/mentorai/commit/b2da8a41378afb774e44341d08e5c0b1c23af220))
- **settings-tab:** add Playwright tests for Copy Mentor functionality in settings tab ([461a60b](https://github.com/iblai/mentorai/commit/461a60ba2c562e28929b4af16803c18301af9f8f))
- **use-os:** mock isTauriApp in use-os tests for accurate platform detection ([102f0d7](https://github.com/iblai/mentorai/commit/102f0d7779a3236e90641ea3cf0ea419f4354a03))

## [0.40.3](https://github.com/iblai/mentorai/compare/v0.40.2...v0.40.3) (2026-03-31)

### Bug Fixes

- open pricing link in system browser via Tauri opener plugin ([db6f010](https://github.com/iblai/mentorai/commit/db6f010fb832ba0164f1cde5fc108f9e50404d02))

## [0.40.2](https://github.com/iblai/mentorai/compare/v0.40.1...v0.40.2) (2026-03-31)

### Bug Fixes

- init tauri OS plugin and update apple restriction modal ([fd72a30](https://github.com/iblai/mentorai/commit/fd72a3029cb5cab8c8cf14b3a9967d76d5feae72))

## [0.40.1](https://github.com/iblai/mentorai/compare/v0.40.0...v0.40.1) (2026-03-30)

### Chores

- add debug logging to useOS hook ([5e9b4d6](https://github.com/iblai/mentorai/commit/5e9b4d609f4566e450c84616fd5d57807f8dd018))

## [0.40.0](https://github.com/iblai/mentorai/compare/v0.39.2...v0.40.0) (2026-03-30)

### Features

- ios restiction message modal feature ([e7f44d5](https://github.com/iblai/mentorai/commit/e7f44d5ed82bcbcfb4d674fbfee61597a36e2846))
- ios restiction message modal feature > pnpm lock update ([f7699b0](https://github.com/iblai/mentorai/commit/f7699b0b152772d764341f9a699bf404f4692eff))
- ios restiction message modal feature > test coverage ([9356132](https://github.com/iblai/mentorai/commit/93561324369fec93661e01669e2cd50c6d57cd30))
- ios restriction on progress ([c91bcaf](https://github.com/iblai/mentorai/commit/c91bcafb7e7eed65a66d60a6d7c3245c5e51d713))
- ios restriction on progress ([9c3637b](https://github.com/iblai/mentorai/commit/9c3637b4e49b51ce74ce0c5cf633d3a6a98a6954))

### Bug Fixes

- regenerate app icons, fix fetch interceptor crash, fix iOS bundle validation ([37e75d3](https://github.com/iblai/mentorai/commit/37e75d380f665bd289e96adffea263186ab10a94))
- restore useOS isTauriApp guard and bump iblai-js to 1.1.9 ([9bd8fd4](https://github.com/iblai/mentorai/commit/9bd8fd4886eb4fc16845f393601073e192d1deb8))

### Chores

- add release-it as devDependency ([8776c87](https://github.com/iblai/mentorai/commit/8776c87e5988bb163f2e3a69a1e741f71070e86b))
- bump package version to patch ([2fd6e7a](https://github.com/iblai/mentorai/commit/2fd6e7aacb9f3698ac3073c6292ebed5952a9338))

## [0.39.2](https://github.com/iblai/mentorai/compare/v0.39.0...v0.39.2) (2026-03-30)

### Chores

- release 0.39.1 ([7a91886](https://github.com/iblai/mentorai/commit/7a9188683ba9db3b7e889fccabf7705b3e65a1ec))

## [0.39.1]

- bump iblai-js version to 1.1.9

## [0.39.0](https://github.com/iblai/mentorai/compare/v0.38.2...v0.39.0) (2026-03-30)

### Features

- add explore page layout component ([9fa63b8](https://github.com/iblai/mentorai/commit/9fa63b8165cdd0142e3b66f0142ff0cae93774d3))
- add navigation function to tenant explore page and implement E2E tests for non-admin and admin ([db1617b](https://github.com/iblai/mentorai/commit/db1617b82507fea448aabe039bc5159005296dba))
- add new chat and workflows buttons to sidebar ([37df152](https://github.com/iblai/mentorai/commit/37df152d9605a1cc42e9e6b17f661eb4a9895ad7))
- add notifications layout component ([91b9aab](https://github.com/iblai/mentorai/commit/91b9aab529aea98868cc23cf61a2d59f852f9809))
- update E2E coverage for Tenant Explore Page with new checkpoints ([6129059](https://github.com/iblai/mentorai/commit/6129059a647144df9db656c70171161e5e9b105e))

### Bug Fixes

- add explore and notifications layout files to skip coverage check ([6dc8d3c](https://github.com/iblai/mentorai/commit/6dc8d3c963eed2ec92551da47c9f9d7a39409b89))
- add skip condition to mentor public settings query ([813f1c8](https://github.com/iblai/mentorai/commit/813f1c896863691fdbfaaab391ecaf1212e3b4dc))
- prevent navigation to workflows without a selected mentor ([ec0dbe9](https://github.com/iblai/mentorai/commit/ec0dbe919a9fc0e9739198ae695db394f3435e31))
- update tenant explore page checkpoints for admin functionality ([316fce5](https://github.com/iblai/mentorai/commit/316fce5a1b7330075ab1e71b8e4e88b1ef3b2a2f))

### Tests

- add unit tests for NotificationsLayout component ([677bb24](https://github.com/iblai/mentorai/commit/677bb24809e8cac192e780048f0943eb77a2a12c))

## [0.38.2](https://github.com/iblai/mentorai/compare/v0.38.0...v0.38.2) (2026-03-30)

### Chores

- release 0.38.1 ([d7b8a06](https://github.com/iblai/mentorai/commit/d7b8a061bf1bbdb2f549fab3300c78229422cbe4))
- release 0.38.1 ([51adbe4](https://github.com/iblai/mentorai/commit/51adbe41aa7b021423ea08c46c1cfa2586f1f5af))

## [0.38.1]

- fix(web-containers): profile > basic > validation needed for fullname field

## [0.38.0](https://github.com/iblai/mentorai/compare/v0.37.2...v0.38.0) (2026-03-30)

### Features

- ios restiction message modal feature ([6d910d8](https://github.com/iblai/mentorai/commit/6d910d88cde11beb83f3cc8bc412ceec8691c76b))
- ios restiction message modal feature > pnpm lock update ([c63f432](https://github.com/iblai/mentorai/commit/c63f4322d4aea72744b0aed0e7e14238d9a564f6))
- ios restiction message modal feature > test coverage ([4c25605](https://github.com/iblai/mentorai/commit/4c256059ed30ac5aa6866de13d284812fd4c1fdb))
- ios restriction on progress ([03358a4](https://github.com/iblai/mentorai/commit/03358a4a495a3f3da4c2ff9f1f6fd6b98063f9f4))
- ios restriction on progress ([e5a781f](https://github.com/iblai/mentorai/commit/e5a781f532b02c155afce61c011d1f617fd0584b))

### Chores

- bump @iblai/iblai-js to 1.1.7 ([6884d9c](https://github.com/iblai/mentorai/commit/6884d9c34fbefa205dd12caa4e48928a6e2b6a92))
- use localhost for tauri dev instead of org env ([62377c5](https://github.com/iblai/mentorai/commit/62377c5581031d3868ee80a92b29eada40cbdb02))

## [0.37.2](https://github.com/iblai/mentorai/compare/v0.37.1...v0.37.2) (2026-03-30)

### Chores

- switch Dependabot to grouped updates to reduce PR noise ([5b50d13](https://github.com/iblai/mentorai/commit/5b50d13b8e5ad4b2113377215dc757ee28ca5866))

## [0.37.1](https://github.com/iblai/mentorai/compare/v0.37.0...v0.37.1) (2026-03-30)

### Bug Fixes

- **e2e:** replace non-existent .react-flow selectors with actual DOM selectors ([8e465ac](https://github.com/iblai/mentorai/commit/8e465ac062156996c9007a14b9809b2e4e54a9bf))

## [0.37.0](https://github.com/iblai/mentorai/compare/v0.36.13...v0.37.0) (2026-03-30)

### Features

- **tauri:** add os plugin and fix e2e auth test ([88cba0d](https://github.com/iblai/mentorai/commit/88cba0d91628575ea6b989861e5c75c3221cdb46))

### Bug Fixes

- add chunk-retry coverage exclusion and headers test ([ad58cfc](https://github.com/iblai/mentorai/commit/ad58cfc93ddb66dd13acd8df1f059c371b3fa0f8))
- add webpack-level chunk retry and cache headers to prevent ChunkLoadError ([db293fc](https://github.com/iblai/mentorai/commit/db293fcdac0c3cf7296b195258d3608da1be973f))

## [0.36.13](https://github.com/iblai/mentorai/compare/v0.36.12...v0.36.13) (2026-03-30)

### Bug Fixes

- **ci:** add release-it devDep, fix node version; skip custom domain check on mentor origin ([118bfa7](https://github.com/iblai/mentorai/commit/118bfa70d18f82eadf9e38656cac11eeba266c5b))
- **ci:** disable husky hooks in release workflow to prevent OOM on CI ([50aa7ed](https://github.com/iblai/mentorai/commit/50aa7edf37eab3d0553c8a3ac9ed2544323e7758))
- **e2e:** increase timeout and re-enable Safari browser tests ([4cc718d](https://github.com/iblai/mentorai/commit/4cc718d61e02cffd32f5eb1189683dd5fc61c7b3))

### Chores

- add Dependabot configuration for dependency and security updates ([7eee7cf](https://github.com/iblai/mentorai/commit/7eee7cfadf540dfcd2ff988836228a83f82e35b2))
- **release:** v0.36.12 ([2c9fb64](https://github.com/iblai/mentorai/commit/2c9fb6475f28904b0f1e87e28dea87db38c86012))

- fix(ci): disable husky hooks in release workflow to prevent OOM on CI (50aa7ed)
- fix(ci): add release-it devDep, fix node version; skip custom domain check on mentor origin (118bfa7)
- fix(e2e): increase timeout and re-enable Safari browser tests (4cc718d)

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
