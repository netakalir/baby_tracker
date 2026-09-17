# סיכום התקדמות - Baby Tracker
**תאריך עדכון אחרון:** 17 בספטמבר 2026

---

## סביבות פריסה (Deployment Environments)

האפליקציה פרוסה חיה על **Vercel** (אירוח סטטי של ה-Vite build; `vercel.json` מוסיף SPA rewrite כדי שניתובי React Router עמוקים/רענון לא יחזירו 404). פרויקט Vercel אחד מחובר לריפו, ומפריד בין הסביבות לפי scope של משתני env — **כל סביבה מדברת עם פרויקט Supabase נפרד** (בידוד DB אומת אובייקטיבית: כל פריסה צורבת `*.supabase.co` שונה).

| סביבה | ענף | כתובת יציבה (Vercel) | פרויקט Supabase | scope של env |
|---|---|---|---|---|
| **production** | `main` | `baby-tracker-git-main-neta-team.vercel.app` (עד לחיבור `app.taliatracker.com`) | פרויקט **prod** (ייעודי, `#18`) | Production |
| **integ** | `integ` | `baby-tracker-git-integ-neta-team.vercel.app` | פרויקט **הבדיקות** (משמש גם E2E) | Preview |

**עקרונות שהוקבעו:**
- **בידוד:** משתני `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` מוגדרים פעמיים ב-Vercel — Production→prod, Preview→בדיקות/integ. הערכים חיים רק בפאנל Vercel + ב-Supabase (לא בריפו). מסומנים כ-**Config** (ה-anon key ציבורי, לא Secret; ה-`service_role` לעולם לא בפרונטאנד).
- **integ ממחזר את פרויקט הבדיקות** (אילוץ Free tier = 2 פרויקטים; כבר יש prod + בדיקות). בטוח כי ה-E2E מנקים רק את מה שהם יצרו לפי ID ([`tests/support/fixtures.ts`](tests/support/fixtures.ts)) ויוצרים משתמשים מאומתים-מראש דרך admin API (עוקפים מייל), כך שהגדרות Auth/SMTP של integ לא שוברות אותם. חיסרון מקובל: בלגן נתונים (`preview-*@example.com` מעורבב עם נתוני integ ידניים).
- **כתובות:** לכל deploy יש כתובת immutable (hash, נצמדת לבנייה); לכל branch יש alias יציב שעוקב אחרי האחרון. ל-**Site URL** משתמשים תמיד ב**יציבה**, לא ב-hash.
- **מיילים (Auth):** נשלחים דרך **Resend** (SMTP; דומיין `taliatracker.com` מאומת עם SPF/DKIM/DMARC ב-Cloudflare). `Site URL` + `Redirect URLs` מוגדרים בכל פרויקט Supabase בנפרד לכתובת היציבה של אותה סביבה. אומת מקצה-לקצה בשתי הסביבות (הרשמה → מייל → קישור נכון). חוב פתוח: דומיין חדש → מוניטין שליחה נמוך, חלק מהמיילים בספאם בהתחלה (משתפר עם הזמן + "not spam").

**חובות/אופציונלי פתוחים בסביבות:**
- תת-דומיינים מותאמים: `app.taliatracker.com` (prod) / `integ.taliatracker.com` (integ) — במקום ה-aliasים של Vercel.
- Resend ייעודי לפרויקט הבדיקות (integ כרגע עשוי להישען על SMTP דיפולטי מוגבל-קצב).
- error monitoring (Sentry), ערוץ פידבק + הערת פרטיות — ראה issues #20 / #22 ב-GitHub (רשימת Phase 0 לפריסה ל-beta).

---

## מה הושלם עד כה

### שלב 1: אפיון מלא ✅
כל המסמכים נכתבו ואושרו:

| מסמך | תוכן |
|---|---|
| `MASTER-SPEC.md` | המסמך הראשי - חזון, ארכיטקטורה, זרימות, החלטות |
| `CLAUDE.md` | קובץ הקשר ל-Claude Code |
| `user-flow-onboarding.md` | זרימת הרשמה/הצטרפות למשפחה |
| `error-handling-spec.md` | כל קטגוריות השגיאות |
| `screen-today-spec.md` | אפיון מסך "היום" |
| `screen-week-spec.md` | אפיון מסך "שבוע" |
| `screen-day-comparison-spec.md` | אפיון מסך "השוואת ימים" |
| `age-content-and-ai-tooltips-spec.md` | תאב מידע לפי גיל + tooltips AI |
| `screen-settings-spec.md` | אפיון מסך הגדרות + העדפות משתמש (per-user / per-family) |

### שלב 2: Skills ל-Claude Code ✅
5 skills מוכנים ב-`.claude/skills/`:

| Skill | תפקיד |
|---|---|
| `design-system` | עקרונות עיצוב אחידים |
| `rls-policy-pattern` | דפוס RLS + GRANT + Realtime |
| `code-review-checklist` | רשימת בדיקה לאיכות קוד |
| `testing-strategy` | אסטרטגיית Playwright |
| `typescript-conventions` | קונבנציות קוד |

### שלב 3: תשתית טכנית ✅

**GitHub:**
- ריפו `baby_tracker` פעיל
- קוד מועלה ומסונכרן

**Supabase:**
- פרויקט `baby-tracker` פעיל (Free tier)
- 5 טבלאות נוצרו: `families`, `family_members`, `children`, `events`, `family_invites`
- RLS מופעל על כל הטבלאות עם policies נכונות
- GRANTs לתפקיד `authenticated` על כל הטבלאות (אומת ב-SQL)
- Realtime publication פעיל על כל הטבלאות (אומת ב-SQL)
- 6 migrations בריפו:
  - `20260701000000_initial_schema.sql` — טבלאות + RLS + policies ראשוניים
  - `20260701000001_grants_and_realtime.sql` — GRANTs מפורשים + Realtime publication
  - `20260712000000_fix_family_members_rls_recursion.sql` — תיקון רקורסיה אינסופית ב-RLS (`42P17`) עם helper `auth_user_family_ids()` (SECURITY DEFINER)
  - `20260712000001` + `20260713000000_families_insert_policy.sql` — פיצול policy של `families` כדי לאפשר יצירת משפחה (INSERT למחובר, קריאה/עריכה לחברים בלבד)
  - `20260713000001_create_family_rpc.sql` — RPC אטומי `create_family()` (משפחה + חברות יחד) + ניקוי משפחות יתומות
  - `20260716000000_family_invites_claim_policy.sql` — **תיקון באג:** policy ל-UPDATE על `family_invites` שמאפשר להורה שני לתבוע (claim) הזמנה. בלעדיו כל ניסיון הצטרפות נכשל ב-"ההזמנה כבר נוצלה" (RLS חסם את ה-UPDATE → 0 שורות)
  - `20260716000001_family_invites_claim_expiry.sql` — **הידוק אבטחה:** הוספת `expires_at > now()` ל-policy, כדי שגם בקשת API ישירה (שעוקפת את בדיקת התוקף ב-JS) לא תוכל לתבוע הזמנה שפג תוקפה. תוקף ההזמנה נאכף כעת ברמת ה-DB, לא רק בלקוח
  - `20260903000000_harden_invite_and_membership_flow.sql` — **הידוק אבטחה קריטי (גבול ההרשאות של כל האפליקציה):** סגירת ארבע חולשות חופפות בזרימת הזמנה→הצטרפות. (S1) הוסרה policy ה-INSERT הפתוחה על `family_members` (`with check (user_id = auth.uid())` בלבד) שאפשרה לכל משתמש מאומת להכניס חברות לכל `family_id` ולקבל גישה מלאה — חברות נוצרת כעת **רק** דרך RPC של SECURITY DEFINER. (S2) הוסרו policy ה-SELECT `using (true)` וה-`grant select ... to anon` על `family_invites` (אפשרו למי-שהוא למנות את **כל** ההזמנות/הטוקנים); אימות לפני-הרשמה עובר כעת ל-RPC חדש `get_invite_by_token` שמחזיר רק שורה אחת ושדות לא-רגישים. (S3) הוסרה policy ה-UPDATE הישירה שאפשרה לכל משתמש מאומת "לשרוף" כל הזמנה (DoS) — ה-claim מקופל כעת לתוך ה-RPC תחת נעילת שורה. (S4) `joinFamilyByToken` הפך מ-select→update→insert לא-אטומי ל-RPC אטומי יחיד `join_family_by_token` (SECURITY DEFINER, `search_path` נעול): בטרנזקציה אחת מאמת מחדש (לא-מנוצל + לא-פג), מסמן מנוצל, ומכניס חברות — הזמנה לא נשרפת יותר בלי שהחברות נוצרת. `family_invites` הוסרה מ-publication ה-realtime (אין מנוי, קריאה עוברת ל-RPC). הלקוח (`onboarding/api.ts`, `JoinFamilyScreen`) קורא ל-RPC וממפה שגיאות typed ל-`JoinFamilyErrorCode`. טסטי בידוד: `tests/e2e/invite-security.spec.ts` (S1–S4) + `family-sharing.spec.ts` עודכן. **סטטוס:** נכתב ואומת סטטית (build+lint+unit עוברים); אימות RLS בזמן-ריצה **ממתין ל-`supabase db push` בשני פרויקטי Supabase** לפני שה-E2E יכול לרוץ.

**פרויקט React:**
- React + TypeScript + Vite מוקם
- Stack נוסף: React Router, TanStack React Query, Zod, Tailwind CSS, oxlint (lint), Playwright (התקנה בלבד)
- מחובר ל-Supabase דרך `.env`
- `.env` מוגן ב-`.gitignore`
- ספריית UI בסיסית ב-`src/components/ui/`: `Button`, `Card`, `Input`, `Label`, `Banner`, `FormError`, `LoadingScreen`, `ErrorScreen`
- תשתית משותפת: `lib/queryClient.ts`, `lib/errorMessages.ts`, `lib/supabase.ts`, `types/database.ts`

### שלב 4: משימה 2 - Auth + Onboarding ✅ (committed + נדחף + אומת מקצה לקצה)
בוצע ונדחף בענף `AuthPage-login` (טרם merged ל-`main`):
- **הרשמה/התחברות באימייל + סיסמה** (לא "אימייל בלבד" - כולל סיסמה, שכחתי סיסמה, איפוס סיסמה, אימות אימייל)
- מסכים: `AuthPage`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `VerifyEmailScreen`
- Onboarding: `CreateOrJoinScreen`, `CreateFamilyScreen`, `JoinFamilyScreen`, `AddChildScreen`
- זרימת קישור הזמנה (join by token)
- Route guards לפי סטטוס onboarding (`RequireAuth`, `RequireVerifiedEmail`, `RequireOnboardingStatus`, `RedirectIfSignedIn`)
- `AuthProvider` + hooks (`useAuth`, `useOnboardingStatus`)
- `TodayScreen` = placeholder (שם ילד + אימייל + **כפתור התנתקות**)

**באגים שהתגלו ותוקנו באימות** (ראה סעיף migrations):
1. רקורסיה אינסופית ב-RLS → כל קריאה 500, ההתחברות נתקעה. תוקן עם `auth_user_family_ids()`.
2. INSERT ל-`families` נחסם (בעיית ביצה-ותרנגולת). תוקן בפיצול policy.
3. `.select()` אחרי יצירת משפחה נחסם → RPC אטומי `create_family()`.
4. אין דרך להתנתק מהמסך הראשי → נוסף כפתור "התנתקות" ב-`TodayScreen` (מנקה גם את מטמון ה-queries).

**Git (ענף `AuthPage-login`):** `feat(db)` → `feat(auth)` → `docs` → `feat(auth): sign-out button` → `fix(db): invite claim policy` → `test(e2e): auth/isolation/sharing`.

### סגירת משימה 2 ✅ (בדיקות E2E + תיקון באג + merge)
- **תשתית בדיקות Playwright** הוקמה מול פרויקט Supabase המאורח: `playwright.config.ts`, `tests/support/` (טעינת env, admin client, fixtures שיוצרים משתמשים מאומתים-מראש/משפחות/הזמנות ומנקים אחריהם), `tests/e2e/`.
- **6 בדיקות E2E — כולן עוברות:**
  - `auth.spec.ts` — התחברות → onboarding מלא → מסך היום; חבר קיים נוחת ישר ב-Today; שגיאת התחברות ידידותית.
  - `family-isolation.spec.ts` — **גבול RLS:** משתמש ממשפחה B לא רואה ילד של משפחה A, גם ב-UI וגם ברמת ה-API עם client מאומת אמיתי.
  - `family-sharing.spec.ts` — הורה שני מצטרף דרך הזמנה ורואה את הילד המשותף; **ובדיקת התקפה:** הזמנה שפג תוקפה לא ניתנת לתביעה גם ב-API ישיר.
- **באג אמיתי שהתגלה ותוקן:** ל-`family_invites` לא היה policy ל-UPDATE, ולכן זרימת ההצטרפות של הורה שני (ליבת שיתוף המשפחה) מעולם לא עבדה באמת. תוקן ב-migration `20260716000000` שנדחף ל-DB המאורח (`supabase db push`).
- **הבדיקות רצות מול פרויקט מאורח** (אין Docker/runtime מקומי במכונה). ה-`service_role`/secret key נמצא ב-`.env.test` בלבד (מוגן ב-`.gitignore`), לשימוש הבדיקות בלבד, ובוטל אחרי הריצה.

---

### שלב 5: משימה 3 - מסך "היום" ✅ (merged ל-`main`)
מוזג ל-`main` (PR #3, ענף `feat/today-screen-slice1`). הקוד ב-`src/features/today/`:
- **שעון 24 שעות** (`DayClock`, `clock/`) — קשתות צבועות לפי סוג אירוע, gradations, מקרא (`ClockLegend`), קריאת שעה מרכזית, חלון יום לפי זמן ישראל (`todayDate.ts`, `clock/dayWindow.ts`).
- **כפתורי הזנה מהירה** (`QuickLogButtons`) — 🍼 😴 🧷 😊, פלטת צבעים מאוחדת לאירועים.
- **טיימר שינה + האכלה** (start/stop) — מקדים חלק ממשימה 4: אירוע פעיל (`end_time = null`) נמשך ומוצג חי.
- **Realtime sync בין הורים** (`useTodayEventsRealtime`) — מקדים משימה 8: סנכרון חי של אירועי היום בין מכשירים.
- שכבת נתונים: `api.ts`, `useTodayEvents.ts`.
- **בדיקות E2E:** `today.spec.ts`, `today-realtime.spec.ts`.

**משימה 5 הושלמה ומוזגה ל-`main`** (squash, 2026-08-06): `EstimateBanners.tsx` מחובר לפונקציית ה-Edge `estimates` (JWT של הקורא + RLS, ללא service_role) שמחשבת צפי האכלה (ממוצע אישי, סף 3 האכלות) וצפי שינה (wake window לפי גיל). טבלת נורמות-הגיל וצורת ה-wire משותפות עם הפרונטאנד דרך `estimate-contract.md`. הבנרים מציגים Loading / "אין מספיק נתונים" / צפי מוכן; המפתח מבוסס device-day + `day_start`.

---

### שלב 6: פיצול אירוע ההאכלה ✅ (ענף `feat/feeding-split`)
פיצול ההאכלה להנקה/בקבוק — **הכול ב-`metadata` של אירוע `feeding` קיים, ללא סוג אירוע חדש וללא migration** (השעון ממשיך לצייר קשת האכלה אחת בצבע אחד). הקוד ב-`src/features/today/`:
- **בחירת אופן האכלה** (`feedingChoice.ts`, `FeedingChoiceMenu` ב-`QuickLogButtons`) — לחיצה על 🍼 פותחת תפריט: הנקה שמאל · הנקה ימין · בקבוק. בחירה מתחילה טיימר עם `metadata.feeding_type` (+`side` בהנקה). ≤2 הקשות. רמז "צד אחרון" נשמר ב-localStorage.
- **כמות בבקבוק** (`FeedingAmountMenu`) — עצירת בקבוק פותחת תפריט גלילה של כמויות (10–300 מ״ל), נשמר ב-`metadata.amount` יחד עם `end_time`; "דלג" עוצר בלי כמות (הכמות אופציונלית). הנקה נעצרת מיידית.
- **תווית**: קשת ההאכלה מציגה את הפירוט ("האכלה · בקבוק · 120 מ״ל" / "האכלה · הנקה · ימין").
- טיפוסים: `FeedingType`, `BreastSide`, `FeedingMetadata` ב-`src/types/database.ts` (`EventType` ללא שינוי).
- **בדיקות E2E:** `today.spec.ts` מכסה זרימת בקבוק (כולל בחירת כמות) והנקה+צד.

---

## מה בתהליך כרגע 🔄

משימות 2 ו-3 נסגרו ומוזגו ל-`main` (כולל הקדמה חלקית של טיימר משימה 4 ו-Realtime משימה 8). פיצול ההאכלה (שלב 6) מוזג ל-`main` (PR #4). **מסך ההגדרות (משימה 12, שלב 7 למטה) הושלם ומוזג ל-`main` (PR #6)**, כולל גמר החלטת ה-scoping: `units` → per-user (`user_preferences`), `day_start` → per-child (`children`), timezone → אזור-המכשיר, `family_settings` → placeholder ריק (אין הגדרה שהיא באמת per-family). התיעוד המלא של ההחלטה: `settings-scoping-decisions.md`.

**עדכון 2026-08-06 — משימה 5 + תשתית ההגדרות מוזגו ל-`main`** (squash `feat/estimates-settings-integration`): (א) בנרי צפי האכלה/שינה חיים מול פונקציית `estimates`; (ב) ארבעת תתי-מסכי ההגדרות מחוברים בפועל (profile / baby & family / display / notifications) עם `api.ts`+hooks (חוב א' מגל 2 נסגר); (ג) RPC `family_members_with_identity` להצגת שם/אימייל אמיתי של חברי משפחה (חוב ב' נסגר); (ד) מחיקת חשבון אמיתית דרך פונקציית `delete-user` (חוב ד' נסגר); (ה) טסטי E2E לארבעת תתי-המסכים + בידוד זהות חברי משפחה (חוב ג' נסגר). תוקן גם באג אמיתי: שמירת פרטי תינוק לא הציגה באנר אישור.

**עדיין פתוח (נדחה במפורש):** שכבת ה-apply — החלת ערכת נושא/שפה(i18n+RTL)/יחידות (נשמרים אך לא מיושמים) ויישום `day_start`/אזור-המכשיר על השעון (ראה "חוב שכבת ה-apply" למטה).

**עדכון 2026-09-03 — תיקון ממצא U1 (קשת טיימר חיה בשעון "היום"):** קשת הטיימר שרץ, הקריאה במרכז והתווית לקורא-מסך בשעון 24 השעות לא התקדמו בזמן אמת — ה-tick-לשנייה חי רק בתוך `QuickLogButtons`, ולכן ה-`useMemo` של `DayClock` (שלכד `new Date()`) לא חושב מחדש. התיקון מרים tick משותף אחד לרכיב-האב `TodayContent` (הוק חדש `useNowTick`) שפעיל **רק** כשקיים טיימר פתוח, ומעביר `now` גם ל-`DayClock` וגם ל-`QuickLogButtons` (מקור אמת יחיד `isRunningTimerEvent` ב-`api.ts`). כדי לא לרנדר את כל העץ כל שנייה, האחים שאינם תלויי-tick (`TodayHeader`/`ClockLegend`/`EstimateBanners`) עטופים ב-`React.memo`. נוסף טסט E2E שמקבע את שעון הדפדפן (`page.clock`) ומקדם 10 דקות ומאמת שהזמן שחלף גדל בדיוק ב-10. עבר code-review עמוק ללא ממצאים.

**עדכון 2026-09-03 — תיקון באג תאריך לידה (bug T1, code review):** אימות "תאריך לידה לא בעתיד" ב-`BabyFamilyScreen.tsx` וב-`onboarding/schemas.ts` השווה מול תאריך UTC שחושב **פעם אחת בטעינת המודול** (`new Date().toISOString().slice(0,10)`) — לא מתאם לעקרון אזור-המכשיר של הפרויקט, וגם לא מתעדכן אחרי חצות בסשן ארוך. סמוך אחרי חצות בישראל (UTC+2/+3) תאריך לידה תקף באותו יום מקומי נדחה בטעות כ"עתידי". תוקן: שני הקבצים משתמשים עכשיו ב-helper הקיים `deviceDateString()` (`src/features/today/todayDate.ts`), מחושב בזמן הוולידציה (בתוך ה-`refine`) ולא בטעינת המודול. נוסף טסט יחידה (`src/features/onboarding/schemas.test.ts`, vitest + `vi.useFakeTimers`/`vi.stubEnv('TZ', ...)`) שמדמה את התרחיש. build/typecheck/lint/tests עברו; code-reviewer agent הורץ על הדיף.

**עדכון 2026-09-10 — סבב CR מלא #2 (Medium/Low) הורכב ונסקר (ענף `integration/cr2-fixes`):** המשך הסקירה הרטרואקטיבית של כל המערכת. 5 סוכנים מקבילים (worktree/ענף לכל אחד, מעל `origin/main` e71fc40), כל ממצא תוחקר-מחדש:
- **DB** (Opus): R1 — פיצול מדיניות RLS של `children`/`events` מ-`for all` לפר-פקודה (select/insert/update/delete, `with check` מפורש, סמנטיקה זהה) — מיגרציה `20260910000000`; D1 — ניקוי משפחות "יתומות" אחרי מחיקת המשתמש האחרון דרך `delete_orphaned_families()` (security definer, service_role-only, guard למשפחה עם חבר שנותר) — מיגרציה `20260910000001` + `delete-user/index.ts`; טסט בידוד `children-events-isolation.spec.ts`.
- **WK**: A1 — ממוצע שינה מחולק בימים-עם-שינה + הצגת "(מתוך N ימים)"; Dw-3 — דגלי `hasSleepData`/`hasFeedingData` פר-ערוץ; Dw-4 — הגבלת טיימר פעיל בשבוע-עבר ל-`min(now, weekEnd)`; Dw-5 — `now` יחיד ב-memo.
- **ST**: Q1 — מחיקת קובץ מת `SettingsPlaceholder.tsx`; Q2 — `preferencesDefaults.ts` כמקור-אמת יחיד; guard ל-`RangeError` ביחידות; optimistic UI ל-togglים.
- **TZ**: `todayDate.ts` — resolution עצלני של אזור-זמן (memoized לפי zone) במקום בטעינת מודול.
- **UI**: C1 — `aria-invalid`/`aria-describedby` ל-`Input` (8 call-sites); C2 — טסטים ל-`errorMessages`/`queryClient`; Button focus-visible+aria-busy; `eventMetadata.ts` — accessors מטיפוסים (jsonb לא צומצם); retry לא-מנסה-שוב על auth-missing; EstimateBanners `timeZone` מפורש.

**צינור:** כל סוכן → תיקון + טסטים. ואז **code-reviewer ייעודי על כל ענף בנפרד** (הסוכנים לא יכלו להריץ בעצמם) — כולם נקיים פרט לממצא אחד ב-UI (EstimateBanners החזיר דפוס tz-eager) ש**תוקן** בשלב האיחוד (`b1e16d2`, עצלני תואם TZ). **CR מאוחד** על כל ה-diff יחד = נקי. regression מקומי: tsc נקי, lint נקי, 47/47 unit. **חסום על המשתמש:** `supabase db push` (2 מיגרציות) על integ+prod, redeploy ל-`delete-user`, ואז E2E מלא — לפני מיזוג. **בוצע (2026-09-16):** מיגרציות נדחפו ל-integ+prod, `delete-user` נפרס מחדש, E2E 44/44 עבר, PR #27+#28 מוזגו ל-`main` — סבב CR #2 חי בפרודקשן.

**עדכון 2026-09-17 — תיקון מובייל במסך "היום" (ענף `fix/feeding-menu-clip-and-dismiss`, PR #29 → integ):** שלושה ליקויים שהתגלו בפתיחת האפליקציה בטלפון אמיתי, כולם ב-`QuickLogButtons.tsx`. (1) **תפריטי פופ-אפ נחתכו בקצה המסך** — התפריטים (בחירת האכלה / כמות בקבוק / מצב רוח) היו ממורכזים מעל כפתורם (`left-1/2 -translate-x-1/2`) וגלשו מעבר לקצה במסך צר (תפריט ההאכלה הימני נחתך). עוגנו לקצה הכפתור הקרוב (האכלה/כמות `right-0`, מצב-רוח `left-0`) כך שנפתחים פנימה ונשארים במסך. (2) **סגירה** — התפריט נסגר רק בלחיצה חוזרת על הכפתור; נוסף מאזין `pointerdown` (פעיל רק כשתפריט פתוח) שסוגר כל תפריט בלחיצה מחוץ לעטיפות (לחיצה על הכפתור/פריט מטופלת כרגיל), והתפריטים הפכו **בלעדיים הדדית**. (3) **סרגל כפתורים לא-רספונסיבי** — 4 כפתורים בגודל קבוע (5rem) גלשו מתחת ל-~356px ונשברו כבר ב-320px (iPhone SE). הסרגל הפך **נוזלי**: כל כפתור בעמודת `flex-1` שווה, העיגול `aspect-square w-full max-w-20` ממלא אותה אך נעצר על 5rem — מתאים לכל רוחב עד **רצפת 320px** (החלטת עיצוב חדשה: מתחת ל-320 התכווצות חלקה בלבד, ללא שבירה בשום רוחב אמיתי). בדיקות: tsc+lint נקיים, **code-reviewer ×3 נקי**, E2E `today.spec.ts` 17/17 (כולל 6 טסטים חדשים: סגירה-בחוץ ×2, בלעדיות, התאמת תפריט 375px, התאמת סרגל 320px).

**עדכון 2026-09-03 — תוקן: E2E תלוי-יום-בשבוע (סגירת פריט מעקב):** ב-`tests/e2e/today-historical.spec.ts` (טסט לחיצה על עמודת שבוע) הזרעת "אתמול" חושבה מ-`Date.now()` אמיתי, כך שהטסט נכשל כל אימת שהריצה קרתה ביום ראשון (אתמול = שבת = השבוע הקודם ב-לוח שבוע א'-ש', לכן השבוע הנוכחי ריק והכפתור המצופה לא קיים). זו הייתה שבריריות-טסט, לא באג אפליקציה. תוקן ע"י הקפאת שעון ה-Playwright (`page.clock.setFixedTime`) לרגע קבוע (יום רביעי) לפני ה-sign-in, וחישוב כל התאריכים ב-Node מאותו רגע קבוע במקום `Date.now()`. אותה שבריריות הפוטנציאלית (זניחה, רק בחלון 00:00–03:00 בימי ראשון) טופלה גם ב-`tests/e2e/week.spec.ts` לעקביות. פריט המעקב "Week column-click test failing" נסגר.

---

## מה עדיין נשאר לבנות

### MVP - לפי סדר בנייה הגיוני

| # | משימה | תלוי ב |
|---|---|---|
| 1 | ~~תשתית (scaffold + טבלאות)~~ | ~~-~~ |
| 2 | ~~Auth + Onboarding~~ (הושלם: בדיקות E2E עוברות + תיקון באג הזמנה + merged ל-`main`) | 1 |
| 3 | ~~מסך "היום" - שעון + כפתורי הזנה~~ (merged ל-`main`, PR #3) | 2 |
| 4 | ~~טיימר שינה (start/stop)~~ (מומש עם משימה 3 — שינה + האכלה) | 3 |
| 5 | בנר צפי שינה/האכלה — **placeholder בלבד, טרם מומש באמת** | 3, 4 |
| 6 | מסך "שבוע" - גרפים | 3 |
| 7 | מסך "השוואת ימים" | 3, 6 |
| 8 | ~~Realtime sync בין הורים~~ (מומש עם משימה 3) | 3 |
| 9 | תאב "מידע לפי גיל" + Edge Function | 2 |
| 10 | Tooltips AI על גרפים | 6, 7, 9 |
| 11 | PWA (manifest + service worker) | כל השאר |
| 12 | מסך הגדרות + העדפות משתמש (`screen-settings-spec.md`) | 2, 3 |

**פירוק משימה 12 (הגדרות) לתתי-משימות:**

| # | תת-משימה | תלוי ב | סוג |
|---|---|---|---|
| 12a | ~~מיגרציה + RLS + טסט: טבלת `user_preferences` (per-user)~~ ✅ נדחף ל-remote + טסט בידוד עובר | 2 | DB |
| 12b | ~~מיגרציה + RLS + טסט: טבלת `family_settings`~~ ✅ נדחף ל-remote + טסט בידוד עובר. **עודכן:** `units`+`day_start` הועברו החוצה (ראה scoping למטה); הטבלה נשארה כ-placeholder ריק | 2 | DB |
| 12c | ~~Settings hub UI (כניסה מגלגל שיניים ב-Today, drill-in ל-4 קטגוריות)~~ ✅ נבנה (typecheck+lint נקי), placeholders ל-12d–12g | 3 | FE |
| 12d | ~~תת-מסך "פרופיל וחשבון" (שם, אימייל, התנתקות, מחיקת חשבון = leave-only)~~ ✅ נבנה, typecheck+lint נקי | 12a, 12c | FE |
| 12e | ~~תת-מסך "תינוק ומשפחה" (שם/תאריך לידה, חברי משפחה, הזמנה)~~ ✅ נבנה, typecheck+lint נקי | 12c | FE |
| 12f | ~~תת-מסך "תצוגה ושפה" (שפה+RTL, ערכת נושא, **יחידות** = per-user; `day_start` = per-child, לא נחשף ב-MVP)~~ ✅ נבנה, typecheck+lint נקי | 12a, 12b, 12c | FE |
| 12g | ~~תת-מסך "התראות" (טוגלים per-user, ללא push בפועל ב-MVP)~~ ✅ נבנה, typecheck+lint נקי | 12a, 12c | FE |

> **חוב מעקב מ-גל 2 (לא חוסם):** (א) כל 4 תתי-המסכים מכניסים קריאות Supabase inline בקומפוננטה במקום פיצול `api.ts`+hook — refactor אופציונלי. (ב) 12e: רשימת חברי המשפחה יכולה להציג רק `user_id`+role, כי RLS לא חושף `display_name`/email של חברים אחרים — נדרש RPC/view עתידי כדי להראות שם/אימייל אמיתי. (ג) חסרים טסטי E2E ל-4 המסכים (Playwright, מול Supabase המתארח). (ד) מחיקת auth-user בפועל ב-12d מסומנת TODO — דורשת Edge Function.
>
> **חוב "שכבת ה-apply" (מ-scoping, לא חוסם):** הערכים נשמרים אך עדיין לא מיושמים ב-UI — (א) החלת ערכת נושא (dark/light), (ב) i18n/RTL חי לפי `language`, (ג) המרת יחידות לפי `units`, (ד) יישום `day_start` על השעון/הסיכומים (במקום חצות מקומית), (ה) מעבר משעון קשיח `Asia/Jerusalem` לאזור-המכשיר. הטסט `auth.spec.ts` עודכן להגיע להתנתקות דרך ה-Settings hub (הכפתור עבר לשם בגל 2).

**נדחה לאפיון נפרד:** מדיניות תוקף טוקן (בדיקת תוקף במקום אימות בכל כניסה) — `screen-settings-spec.md §8`; ניקוי משפחות יתומות (מחיקת חבר אחרון).

### Phase 0 — Beta hardening

**Sentry error monitoring (issue #20) — ✅ קוד מוכן, טרם הופעל בפרודקשן.**
נוסף ניטור שגיאות ל-Frontend (React) ול-Edge Functions (`estimates`, `delete-user`). **שגיאות בלבד** — ללא Session Replay וללא performance tracing (`tracesSampleRate: 0`), דרישת בטיחות PII (שמות תינוקות ב-UI). כל השליחה מגודרת: פועלת רק כאשר יש DSN **וגם** ה-environment הוא `production`/`integration`, כך ש-dev/test לעולם לא שולחים. `beforeSend` מנקה PII (email/username/ip, cookies, כותרות auth) בשני הצדדים; `sendDefaultPii: false`. נוסף `Sentry.ErrorBoundary` סביב עץ האפליקציה עם fallback על-פי מערכת העיצוב (במקום מסך לבן), ולכידת שגיאות Supabase/רשת דרך `QueryCache`/`MutationCache` ב-`queryClient` (מסננת מצבי auth צפויים). מפות מקור מועלות ל-Sentry ב-build רק כאשר `SENTRY_AUTH_TOKEN` קיים (אחרת ה-build רץ ללא שינוי).
>
> **הקשחת PII ב-URL/breadcrumbs (P1) — ✅ תוקן.** `scrubEvent` (Frontend + שני ה-Edge) ניקה קודם רק user/cookies/headers אך **לא** את `event.request.url` ולא את ה-breadcrumbs, בעוד ה-integrations המובנים של Sentry מצרפים אותם. זרימת ההצטרפות (`/join?token=…`, `/rest/v1/family_invites?token=eq.…`) ו-magic-link (`#access_token=…`) היו יכולים לדלוף טוקן פנימה — בניגוד להבטחה המפורשת של המודול ("tokens must never leave"). התיקון: מחיקת query string ו-hash מ-`request.url`, מ-`request.query_string`, ומכל URL ב-breadcrumb (`data.url`/`to`/`from` + `http.query`/`http.fragment`) — מוחקים את כל ה-query/hash שמרנית (האפליקציה לא צריכה אותם בדיווח). נוספו unit tests ל-`scrubEvent` (`src/lib/monitoring.test.ts`) המוודאים שטוקנים/מיילים/query strings מוסרים מ-user, headers, `request.url` ו-breadcrumb URLs; `vitest.config.ts` מזריק כעת את ה-defines של ה-build (`__APP_VERSION__`) כדי שהמודול ייטען בבדיקות.

> **חוב הפעלה (Netanel צריך להגדיר משתני סביבה — אין ערכים אמיתיים בריפו):**
> - **Vercel (Frontend):** `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` (הגדר `production` בפרוד ו-`integration` באינטג'), ובנוסף לבנייה בלבד: `SENTRY_AUTH_TOKEN` (secret), `SENTRY_ORG`, `SENTRY_PROJECT` — להעלאת source maps.
> - **Supabase (Edge Function secrets, דרך `supabase secrets set`):** `SENTRY_DSN`, `SENTRY_ENVIRONMENT`.
> - שמות המשתנים מתועדים ב-`.env.example`. ה-Edge Functions לא נפרסו במסגרת משימה זו (`supabase functions deploy` יבוצע בנפרד).

### לא ב-MVP (שלבים עתידיים)
- **Phase 2:** עקומות גדילה WHO + אבני דרך התפתחותיות
- **Phase 3:** טאב "בריאות" (חיסונים, תורים, תזכורות) + מלאי
- **Phase 4:** חלוקת משמרות, SOS, סיכום וואטסאפ, מצב מטפלת
- **עתידי:** Google Photos Picker API, Google OAuth

---

## החלטות פתוחות שנדחו

1. **Google OAuth** - לא הוגדר עדיין ב-Google Cloud Console. יוסף בהמשך מבלי לשנות קוד קיים
2. **עיצוב Empty State** - עקרונות קיימים, עיצוב מדויק יוגדר בבנייה
3. **מקור נתונים מדויק לתוכן AI** - אילו אתרים/מאגרים ה-Edge Function מצטט
4. **Subagents** - `code-reviewer`, `test-runner`, `rls-auditor` יוקמו כשיהיה מספיק קוד לתחזק

---

## נקודות חשובות לזכור

- **GitHub = מקור אמת יחיד** לכל המסמכים וה-skills
- **כל שינוי סכמה** = migration דרך Supabase CLI, לא ידנית ב-Dashboard
- **Caregiver role** = לא קיים ב-MVP, יוחזר רק עם Phase 4
- **כל טבלה חדשה** = RLS + GRANT + Realtime publication (שלושה שלבים, לא אחד)
- **Timezone** = שמירה ב-UTC, חישוב "גבול יום" לפי זמן ישראל בצד הלקוח
