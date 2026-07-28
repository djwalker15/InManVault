# Changelog

## [0.4.1](https://github.com/djwalker15/InMan/compare/inman-v0.4.0...inman-v0.4.1) (2026-07-28)


### Bug Fixes

* **e2e:** make the Playwright dev-server port configurable ([973d699](https://github.com/djwalker15/InMan/commit/973d699b3a99b1d10a97f4f75dc8157a49a5b105))

## [0.4.0](https://github.com/djwalker15/InMan/compare/inman-v0.3.2...inman-v0.4.0) (2026-06-25)


### Features

* **inventory:** receipt/invoice scan add method ([b9d2399](https://github.com/djwalker15/InMan/commit/b9d239992338b1ef039ea611ee0020e06306296d))


### Bug Fixes

* **e2e:** repair receipt-scan smoke test (valid PNG + CORS preflight) ([d2e280d](https://github.com/djwalker15/InMan/commit/d2e280d6ee91bac1f820142cfc5846d3fa83bf4d))
* **e2e:** repair receipt-scan smoke test (valid PNG + CORS preflight) ([8b79874](https://github.com/djwalker15/InMan/commit/8b79874b1959ddf48812130d1e692d2df05398c4))

## [0.3.2](https://github.com/djwalker15/InMan/compare/inman-v0.3.1...inman-v0.3.2) (2026-06-24)


### Bug Fixes

* **deps:** use dev's complete lockfile for the merge, bump root version to 0.3.1 ([d8413f2](https://github.com/djwalker15/InMan/commit/d8413f28383972ea45c61d4825cb5268c263a01d))

## [0.3.1](https://github.com/djwalker15/InMan/compare/inman-v0.3.0...inman-v0.3.1) (2026-06-23)


### Bug Fixes

* **ci:** align e2e Playwright image with pinned dep version ([2eec986](https://github.com/djwalker15/InMan/commit/2eec98621f11af588e87a132ed8cb1b402863f6f))
* **ci:** align e2e Playwright image with the pinned dep version ([f0f1265](https://github.com/djwalker15/InMan/commit/f0f1265e758a086987f4daa0c03f230337670531))

## [0.3.0](https://github.com/djwalker15/InMan/compare/inman-v0.2.0...inman-v0.3.0) (2026-06-17)


### Features

* **feedback:** in-app feedback widget that auto-files to ClickUp ([1b0fd99](https://github.com/djwalker15/InMan/commit/1b0fd993cbfde9d4a58ac07ff232973ce0d2d90d))
* **feedback:** in-app feedback widget that auto-files to ClickUp ([1e655f2](https://github.com/djwalker15/InMan/commit/1e655f20a57cee5bd46badb9a8a55aea151779b9))


### Bug Fixes

* **auth:** land email/password sign-ups on /dashboard, fix e2e flow ([f3072d6](https://github.com/djwalker15/InMan/commit/f3072d6c554dbc09d0d9eeacb257f11073741f15))
* **ds:** Sheet steals focus from inputs on each keystroke ([f0fa117](https://github.com/djwalker15/InMan/commit/f0fa117df48e611c8bea6b725475909e61ec8053))
* **ds:** stop Sheet stealing focus on every onClose identity change ([55bf4ab](https://github.com/djwalker15/InMan/commit/55bf4abe80b3ab81cf1c8d2ee8e8b0052da8da36))

## [0.2.0](https://github.com/djwalker15/InMan/compare/inman-v0.1.0...inman-v0.2.0) (2026-06-15)


### Features

* **account:** slice 1 — users soft-delete columns + 30-day purge cron ([27a0c9d](https://github.com/djwalker15/InMan/commit/27a0c9daddd9e343b9eb7cc917701fbcc9514919))
* **account:** slice 2 — atomic request_account_deletion + restore_account RPCs ([ec3470c](https://github.com/djwalker15/InMan/commit/ec3470c675d2ccf60e5ec7b1cbec9c8c1e3be6a3))
* **account:** slice 3 — Clerk integration edge functions + restore detection ([256d11f](https://github.com/djwalker15/InMan/commit/256d11f8dfabe899dbbcd745eba137a589dc38ad))
* **account:** slice 4 — Settings → Account UI + restore prompt + slice-3 reconciliation ([2011266](https://github.com/djwalker15/InMan/commit/201126622176a618dac0f1d485c921ce07571d63))
* **alerts:** dashboard widget + /alerts grouped page ([e926067](https://github.com/djwalker15/InMan/commit/e926067c34aa0d59ef4b5d43667bc7127274c88b))
* **app:** scaffold Vite + React + TS app with Clerk/Supabase auth shell ([8a87279](https://github.com/djwalker15/InMan/commit/8a87279ee8fe44610a13c3fc621442a5a3efc8f2))
* **crews:** /crew/settings read shell — General + Members tabs ([1c5a15d](https://github.com/djwalker15/InMan/commit/1c5a15d4de867c8ece3a51adf75b1987a3c7e934))
* **crews:** crew switcher in sidenav + /crews list page ([cf27504](https://github.com/djwalker15/InMan/commit/cf27504a79f5b85dd6049bf0249bf1ab6bfcb1b8))
* **crews:** Danger Zone — transfer, leave, delete with 48h cool-off ([31f14e9](https://github.com/djwalker15/InMan/commit/31f14e9589539e4631615a25bd386c7791729f2b))
* **crews:** Members tab actions — invite, change role, remove, revoke ([9ab3671](https://github.com/djwalker15/InMan/commit/9ab367188f91d5dd9a3c34d5c0469e70cad958f4))
* **crews:** Permissions tab — per-member feature overrides ([7b0e33a](https://github.com/djwalker15/InMan/commit/7b0e33acd7bf750d12b37984f4b51b2cefed0e56))
* **dashboard:** admin-only dismissible onboarding checklist ([2836104](https://github.com/djwalker15/InMan/commit/2836104ad7c432ab8ac2467de6e72cb850b0d48f))
* **dashboard:** admin-only dismissible onboarding checklist ([9ca2976](https://github.com/djwalker15/InMan/commit/9ca297609726f61a919ef9aee2fe9a0f747f93ad))
* **dashboard:** redesign with onboarding checklist and SignedInLayout shell ([c318fff](https://github.com/djwalker15/InMan/commit/c318fffd6fa18c2242ea9bc9158a06644771fb79))
* **ds:** optional clear action on ChecklistRow ([b64a9ad](https://github.com/djwalker15/InMan/commit/b64a9add64aa53759cf17893044b400a3aa16f5e))
* **ds:** scaffold core design-system primitives ([019e3aa](https://github.com/djwalker15/InMan/commit/019e3aad9ffb1f1752d1c5be8873a8ac084f1e49))
* **inventory:** add-item step 1 — product resolution ([eadfac9](https://github.com/djwalker15/InMan/commit/eadfac9a110c81debf4b7f76b5202f5257c92f97))
* **inventory:** add-item step 2 — atomic record_purchase RPC ([76ee4f7](https://github.com/djwalker15/InMan/commit/76ee4f7fa9b1bfb0eb27f18b694b56a85d3efadb))
* **inventory:** inline row actions — move, set home, put back, edit ([04deea7](https://github.com/djwalker15/InMan/commit/04deea726aee3272cc0b184492b0199ddef754f5))
* **inventory:** inline row expansion with recent activity ([7e80ebc](https://github.com/djwalker15/InMan/commit/7e80ebc273d93ffabeced1ad05afa8d3d14b1074))
* **inventory:** inventory list shell with empty state ([54d723f](https://github.com/djwalker15/InMan/commit/54d723fe6dc5fbd962d7d82d96917dd148597e78))
* **inventory:** list rows with status badges and alert-first sort ([56198b1](https://github.com/djwalker15/InMan/commit/56198b19bac931a309385c5ab78dc4c87b6542af))
* **inventory:** restock sub-flow ([9a26acc](https://github.com/djwalker15/InMan/commit/9a26acc9242afb9cf80761bcaef702a42169603a))
* **inventory:** search and stacking filters ([91c1016](https://github.com/djwalker15/InMan/commit/91c10167b12c0e2619d5088952fd20a3d551ccc8))
* **landing:** rebuild marketing landing in design-system style ([c1f6b08](https://github.com/djwalker15/InMan/commit/c1f6b085ecc9b6079cca404ae8345aa6b48ddd59))
* **nav:** sidenav drawer with Spaces destination ([db7df72](https://github.com/djwalker15/InMan/commit/db7df72def2a10c36d37f6aeb464e162184a2172))
* **onboarding:** Crew Decision and Creation screens with progress bar ([0342656](https://github.com/djwalker15/InMan/commit/034265666964e442534c4253ff9832fa19f9b287))
* **onboarding:** invite acceptance route /invite/:code (Path B) ([29c5fe9](https://github.com/djwalker15/InMan/commit/29c5fe9c82737622268f6f825de8d5648eb81c94))
* **onboarding:** wire /onboarding/spaces step 3 of wizard ([fa247a8](https://github.com/djwalker15/InMan/commit/fa247a8838c6c69cd609b79b50f3f3f03236559e))
* **spaces:** explainer screen with 7-level hierarchy diagram ([4fe3c9f](https://github.com/djwalker15/InMan/commit/4fe3c9f1ddf75e8bd699dd8e18e7dcfdc86c5824))
* **spaces:** guided first-branch wizard ([8f9d010](https://github.com/djwalker15/InMan/commit/8f9d0102175c68bf7bf2073a7098fd61b65d4ba0))
* **spaces:** premises creation with live tree ([88626f5](https://github.com/djwalker15/InMan/commit/88626f5714cd87d455c75e6474f8d3fc3f9d444f))
* **spaces:** Reorganize Delete + Split — atomic RPCs and item-level pickers ([0569020](https://github.com/djwalker15/InMan/commit/0569020e492e115f6123a01bad58b65ca5153e91))
* **spaces:** Reorganize mode shell + preview panel ([50af8cf](https://github.com/djwalker15/InMan/commit/50af8cf573da2dbf35605a4fd5afd3211b96ec48))
* **spaces:** Reorganize Move + Merge — atomic RPCs and live previews ([25aadd7](https://github.com/djwalker15/InMan/commit/25aadd707f49c8051cf119043b83b22454f213b2))
* **spaces:** scoped card drill-down browser with tree-view toggle ([6844055](https://github.com/djwalker15/InMan/commit/68440555833ea2bb1b83f42041219e5f4e695d4a))
* **spaces:** scoped card drill-down browser with tree-view toggle ([db84b90](https://github.com/djwalker15/InMan/commit/db84b901fb535286a13b5566d2e46626e315cb87))
* **spaces:** success toast for inline tree delete ([0fc74cd](https://github.com/djwalker15/InMan/commit/0fc74cd1f6b3499f7bff8bb7d2aa069b61937b05))
* **spaces:** success toast for Reorganize ops ([ead503b](https://github.com/djwalker15/InMan/commit/ead503b558f117206525cc71cae3e65b43693d5f))
* **spaces:** template browser with replace/merge ([5eac564](https://github.com/djwalker15/InMan/commit/5eac564b15ac60a692ac639367119e960a77c8e8))
* **spaces:** tree editor at /spaces and /onboarding/spaces ([d8ee8bd](https://github.com/djwalker15/InMan/commit/d8ee8bde28108d021be7b04f2035947effc3b948))


### Bug Fixes

* **crews:** sync active-crew selection across views ([1506e4d](https://github.com/djwalker15/InMan/commit/1506e4da9d144d9ec1dbebb89940ea0e030e6924))
* **crews:** sync active-crew selection across views ([2591aa0](https://github.com/djwalker15/InMan/commit/2591aa07acf0f4006d5e59262e3464962d7b119e))
* **crews:** three bug fixes for crew creation and switching ([3d3cbdf](https://github.com/djwalker15/InMan/commit/3d3cbdf770e7570b94d6d4b9a82826323c7da87b))
* **spaces:** inline tree delete via cascade_soft_delete_spaces RPC ([c0ba1b7](https://github.com/djwalker15/InMan/commit/c0ba1b77ef0acfb3c8d0b899740c44d7e2465bfd))
* **spaces:** scope onboarding spaces lookup to active crew ([45fd194](https://github.com/djwalker15/InMan/commit/45fd19425d4ddd0cc546abb3e7e27382b2efa6ea))
* **spaces:** scope onboarding spaces lookup to active crew ([7aca122](https://github.com/djwalker15/InMan/commit/7aca1221983d46805fb6688cf34739d18cc8bf3c))
* **spaces:** surface PostgrestError in tree-editor catches ([d6eb37e](https://github.com/djwalker15/InMan/commit/d6eb37ea6f1d74915b5b684e36b0b5c4a166769d))
* **vite:** ensure server host is set for WSL2 compatibility ([3ecc728](https://github.com/djwalker15/InMan/commit/3ecc72886073ad1ea235c1e4c004646b4ff5c8c1))
