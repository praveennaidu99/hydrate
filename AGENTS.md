This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This project: Hydrate (hydration + health reminders)

### Structure
- Entry `index.ts` imports `src/background.ts` FIRST (notification-button background task), then `expo-router/entry`.
- Routes (Expo Router, `src/app`): `_layout.tsx` (fonts, theme, notification lifecycle + deep links), `(tabs)/` = `index` (Today), `reminders`, `insights` (accepts `?period=week|month`), `settings`; `new-reminder.tsx` is a modal. Tabs come from `expo-router/js-tabs` with the custom `src/ui/TabBar.tsx`.
- Logic (no UI): `src/notifications.ts` (ALL scheduling), `src/storage.ts` (AsyncStorage), `src/health.ts` (stats + health copy), `src/events.ts` (refresh bus).

### Notifications
- Identifier prefixes: `hydration-`, `custom-` (weekday variants `custom-<ts>~<weekday>`), `goalcheck-`, `review-`, `snooze-`. Custom reminder spec lives in `content.data.spec`; the scheduled list is the source of truth.
- Buttons: category `water` (drink/snooze), `task` (done/snooze) → `handleResponse` (de-duplicated).
- Android: one channel per sound (`rem-<sound>`). Custom sounds + background buttons need a real build, not Expo Go.
- Keep total scheduled notifications under 64 (iOS); water slots capped at 36.

### Design system ("Tide")
- Tokens in `src/theme.tsx` (light/dark, font family `F`, `radius`, `elevation()`, `alpha()`). Never hard-code colors in screens; use `useTheme()`. Category hues/icons: `src/ui/kinds.ts`.
- Primitives in `src/ui/primitives.tsx`: `Text` (variants display/title/headline/body/strong/caption/overline), `Card`, `PressableScale`, `IconTile`, `IconButton`, `GradientButton`, `Segmented`, `Toggle`, `Stepper`, `Pills`, `Banner`, `SectionLabel`, `FadeSwap`. Pages use `Screen` + `enter(i)` for staggered entrances.
- Signature components: `LiquidOrb` (SVG waves, tilt via Accelerometer, hold-to-pour on Today), `Charts` (Ring, WeekRings, ScoreRing, BarChart), `Confetti`, `AnimatedNumber`.
- Motion: Reanimated 4 only. Write shared values with `.set()` in event handlers (React Compiler lint). Respect `useReducedMotion()` for looping/ambient motion. Icons: Ionicons from `@expo/vector-icons`. Font: Plus Jakarta Sans.
- `.npmrc` has `legacy-peer-deps=true` (expo-router web deps pin a newer react-dom than the app).

### Rules
- Health text is general wellness info; keep the disclaimer and never present it as a diagnosis.
