# מסמך העברה: מערכת הדוחות (survey-sentry-pro)

**למי:** מי שמנהל את המערכת הראשית של העסק.
**המטרה:** לחבר את מערכת הדוחות למערכת הראשית **בלי להפסיק את המערכת שעובדת היום**.
**מצב נכון ל:** 15.11.2026. הקוד הוא בדיוק מה שרץ היום ב־production (ענף `main`, commit `3f31e90`).

---

## 1. בקצרה

* **מה זה:** אפליקציית ווב בעברית (RTL) שבנויה קודם כל לטלפון. עובדים בשטח ממלאים בה סקרים, מצלמים, חותמים, ומפיקים דוח PDF.
* **8 סוגי דוחות:** סקר נגישות מתו״ס ושירות, סקר בטיחות מוסדות חינוך, סקר בטיחות כללי, מבדק משרד הרווחה, בדיקת יציבות אלמנטים, סקר סיכונים, טופס 8 (נגישות), וטופס 8 לאירוע המוני. הרשימה המלאה נמצאת ב־`src/lib/types.ts` (`SURVEY_TYPES`).
* **אין שרת משלה.** זו אפליקציית צד־לקוח בלבד (React SPA). כל צד השרת הוא **Supabase**: התחברות (Auth), מסד נתונים Postgres והרשאות ברמת שורה (RLS). אין Storage buckets ואין Edge Functions.
* **עובדת גם בלי אינטרנט.** דוחות נשמרים קודם במכשיר (IndexedDB) ומסונכרנים לשרת ברקע.
* **בשימוש פעיל.** ביום ההעברה היו במערכת 277 דוחות ו־5 משתמשים. טבלת הדוחות שוקלת כ־457MB, כי התמונות שמורות בתוכה.

---

## 2. מה יש בתיקייה

```
survey-sentry-pro-handoff/
├── README-HANDOFF.md        ← המסמך הזה
├── database/
│   └── schema-current.sql   ← מבנה מסד הנתונים כפי שהוא רץ היום, בקובץ אחד
└── project/                 ← כל קוד המקור, מוכן להרצה
    ├── src/                 ← הקוד (pages/, components/, lib/, contexts/)
    ├── public/              ← אייקונים ו־manifest
    ├── docs/handoff/        ← עותק של המסמך הזה ושל schema-current.sql
    ├── .github/workflows/   ← ה־CI שמפרסם היום ל־GitHub Pages
    ├── *.sql                ← סקריפטים היסטוריים שהורצו ידנית (ראו סעיף 6)
    ├── package.json, package-lock.json, vite.config.ts, tailwind.config.ts ...
    └── src/empty-folder/    ← מסמכי מקור של ת״י 1918 (‏38MB), ראו סעיף 10
```

**לא נכלל בכוונה:** סיסמאות, מפתח `service_role`, ה־secrets של GitHub, ונתוני הלקוחות (דוחות, משתמשים). את הגישה לאלה מעבירים בנפרד ובערוץ מאובטח (סעיף 11).

---

## 3. טכנולוגיות

| שכבה | טכנולוגיה |
|---|---|
| UI | React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui (Radix) |
| ניתוב | `react-router-dom` עם **HashRouter** (כתובות בצורה `/#/report/123`) |
| צד שרת | Supabase: Auth (אימייל וסיסמה), Postgres 17 עם RLS |
| PDF | `jspdf` ו־`html2canvas` (ההפקה רצה בדפדפן) |
| Offline | IndexedDB (`survey-sentry-offline`) ו־localStorage |
| בדיקות | Vitest ו־Testing Library |
| גופנים | Heebo ו־Assistant מ־Google Fonts (CDN) |

---

## 4. הרצה מקומית

דרוש Node 20 (זו הגרסה שה־CI משתמש בה).

```bash
cd project
npm ci
```

```bash
npm run dev        # http://localhost:8080
```

```bash
npm test           # בדיקות יחידה
```

```bash
npm run build      # תוצר סטטי בתיקייה dist/
```

**משתני סביבה** (קובץ `.env.local` או משתני ה־CI):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key, בפורמט JWT שמתחיל ב-eyJ>
```

בלי המשתנים האלה האפליקציה מתחברת אוטומטית לפרויקט ה־Supabase של production. הסבר ואזהרה בסעיף 10.

---

## 5. איך המערכת רצה היום

```
push ל-main ב-GitHub  →  GitHub Actions (.github/workflows/deploy.yml)
                       →  npm ci && npm run build
                       →  dist/ מתפרסם לענף gh-pages  →  GitHub Pages
```

* **Repository:** `razshemer9-gif/survey-sentry-pro` ב־GitHub (פרטי).
* **כתובת:** GitHub Pages, נתיב `/survey-sentry-pro/`. כנראה `https://razshemer9-gif.github.io/survey-sentry-pro/` (כדאי לאמת מול רז).
* **Supabase:** פרויקט `dkbujtvotivpqyomyhnf`, אזור `ap-southeast-2` (סידני), Postgres 17.
* **Secrets ב־GitHub:** `VITE_SUPABASE_URL` ו־`VITE_SUPABASE_ANON_KEY`.
* **Base path:** ב־build של production, ‏`vite.config.ts` מגדיר `base: "/survey-sentry-pro/"`. אם מארחים בכתובת אחרת צריך לשנות את זה (למשל ל־`"/"` בתת־דומיין).
* בגלל ה־HashRouter **לא צריך** rewrite rules בשרת. כל קובץ סטטי עובד.

---

## 6. מסד הנתונים

**הקובץ המחייב הוא `database/schema-current.sql`.** הוא נבנה מקריאה (בלבד) של מסד הנתונים החי, וכולל כמה דברים שנעשו ישירות בממשק של Supabase ואינם באף קובץ אחר: הטבלה `report_summaries`, הטריגר שמעדכן אותה, והגרסה הנוכחית של `list_report_summaries()`.
קובצי ה־`.sql` שבשורש הפרויקט הם היסטוריה. אין להריץ אותם על פרויקט חדש.

| טבלה | מה יש בה | הרשאות (RLS) |
|---|---|---|
| `reports` | שורה לכל דוח. כל הדוח, **כולל התמונות כ־base64**, נמצא בעמודת `data` (jsonb) | עובד: רק שלו. owner/admin: הכול (בלי INSERT בשם אחרים) |
| `report_summaries` | תקציר קל לכל דוח (שם, כתובת, תאריך, סטטוסים). מתעדכן בטריגר, האפליקציה לא כותבת אליו | קריאה בלבד, באותו כלל |
| `profiles` | משתמש, אימייל, שם ותפקיד (`owner` / `admin` / `employee`) | כל אחד רואה את עצמו. owner/admin רואים ומנהלים את כולם |
| `user_settings` | הגדרות אישיות: פרטי חברה, לוגו, חותמת וחתימה, תבניות דוח לכל סוג | כל משתמש רק את שלו |
| `user_templates` | תבניות צ׳קליסט אישיות | כל משתמש רק את שלו |
| `accessibility_requirements` | מאגר הדרישות והליקויים (ת״י 1918 ובטיחות), 113 שורות | כולם קוראים, owner/admin כותבים |

**חשוב לדעת על הנתונים:**
* `reports.device_id` הוא **ה־`auth.users.id` של כותב הדוח**, שמור כ־text. השם נשאר מגרסה ישנה.
* `created_at` ו־`updated_at` הם **מילישניות מאז 1970** (bigint), לא timestamp.
* המבנה של `reports.data` מוגדר ב־`SurveyReport` שב־`src/lib/types.ts`.
* פונקציות: `get_current_user_role()`, `handle_new_user()` (טריגר שיוצר פרופיל לכל משתמש חדש), `prevent_role_escalation()`, `sync_report_summary()`, `list_report_summaries(p_limit)`. יש גם `list_my_reports()`, שקיימת במסד אבל הקוד כבר לא קורא לה.

**הקריאות של האפליקציה ל־Supabase** מרוכזות בקבצים האלה:
`src/lib/supabase.ts` (יצירת ה־client), `src/lib/reports-remote.ts` (דוחות), `src/lib/storage.ts` (הגדרות ותבניות), `src/lib/standards-storage.ts` (מאגר הדרישות), `src/lib/auth.ts` ו־`src/contexts/AuthContext.tsx` (התחברות ותפקיד), `src/pages/UserManagement.tsx` (ניהול משתמשים).

---

## 7. משתמשים והרשאות

* התחברות עם אימייל וסיסמה של Supabase Auth. אין ספק חיצוני (Google וכו׳).
* כל מי שנרשם מקבל אוטומטית תפקיד `employee`. owner או admin משדרגים אותו במסך `/admin/users`.
* מסכים לאדמין בלבד: `/standards` (עריכת מאגר הדרישות) ו־`/admin/users`.
* **רשימות אימייל קבועות בקוד:** שני פיצ׳רים מוצגים רק לשני אנשים:
  * `src/lib/static-calc-access.ts`: קישור לאפליקציית החישובים הסטטיים (פרויקט נפרד בכתובת `https://shemer-static-calc.web.app/`, **לא חלק מהחבילה הזו**).
  * `src/lib/eng-ui.ts`: עיצוב חדש שנמצא בניסוי.

---

## 8. אפשרויות לחיבור למערכת הראשית

הסדר הוא מהפשוט והבטוח אל המורכב. מומלץ להתחיל ב־א׳, שאפשר לעשות בלי לגעת בכלום שרץ היום.

**א׳. קישור מהמערכת הראשית לאפליקציה בתת־דומיין (מומלץ כצעד ראשון)**
מארחים את `dist/` בכתובת של העסק, למשל `reports.<domain>`, ומוסיפים קישור בתפריט של המערכת הראשית. מצביעים על **אותו פרויקט Supabase** שעובד היום. כך הכתובת הישנה והחדשה עובדות במקביל על אותם נתונים, והמשתמשים עוברים בהדרגה. כל מה שצריך: build עם `base: "/"`, שני משתני הסביבה, ו־DNS.

**ב׳. הטמעה בתוך iframe**
אפשרי, אבל בעבר היו בעיות בהורדת PDF מתוך iframe (פירוט ב־`.lovable/plan.md`). גם המצלמה ובחירת הקבצים צריכות הרשאות `allow` מתאימות. לא מומלץ בלי בדיקה מסודרת על טלפונים.

**ג׳. התחברות אחת (SSO) בין המערכות**
* אם גם המערכת הראשית עובדת עם Supabase, אפשר לאחד לאותו פרויקט Auth, או להעביר session.
* אם יש לה ספק זהות אחר (Google Workspace, Azure AD, Auth0 וכו׳), אפשר לחבר אותו ל־Supabase Auth דרך OAuth, SAML או Third-party Auth (תלוי בתוכנית של Supabase). השינוי בצד האפליקציה מרוכז ב־`src/lib/auth.ts` וב־`src/pages/AuthPage.tsx`.
* צריך לשמור על הקשר `profiles.user_id = auth.users.id`, כי כל ההרשאות נשענות עליו.

**ד׳. שימוש בנתוני הדוחות מהמערכת הראשית**
המערכת הראשית יכולה לקרוא דוחות מ־Supabase דרך ה־REST API.
* `report_summaries` מתאימה לרשימות ולדשבורדים: קלה ובלי תמונות.
* `reports` מחזירה את הדוח המלא, ושורה אחת יכולה לשקול מגה־בייטים.
* קריאה מצד שרת עם מפתח `service_role` עוקפת את ה־RLS. המפתח הזה **לעולם לא** נכנס לקוד של דפדפן.

**ה׳. מיזוג מלא של הקוד לתוך המערכת הראשית**
רלוונטי רק אם המערכת הראשית בנויה ב־React. נקודות שצריך לטפל בהן: ה־HashRouter מול הנתב של המערכת הראשית, ה־CSS הגלובלי ב־`src/index.css` ומשתני ה־theme ב־`tailwind.config.ts`, ה־alias ‏`@` → `src/`, וגרסת React 18. זה הכי הרבה עבודה והכי הרבה סיכון. מומלץ רק אחרי שא׳ עובד.

---

## 9. מעבר בלי להשבית את מה שרץ היום

1. **לא לשנות** את ענף `main`, את ענף `gh-pages` או את פרויקט ה־Supabase של production בזמן העבודה. כל push ל־`main` מפרסם מיד גרסה חדשה למשתמשים.
2. **לפתח מול סביבה נפרדת:** פרויקט Supabase חדש ריק, להריץ עליו את `database/schema-current.sql`, ולהריץ מקומית עם משתני הסביבה שלו. מאגר הדרישות מתמלא לבד בפעם הראשונה ש־owner או admin פותח את המסך `/standards`.
3. **כשהחיבור מוכן,** לפרסם את האפליקציה במיקום החדש **מול ה־Supabase הקיים**. שתי הכתובות עובדות במקביל על אותם נתונים.
4. **לפני שמורידים את הכתובת הישנה:** לבקש מכל המשתמשים לפתוח את האפליקציה בכתובת הישנה כשיש אינטרנט, ולוודא שאין דוחות שממתינים לסנכרון. **IndexedDB נשמר לפי כתובת (origin)**, ולכן דוח שנשמר במכשיר ועוד לא עלה לשרת **לא יופיע** בכתובת החדשה. הגדרות ותבניות כבר שמורות בשרת, ואותן לא מאבדים.
5. **רק אם צריך להעביר את מסד הנתונים** לחשבון Supabase אחר: הדרך הבטוחה היא **העברת הפרויקט כולו** (Transfer project) לארגון של העסק. היא שומרת את המשתמשים, הסיסמאות והנתונים בלי השבתה ובלי לשנות קוד. העתקה ידנית ל־Postgres אחר דורשת גם להעביר את `auth.users` עם ה־hash של הסיסמאות, ולעדכן את הקוד (סעיף 10).

---

## 10. דברים שכדאי לדעת מראש

* **ערכי ברירת מחדל קבועים ב־`src/lib/supabase.ts`:** אם `VITE_SUPABASE_URL` חסר, הקוד מתחבר לפרויקט של production. אם `VITE_SUPABASE_ANON_KEY` חסר **או מתחיל ב־`sb_`** (הפורמט החדש של Supabase), הקוד משתמש במפתח anon הקבוע של **הפרויקט הנוכחי**. המשמעות: מעבר לפרויקט Supabase אחר דורש להגדיר מפתח anon בפורמט JWT (`eyJ...`) **או** לערוך את הקובץ. אחרת יתקבל 401.
* **התמונות שמורות בתוך מסד הנתונים** כ־base64. זה עובד, אבל מנפח את השורות. אם בהמשך רוצים לשפר, כדאי להעביר אותן ל־Supabase Storage. זה לא נדרש לחיבור.
* **`src/empty-folder/`** מכיל את מסמכי המקור של ת״י 1918 (Word, ‏38MB) שמהם נכתב `src/lib/standards-data.ts`. הקוד לא טוען אותם והם לא נכנסים ל־build. זה חומר רקע בלבד.
* **`.agents/` ו־`.lovable/`** הם קבצים של כלי פיתוח (AI) ולא נדרשים להרצה.
* **Google Fonts** נטענים מ־CDN. אם במערכת הראשית יש Content-Security-Policy, צריך לאשר את `fonts.googleapis.com` ואת `fonts.gstatic.com`, וגם את כתובת ה־Supabase.
* **אפליקציית החישובים הסטטיים** היא פרויקט נפרד (Firebase). כאן יש רק קישור אליה.

---

## 11. אבטחה וגישה

* מפתח ה־anon שמופיע בקוד **ציבורי מטבעו** (הוא נשלח לכל דפדפן). ההגנה על הנתונים היא ה־RLS שבסעיף 6.
* **גישות שיש לבקש מרז בנפרד:**
  1. GitHub: הוספה כ־collaborator ל־repository. כך מקבלים גם את כל ההיסטוריה (213 PRs).
  2. Supabase: הזמנה כחבר בארגון/פרויקט, או העברת הפרויקט לארגון של העסק.
  3. הדומיין / DNS, אם מארחים בתת־דומיין.
* **שיפור קטן שמומלץ (לא דחוף):** ל־policy ‏`"System can insert profiles"` על `profiles` יש `with check (true)`. הטריגר `handle_new_user` רץ כ־`security definer` ולא תלוי ב־policy הזה, ולכן אפשר לצמצם אותו ל־`with check (auth.uid() = user_id and role = 'employee')`. הסיכון היום נמוך, כי לכל משתמש קיים כבר יש פרופיל.

---

## 12. שאלות

בעל המערכת: רז. כל ההיסטוריה של השינויים, עם הסבר לכל אחד, נמצאת ב־pull requests של ה־repository ב־GitHub.
