# Changelog

## [0.92.4](https://github.com/iblai/os/compare/v0.92.3...v0.92.4) (2026-07-08)

### Bug Fixes

* **sidebar:** hide chat export for students when tenant setting is off ([7854e52](https://github.com/iblai/os/commit/7854e521ebcb438e55d39ba1b615aaa67f5c9cda))
* **sidebar:** preserve embed mode when selecting a chat from history ([67e74db](https://github.com/iblai/os/commit/67e74db2841c9585b31722885fbf84d37cb61e26)), closes [#2067](https://github.com/iblai/os/issues/2067)
* **sidebar:** restore pre-rewrite chat-selection page routing ([b06c969](https://github.com/iblai/os/commit/b06c969b4122a872ca59a76dc5683f69868006e3)), closes [#2067](https://github.com/iblai/os/issues/2067)
* **tests:** skip journey 43 for now ([13e5b89](https://github.com/iblai/os/commit/13e5b891ea5c40b7507199e404c1265788cdcbe2))

### Chores

* **deps:** bump @iblai/iblai-js to 1.22.2 ([0d6248b](https://github.com/iblai/os/commit/0d6248bf558c81d941757c1ebaa37d3f4f19a2a3))

### Documentation

* **e2e:** record journey 56 coverage ([57e0ba0](https://github.com/iblai/os/commit/57e0ba00d0a8b172dbd9f694adc580f0a3875e58))

### Tests

* **e2e:** add journey 56 for chat history export toggle ([78614c6](https://github.com/iblai/os/commit/78614c68bd91edeab3f7261ff8f71f2dc353a263))
* **e2e:** add journey 57 for embed-mode chat-selection sidebar guard ([ae995a6](https://github.com/iblai/os/commit/ae995a610dc2dcb359f8fbe014618432d564309b))
* **e2e:** fix flaky Export-gate assertions in journey 57 ([609aac1](https://github.com/iblai/os/commit/609aac1cf6bdb83b83dfbe7bc6f0264f55cc8169))

## [0.92.3](https://github.com/iblai/os/compare/v0.92.2...v0.92.3) (2026-07-07)

### Bug Fixes

- **app:** foreground main window before navigating on popup return ([f1a8aa5](https://github.com/iblai/os/commit/f1a8aa5f88726b3a68e2235f69a332c5fcaa775b))

## [0.92.2](https://github.com/iblai/os/compare/v0.92.1...v0.92.2) (2026-07-07)

### Bug Fixes

- **mentor:** hide admin-only settings when an admin previews as a student ([3233caa](https://github.com/iblai/os/commit/3233caa7d7e7395d676532981eb3b3fd3c8c22c3))
- **mentor:** hide the agent fork action in student mode ([b2dfe48](https://github.com/iblai/os/commit/b2dfe485065d4eae7eddb960ef564ed103bf811a))
- **mentor:** rebuild the segment list when the effective user type changes ([fde3f7a](https://github.com/iblai/os/commit/fde3f7a585f15a7944873212c3a6b79ce0aeebb1))
- **tests:** remove "/dm", this is already expected from the env variable ([1d60663](https://github.com/iblai/os/commit/1d606630abfab93fc8b52b11b0df13ac41fd90d7))

### Chores

- **deps:** bump @iblai/iblai-js to 1.20.21 ([26167a5](https://github.com/iblai/os/commit/26167a51098555e36d153d18426c1e7d94238c72))

### Documentation

- **e2e:** record journey 56 in coverage ([22a22da](https://github.com/iblai/os/commit/22a22da5e1807ca57a35ef0ccf21934a64980101))

### Tests

- **e2e:** cover navbar agent-dropdown visibility across user/admin mode ([bf93c4d](https://github.com/iblai/os/commit/bf93c4d241e5fd6c036e9212c108d29c338ecc2e))
- **mentor:** align useUserType mocks with the new userType return ([cbbc49e](https://github.com/iblai/os/commit/cbbc49e252a766e92cb201ff459a1bdde1da8eb1))

## [0.92.1](https://github.com/iblai/os/compare/v0.92.0...v0.92.1) (2026-07-07)

### Bug Fixes

- **app:** hard-navigate the main window on in-app popup return ([a6f76b2](https://github.com/iblai/os/commit/a6f76b20cd1e8c536b4ae5b0d430aa931bf12e33))

## [0.92.0](https://github.com/iblai/os/compare/v0.91.2...v0.92.0) (2026-07-06)

### Features

- **app:** route open_external_url to an in-app popup by URL pattern ([6f07027](https://github.com/iblai/os/commit/6f07027d28bfba31422845dcccfee63bd85844b8)), closes [#311](https://github.com/iblai/os/issues/311)

## [0.91.2](https://github.com/iblai/os/compare/v0.91.1...v0.91.2) (2026-07-06)

### Bug Fixes

- **app:** register open_external_url command on desktop ([cc1b010](https://github.com/iblai/os/commit/cc1b0106096a57766b44ea2c62c8e82019ca0a15))

## [0.91.1](https://github.com/iblai/os/compare/v0.91.0...v0.91.1) (2026-07-06)

### Chores

- bumped iblai-js version to 1.22.4 ([f2a9c3c](https://github.com/iblai/os/commit/f2a9c3c479555a0144da4303dec637b94bfc5abc))
- bumped iblai-js version to 1.22.4 > test coverage ([6d28bd4](https://github.com/iblai/os/commit/6d28bd4f80fee0c05ff7c5a98486b6c82cf9c043))

## [0.91.0](https://github.com/iblai/os/compare/v0.90.4...v0.91.0) (2026-07-06)

### Features

- gradebook display gated behind env flag ([4dbfc4f](https://github.com/iblai/os/commit/4dbfc4fec558a5a5413e97dbe90c65ab938a3750))
- gradebook display gated behind env flag > pnpm lock update ([a902f77](https://github.com/iblai/os/commit/a902f772f2efd943ba4ea485de8919f3c14cd59a))
- gradebook display gated behind env flag > test coverage ([5ce33a2](https://github.com/iblai/os/commit/5ce33a29138a2efc40e1095da437f7d4a908495b))
- gradebook display gated behind env flag > test coverage ([277f300](https://github.com/iblai/os/commit/277f300921f5aff6687e00456c1dc1fe2241cb16))
- **mentor:** sync forkable_with_training_data with enable-copies toggle ([60d71f7](https://github.com/iblai/os/commit/60d71f7910f3ee889e22de04e08103aa9e3fb557))

### Bug Fixes

- **sentry:** skip sourcemap generation when there's no auth token ([c76f5b1](https://github.com/iblai/os/commit/c76f5b158bb98c13504fae23fda79893d581fbda)), closes [298/#303](https://github.com/298/os/issues/303)

### Chores

- normalize CHANGELOG formatting ([cbe4f6e](https://github.com/iblai/os/commit/cbe4f6e08521533ce06c8db9bb9ad3d6f5d33b35))

### Tests

- **e2e:** align profile management journey with nested tabs ([2596cd4](https://github.com/iblai/os/commit/2596cd45d19367be71eb333f1678cd4d0cdbde81))
- **e2e:** match renamed Privacy profile tab in chat-privacy PO ([8a9a75d](https://github.com/iblai/os/commit/8a9a75ddca8868a6d16c28bf283414143cd1edf9))
- **e2e:** scope profile tab lookups to the profile nav ([4fff5aa](https://github.com/iblai/os/commit/4fff5aa613793e53b4b2e5b58f3b98625e6063c4))
- **e2e:** scope the schedule-retraining dialog by name ([d0cb1d3](https://github.com/iblai/os/commit/d0cb1d36753bd3c12d1593b13cb17c192785e4eb))

## [0.90.4](https://github.com/iblai/os/compare/v0.90.3...v0.90.4) (2026-07-03)

### Chores

- **sentry:** delete source maps after uploading them to Sentry ([700a37d](https://github.com/iblai/os/commit/700a37d311bf8dabb34713083c0fd5883efefc36))

## [0.90.3](https://github.com/iblai/os/compare/v0.90.2...v0.90.3) (2026-07-03)

### CI

- PR image build timeout + drop dead SENTRY_AUTH_TOKEN reference ([3d530e1](https://github.com/iblai/os/commit/3d530e17ae6a78416a68ad530628ebc5ff696995))

## [0.90.2](https://github.com/iblai/os/compare/v0.90.1...v0.90.2) (2026-07-03)

### Bug Fixes

- **tauri:** trust https://\*.ibl.ai origin in capabilities ([0c0d469](https://github.com/iblai/os/commit/0c0d4691a9d0cc8479aae620c90dbda204095f04))
- **tauri:** trust https://\*.ibl.ai origin in capabilities ([8f53622](https://github.com/iblai/os/commit/8f536224279e5e07d824dc7dd52f8b9477643a8e))

## [0.90.1](https://github.com/iblai/os/compare/v0.90.0...v0.90.1) (2026-07-03)

### Bug Fixes

- **tauri:** grant ACL permission for allow_in_app_purchase command ([fee75a2](https://github.com/iblai/os/commit/fee75a24b52afe4477889a01928bdf230691a708))

### CI

- push release image to iblai-os-spa (replaces iblai-mentor-spa-pro) ([d1bf12f](https://github.com/iblai/os/commit/d1bf12ff7565d0f01a1fd3dfbd03c8bd20503f6a))

## [0.90.0](https://github.com/iblai/os/compare/v0.89.1...v0.90.0) (2026-07-03)

### Features

- in-app-purchase hook implemented ([396a006](https://github.com/iblai/os/commit/396a0060d03a485b66fc73c181e45a7c7ba65e80))
- in-app-purchase hook implemented ([d5386e0](https://github.com/iblai/os/commit/d5386e04aa8164ea31b0a056cc136c97a486f413))
- in-app-purchase hook implemented > test coverage ([73cfd1c](https://github.com/iblai/os/commit/73cfd1cd527404a0dbeb1e4decf5aea64ee1a524))

## [0.89.1](https://github.com/iblai/os/compare/v0.89.0...v0.89.1) (2026-07-02)

### Bug Fixes

- **i18n:** gate language-preference sync on edX JWT and mount inside AuthProvider ([a1829f9](https://github.com/iblai/os/commit/a1829f9db2b69428c2cb45d72bd4c209d5b0ffe7))

## [0.89.0](https://github.com/iblai/os/compare/v0.88.3...v0.89.0) (2026-07-02)

### Features

- **tauri:** add allow_in_app_purchase command gated by build-time env ([1a1ddeb](https://github.com/iblai/os/commit/1a1ddebc5475ad80bb4cd19ea60d539248ac7701))

### Tests

- **e2e:** wait for streaming before re-navigating in prompt-injection TC3 ([31b4edd](https://github.com/iblai/os/commit/31b4edd43968f25781982b6828ed6c06485000bc))

## [0.88.3](https://github.com/iblai/os/compare/v0.88.2...v0.88.3) (2026-07-01)

### Chores

- **deps:** bump @iblai/iblai-js to 1.20.17 ([d73e457](https://github.com/iblai/os/commit/d73e457953415a97c9aaf8d0cafe0bf97da895ca))

## [0.88.2](https://github.com/iblai/os/compare/v0.88.1...v0.88.2) (2026-06-30)

### Bug Fixes

- **mentor:** respect RBAC on Verbose Reasoning toggle ([c6583a2](https://github.com/iblai/os/commit/c6583a2c3acb09257e3757728a4914b3046e5b06))

## [0.88.1](https://github.com/iblai/os/compare/v0.88.0...v0.88.1) (2026-06-30)

### Bug Fixes

- **mentor:** only stop generation on chat switch when one is active ([250a951](https://github.com/iblai/os/commit/250a951b7cbd763c070c006cc8a9db997bfa1370))

## [0.88.0](https://github.com/iblai/os/compare/v0.87.3...v0.88.0) (2026-06-30)

### Features

- playwright test for stripe checkout URL ([f26d672](https://github.com/iblai/os/commit/f26d672d505c2169425dc0e17dbb2916084cc4e9))
- playwright test for stripe checkout URL ([f63c09a](https://github.com/iblai/os/commit/f63c09a395bae65bf5eae43dc3ddb6709dcb0177))
- playwright test for stripe checkout URL > coverage json & md updated ([27aa6da](https://github.com/iblai/os/commit/27aa6da24c6effe3d6ae352c87da59591867a95d))
- playwright test for stripe checkout URL > fixme on follow up test ([66cbfd5](https://github.com/iblai/os/commit/66cbfd5c25362a98bb985bd58b54777f6b9682a9))

### Bug Fixes

- journey 36> Copy Mentor playwright issue fixed ([ef946b6](https://github.com/iblai/os/commit/ef946b6b4b18f6e67a5f25cd56115802af6333be))

## [0.87.3](https://github.com/iblai/os/compare/v0.87.2...v0.87.3) (2026-06-30)

## [0.87.2](https://github.com/iblai/os/compare/v0.87.1...v0.87.2) (2026-06-30)

### Bug Fixes

- **deps:** patch vitest, dompurify, and @opentelemetry/core vulnerabilities ([4e30df7](https://github.com/iblai/os/commit/4e30df7e7c70e16fea703f66cd06120cd8dd9549))

### CI

- add dependency vulnerability scanning to the PR pipeline ([9c3b7b6](https://github.com/iblai/os/commit/9c3b7b645976455b1ad1f0112493b18535a8b862))

## [0.87.1](https://github.com/iblai/os/compare/v0.87.0...v0.87.1) (2026-06-30)

### Bug Fixes

- **e2e-test:** fixing e2e test for journey 20 for nested dialouge ([efc873c](https://github.com/iblai/os/commit/efc873c410913ac4ef4db42478a234bbb8a8d06c))
- **e2e-test:** fixing voice chat tests to have dedicated mentor to perform tests ([1cccc44](https://github.com/iblai/os/commit/1cccc448fbade330d5c46cf723ebb1668610ec99))
- **e2e-test:** more fixes for journey 20 ([e845aca](https://github.com/iblai/os/commit/e845acab21dbb31cce2d228d89a5408a23977dab))
- **mentor:** unify explore agents section onto ai-search endpoint ([e929083](https://github.com/iblai/os/commit/e929083c7583012c0ac74e484fa901889ae6db12))

### Chores

- **format:** apply prettier to drifted files ([630bc8c](https://github.com/iblai/os/commit/630bc8c0f320db285864ffbda1b5bea7e71e4863))
- **mentorai:** version bump for iblai-js ([a4034b3](https://github.com/iblai/os/commit/a4034b3f1496295b1056959fa4dcb4cc899be75d))

### Tests

- **mentor:** update explore agents tests for unified endpoint ([ca48859](https://github.com/iblai/os/commit/ca48859d4a54cacbf1db760b4c533a01418f3dd8))

## [0.87.0](https://github.com/iblai/os/compare/v0.86.0...v0.87.0) (2026-06-27)

### Features

- **mentor:** add Optimize Page Context Tokens embed toggle ([cc250bb](https://github.com/iblai/os/commit/cc250bb5cfc9281848d117c064775ec6e10c4515))

### Bug Fixes

- **mentor:** match Advanced CSS/JS tooltip styling to the rest ([31aa961](https://github.com/iblai/os/commit/31aa96130c67e8716eb0e699cefb2c7ae5b6a97f))
- test journey-20 ([59e5994](https://github.com/iblai/os/commit/59e5994df46f45c62f7c81e717b1d058f9a51707))

### Chores

- bump iblai sdk to 1.20.12 ([17da0c2](https://github.com/iblai/os/commit/17da0c2b82c8a1039cef1a6906a96ecc02fb6f21))
- replace yalc web-containers override with published 1.10.10 ([48e222b](https://github.com/iblai/os/commit/48e222bb0e94d93f025c8c6dc2bfd9ca6dbef2fb))

### Documentation

- **e2e:** record emb-10 coverage for Optimize Page Context Tokens ([4f6d1f3](https://github.com/iblai/os/commit/4f6d1f3d5c5e62736f21b6107426497b664bfb09))

### Tests

- **e2e:** align Enhanced RAG locators with shipped "Enhanced document retrieval" label ([3fea850](https://github.com/iblai/os/commit/3fea85065ab0ded90d67b26ef5531d432319b91e))
- **e2e:** cover embed Optimize Page Context Tokens toggle ([aab2fe3](https://github.com/iblai/os/commit/aab2fe35c32a6c82d8d0303858ba8ad32a26a46a))
- **e2e:** match Add Resources modal by accessible name to avoid strict-mode race ([fb2c486](https://github.com/iblai/os/commit/fb2c48613db9fe2612d6f9483c1ad4a77af57d13))
- **e2e:** park emb-10 Optimize Page Context Tokens as fixme ([8b8c6ab](https://github.com/iblai/os/commit/8b8c6abc066bdcc6f51c685a049913a22f750749))
- **mentor:** cover Optimize Page Context Tokens toggle ([bac9a0a](https://github.com/iblai/os/commit/bac9a0a76f27984da2a0f336fb3b3add4bf74fa1))

## [0.86.0](https://github.com/iblai/os/compare/v0.85.0...v0.86.0) (2026-06-26)

### Features

- text to speech endpoint now streamable ([0dbb773](https://github.com/iblai/os/commit/0dbb77353e417cfb0c07227deec0e9c7fa8c0ced))
- text to speech endpoint now streamable ([5039df8](https://github.com/iblai/os/commit/5039df8262e27c01bc5da82f711551411fe1ac32))
- text to speech endpoint now streamable ([7106acd](https://github.com/iblai/os/commit/7106acd82cdcb88e6793ac9036677ea4d1726686))
- text to speech endpoint now streamable > test coverage ([72ccd50](https://github.com/iblai/os/commit/72ccd50907249fcc4b5c4234dc29d7e0c79382c7))

## [0.85.0](https://github.com/iblai/os/compare/v0.84.3...v0.85.0) (2026-06-26)

### Features

- test coverage from uncovered files ([04a8460](https://github.com/iblai/os/commit/04a84607c17ebcce9423f4834b47b56a9686e035))
- user phone support now behind env flag ([b2c57c6](https://github.com/iblai/os/commit/b2c57c641db8752beb544b4d02dbd86893f73710))
- user phone support now behind env flag > test coverage ([0136bf0](https://github.com/iblai/os/commit/0136bf0c44d0e48e3fd1e01bbae87cdff2f39e6b))
- user phone support now behind env flag > test coverage ([8fac079](https://github.com/iblai/os/commit/8fac0795c355d215b3d4179359f5945519a5beaa))

### Chores

- bumper iblai-js to 1.20.11 ([7f1e887](https://github.com/iblai/os/commit/7f1e887d8ede874b52d0e93fea92d978783ea8ac))
- rebase against main ([2acedb3](https://github.com/iblai/os/commit/2acedb3c0af9872409000f50b1631b17ccdcc901))

## [0.84.3](https://github.com/iblai/os/compare/v0.84.2...v0.84.3) (2026-06-25)

### Bug Fixes

- **docker:** copy pnpm-workspace.yaml in e2e image so frozen install sees overrides ([172edb2](https://github.com/iblai/os/commit/172edb2a3f2c76f4d97a19b55edcc9981e490269))

## [0.84.2](https://github.com/iblai/os/compare/v0.84.1...v0.84.2) (2026-06-25)

### Bug Fixes

- **docker:** copy pnpm-workspace.yaml so frozen install sees overrides ([4d0b38e](https://github.com/iblai/os/commit/4d0b38e412f73397e7dcf72c323da0f477cc9b7c))

## [0.84.1](https://github.com/iblai/os/compare/v0.84.0...v0.84.1) (2026-06-25)

### Bug Fixes

- **i18n:** force dynamic rendering so cookie-based locale doesn't break build ([9b6d332](https://github.com/iblai/os/commit/9b6d332d89d58f61cc4f73939983f4ab0a0db03a))

## [0.84.0](https://github.com/iblai/os/compare/v0.83.0...v0.84.0) (2026-06-25)

### Features

- **extensions:** add Chrome side-panel extension hosting <agent-ai> ([1467aa1](https://github.com/iblai/os/commit/1467aa10ebf15aa943f14652920bf47b0d6386ee))
- **i18n:** internationalize the app with next-intl ([646f891](https://github.com/iblai/os/commit/646f891bf54b50bb3196351d06cfb24cee16c205))

### Bug Fixes

- **deps:** drop obsolete .yalc web-containers override; use published SDK ([f9e493b](https://github.com/iblai/os/commit/f9e493b45da709db4681efb3774cae85d4943940))

## [0.83.0](https://github.com/iblai/os/compare/v0.82.1...v0.83.0) (2026-06-25)

### Features

- add dataset curator viewer role on access tab ([c892565](https://github.com/iblai/os/commit/c892565ff592e3660edf0c66cdfe4cc94d8024af))
- add dataset curator viewer role on access tab > test coverage ([213a72e](https://github.com/iblai/os/commit/213a72e06739072b9b0eeab5162e4dbf8ac74e6f))
- add dataset curator viewer role on access tab > test coverage ([be3f0de](https://github.com/iblai/os/commit/be3f0de3094f8d1357a016b59983d2fd5f94527d))
- add dataset curator viewer role on access tab > test coverage ([494c3ed](https://github.com/iblai/os/commit/494c3edce92853b2006b5a6e4df4e6407b6a3dce))

### Bug Fixes

- failing playwright test fix ([aab5693](https://github.com/iblai/os/commit/aab569378c29db2cdcfba151d85e20407d8957e8))
- **mentor:** load agent picker from ai-search endpoint ([b855fbe](https://github.com/iblai/os/commit/b855fbe7805cd5f8d302ee3e00344f09138f13f5))

### Chores

- **deps:** bump @iblai/iblai-js to 1.20.11 ([ee29c03](https://github.com/iblai/os/commit/ee29c03048049aa5cea1056d750b1ce1b330d01d))

### Tests

- **e2e:** widen project agent-card wait for slow agent loads ([7c3ac05](https://github.com/iblai/os/commit/7c3ac05fdb243622fafba7797db463d21dce9037))
- **mentor:** cover ai-search agent picker hook and grid ([79de6cd](https://github.com/iblai/os/commit/79de6cd028202a105c62ecc7ef9628b6f0e596e8))

## [0.82.1](https://github.com/iblai/os/compare/v0.82.0...v0.82.1) (2026-06-24)

### Bug Fixes

- **chat:** split thought-process steps on bold delimiters ([318d713](https://github.com/iblai/os/commit/318d7136bbc32a1e9cf0f0ecb8ddad98412c8bab))
- **settings:** use "Enable …" wording for three capability toggles ([c0dd67d](https://github.com/iblai/os/commit/c0dd67d9501dd7b1e556d3a483769550425a0917))

### Tests

- **chat:** cover thought-process step splitting ([c6e22a0](https://github.com/iblai/os/commit/c6e22a044837c637dd89ec3b39f47e779c96306f))
- **e2e:** update selectors and coverage for "Enable …" toggle labels ([3abcb74](https://github.com/iblai/os/commit/3abcb740f3f89f5e95b1717919d686f3bb16219e))

## [0.82.0](https://github.com/iblai/os/compare/v0.81.1...v0.82.0) (2026-06-24)

### Features

- add DMG release for macos ([ea335d4](https://github.com/iblai/os/commit/ea335d4b806ebdf7d3c8df9bc0df9fb8d91a8570))

### Chores

- remove auto generated files ([2ffcfec](https://github.com/iblai/os/commit/2ffcfec29958de62a1bd006e06f49a21558d605e))

## [0.81.1](https://github.com/iblai/os/compare/v0.81.0...v0.81.1) (2026-06-24)

### Bug Fixes

- playwright tests issues fixed ([081da29](https://github.com/iblai/os/commit/081da2989c6edfad486ddc5f07a2159df9d04ce9))
- playwright tests issues fixed > test coverage ([36e3acb](https://github.com/iblai/os/commit/36e3acb40b4202dcc27590c5be124c130e01b430))

## [0.81.0](https://github.com/iblai/os/compare/v0.80.2...v0.81.0) (2026-06-24)

### Features

- add fallbacks for program installations ([9dbc61d](https://github.com/iblai/os/commit/9dbc61d11addb4ac79edbde1db4852192c730f8f))
- add ghostos support ([440d7f6](https://github.com/iblai/os/commit/440d7f67ed0c0c82eacc1325fc4a73fafd36d3f3))
- add repoll for model manager installation status ([0bb8023](https://github.com/iblai/os/commit/0bb8023239eef080df688ece9e7311c1d5f350c6))
- add usable memory (ram/vram) checks ([0257a3a](https://github.com/iblai/os/commit/0257a3aa694d8aa21c1c8aa72d408e0cbd63f00e))
- **app:** rewrite custom-scheme deep links to app URL in webview ([e6e016a](https://github.com/iblai/os/commit/e6e016af8d7280cdc23e7a4fb21d27a0c8e58d3e))
- update tauri backend with new ollama functions ([b7357f9](https://github.com/iblai/os/commit/b7357f9a7290a134d9a7aad277969f8934604e01))

### Bug Fixes

- add permission for get_system_memory ([7a1c707](https://github.com/iblai/os/commit/7a1c7076aa00b24746561cda6988de72a0645133))
- **config:** treat empty-string env values as unset so paste threshold defaults correctly; harden flaky e2e specs ([798bd57](https://github.com/iblai/os/commit/798bd57c39a2ca3242edd5e0c44cc26d92c023a2))
- more stable usable memory detection ([7fc286d](https://github.com/iblai/os/commit/7fc286df74d4c709dc1a8baf1f2bfe7663acd24c))

### Chores

- update deps ([7471fd6](https://github.com/iblai/os/commit/7471fd66c880bb41680805b1a5ed9d80159a2448))
- update iblai-js number to npm release ([a25205d](https://github.com/iblai/os/commit/a25205dc9dfe65944df5e1d0afeaeca3d7f96726))
- update lockfile ([c881204](https://github.com/iblai/os/commit/c881204fa6bc9be7fe1a16a2036c14ae2c16fd7d))

## [0.80.2](https://github.com/iblai/os/compare/v0.80.1...v0.80.2) (2026-06-22)

### Chores

- **env:** wire NEXT_PUBLIC_MAXIMUM_CHARACTER_SIZE_TO_COPY into runtime env ([485d4ea](https://github.com/iblai/os/commit/485d4ea47a36b1a6acdcae6cfe8efadd7900b77b))

## [0.80.1](https://github.com/iblai/os/compare/v0.80.0...v0.80.1) (2026-06-22)

### Bug Fixes

- **projects:** block navigation into agentless projects ([59e965f](https://github.com/iblai/os/commit/59e965fdd234ceaee3a800bc090477fe9ccde2c3))
- **projects:** redirect to projects list when mentorId is missing ([5c0a663](https://github.com/iblai/os/commit/5c0a6636741dde248534af11a3da8de3e80bddb7))

## [0.80.0](https://github.com/iblai/os/compare/v0.79.0...v0.80.0) (2026-06-21)

### Features

- **chat:** paginate chat history with infinite scroll-up ([1741f49](https://github.com/iblai/os/commit/1741f494c6f7118c66cf9629a3e359ba501f3d47))

### Chores

- **deps:** bump @iblai/iblai-js to 1.20.5 ([d6c8a47](https://github.com/iblai/os/commit/d6c8a47b20ccad629c5e537b0c4005ace5ca4053))

### Tests

- **e2e:** match tasks-tab description by stable prefix ([4f4925e](https://github.com/iblai/os/commit/4f4925ec7ffcffb0a66b70b4667d21a5c21401fe))

## [0.79.0](https://github.com/iblai/os/compare/v0.78.1...v0.79.0) (2026-06-21)

### Features

- **chat:** add attachment-chip test id ([ffcb585](https://github.com/iblai/os/commit/ffcb585f9f9423911928a8a2c79093d1ff9076be))
- **chat:** add clipboard file extraction helper ([25a5404](https://github.com/iblai/os/commit/25a5404fa01de6e747164938ad37404f01c5ee64))
- **chat:** convert pasted text and files into uploads ([bdbe1fe](https://github.com/iblai/os/commit/bdbe1fef74f3feff33657f3d40a3febb9c854b87))
- **chat:** show full mime type on attachment chips ([3f8bead](https://github.com/iblai/os/commit/3f8bead3817567c9e0d4c120f269799f0e8b369f))
- **config:** add NEXT_PUBLIC_MAXIMUM_CHARACTER_SIZE_TO_COPY env var ([2c3b9ef](https://github.com/iblai/os/commit/2c3b9ef3e279a012445672a77a21afd4736de673))

### Chores

- **env:** document NEXT_PUBLIC_MAXIMUM_CHARACTER_SIZE_TO_COPY ([8603f93](https://github.com/iblai/os/commit/8603f933c5c0165686d017035583001ac06722f2))

### Tests

- **chat:** cover file attachments list component ([d342beb](https://github.com/iblai/os/commit/d342beba45b7e0f2ecb35b3298c80185995965b5))
- **e2e:** cover chat paste-to-attachment journey ([dc13b5a](https://github.com/iblai/os/commit/dc13b5a33bdd8ccb7ee5b0f4be2c19e257d566d3)), closes [#1993](https://github.com/iblai/os/issues/1993)

## [0.78.1](https://github.com/iblai/os/compare/v0.78.0...v0.78.1) (2026-06-20)

### Bug Fixes

- **mentor:** restore recent chats refetch after first AI response ([187d5b3](https://github.com/iblai/os/commit/187d5b39a3b736a383bab02dc8ad50bef718f5cd))

### Chores

- **format:** prettier sweep of pre-existing drift ([13f3e04](https://github.com/iblai/os/commit/13f3e04cbcd508468a51b2cfe2b23172fdb202f7))
- **mentor:** remove orphaned recent/pinned message components ([46a299e](https://github.com/iblai/os/commit/46a299e14f1b2824b67c0177f54f638d4ac94cf8))

### Tests

- **e2e:** cover recent chats refresh after first AI response ([5ee610b](https://github.com/iblai/os/commit/5ee610b48956cb3ba043fb08b2e2940d0407498c))
- **e2e:** gate prompt-injection TC3 on streaming completion ([b0d5ed3](https://github.com/iblai/os/commit/b0d5ed36075da3f26a7af6f1b4cb29c88b976cc2))
- **mentor:** cover recent chats first-response refetch effect ([ecd41bd](https://github.com/iblai/os/commit/ecd41bdfe75c31c1394520baa7d7b389ba844b0a))

## [0.78.0](https://github.com/iblai/os/compare/v0.77.0...v0.78.0) (2026-06-19)

### Features

- **chat:** add ReasoningSection and ToolCallIndicator to AIMessageBubble ([fe5b6c5](https://github.com/iblai/os/commit/fe5b6c559a2514c5ca8cbe406193a47cc034c361))
- **chat:** add ReasoningSection component with auto-open/collapse behavior and corresponding tests ([42428a5](https://github.com/iblai/os/commit/42428a5c0ed9d6c8d941978a8988f52f67e0cc57))
- **chat:** add streaming reasoning and tool call selectors to Chat component with tests ([b5d6fb1](https://github.com/iblai/os/commit/b5d6fb15b779fd3e38b1ac385ae6ae398379b359))
- **chat:** add ToolCallIndicator component and corresponding tests for rendering tool calls ([bec8377](https://github.com/iblai/os/commit/bec8377dbb6989f7dd68684f28ce66afc82f1a8a))
- **chat:** add utility functions for tool call handling and corresponding tests ([7942fa6](https://github.com/iblai/os/commit/7942fa6f4ba48c0e7246928cab1a725763baba8f))
- **chat:** enhance ChatMessages component to support streaming reasoning and tool calls ([72d408f](https://github.com/iblai/os/commit/72d408ffb444f2a1b212cdcef62bb92af36ebba7))
- **chat:** extract reasoning content and tool calls from additional_kwargs in AppSidebar with tests ([447454a](https://github.com/iblai/os/commit/447454a0bec64285e48d4d4007b6380cdf63a19e))
- **chat:** gate reasoning + tool-call UI on Verbose Reasoning toggle ([def67d4](https://github.com/iblai/os/commit/def67d4924dff4a2c86f186272b9900a5901db6d))
- **chat:** implement ToolCallItem component with collapsible details and add corresponding tests ([a591ae4](https://github.com/iblai/os/commit/a591ae464f96451d866f3f3e6d7d623c05a2e1ec))
- **chat:** integrate ReasoningSection and ToolCallIndicator into AIMessageBubble with tests ([6e106e4](https://github.com/iblai/os/commit/6e106e488d0f0ca209a05010f22f0aee798b522d))
- **lint:** add lint-on-save script for automatic formatting and type checking of JS/TS files ([be06f74](https://github.com/iblai/os/commit/be06f741fb43105631797a7486c33e498e8b9d9b))
- **mentor:** add reasoning visibility toggle to agent settings tab ([b25519b](https://github.com/iblai/os/commit/b25519b2d1e609f022eba642bd188ba142f5b698))
- **mentor:** add the dedicated Projects page route ([33235c8](https://github.com/iblai/os/commit/33235c871b5b5349309bfe0c8c82ac6b0824e712))

### Bug Fixes

- **auth:** remove invalid hasNonExpiredAuthToken prop from AuthProvider ([c5647f9](https://github.com/iblai/os/commit/c5647f90e7211788c2a63738c237cdf98ea4c4e1))
- **chat:** hide AI message action toolbar while the message is streaming ([871ca7e](https://github.com/iblai/os/commit/871ca7efcafecb4e57bfe41da8ba96ee08166a87))
- **chat:** keep loading placeholder from showing while a response is already streaming ([a4b7847](https://github.com/iblai/os/commit/a4b784740deea73947d7b2d14e8e2255b2b22ac9))
- **chat:** show stop-streaming tooltip on hover only ([868dacd](https://github.com/iblai/os/commit/868dacd9154d6adbd8f23b91c2e39ee9d262fa51))
- **chat:** stop streaming indicator and restore toolbar after response completes ([dc216c4](https://github.com/iblai/os/commit/dc216c42312cc758aeaf91cffd366484a223ca8f))
- **chat:** suppress empty AI bubble when verbose reasoning is off ([40786c5](https://github.com/iblai/os/commit/40786c50c351a2a82238e901225e3ad1ffe86365))
- **chat:** update ToolCallIndicator to count unique tools used and adjust related tests ([90c272d](https://github.com/iblai/os/commit/90c272d5e5b959b97d4cae81e8f116ddda9e4cb9))
- **chore:** remove `learning` text from explore ([cdff754](https://github.com/iblai/os/commit/cdff754b16419c409b9de9de57bf75dc77f48801))
- **chore:** simplify marketing copy in ExplorePageContent and update test ([a1ffc8a](https://github.com/iblai/os/commit/a1ffc8aac6035a0bd85d931086ab303ebab233ee))
- **e2e:** reach projects index via My Projects and match New Chat in either rail state ([2e6d5b5](https://github.com/iblai/os/commit/2e6d5b51b3078330594b464392c851e99227318a))
- **e2e:** reload before asserting the chat Prompts button in user mode ([0c79b22](https://github.com/iblai/os/commit/0c79b2212a78c5825e2752a6cf8f6602c9662e86))
- **e2e:** use a non-disposable email for the sign-up journey ([1f59dc4](https://github.com/iblai/os/commit/1f59dc49a514e98e268c63afebe82c8b560f73fd))
- **mentor:** navigate to Explore from the No Agent Selected modal ([37a9c39](https://github.com/iblai/os/commit/37a9c398db5304625fa6f39465b8f1f0f375779b))

### Refactors

- **chat:** simplify ReasoningSection auto-open logic and enhance collapsible details and tests ([674425c](https://github.com/iblai/os/commit/674425c501158d4c902438742bb1b4bea3fc7189))
- **mentor:** rename "Show Reasoning" label to "Verbose Reasoning" ([6d83812](https://github.com/iblai/os/commit/6d838120317f9cdbc6a55974533a02cd5d3ffc63))
- **mentor:** replace the projects sidebar dropdown with a nav button ([578230c](https://github.com/iblai/os/commit/578230c5b5cf3a473884a31ea69e5647eef56719))
- **mentor:** source the projects UI from the SDK ([5c02208](https://github.com/iblai/os/commit/5c02208b7401e8055d37c5e2d7d831b376cf95a6))

### Chores

- **claude:** add configuration for lint-on-save hook to automate code formatting and type checking ([760b858](https://github.com/iblai/os/commit/760b85835fd3afb2210e19af27e4d03769e6e7f4))
- **deps:** upgrade @iblai/iblai-js to 1.17.9 ([e1e4658](https://github.com/iblai/os/commit/e1e465889e86ecdea9a671e269c513913ce4ee54))
- **e2e:** map no-mentor-selected-modal and welcome-chat-new to journey 26 ([25656e4](https://github.com/iblai/os/commit/25656e43e5bb47741b77d216a785a3ccefba1dd8))
- remove accidentally-committed .claude/agent-memory ([3d01e55](https://github.com/iblai/os/commit/3d01e557dea17bf5a7c43fabe9361b36083c30ba))
- **security:** fix code review issues suggested ([836d8eb](https://github.com/iblai/os/commit/836d8eb9426e5115418e463db5f35a7c3ec2f742))
- **tests:** fix selector query in claw sandbox playwright tests ([7fee41a](https://github.com/iblai/os/commit/7fee41aecb681e0c635c7319da0ad48d848abb1a))

### Styles

- **chat:** adjust spacing and padding in ToolCallIndicator for improved layout ([816bad9](https://github.com/iblai/os/commit/816bad949473dc51a8fb6ad3d6db043fdf902bd5))
- **chat:** refine spacing in ToolCallIndicator for better visual consistency ([5f7fe33](https://github.com/iblai/os/commit/5f7fe3306340ab9a6645a16e0033ffa87304988f))

### Tests

- **chat:** update Tool Call Indicator tests to reflect new behavior and unique tool count ([b151fbd](https://github.com/iblai/os/commit/b151fbda2645b95b3a0ba3e1e5471b1e5b59e8dc))
- **e2e:** cover the dedicated Projects page (journey 26) ([0cbed13](https://github.com/iblai/os/commit/0cbed135edd29edac635e764773f9098b20eafd9))
- **e2e:** fix journey 46 streaming tests ([8c620f6](https://github.com/iblai/os/commit/8c620f6d8a725ff4c2a197c451d9cf23e719288d))
- **e2e:** harden journey 47 tool-call assertions for live LLM ([782f49a](https://github.com/iblai/os/commit/782f49ae8afaa03fbd47d042de223e7f5b8d8dcf))
- **e2e:** renumber tool-call journey 47 -> 52 to resolve collision ([c58fa25](https://github.com/iblai/os/commit/c58fa25daadbcd7c7acf7b5ae9e88baddfd56a8b))
- **e2e:** revert chat textarea locator to role+name ([ecb2683](https://github.com/iblai/os/commit/ecb268301b26686bf2535388c3182a09aad31e99)), closes [#chat-input-textarea](https://github.com/iblai/os/issues/chat-input-textarea)
- **e2e:** use stable id locator for chat textarea ([29007d1](https://github.com/iblai/os/commit/29007d14d07e611996946646ebfca19e2a4aa029)), closes [#chat-input-textarea](https://github.com/iblai/os/issues/chat-input-textarea)

## [0.77.0](https://github.com/iblai/os/compare/v0.76.0...v0.77.0) (2026-06-19)

### Features

- **mentor:** add prompt caching toggle to agent settings ([2c90236](https://github.com/iblai/os/commit/2c9023664f6be4818787f3a33773f08e6cae8167))

### Chores

- **tests:** add playwright tests for prompt caching ([29cf427](https://github.com/iblai/os/commit/29cf42769b53bc26f12ddaabbafccd32452c9ddb))

## [0.76.0](https://github.com/iblai/os/compare/v0.75.17...v0.76.0) (2026-06-19)

### Features

- **mentor:** adding private mode for temprary chat ([4f1d5c3](https://github.com/iblai/os/commit/4f1d5c307e1d610f5c5c266388afc5d883b37b0b))
- **mentor:** fix for privacy and settings tab categorized ([0fed802](https://github.com/iblai/os/commit/0fed8025cba229db335af8dfa9d0f97ef3e34319))

### Bug Fixes

- **e2e:** fixing e2e failed tests ([53aea03](https://github.com/iblai/os/commit/53aea03f5187fa660adfde280fa710799141ef95))
- **e2e:** fixing e2e tests for private chat and privacy ([33346dd](https://github.com/iblai/os/commit/33346dd66be5b8deec321f6fb2de7698ae0253f1))
- **e2e:** fixing flaky tests for journey 44 and 45 ([4bca2e1](https://github.com/iblai/os/commit/4bca2e115d943e3516d0b4cf43248cac8ce2c20c))
- **e2e:** fixing privacy tab flaky tests ([a0ed517](https://github.com/iblai/os/commit/a0ed5178cf5abc34455436abc4aa361011715ee1))
- **mentor:** add private mode for embed and smaller screens ([6b9b314](https://github.com/iblai/os/commit/6b9b314da5989aa9b2fc3589a5293381782101f7))
- **mentor:** adding fix for the comments and coverage fixes ([1d7dc0d](https://github.com/iblai/os/commit/1d7dc0d2a88b4965d29d552d0aca6b9f26500d88))
- **mentor:** adding fix the e2e tests ([f601161](https://github.com/iblai/os/commit/f601161e29d1a3d1ed9632a3d48878302466b9ff))
- **mentor:** adding playwright test changes ([ad225b8](https://github.com/iblai/os/commit/ad225b85aa9a16c1f01a24db013c73672acd23a1))
- **mentor:** e2e test fixes and real time toggle for private mode ([8293874](https://github.com/iblai/os/commit/829387409e1df199040ffb0007e6f7a136a254f1))
- **mentor:** fixing pnpm-lock file ([5fc6f94](https://github.com/iblai/os/commit/5fc6f94ea84a4254a98dcbd50832c1bcbc2b1d56))
- **mentor:** more fix for the extra comments ([7bdc193](https://github.com/iblai/os/commit/7bdc1932d1b3649cc4ebe257361eb67a9d41e2f6))
- **mentor:** pattern fixes for settings ([59f48c8](https://github.com/iblai/os/commit/59f48c884be8341a228ffc0ec5af1384abd1bc77))
- **mentor:** privacy toggle moved to settings ([3181ca4](https://github.com/iblai/os/commit/3181ca4e7cb4ca2ab203ce3d74b4dec82dc8f501))

## [0.75.17](https://github.com/iblai/os/compare/v0.75.16...v0.75.17) (2026-06-18)

### Bug Fixes

- **embed:** remove redundant auth-redirect from embed snippet ([6a464d7](https://github.com/iblai/os/commit/6a464d76fd7b9bbeb48f7a09cea598bd6740d34a))

## [0.75.16](https://github.com/iblai/os/compare/v0.75.15...v0.75.16) (2026-06-18)

### Bug Fixes

- **chat:** keep keyboard focus on the message textarea while chatting ([b720bbe](https://github.com/iblai/os/commit/b720bbec495d1ee8151faf1d17cd258c7123a677))

### Refactors

- **chat:** stop moving focus to stop/copy buttons during streaming ([3361bef](https://github.com/iblai/os/commit/3361befa607a93744b506d47c199f404bc79cb1a)), closes [WCAG-#576](https://github.com/iblai/WCAG-/issues/576)

### Chores

- **ci:** normalize quote style in reusable workflows ([5c3fc32](https://github.com/iblai/os/commit/5c3fc32916b1a193e11fa11b8023514882b94d55))

### Tests

- **e2e:** cover textarea focus retention in journey 29 ([#1904](https://github.com/iblai/os/issues/1904)) ([f5009a3](https://github.com/iblai/os/commit/f5009a34088d3ec3b138cda0559fc741ad73141c)), closes [WCAG-#576](https://github.com/iblai/WCAG-/issues/576) [#576](https://github.com/iblai/os/issues/576)

## [0.75.15](https://github.com/iblai/os/compare/v0.75.14...v0.75.15) (2026-06-18)

### Bug Fixes

- mentor db id payload passed to reports endpoints ([f2d29f3](https://github.com/iblai/os/commit/f2d29f356964cfb49687ab6e524817e3972265a9))
- mentor db id payload passed to reports endpoints > test coverage ([e8dba0c](https://github.com/iblai/os/commit/e8dba0cfad7164a226a6ffe7530d5598bd005663))

## [0.75.14](https://github.com/iblai/os/compare/v0.75.13...v0.75.14) (2026-06-18)

### Bug Fixes

- **e2e:** journey 14 anon admin gate clicks Analytics leaf, not the group ([6fd68ac](https://github.com/iblai/os/commit/6fd68ac81812906aa21a50632f6f362b04928b2e))
- **mentor:** hide Add Resource button without documents create permission ([8a8f259](https://github.com/iblai/os/commit/8a8f259bbd4b7d267d9f8c3d80cf2540d092c45d))
- **mentor:** render a single Edit Agent modal so its Close isn't intercepted ([738b583](https://github.com/iblai/os/commit/738b583c26a9361a6a20aa71e72076ca542a5f32))

### Tests

- **mentor:** cover RBAC gating of Add Resource button ([235c322](https://github.com/iblai/os/commit/235c3221a8cb35c0b7db42570b598cc01b27d10c))

## [0.75.13](https://github.com/iblai/os/compare/v0.75.12...v0.75.13) (2026-06-17)

### Bug Fixes

- **ci:** copy patches/ before pnpm install in app + e2e Dockerfiles ([0422bc1](https://github.com/iblai/os/commit/0422bc13d57de361c2e7f26dd7b5f464b2b6dbc6))

## [0.75.12](https://github.com/iblai/os/compare/v0.75.11...v0.75.12) (2026-06-17)

### Bug Fixes

- **deps:** patch google-drive-picker to drop hardcoded drive.readonly scope ([e4e8698](https://github.com/iblai/os/commit/e4e8698e1e4b75eaca8fa62213b8859de468c01d))

### Tests

- **hooks:** guard google-drive-picker scope patch against regression ([2b76489](https://github.com/iblai/os/commit/2b76489101fa9664bf1ec82eb23851c2dba89082))

### CI

- add .dockerignore to keep docs/agent/VCS files out of the build ([3702d52](https://github.com/iblai/os/commit/3702d5240db74fbb47688b70a1ed7596af3f99aa))

## [0.75.11](https://github.com/iblai/os/compare/v0.75.10...v0.75.11) (2026-06-17)

### Bug Fixes

- repair CLAUDE.md symlink (stray newline in target broke the SPA build) ([5c06f03](https://github.com/iblai/os/commit/5c06f0311fa1736641861cd2f953c170abff85de))

## [0.75.10](https://github.com/iblai/os/compare/v0.75.9...v0.75.10) (2026-06-17)

### Chores

- **msix:** bump AppxManifest version to 1.1.20.0 ([ff846f1](https://github.com/iblai/os/commit/ff846f1d8fe9a903d6ca2c701250f7bf409093c2))

## [0.75.9](https://github.com/iblai/os/compare/v0.75.8...v0.75.9) (2026-06-16)

### Bug Fixes

- **ci:** pin coverage-bot to claude-sonnet-4-6 ([0148c32](https://github.com/iblai/os/commit/0148c324b294864c849bf5f0a988f6ebbe10441b))
- **msix:** correct Store package identity name to ibl.ai.ibl.ai ([4f73626](https://github.com/iblai/os/commit/4f736267defda500464c0ddebd6c5dadff36048f))

## [0.75.8](https://github.com/iblai/os/compare/v0.75.7...v0.75.8) (2026-06-16)

### Bug Fixes

- **mentor:** genericize explore page heading copy ([a9f47d2](https://github.com/iblai/os/commit/a9f47d291aca38048cb631ebdff9047c736524d2))

### Tests

- **e2e:** update stale explore heading comments ([730c04b](https://github.com/iblai/os/commit/730c04b8db81c0ffa43a2542e00715f2a25032e3))

## [0.75.7](https://github.com/iblai/os/compare/v0.75.6...v0.75.7) (2026-06-16)

### Bug Fixes

- **mentor:** rename 'Student Success' tools category and reword canvas reading-level prompts ([ae9f787](https://github.com/iblai/os/commit/ae9f78796eee2a51c90a23997c5677c60b6cbaec))
- **mentor:** replace 'Students' visibility label and default prompt copy with 'Users' ([54fdcf5](https://github.com/iblai/os/commit/54fdcf5dac2314e0eda00c230cde141e5ccccb66))
- **mentor:** shorten navbar model-selector tooltip to 'Select Model' ([1a2df4c](https://github.com/iblai/os/commit/1a2df4c83db10603facce9326695c49ac5714239))

### Chores

- normalize CHANGELOG formatting via prettier ([abbedcd](https://github.com/iblai/os/commit/abbedcd90223c8f2dccd252edeb202502228dea5))

### Tests

- **e2e:** map canvas-controls to canvas journey; exclude dead tools-section ([48e89e7](https://github.com/iblai/os/commit/48e89e7835508ca742f38850107178037b9258bd))
- **e2e:** update prompt visibility page-object label Students→Users ([e88b8d1](https://github.com/iblai/os/commit/e88b8d173491f8e2f30d0697040e22567303af9a))
- **mentor:** update unit tests for Students→Users rename ([2f351e5](https://github.com/iblai/os/commit/2f351e59fea93fdb622299197370bc65ade57ad5))

## [0.75.6](https://github.com/iblai/os/compare/v0.75.5...v0.75.6) (2026-06-16)

### Bug Fixes

- **mentor:** scroll history user-search list inside dialog ([41a22df](https://github.com/iblai/os/commit/41a22dfc0eb3c242c145c3d68a2b9c09506cfb1f))

### Tests

- **history-tab:** add unit coverage for HistoryTab ([b4c3173](https://github.com/iblai/os/commit/b4c31734a095c22bd4e433599163a451ff11751b))

## [0.75.5](https://github.com/iblai/os/compare/v0.75.4...v0.75.5) (2026-06-16)

### Bug Fixes

- **android:** route iblai-mentor:// SSO deep link back into the app ([d472ad4](https://github.com/iblai/os/commit/d472ad49f009e4346812665c0930c10f7576c377))

### Refactors

- **tenant-switch:** consume cross-tab tenant switch from the SDK ([367da66](https://github.com/iblai/os/commit/367da6672f03cf55ee977263b8138434f25e95e7))

## [0.75.4](https://github.com/iblai/os/compare/v0.75.3...v0.75.4) (2026-06-15)

### Bug Fixes

- support phone number defaults even when env not set ([31205a5](https://github.com/iblai/os/commit/31205a546bb1c35eb16b2ea8b503db0795062969))

## [0.75.3](https://github.com/iblai/os/compare/v0.75.2...v0.75.3) (2026-06-14)

### Bug Fixes

- **chat:** dedupe newChat and stopChatGenerating event listeners ([1bd448f](https://github.com/iblai/os/commit/1bd448fc618c627f841340ef2f75a185d60005bb))

### Chores

- normalize CHANGELOG bullet formatting via prettier ([d19a255](https://github.com/iblai/os/commit/d19a255f2fa23d5d3880dfa73e19647d87b85741))

### Tests

- **chat:** cover single newChat/stopChatGenerating listener registration ([0b0b973](https://github.com/iblai/os/commit/0b0b9737ad97c889d3363ef97d02474af7ae5cb2))
- **e2e:** add parked New Chat single-session regression guard ([#1002](https://github.com/iblai/os/issues/1002)) ([7352c21](https://github.com/iblai/os/commit/7352c213b108edbd259d6c0fa536dd4da538c785))

## [0.75.2](https://github.com/iblai/os/compare/v0.75.1...v0.75.2) (2026-06-14)

### Bug Fixes

- **workflows:** drop "and learning experiences" from page subheading ([3c2d021](https://github.com/iblai/os/commit/3c2d021bdbb5ddad578f9677817ed6d16db2798e))

### Chores

- normalize CHANGELOG bullet style to prettier ([148cb25](https://github.com/iblai/os/commit/148cb254f282d3370d6255728fef31045528412e))

### Tests

- **e2e:** assert workflows subheading with exact match ([43a7cc0](https://github.com/iblai/os/commit/43a7cc06c9230feb9dd405b1af294a1a083680a4))

## [0.75.1](https://github.com/iblai/os/compare/v0.75.0...v0.75.1) (2026-06-13)

## [0.75.0](https://github.com/iblai/os/compare/v0.74.4...v0.75.0) (2026-06-12)

### Features

- bumped iblai-js to 1.18.1 ([ab1e3f7](https://github.com/iblai/os/commit/ab1e3f7c8c9b063963d96789e8e4bb79590a9408))
- **mentor:** adding tasks for edit mentor, unit and playwright tests ([9687dc1](https://github.com/iblai/os/commit/9687dc163c6f38ab0d7a44e2b1904151fc31d196))
- **mentorai:** adding version bump for iblai-js ([01d3879](https://github.com/iblai/os/commit/01d3879bc4ac8b4f487aeb97031ec8fe5420d96a))

### Bug Fixes

- **e2e:** adding more playwright tests for task tab ([1ab2118](https://github.com/iblai/os/commit/1ab2118a49b86f674e0c16858561d28f67d26554))
- **mentor:** adding fix for the pnpm-lock ([030bfec](https://github.com/iblai/os/commit/030bfec8fb1539a099bc1e49865b45a91ddd87b2))
- **mentor:** adding fix for the task test ([dc06129](https://github.com/iblai/os/commit/dc06129aefc959d2e66b15064caaf5fc7bd90bfa))
- **mentor:** fix for the tasks tab ([50ec103](https://github.com/iblai/os/commit/50ec103424ab255d4818bd9f4009539d06a86b22))
- **mentor:** pnpm-lock changes ([9edd14a](https://github.com/iblai/os/commit/9edd14acabda4bb82fc95ab12c5e00b41e9f6771))

### Chores

- **mentor:** version bump for iblai-js ([d7247b7](https://github.com/iblai/os/commit/d7247b7e437fe601875b297e79c6580b0709723d))

## [0.74.4]

- bumped iblai-js version to 1.17.25

## [0.74.3](https://github.com/iblai/os/pull/244)

## [0.74.2](https://github.com/iblai/os/pull/235)

## [0.74.1](https://github.com/iblai/os/pull/235)

## [0.74.0](https://github.com/iblai/os/compare/v0.73.8...v0.74.0) (2026-06-09)

### Features

- **sidebar:** enlarge and center the platform logo in the header ([b9055cc](https://github.com/iblai/os/commit/b9055cc5fa3e96597593cdcfefcfcd977bcddd59))

### Bug Fixes

- **mentor:** adding fixes for the sidebar ([5ee8df5](https://github.com/iblai/os/commit/5ee8df5d5f28cf37b9dac2a835386820371eb9d9))
- **mentor:** fixes for the sidebar ([f5540c3](https://github.com/iblai/os/commit/f5540c34a0085c8739736e75752d7bc7d8ac7a18))
- **mentor:** fixing unit test ([d19dd18](https://github.com/iblai/os/commit/d19dd18d2c92298976260678a8b162f66f1a4e6f))
- **mentor:** load selected chat messages when switching chats from the sidebar ([d72a52b](https://github.com/iblai/os/commit/d72a52b0f754f1099f5ae8e459f7b39108e90c90))
- **mentor:** sidebar fixes for the embed, advertising agent and anonymous tenat ([4a9f2c3](https://github.com/iblai/os/commit/4a9f2c326464a4926386bc58a91262143711792a))

## [0.73.8](https://github.com/iblai/os/compare/v0.73.7...v0.73.8) (2026-06-08)

### Chores

- bump iblai-js to 1.17.19 ([fb3da86](https://github.com/iblai/os/commit/fb3da86d95a28198a0ca9ca952bf580a8807c498))

### CI

- skip PR workflows for external pull requests ([29aca2e](https://github.com/iblai/os/commit/29aca2e6e8fa57ab68ea9183b5d8f05d41125cb8))

## [0.73.7](https://github.com/iblai/os/compare/v0.73.6...v0.73.7) (2026-06-08)

### CI

- run summary job on github-hosted runner ([bf89f2c](https://github.com/iblai/os/commit/bf89f2ccc271013a9b5a571532eb8a3dcff576d5))

## [0.73.6](https://github.com/iblai/os/compare/v0.73.5...v0.73.6) (2026-06-08)

### Documentation

- **readme:** add Testing section — run E2E with `make e2e-ui` ([72c26aa](https://github.com/iblai/os/commit/72c26aab4b117fdb8fce6243ce64c4a942d63337))

## [0.73.5](https://github.com/iblai/os/compare/v0.73.4...v0.73.5) (2026-06-08)

### Bug Fixes

- **deploy:** pin outputFileTracingRoot so standalone builds stay un-nested ([535fdde](https://github.com/iblai/os/commit/535fdde8f1e52f58e0833cc9ace0f5728030cd52))

### Chores

- remove idle workflow_dispatch-only workflows ([fb9b9d7](https://github.com/iblai/os/commit/fb9b9d74a2aa036780375a348f47beeebd688224))

## [0.73.4](https://github.com/iblai/os/compare/v0.73.3...v0.73.4) (2026-06-08)

### Chores

- remove stale workflows that have not run successfully in months ([9cf8114](https://github.com/iblai/os/commit/9cf8114e83d8401855293164a65132f45dbd1f51))

## [0.73.3](https://github.com/iblai/os/compare/v0.73.2...v0.73.3) (2026-06-08)

### Documentation

- update demo link to YouTube playlist ([49f4ece](https://github.com/iblai/os/commit/49f4ecec7c2d36279cfc55d892c969d856c91bd8))

## [0.73.2](https://github.com/iblai/os/compare/v0.73.1...v0.73.2) (2026-06-07)

### Chores

- add iblai-mentor scheme to redirectToAuthSpa from sdk ([49bea52](https://github.com/iblai/os/commit/49bea520dd98487d361f36f85989191e6a79214f))

## [0.73.1](https://github.com/iblai/os/compare/v0.73.0...v0.73.1) (2026-06-05)

### Documentation

- update YouTube demo video link and hyperlink label ([458b66d](https://github.com/iblai/os/commit/458b66d4552ad885a8eda74326785afbacbc1bf4))

## [0.73.0](https://github.com/iblai/os/compare/v0.72.1...v0.73.0) (2026-06-05)

### Features

- add /setup skill for guided tenant configuration ([26641e1](https://github.com/iblai/os/commit/26641e1265905547d9bb6cc0019e3c3583f636ee))

### Chores

- add NEXT_PUBLIC_TENANT to .env.example, fix demo alt text ([2606b4b](https://github.com/iblai/os/commit/2606b4ba85128d8f4ca32298d57bc248873e607e))
- bump iblai-js to 1.17.17 ([157cb24](https://github.com/iblai/os/commit/157cb24a07423839d25cc670de7a6519d90fdbba))
- bump Tauri version to 1.1.19 ([c0e20bd](https://github.com/iblai/os/commit/c0e20bdef96beaef0e3935352176b3d9e13774ea))

### Documentation

- add cross-platform availability section to README ([9eaa79e](https://github.com/iblai/os/commit/9eaa79efb02df3e1a361fe5cee127d3d000a34ef))
- add MIT LICENSE file ([9f79cf1](https://github.com/iblai/os/commit/9f79cf1485719637985c024501306791eff0e810))
- add product screenshots to README ([8a2ce4b](https://github.com/iblai/os/commit/8a2ce4bbd65291f3be6706cdd0c68d170d12c8ed))
- add YouTube demo link to README header ([b7dbadd](https://github.com/iblai/os/commit/b7dbadd0e2b7386ca8717c39088f0068f6905e99))
- merge enterprise section into features in README ([d5daab0](https://github.com/iblai/os/commit/d5daab07435d4d6c4ee889c4d86f3f707a4bbaba))
- move screenshots section below Available On ([59e5a2c](https://github.com/iblai/os/commit/59e5a2c94ad24c477c46ac9ef6d2245f902cacdc))
- remove Desktop & Mobile badge ([b2f6fa1](https://github.com/iblai/os/commit/b2f6fa1cc9620cce071a70516e1c427f778ccc06))
- rename Option B to Enterprise Deployment ([ab66b8e](https://github.com/iblai/os/commit/ab66b8ea9c89e355920e136947583ed040f0db0d))
- replace YouTube badge with video thumbnail preview ([e064dd7](https://github.com/iblai/os/commit/e064dd7727720d5be0d227645c4e9b331ea3cc33))
- revamp deployment section and update README badges ([bc21ba7](https://github.com/iblai/os/commit/bc21ba72e94a99a256be2cdbf7e8c5f88478a7ec))
- revamp README to be marketing-focused, move developer content to docs/ ([a5565e2](https://github.com/iblai/os/commit/a5565e23abdc5a6b9a2308c70d119f2060fdc55f))
- simplify tenant configuration to single env var ([579752a](https://github.com/iblai/os/commit/579752a3de60de3d323bf2e66277bddceccfc41c))
- update Enterprise Deployment with contact and infra CLI info ([24a8b78](https://github.com/iblai/os/commit/24a8b78605d95932c7d70036c6c3715784261be9))

## [0.72.1](https://github.com/iblai/os/compare/v0.72.0...v0.72.1) (2026-06-05)

### Bug Fixes

- **e2e:** adding e2e tests for the agent popup fix ([ba84938](https://github.com/iblai/os/commit/ba84938a2def096f414529bcab93c2c68cfa0606))
- **e2e:** my agents test fix ([dba69fc](https://github.com/iblai/os/commit/dba69fc9d87ac76a6c4bb9b8f0646599f6f54fcb))
- **mentor:** e2e fixes ([d4c2e92](https://github.com/iblai/os/commit/d4c2e92b5466e688e147617cc5bf3c87a24fb77b))

## [0.72.0](https://github.com/iblai/os/compare/v0.71.1...v0.72.0) (2026-06-04)

### Features

- **mentor:** sidebar, agent settings layout changes ([3bc2762](https://github.com/iblai/os/commit/3bc276244face45d4dd5db2668c4a4bbba3a20c6))

### Bug Fixes

- **e2e:** fix for the e2e tests ([3733d96](https://github.com/iblai/os/commit/3733d967e2c3093a4e8df10041cb42ba8dc6fa05))
- **e2e:** fix the explore page test failiures ([ecf8a27](https://github.com/iblai/os/commit/ecf8a27a7711b08326aac17afe58daebbd39a55c))
- **e2e:** fixing coverage.json for missing components ([c63ca0e](https://github.com/iblai/os/commit/c63ca0eb7794fbe57b9e28d518e726f045f4757e))
- **e2e:** fixing for the e2e tests ([d44cc81](https://github.com/iblai/os/commit/d44cc8160fa2e7e86b1884a9e797d4c5d7555dbf))
- **e2e:** fixing for the e2e tests ([08965fd](https://github.com/iblai/os/commit/08965fd81c7dcd2782e438df218c972f03fa5309))
- **e2e:** more fixes for the tests ([8a40c32](https://github.com/iblai/os/commit/8a40c321f77c2ba446c92fa5a96459ca1d7f0e0a))
- **e2e:** more fixes for the tests ([3104d2e](https://github.com/iblai/os/commit/3104d2e352201a8281421b708dc51c703bcce161))
- **mentor:** adding app-sidebar test ([0e5f654](https://github.com/iblai/os/commit/0e5f65411086e8bc433dc0d04983e6dbb76a72d8))
- **mentor:** adding app-sidebar test ([deaa14c](https://github.com/iblai/os/commit/deaa14ce048be7433f1e8b302dc3a586e011ffb9))
- **mentor:** adding data state ([9a1a7fb](https://github.com/iblai/os/commit/9a1a7fb5da3d61c8980e1e884db798ad5a98a5dd))
- **mentor:** adding unit tests coverage ([740a2d3](https://github.com/iblai/os/commit/740a2d34cb95ea23fc1c7b767596c85f8c96f7ac))
- **mentor:** coverage fixes ([606508b](https://github.com/iblai/os/commit/606508b445a7eb04c0601d726cae1a87f69327ff))
- **mentor:** fix for the excel ([d49413a](https://github.com/iblai/os/commit/d49413a0510e86b0d8b2e59549556103869bc765))
- **mentor:** fix for the packages ([420ae98](https://github.com/iblai/os/commit/420ae981689dd3cbc3ea643ed7a6b2ce682b3ee5))
- **mentor:** fix for the settings tab unit tests ([c4a6d50](https://github.com/iblai/os/commit/c4a6d50dfdcbfd827b11ff92ec35802e5085340f))
- **mentor:** fixes for the e2e tests and tabs for agent settings ([276df4e](https://github.com/iblai/os/commit/276df4e304d92dce95dc33a39fa60026edb6347f))
- **mentor:** fixing for the tabs inconsistant height ([d1f3535](https://github.com/iblai/os/commit/d1f35359596c634e835e010eafa0df5b9305b8db))
- **mentor:** type check issue fix ([87d9277](https://github.com/iblai/os/commit/87d9277e018b2354604b99b1d3c2dd5e39a24c15))
- **mentor:** unit test coverage ([d8a0555](https://github.com/iblai/os/commit/d8a05551ad4f4ce29be8943c875eb23f7579e20a))
- **mentor:** unit test fixes for providers ([44336a5](https://github.com/iblai/os/commit/44336a58ae0a0001f5c3508384edda09fee9c0cc))

## [0.71.1](https://github.com/iblai/os/compare/v0.71.0...v0.71.1) (2026-06-03)

### Bug Fixes

- **deps:** bump axios >=1.16.0 and minimatch's brace-expansion to 2.0.3 ([5a9b63f](https://github.com/iblai/os/commit/5a9b63f2f18774e1b47fa57a0f762961bc71976a))

### Chores

- change agentAI -> OS ([ec6cc3c](https://github.com/iblai/os/commit/ec6cc3c0a3a07ec2ce5fad28397c7668c9e79470))
- change IBL.ai to ibl.ai ([df48cc5](https://github.com/iblai/os/commit/df48cc5f518785d45abb2b5374b91a30dfda4488))
- update app name in AGENTS.md ([0bc8a6e](https://github.com/iblai/os/commit/0bc8a6e4fd54c0921d20f26ac5f5830256f24c88))
- update documentation ([d802e80](https://github.com/iblai/os/commit/d802e802227135715d19097a5a08d80771d83614))

## [0.71.0](https://github.com/iblai/os/compare/v0.70.1...v0.71.0) (2026-06-02)

### Features

- **embed-tab:** add Save button to persist embed settings ([9d684bb](https://github.com/iblai/os/commit/9d684bb012cf649a434edeb32b1e1e376cab7563))

### Bug Fixes

- **chat-input:** collapse inside tool buttons to dropdown below 800px ([c392b5d](https://github.com/iblai/os/commit/c392b5d3f710cbfca98b66de78e5ab52ebf576d4))

### Refactors

- **embed-tab:** export validateCss and validateJavaScript ([6f2505f](https://github.com/iblai/os/commit/6f2505f4b5ec651aa79cac8e5a2723548f469f68))
- **settings-tab:** pin Save/Copy/Delete to fixed footer ([e8793fb](https://github.com/iblai/os/commit/e8793fb8f56a19d5fc0e451d65632145c098b9a9))

### Chores

- **embed:** remove save button in embed tab ([0353fd3](https://github.com/iblai/os/commit/0353fd329d3393d153fa8939e479e1d2de66dfa2))
- **tests:** fixed failing unit tests ([3796795](https://github.com/iblai/os/commit/37967955e86e63b402928bbaf197cc5de1b0c965))
- **tests:** improve test coverage to 95% ([bd20761](https://github.com/iblai/os/commit/bd20761e401a6637220f175afd2ae2af3209b5a3))

### Tests

- **embed-tab,settings-tab:** raise coverage to >=95% ([dbdcac3](https://github.com/iblai/os/commit/dbdcac307adfd94acb785a3ba65d0690f1aa138b))

## [0.70.1](https://github.com/iblai/agentai/compare/v0.70.0...v0.70.1) (2026-06-01)

### Chores

- bump iblai-js to 1.17.3 ([a5fc5b7](https://github.com/iblai/agentai/commit/a5fc5b712c52d41cc4c36835d26dc573d3327704))
- migrate default URLs from iblai.org to iblai.app and bump Tauri to 1.1.18 ([3993417](https://github.com/iblai/agentai/commit/3993417eeb54e32ed1506fd35e33280c0bd434d4))

## [0.70.0](https://github.com/iblai/agentai/compare/v0.69.1...v0.70.0) (2026-05-29)

### Features

- **embed:** add Show Catalogue toggle to the embed tab ([4b11211](https://github.com/iblai/agentai/commit/4b11211f0934cb321b5a631262a1d2908be6ebed)), closes [#1775](https://github.com/iblai/agentai/issues/1775)
- **logo:** gate sidebar logo navigation on show_catalogue in embed mode ([6acac52](https://github.com/iblai/agentai/commit/6acac5202ef0f3a7a7d27fb6bdab41bb4a69c345)), closes [#1775](https://github.com/iblai/agentai/issues/1775)

### Styles

- **changelog:** normalize list bullets via prettier ([1be68ab](https://github.com/iblai/agentai/commit/1be68abe0db31a5e617ef3a582066c42bc7461a8))

### Tests

- **e2e:** cover Show Catalogue toggle and embed logo gating ([e46fc47](https://github.com/iblai/agentai/commit/e46fc470edae759c9621982c3e2e463419807a27)), closes [#1775](https://github.com/iblai/agentai/issues/1775)

## [0.69.1](https://github.com/iblai/agentai/compare/v0.69.0...v0.69.1) (2026-05-29)

### Refactors

- **auth:** replace local redirectToAuthSpa with SDK wrapper from @iblai/iblai-js ([a03798d](https://github.com/iblai/agentai/commit/a03798d243c587f131dfbad95cf073205a950ca3))

### Chores

- adds android build schema ([cd0c703](https://github.com/iblai/agentai/commit/cd0c703c938eafc379ca6ff7f7e3a8f7d3de2f94))

## [0.69.0](https://github.com/iblai/agentai/compare/v0.68.0...v0.69.0) (2026-05-28)

### Features

- iblai-js bump to 1.15.0 ([cb5ca30](https://github.com/iblai/agentai/commit/cb5ca303faae6127ecd563ae22303dd77878650a))

## [0.68.0](https://github.com/iblai/agentai/compare/v0.67.12...v0.68.0) (2026-05-28)

### Features

- autoplay ai message by voice event completed ([4b95ac8](https://github.com/iblai/agentai/commit/4b95ac851fbbde4bce1eb0e55609c167869f45b7))
- autoplay ai message by voice event completed ([42b9b42](https://github.com/iblai/agentai/commit/42b9b4253685f56e3d8644c9c9b39f1841640b58))
- autoplay ai message by voice event completed > pnpm lock update ([4c84ec6](https://github.com/iblai/agentai/commit/4c84ec609b8a62fcfbcfd04c3a745daeba04e15e))
- autoplay ai message by voice event completed > test coverage ([eb4ec87](https://github.com/iblai/agentai/commit/eb4ec8743c5e71dbf410d1c35d90e813bc1ed044))
- autoplay ai message by voice event completed > test coverage issue fixed ([d778c29](https://github.com/iblai/agentai/commit/d778c296c384c9ab029b97caea8733fce893f542))
- autoplay ai message by voice event on progress ([b892590](https://github.com/iblai/agentai/commit/b8925902cb9205eeff7fd2ae5ac9e0f2508ac505))
- autoplay ai message by voice event on progress ([5f783ff](https://github.com/iblai/agentai/commit/5f783ff05b8fa3c1020db728c73b301d0cf01f7f))
- autoplay ai message by voice event on progress ([eac7a9f](https://github.com/iblai/agentai/commit/eac7a9f45198d0957b75eeadf468e83eafc446db))

## [0.67.12](https://github.com/iblai/agentai/compare/v0.67.11...v0.67.12) (2026-05-28)

### Bug Fixes

- **deps:** drop brace-expansion override that broke coverage tooling ([5b5f5a8](https://github.com/iblai/agentai/commit/5b5f5a8ebca40b4a84eebb8e9e6a7870464f09d5))
- **mentor:** tighten nav-bar credit/notification/profile spacing ([bd1e44c](https://github.com/iblai/agentai/commit/bd1e44c5095696675514b1d70e256aa37d35ba9b))
- **mentor:** update Agent AI banner copy and docs link ([277ff84](https://github.com/iblai/agentai/commit/277ff842822265cc60f4af00d41dc35e1e7750c5))

### Chores

- **deps:** update pnpm-lock.yaml file ([db85752](https://github.com/iblai/agentai/commit/db85752e41b1af9103f6e1287e54b462abf18e89))

### Tests

- **mentor:** lock app-banner default fallbacks ([e6bda14](https://github.com/iblai/agentai/commit/e6bda14072b310c4062c17ca113a2341763f0298))

## [0.67.11](https://github.com/iblai/agentai/compare/v0.67.10...v0.67.11) (2026-05-27)

### Bug Fixes

- **ci:** allow skipped E2E tests to pass summary job ([07894e4](https://github.com/iblai/agentai/commit/07894e4ae46816e84b3ad60beb492dd428d6d854))

## [0.67.10](https://github.com/iblai/agentai/compare/v0.67.9...v0.67.10) (2026-05-27)

### Chores

- bump iblai-js to 1.12.1, update macOS entitlements and Tauri version ([7882a36](https://github.com/iblai/agentai/commit/7882a364bb7dc4ed250380c848d31d37bccdfed1))

## [0.67.9](https://github.com/iblai/agentai/compare/v0.67.8...v0.67.9) (2026-05-26)

### Bug Fixes

- **ci:** update PR Validation status when E2E tests complete ([3f03342](https://github.com/iblai/agentai/commit/3f033426613b7ed33ee06f38eed0c2738311408d))

## [0.67.8](https://github.com/iblai/agentai/compare/v0.67.7...v0.67.8) (2026-05-25)

### Documentation

- rename mentorAI to agentAI in README ([4370d2b](https://github.com/iblai/agentai/commit/4370d2b36a9fb22c85fbb3c966ca8f6a46f26f46))

## [0.67.7](https://github.com/iblai/mentorai/compare/v0.67.6...v0.67.7) (2026-05-25)

### Refactors

- remove external pricing modal and hook ([8de6f66](https://github.com/iblai/mentorai/commit/8de6f6622bc11961bd2582cfd472f9660a147576))

## [0.67.6](https://github.com/iblai/mentorai/compare/v0.67.5...v0.67.6) (2026-05-25)

### Bug Fixes

- **security:** restrict postMessage target origins ([5c10b3c](https://github.com/iblai/mentorai/commit/5c10b3c16b0870cb5343f68fd1df536c0d56c1cc)), closes [#72](https://github.com/iblai/mentorai/issues/72)

## [0.67.5](https://github.com/iblai/mentorai/compare/v0.67.4...v0.67.5) (2026-05-25)

### Bug Fixes

- **deps:** pin qs to >=6.15.2 to fix DoS (CVE-2026-8723) ([38d71a8](https://github.com/iblai/mentorai/commit/38d71a8f8e1e9e30949ed4fe94b2b71fa85fc038))
- **deps:** pin uuid to ^11.1.1 to fix buffer bounds check (CVE-2026-41907) ([23bc69a](https://github.com/iblai/mentorai/commit/23bc69a4e81af828901622d25b0e40dab91908b2))
- **deps:** replace xlsx with write-excel-file to fix prototype pollution ([5bc1702](https://github.com/iblai/mentorai/commit/5bc1702cb29c20674083d69518981d7b83544450)), closes [iblai/iblai-platform#1455](https://github.com/iblai/iblai-platform/issues/1455)
- **deps:** update glib version to v0.20.0 ([46c74d2](https://github.com/iblai/mentorai/commit/46c74d26b16affbbc35f98609514b235830a5374))

### Refactors

- extract shared exportMessagesToXlsx helper ([3e91403](https://github.com/iblai/mentorai/commit/3e9140318840ecd4148b4491bbc216cabebd20c6))

## [0.67.4](https://github.com/iblai/mentorai/compare/v0.67.3...v0.67.4) (2026-05-25)

### Bug Fixes

- **security:** loop HTML tag stripping in canvas-component and sidebar tests ([ed68d06](https://github.com/iblai/mentorai/commit/ed68d06051e1331b9be57cba8d4a433c1b93f7d0))

## [0.67.3](https://github.com/iblai/mentorai/compare/v0.67.2...v0.67.3) (2026-05-25)

### Bug Fixes

- **security:** sanitize redirect URL from postMessage to prevent XSS ([c9ca184](https://github.com/iblai/mentorai/commit/c9ca184d79da388af5f5692594e7c6701541efd3))

## [0.67.2](https://github.com/iblai/mentorai/compare/v0.67.1...v0.67.2) (2026-05-25)

### Bug Fixes

- **security:** loop HTML tag stripping in remaining test mocks ([8038b62](https://github.com/iblai/mentorai/commit/8038b62594c7a146afb701f5696b68c988f5fbd6)), closes [#66](https://github.com/iblai/mentorai/issues/66)

## [0.67.1](https://github.com/iblai/mentorai/compare/v0.67.0...v0.67.1) (2026-05-25)

### Bug Fixes

- **security:** loop HTML tag stripping in canvas-utils tests ([e2145a5](https://github.com/iblai/mentorai/commit/e2145a5356425b36b5cad1af095ee7d1dd97189b)), closes [#67](https://github.com/iblai/mentorai/issues/67)

## [0.67.0](https://github.com/iblai/mentorai/compare/v0.66.3...v0.67.0) (2026-05-25)

### Features

- **embed:** validate Website URL input as origin-only without trailing slash ([7e6b5d6](https://github.com/iblai/mentorai/commit/7e6b5d6838f7b2df2529f3a9aef6965140c989bf))

### Bug Fixes

- **security:** loop HTML tag stripping to prevent incomplete sanitization ([00b8820](https://github.com/iblai/mentorai/commit/00b882069379ddcd4e8e6cd59f19fcadf4075c29)), closes [#71](https://github.com/iblai/mentorai/issues/71)

### Chores

- skip coverage check for embed-tab and utils (pre-existing low coverage) ([eaa7883](https://github.com/iblai/mentorai/commit/eaa7883780686756303f84dd6a239db957070bf2))

## [0.66.3](https://github.com/iblai/mentorai/compare/v0.66.2...v0.66.3) (2026-05-25)

### Bug Fixes

- access tabs failing tests fixed ([b3b2fe6](https://github.com/iblai/mentorai/commit/b3b2fe63cd44e87b2344dede7f340b9fc2300397))
- ios restriction modal moved to sdk ([777bfba](https://github.com/iblai/mentorai/commit/777bfba73253a37b919f9f47e91c7ef23c5a8281))
- ios restriction modal moved to sdk ([de50c60](https://github.com/iblai/mentorai/commit/de50c60f073d7993436645f4254eea509784414d))
- ios restriction modal moved to sdk > istanbul coverage issues fixed ([aa9e94d](https://github.com/iblai/mentorai/commit/aa9e94d278a1df0c5ffda2d3a1559db2b9945f84))
- ios restriction modal moved to sdk > test coverage ([3aff85e](https://github.com/iblai/mentorai/commit/3aff85e623a2344c9975bd6e7fa3e1069329b871))

## [0.66.2](https://github.com/iblai/mentorai/compare/v0.66.1...v0.66.2) (2026-05-25)

### Bug Fixes

- **deps:** patch 6 follow-up Dependabot security alerts ([a6e2a90](https://github.com/iblai/mentorai/commit/a6e2a90bf623db097bd0fa0ad24d8b303a88d8fe))

## [0.66.1](https://github.com/iblai/mentorai/compare/v0.66.0...v0.66.1) (2026-05-25)

### Bug Fixes

- **auth:** ensure explicit login clicks always redirect, bypassing stale cookies ([91d9eb5](https://github.com/iblai/mentorai/commit/91d9eb536ef35330f6407eb94328c8e735fc4d58))
- **macos:** remove network.server entitlement per App Store review ([f1077d9](https://github.com/iblai/mentorai/commit/f1077d9424753a5baecd360dc29deb7275fa8cee))

## [0.66.0](https://github.com/iblai/mentorai/compare/v0.65.2...v0.66.0) (2026-05-24)

### Features

- **chat:** forward ?prompt= URL param to useAdvancedChat as initialPrompt ([07f19d8](https://github.com/iblai/mentorai/commit/07f19d821b85ef70b59d37e6ec2cb2eb1ffee313))

### Bug Fixes

- **deps:** scope brace-expansion override to majors 1 and 2 ([25e978f](https://github.com/iblai/mentorai/commit/25e978f0a63f43aabec366b87bda77196aacface))

### Reverts

- **header:** restore mentorAI_logo URL; re-apply tauri shortDescription ([ad707ba](https://github.com/iblai/mentorai/commit/ad707ba5b45b7221cffaefe860f6825ea12fb4b3))
- **tauri:** restore shortDescription "AI-powered mentoring assistant" ([1b4ef6b](https://github.com/iblai/mentorai/commit/1b4ef6b28cbae687fcc250a1142a8424968f363e))

### Chores

- **deps:** bump @iblai/iblai-js to 1.11.5 ([dd3efa7](https://github.com/iblai/mentorai/commit/dd3efa78674d2e4698f3a99da9d4a615f8d2f5f6))
- **disclaimer:** drop product noun from default disclaimer ([e59f90d](https://github.com/iblai/mentorai/commit/e59f90d27cd2762c0cae940977763ca8183e0433))
- **disclaimer:** rename MentorAI to Iblai in default disclaimer ([7dfc43e](https://github.com/iblai/mentorai/commit/7dfc43e96906fc20c376d4302da65dad72ccaec3))
- **e2e:** sync coverage summary after rebase onto main ([422c7aa](https://github.com/iblai/mentorai/commit/422c7aa688dd15f150639968a573dc39c5b96efe)), closes [1688/#190](https://github.com/1688/mentorai/issues/190)
- **ui:** rebrand remaining MentorAI references to Agent AI ([dab6493](https://github.com/iblai/mentorai/commit/dab6493aa112685dd580001b0b89f0aa8dbd80d9))

### Tests

- **chat:** add E2E journey for ?prompt= URL auto-injection ([14de559](https://github.com/iblai/mentorai/commit/14de559dd8c277cd18c7bc884a8bdba0b8342290)), closes [iblai-platform#1722](https://github.com/iblai/iblai-platform/issues/1722)
- **chat:** cover initialPrompt forwarding from searchParams ([0e13cdf](https://github.com/iblai/mentorai/commit/0e13cdf92f9af3965515c1d2708badf180373a2d))

## [0.65.2](https://github.com/iblai/mentorai/compare/v0.65.1...v0.65.2) (2026-05-20)

### Bug Fixes

- **embed:** hide Close X when chat is not iframed ([2d77d31](https://github.com/iblai/mentorai/commit/2d77d31de6b5034d4f0878b84a1f67feec854160))
- **header:** rename Learner/Instructor to User/Admin ([cf6acd7](https://github.com/iblai/mentorai/commit/cf6acd7d59ff9f5038ef026cd26d37719a3accd0))
- **mentor-settings:** unify settings-tab labels to nouns + agent tooltip wording ([1097474](https://github.com/iblai/mentorai/commit/109747478645ac13fc8bb3cf66c2e976efee43fa))

### Chores

- **e2e:** map components/header/profile-button.tsx to journey 28 ([42e97bf](https://github.com/iblai/mentorai/commit/42e97bf5687a428f2ae0ed2cffbf203c4c26716c))

### Tests

- **e2e:** update label strings + coverage for [#1688](https://github.com/iblai/mentorai/issues/1688) ([42c469a](https://github.com/iblai/mentorai/commit/42c469a7242880a165f4238a9d1b680ca3796677))
- **learner-mode-switch:** cover LearnerModeSwitch render + toggle to satisfy 95% gate ([b8617a6](https://github.com/iblai/mentorai/commit/b8617a600e14aece916ea44d23edd6900b6d6228))

## [0.65.1](https://github.com/iblai/mentorai/compare/v0.65.0...v0.65.1) (2026-05-20)

### Bug Fixes

- **deps:** patch 32 Dependabot security alerts ([33103f4](https://github.com/iblai/mentorai/commit/33103f4d55f76e28262f1b3a7ee36dc39594b13a))
- **tauri:** patch 3 Cargo security alerts ([215aeaa](https://github.com/iblai/mentorai/commit/215aeaa8049df08fe9e41268c9b4b513f296c671))

## [0.65.0](https://github.com/iblai/mentorai/compare/v0.64.3...v0.65.0) (2026-05-18)

### Features

- **mentorai:** adding privacy tab for edit mentor and playwright tests ([3804a7b](https://github.com/iblai/mentorai/commit/3804a7b27ab926d522fc383315cb9915a8d35265))

### Bug Fixes

- **mentor:** fix for the package ([1494838](https://github.com/iblai/mentorai/commit/149483806b4b0f7f9ade3d2c90d23d8007902b42))

## [0.64.3](https://github.com/iblai/mentorai/compare/v0.64.2...v0.64.3) (2026-05-14)

### Chores

- **deps:** add @iblai/agent-ai dependency ([75b245a](https://github.com/iblai/mentorai/commit/75b245a4d1e1424259ffa654ad96c3494e6b6769))

## [0.64.2](https://github.com/iblai/mentorai/compare/v0.64.1...v0.64.2) (2026-05-14)

### Bug Fixes

- hasNonExpiredAuthToken returns false when no token, bump iblai-js to 1.9.11 ([7d18371](https://github.com/iblai/mentorai/commit/7d183713b142ee269ac0a30facfbee3e67342028))

### Chores

- add logs ([2633564](https://github.com/iblai/mentorai/commit/2633564b3d70cc80ba84658318e7c7a87a56795e))
- **deps:** bump version of iblai-js to 1.9.4 ([c020649](https://github.com/iblai/mentorai/commit/c0206490249eec6acf2d121c61527c0d3092580d))
- **deps:** bump version of iblai-js to 1.9.5 ([42af9ec](https://github.com/iblai/mentorai/commit/42af9ecb3200525507dcf70ad2a2e803ae143315))
- rename app to ibl.ai, bump to 1.1.11, fix macOS entitlements ([5a7e440](https://github.com/iblai/mentorai/commit/5a7e44085effe2dc9951392d5cc943047811aa72))
- update Dockerfile to include APP_VERSION arg ([1e04517](https://github.com/iblai/mentorai/commit/1e04517673f8f5c121673838dc6bc340d1b690ae))
- update Dockerfile to include APP_VERSION arg ([51c5050](https://github.com/iblai/mentorai/commit/51c5050f38a2addb28b3f539df99efe96a48fbfe))

## [0.64.1](https://github.com/iblai/mentorai/compare/v0.64.0...v0.64.1) (2026-05-12)

### Chores

- update Dockerfile to include APP_VERSION arg ([017ed8a](https://github.com/iblai/mentorai/commit/017ed8afd5db8e7f70bc40908c23783d3f76392d))

## [0.64.0](https://github.com/iblai/mentorai/compare/v0.63.16...v0.64.0) (2026-05-11)

### Features

- **mentor:** adding open claw tabs for edit mentor ([1a417a8](https://github.com/iblai/mentorai/commit/1a417a8a7503133980b9eeef762990d28e834f9d))

### Bug Fixes

- **e2e:** adding fix for the playwright and merge issues ([13e2853](https://github.com/iblai/mentorai/commit/13e285374f02a376cec942732f29c3ef0a54c5e9))
- **e2e:** adding for the coverage ([f0409d6](https://github.com/iblai/mentorai/commit/f0409d6c6843dec1477c60d805a4e67fd7507023))
- **e2e:** better elements capture for tests ([39b2113](https://github.com/iblai/mentorai/commit/39b21137a09e3cef27662ea20bfd3836534d3002))
- **e2e:** fix for the memory tests ([8d70dca](https://github.com/iblai/mentorai/commit/8d70dcac1ac9b4b6aafef00bfd96b9a1ec1a473b))
- **e2e:** more fixes for the tests ([a0f2d61](https://github.com/iblai/mentorai/commit/a0f2d61fef2c1b036972788de23da9e3a5b50eb0))
- **e2e:** open claw test fixes ([34a745d](https://github.com/iblai/mentorai/commit/34a745d1c3a2334c91c42449f5d63ece4906ece7))
- **e2e:** test fixes for memory and open claw ([ba2ff85](https://github.com/iblai/mentorai/commit/ba2ff8558c2594a41aab0928276ca6c6f24270f1))
- **mentor:** e2e playwright test fixes for claw ([e72dfb5](https://github.com/iblai/mentorai/commit/e72dfb58e34e544026001a1dc1e910af1c7bff20))
- **mentor:** fixes for e2e and unit tests ([5315c3e](https://github.com/iblai/mentorai/commit/5315c3e67cfd875f9ff71316497efcd2e92889a1))
- **mentor:** fixes for e2e and unit tests ([e7e24dd](https://github.com/iblai/mentorai/commit/e7e24ddafb989738662e7a7cbaa12789a7b59fca))
- **mentor:** fixing imports ([7644b2f](https://github.com/iblai/mentorai/commit/7644b2f5f18869b1003e164c10c494460996017e))
- **mentor:** memory test fixes ([9404b7b](https://github.com/iblai/mentorai/commit/9404b7b359b02a16f2414897d5c4ef474fe0ba03))
- **mentor:** open claw fixes ([ffc5c96](https://github.com/iblai/mentorai/commit/ffc5c96872ad6b5118a492b0001a04a9323544ef))
- **mentor:** package version fixes ([8b0b745](https://github.com/iblai/mentorai/commit/8b0b745ba507db0e9dc55725aa12766faa84d237))
- **mentor:** remove yalc package ([1acb196](https://github.com/iblai/mentorai/commit/1acb19653a71aa5fa32c0e360651585ee644590e))
- **mentor:** reverting prepush hook ([030152e](https://github.com/iblai/mentorai/commit/030152e0058448e0a6430722b0f16519fb8fb087))
- **mentor:** udpates for open claw and playwright tests ([b5f95a2](https://github.com/iblai/mentorai/commit/b5f95a2bcb8c70e6457661be344d8006348033e2))
- replace yalc @iblai/iblai-js with registry version 1.1.9 ([1c92772](https://github.com/iblai/mentorai/commit/1c92772fbcbb1b616a5261ef143cd670bec0c766))
- skip version.tsx from unit test coverage check (pure JSX, not instrumentable) ([478e82c](https://github.com/iblai/mentorai/commit/478e82c943ecff42a9595333d08c02b7194f2f5e))

### Chores

- **deps:** bump iblai-js to 1.9.3 ([2fc5648](https://github.com/iblai/mentorai/commit/2fc5648f1e93bd0d7eb4a11ef1a093e786a49e2f))
- drop redundant claw mock entries from tests not exercising claw ([ee8516e](https://github.com/iblai/mentorai/commit/ee8516e9cc73273358040dbd8b766f43cd92e738))
- **mentor:** adding claw updates better ui ([bf86f0e](https://github.com/iblai/mentorai/commit/bf86f0ed2269dfed01c7dd62a9876d27aeb87b8f))
- **mentor:** fixing for skills and settings tab ([ec85a2d](https://github.com/iblai/mentorai/commit/ec85a2dc8774192fab9759b350bb3c8628e89444))
- **mentor:** skills tab fixes and playwright tests ([223206b](https://github.com/iblai/mentorai/commit/223206b07420ca65961620fe5612d033242ab5b4))

### Tests

- fix hasNonExpiredAuthToken ([d91a6a5](https://github.com/iblai/mentorai/commit/d91a6a510b0ab49baee1766c93bae35b6e8c33d2))

## [0.63.16](https://github.com/iblai/mentorai/compare/v0.63.15...v0.63.16) (2026-05-11)

### Chores

- update iblai-js version ([39bc8da](https://github.com/iblai/mentorai/commit/39bc8dac18a04e7e9a1093c080fa3915e00457f9))

## [0.63.15](https://github.com/iblai/mentorai/compare/v0.63.14...v0.63.15) (2026-05-10)

### Tests

- **e2e:** add real LiveKit voice-call round-trip (vc-07) ([c656273](https://github.com/iblai/mentorai/commit/c656273703267703958596d2d812a92f645f5584))
- **e2e:** add voice-to-text dictation journey with real audio injection ([c3b444c](https://github.com/iblai/mentorai/commit/c3b444ca9a5546cd341bc4c3d05741e78224722e))

## [0.63.14](https://github.com/iblai/mentorai/compare/v0.63.13...v0.63.14) (2026-05-09)

### Chores

- **deps:** bump iblai-js to 1.9.0 ([cee2f56](https://github.com/iblai/mentorai/commit/cee2f56b2fe9e663911e7590ed4bf51ad48beb11))

## [0.63.13](https://github.com/iblai/mentorai/compare/v0.63.12...v0.63.13) (2026-05-08)

### Reverts

- drop out-of-scope reflow + skip-link + voice-call work from [#1596](https://github.com/iblai/mentorai/issues/1596) ([dbce21b](https://github.com/iblai/mentorai/commit/dbce21b519cda83a26b718123111ea9d1a638c8f))

### Chores

- **e2e:** map voice-call-button.tsx to journey 37 sourceFiles ([e1dd9a1](https://github.com/iblai/mentorai/commit/e1dd9a10f2ebf428e744b2a01fc9c7eedb22b4e0))

## [0.63.12](https://github.com/iblai/mentorai/compare/v0.63.11...v0.63.12) (2026-05-08)

### Bug Fixes

- navbar header overflowing when llm name very long ([24f3e7e](https://github.com/iblai/mentorai/commit/24f3e7ee4be941ba0d115f05d0dee0ffbb446161))
- navbar header overflowing when llm name very long > playwright test coverage ([daa3909](https://github.com/iblai/mentorai/commit/daa3909bd832c03c087c6cc3e2a10ee082b49850))
- navbar header overflowing when llm name very long > test coverage ([cc11102](https://github.com/iblai/mentorai/commit/cc111026645b96677aaa39507bb8904e1e732fda))

### Chores

- bump iblai-js version to 1.7.0 ([c85204b](https://github.com/iblai/mentorai/commit/c85204ba9fdcc96bf43be9fbd7c51f7fc3186f86))

## [0.63.11](https://github.com/iblai/mentorai/compare/v0.63.10...v0.63.11) (2026-05-08)

### CI

- updates pr-e2e-tests ([f02f1ba](https://github.com/iblai/mentorai/commit/f02f1ba580774de2ea7094b8b4466aa833bdb279))

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
