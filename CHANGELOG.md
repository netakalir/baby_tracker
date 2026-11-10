# Changelog

## [0.2.0](https://github.com/netakalir/baby_tracker/compare/vite-scaffold-v0.1.0...vite-scaffold-v0.2.0) (2026-11-10)


### Features

* **compare:** add day comparison screen ([caf26d4](https://github.com/netakalir/baby_tracker/commit/caf26d4cb757b125c7ab9855ef9027437400a020))
* **compare:** day comparison screen + Today header menu ([39d1412](https://github.com/netakalir/baby_tracker/commit/39d14121cd364f4ba10153aa31276b160088e499))
* **compare:** move the entry point to a Today header icon ([8993390](https://github.com/netakalir/baby_tracker/commit/8993390c96d168ffa7935675f6d1464fb2d402bf))
* **query:** let a query opt expected errors out of Sentry reporting ([b4bd1dc](https://github.com/netakalir/baby_tracker/commit/b4bd1dc748327eddd45a0a4c729b054e0357a0b1))
* **today:** replace header icons with a hamburger navigation menu ([0439b0b](https://github.com/netakalir/baby_tracker/commit/0439b0b516c801ac9bb334b3dc42bd713db14731))
* **today:** rotate the hamburger lines vertical while the menu is open ([f4014c3](https://github.com/netakalir/baby_tracker/commit/f4014c34edd3cafe25e432688df6c4245ed2059f))
* **weather:** "what to dress today" strip on the Today screen ([79b3673](https://github.com/netakalir/baby_tracker/commit/79b3673b7108ddc19f4175623473da8151dcac2b))
* **weather:** add forecast, geocoding and dressing-advice data layer ([27cab63](https://github.com/netakalir/baby_tracker/commit/27cab63403e5c710d4429bd29d6bfde8c9d64cd4))
* **weather:** float the weather panel over the page as a popover ([4e4ed75](https://github.com/netakalir/baby_tracker/commit/4e4ed75eeadc110bebaa62c1a4b983edbc256f95))
* **weather:** show a moon instead of a sun at night ([e7ae49e](https://github.com/netakalir/baby_tracker/commit/e7ae49e4cb1df0b377b64b056ef03aec79f3506d))
* **weather:** show dressing strip under the live Today header ([51c4b56](https://github.com/netakalir/baby_tracker/commit/51c4b56c460ebe7249682bb7b5247a9edd7b7695))


### Bug Fixes

* **compare:** extend running timers on every row and sync rows in realtime ([b6e637f](https://github.com/netakalir/baby_tracker/commit/b6e637fc807bdccb39cf958e075114d72ddd25fc))
* **compare:** show a quiet note on a row whose day failed to load ([15f1f10](https://github.com/netakalir/baby_tracker/commit/15f1f1009f9b6f22ac4b4fbc8b21e5e2c49bdcc4))
* **today:** ArrowUp from the menu panel focuses the last item ([187b9b6](https://github.com/netakalir/baby_tracker/commit/187b9b684e3798896f7dc5e31afc80eb074c6ebe))
* **today:** header overflow fallback, menu layering and content-sized menu ([4bc3898](https://github.com/netakalir/baby_tracker/commit/4bc3898efb52241f7f611a1dc18f9f7af42ca321))
* **today:** keep a readable header date at 320px and wire compare via prop ([f2cf4a1](https://github.com/netakalir/baby_tracker/commit/f2cf4a1c29cbc4c4063ddd2887df14e3d7e1732e))
* **weather:** abandon a pending locate on search and on unmount ([220e982](https://github.com/netakalir/baby_tracker/commit/220e9820696e175f6660c8ee18db7646345db7b8))
* **weather:** address review - focus, Sentry noise, offline, rounding ([c18b806](https://github.com/netakalir/baby_tracker/commit/c18b8066ff48f9343c8246c84591d59207ca2f8a))
* **weather:** close the popover when keyboard focus leaves it ([748bfbc](https://github.com/netakalir/baby_tracker/commit/748bfbc628fd0ff3f222a937929030d6b98ffe3b))
* **weather:** ignore a late "use my location" result after a city is chosen ([4ede585](https://github.com/netakalir/baby_tracker/commit/4ede58509610f4b93952c51ed8c83d33239d0592))
* **weather:** make Shift+Tab test header-agnostic, release flag on contextmenu ([10f1652](https://github.com/netakalir/baby_tracker/commit/10f1652ef6a7d0081d58c11acf92b2a2da3ea8c8))
* **weather:** only switch to device location once geolocation succeeds ([6dfd4a9](https://github.com/netakalir/baby_tracker/commit/6dfd4a980c5d86d6f7802d9fd06cc5673c78414f))
