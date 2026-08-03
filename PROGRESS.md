# סיכום התקדמות - Baby Tracker
**תאריך עדכון אחרון:** אוגוסט 2026

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

## מה בתהליך כרגע 🔄

אין משימה פעילה. משימה 2 נסגרה במלואה (auth + onboarding + בדיקות E2E + תיקון באג ההזמנה + merge ל-`main`). הצעד הבא: **משימה 3** — מסך "היום" (שעון 24 שעות + כפתורי הזנה).

---

## מה עדיין נשאר לבנות

### MVP - לפי סדר בנייה הגיוני

| # | משימה | תלוי ב |
|---|---|---|
| 1 | ~~תשתית (scaffold + טבלאות)~~ | ~~-~~ |
| 2 | ~~Auth + Onboarding~~ (הושלם: בדיקות E2E עוברות + תיקון באג הזמנה + merged ל-`main`) | 1 |
| 3 | מסך "היום" - שעון + כפתורי הזנה | 2 |
| 4 | טיימר שינה (start/stop) | 3 |
| 5 | בנר צפי שינה/האכלה | 3, 4 |
| 6 | מסך "שבוע" - גרפים | 3 |
| 7 | מסך "השוואת ימים" | 3, 6 |
| 8 | Realtime sync בין הורים | 3 |
| 9 | תאב "מידע לפי גיל" + Edge Function | 2 |
| 10 | Tooltips AI על גרפים | 6, 7, 9 |
| 11 | PWA (manifest + service worker) | כל השאר |
| 12 | מסך הגדרות + העדפות משתמש (`screen-settings-spec.md`) | 2, 3 |

**פירוק משימה 12 (הגדרות) לתתי-משימות:**

| # | תת-משימה | תלוי ב | סוג |
|---|---|---|---|
| 12a | מיגרציה + RLS + טסט: טבלת `user_preferences` (per-user) | 2 | DB |
| 12b | מיגרציה + RLS + טסט: טבלת `family_settings` (per-family, `units`+`day_start`) | 2 | DB |
| 12c | Settings hub UI (כניסה מגלגל שיניים ב-Today, drill-in ל-4 קטגוריות) | 3 | FE |
| 12d | תת-מסך "פרופיל וחשבון" (שם, אימייל, התנתקות, מחיקת חשבון = leave-only) | 12a, 12c | FE |
| 12e | תת-מסך "תינוק ומשפחה" (שם/תאריך לידה, חברי משפחה, הזמנה, בורר ילד) | 12c | FE |
| 12f | תת-מסך "תצוגה ושפה" (שפה+RTL, ערכת נושא = per-user; יחידות+שעת-יום = per-family) | 12a, 12b, 12c | FE |
| 12g | תת-מסך "התראות" (טוגלים per-user, ללא push בפועל ב-MVP) | 12a, 12c | FE |

**נדחה לאפיון נפרד:** מדיניות תוקף טוקן (בדיקת תוקף במקום אימות בכל כניסה) — `screen-settings-spec.md §8`; ניקוי משפחות יתומות (מחיקת חבר אחרון).

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
