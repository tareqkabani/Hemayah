# جرد طبقة المحتوى — 7 أغسطس 2026

> حصر كل القوائم والنصوص المضمّنة في الكود، تمهيداً لتطبيق حزمة تسليم بوابة الأدمن وطبقة محتوى المنصّة
> (`~/Downloads/تسليم 7 أغسطس/design_handoff_admin_portal/`). أُعدّ آلياً بمسح شامل للبوابات الـ15
> والمهاجرات الـ66. يُحدَّث أثناء التنفيذ: كل موضع يُحوَّل إلى `reference_items`/`notification_templates`
> يُشطب من هنا.

---

## Section A — الحالة الحالية لحزمة `@hemaya/domain`

المسار: `hemaya-app/packages/domain/` — `main: ./src/index.ts`، تعتمد على `@hemaya/supabase` (لأنواع enums المولَّدة).

| الملف | ما يُمركزه |
|---|---|
| `src/enums.ts` | `CASE_STATUS` (13 حالة)، `CATEGORY` (5 فئات)، `RISK_LEVEL` (4)، `CASE_SOURCE` (3)، `APPLICANT_ROLE` (5)، `PROTECTION_TYPES_14` (13 نوع حماية م14 + علم `dur`)، `PROTECTION_TYPE_LABELS_14` |
| `src/regions.ts` | `REGION_LABEL` (13 منطقة ↔ `region_code`) + `regionDisp()` |
| `src/roles.ts` | `ROLE_LABEL` (21 دور ↔ `app_role`)، `PORTALS` (14 بوابة: app/title/port/roles) |
| `src/materials.ts` | `REFERRAL_AUTHORITY_LABEL` (8 جهات ↔ `referral_authority`)، `REFERRAL_SERVICES` (7 خدمات إحالة) |
| `src/durations.ts` | `DURATIONS` (3 مدد موحّدة) + `LEGACY_DURATION_*` + `isCustomDuration()` / `durationDays()` |
| `src/sla.ts` | `SLA` (9 قواعد مدد نظامية)، حساب أيام العمل (الأحد–الخميس) |
| `src/case-state.ts` | `CASE_TRANSITIONS` (آلة حالة القضية)، `SPECIAL_TRACKS` (3 مسارات) |
| `src/decision-state.ts` | `DECISION_STATUS` (6)، `DECISION_TRANSITIONS`، `DECISION_ACTION_ROLE`، `DECISION_STAGES` (6 مراحل)، `DECISION_MAJORITY=4`، `DECISION_VOTING_SEATS=7`، `nextDecisionAction()` (نصوص إجراءات) |
| `src/grievance.ts` | `GRIEVANCE_STAGES` (4 مراحل م21)، `GRIEVANCE_SLA_DAYS=10`، `grievanceNextAction()` |
| `src/portal-config.ts` | `PAPER_INTAKE_LABEL`، `STAGE_FLOW` (6 مراحل)، `PortalConfig` لكل بوابة + `PORTAL_CONFIGS` — يتضمّن `notifCategories`، `messaging.parties`، `deliveryReceipt`، `strings` |

**حارس التغطية — موجود لكنه جزئي:**
- `packages/domain/src/label-coverage.test.ts` — يقارن `ROLE_LABEL / CASE_STATUS / CATEGORY / RISK_LEVEL / CASE_SOURCE / REFERRAL_AUTHORITY_LABEL / REGION_LABEL` مع `Constants.public.Enums` من `types.gen`؛ ويتحقّق من اتساق `CASE_TRANSITIONS` و`PORTALS.roles` و`REFERRAL_SERVICES.authority`. **لا يغطّي القوائم غير المرتبطة بـenum** (أنواع الحماية، المدد، أسباب الرفض…) — وهي بالضبط التي درفت.
- اختبارات مساندة: `portal-config.test.ts`، `decision-state.test.ts`، `durations.test.ts`.

**نمط جيد يُحتذى:** `packages/study-eval/src/lookups.js` يعيد تصدير `PROTECTION_TYPES_14 as PROTECTION_TYPES` و`DURATIONS` من الدومين.

---

## Section B — قوائم ما زالت مضمّنة inline

### B1. أنواع الحماية (م14) — **تعارض فعلي مع الدومين**
| file:line | القائمة | مكافئ في الدومين؟ |
|---|---|---|
| `apps/center-officer/components/StudyEvalPortal.jsx:69` | `PTYPES` — 13 نوع بصياغة مختلفة («تغيير أرقام هواتفه»…) | نعم — drift صياغة |
| `apps/decision/components/decision-store.js:30` | `PROTECTION_TYPES` — **6 أنواع فقط** ومختلفة تماماً | تعارض صريح |
| `apps/center-officer/components/referral-bus.js:17` (+ نسخ متطابقة في `security-admin`, `hr`, `health`) | `M13` — 12 تدبير م14 بمفاتيح/مراجع مواد | جزئياً (`REFERRAL_SERVICES` فيه 7) |
| `apps/competent-entities/components/branch-roles.jsx:76` | `types: [...]` — 3 أنواع inline | نعم |
| `apps/health/components/HealthPortal.jsx:19` / `apps/hr/components/HrPortal.jsx:19` | `SERVICE` — خدمات م14 لكل وزارة مع `ref` المادة | جزئياً |

### B2. أسباب الرفض / الاستجابة / الإغلاق
| file:line | القائمة | مكافئ؟ |
|---|---|---|
| `apps/center-officer/components/StudyEvalPortal.jsx:84` | `REJ` — 5 أسباب رفض (نسخة من `study-eval/lookups.js:8`) | في `study-eval` لا في الدومين |
| `packages/study-eval/src/lookups.js:8` | `REJECT_REASONS` (5) | خارج الدومين |
| `apps/triage/components/TriagePortal.jsx:183` | `RESPONSE_OPTIONS` — 8 صيغ ردّ/إغلاق جاهزة | لا |
| `apps/triage/components/TriagePortal.jsx:196` | `RESPONSE_REASON` — خريطة نص→كود سبب الحفظ | لا |
| `apps/seeker/components/real-detail.jsx:195-196` | نطاقات التظلّم | لا |

### B3. المدد
| file:line | القائمة | مكافئ؟ |
|---|---|---|
| `apps/decision/components/DecisionPortal.jsx:124` | `["30 يوماً","90 يوماً","إلى حين انتهاء القضية"]` — **لا تطابق `DURATIONS`** | نعم |
| `apps/center-officer/components/PaperIntakePortal.jsx:280` | مطابقة نصّاً لكن غير مستوردة | نعم |
| `apps/center-officer/components/StudyEvalPortal.jsx:255` | صياغة ثالثة | نعم |
| `apps/center-officer/components/OversightPortal.jsx:179` | `['5 أيام','10 أيام','حتى العودة']` — مدد التفويض | لا |

### B4. الفئات وصفات مقدّم الطلب (تكرار `CATEGORY` / `APPLICANT_ROLE`)
- `apps/seeker/components/screens-detailed.tsx:286,291` — الصفات والفئات inline
- `apps/center-officer/components/PaperIntakePortal.jsx:367,375,180` — نفس القائمتين (بصيغة `مُبلِّغ`)
- `apps/competent-entities/components/RecommendationForm.jsx:154,338` — الفئات
- `apps/api/src/schemas.ts:6-7` — `CATEGORY_VALUES` + `APPLICANT_ROLE_VALUES` (مكرّرة عمداً بتعليق موثّق) · `openapi.ts:61` · `schemas.ts:108` (`REFERRAL_AUTHORITIES`)
- **8 نسخ منفصلة** من خرائط عربي↔enum للفئات: `apps/seeker/lib/seeker-actions.ts:12-16`، `apps/center-officer/lib/paper-intake-actions.ts:8-13,65`، `apps/competent-entities/lib/entity-actions.ts:6`، `apps/center-officer/components/execution-live.js:8`، `apps/seeker/components/real-detail.jsx:14`، `apps/interior/components/InteriorPortal.jsx:25`، `apps/competent-entities/components/recommendation-store.js:11`، `packages/study-eval/src/map-task.js:6`

### B5. الجهات المختصة الخمس — 8 نسخ inline
- `apps/seeker/components/screens-detailed.tsx:312` · `apps/triage/components/TriagePortal.jsx:471` · `apps/center-officer/components/PaperIntakePortal.jsx:51,54` · `apps/competent-entities/components/RecommendationForm.jsx:59` (مسمّيات مختصرة مختلفة) · `CompetentEntitiesPortal.jsx:358-361` (`ENT_NAMES/ENT_ORDER/ENT_OFFICERS/ENT_ROLE`) · `CompetentEntitiesPortal.jsx:154` (`ENT_MSG_AUTHOR`) · `TriagePortal.jsx:51` (`ENT_BR_PREFIX`) · `branch-roles.jsx:16` (`ENT_BRANCHES`)

### B6. الوقائع/الجرائم
- `RecommendationForm.jsx:66` + `PaperIntakePortal.jsx:61` — `WAQIA` (10 أنواع، نسختان)
- `RecommendationForm.jsx:191,347` / `PaperIntakePortal.jsx:220` — نوع الجريمة (كبيرة/ليست كبيرة)

### B7. مستويات الخطر / الحالات المحلية
- `RecommendationForm.jsx:208` / `PaperIntakePortal.jsx:237` — `['شديد','متوسط','منخفض']` — **لا تطابق `RISK_LEVEL`** (منخفض/متوسط/مرتفع/حرِج)
- `ExecutionPortal.jsx:48` / `SecurityPortal.jsx:71` — `RISK_TONE` بصياغة ثالثة (`'حرج'/'عالٍ'`…)
- حالات الإحالة الست — **6 نسخ**: `HealthPortal.jsx:32` / `HrPortal.jsx:42` / `referral-bus.js:37` (×4)
- حالات نصّية عربية كمفاتيح: `SecurityPortal.jsx:72,73` · `ExecutionPortal.jsx:49` · `InteriorPortal.jsx:16` · `CompetentEntitiesPortal.jsx:19,280` · `TriagePortal.jsx:38` · `seeker/screens-detailed.tsx` · `real-detail.jsx:37` (`GRV_STATUS`)
- **تعارض:** `real-detail.jsx:24` (`DONE`) مقابل `screens-detailed.tsx` (`STAGE_INDEX`) — خريطتا حالة→مرحلة متعارضتان (`classified`=4 مقابل 3، `rejected`=5 مقابل 4، `closed`=5 مقابل 6)

### B8. المناطق / المدن
- `TriagePortal.jsx:50` — `CITY_REGION` (16 مدينة→منطقة، لا مكافئ)
- `InteriorPortal.jsx:28` (`FLAG` 5 دول) · `InteriorPortal.jsx:253` (`BASES` — 4 أسانيد م6)
- ✅ `branch-roles.jsx:14` يستورد `REGION_LABEL` من الدومين

### B9. قوائم إجرائية / نماذج أخرى (مختارات)
- `TriagePortal.jsx:175,179` (قنوات/نتائج محضر الاتصال) · `:287` (`CHECK_ITEMS` — 5 بنود الفحص الشكلي) · `:360` (`DEC`) · `:28,33` (أشخاص وهميون)
- `seeker/screens-detailed.tsx:90` (`EC_RELATIONS` — 7 صلات) · `:112` (`MANUAL_EMPTY`)
- `real-detail.jsx:15` + `screens-detailed.tsx:28` — `STAGES` (نسختان شبه متطابقتين؛ يقابل `STAGE_FLOW`)
- `SecurityPortal.jsx:44,63,24,31,37` — `MEASURES/RKIND/ROLES/OFFICERS/SRC`
- `ExecutionPortal.jsx:28,352` — `STEPS` / `AUTH_GROUPS`
- `OversightPortal.jsx:40,50,63,244,293,354` — `KPIS` (قيم ثابتة مُلفّقة) وغيرها
- `AttorneyGeneralPortal.jsx:182,694,780` · `HealthPortal.jsx:347,348` (`VIA/FIT`) · `HrPortal.jsx:32` (`CFG`)
- `decision-store.js:14,23,24,27` (`SEATS/MEMBER_SEATS/VOTING_SEATS/PREPARERS`) · `decision-screens.jsx:71` (`ATT_GROUPS`) · `DecisionPortal.jsx:57` (`NOTIF_FILTERS`) · خيارات التصويت في 3 مواضع
- قوائم المرفقات: `RecommendationForm.jsx:255,371` + `PaperIntakePortal.jsx:288-289` + `branch-roles.jsx:116`
- `apps/landing/public/gateway-core.js:42` — `PORTALS` (19 رابطاً، static لا يستورد — النسخة الخفية المعروفة)
- `TechOfficePortal.jsx:477` (`NOTIF_CAT`) · `packages/ui/src/shell/NotificationsScreen.jsx:10` (`CAT_STYLE`) · `packages/ui/src/patterns.jsx:69` (`RISK`)
- `packages/study-eval/src/screens.jsx:10` (`TRACK`) + `map-task.js:5` (`TRACK_AR`) · `screens.jsx:610,646,701`
- `packages/auth/src/adapters/nafath.ts:4-5` — أسماء توليد الهويات التجريبية
- مجموعات التاريخ `["اليوم","أمس","الأقدم"]` — **4 نسخ**: `DecisionPortal.jsx:447` · `seeker/realtime-screens.tsx:197` · `ui/shell/NotificationsScreen.jsx:101` · `ui/shell/util.jsx:37-39`

---

## Section C — نصوص إشعارات ورسائل ولافتات وإقرارات مضمّنة

### C1. قوالب الإشعارات داخل SQL — المصدر الأساسي: **~47 موضع `insert into notifications` في 28 ملف هجرة**
كلّها عناوين/أجساد عربية حرفية داخل دوال `SECURITY DEFINER`. أبرزها:
- `20260704000007_triage.sql:98-102` — 3 عناوين قرار فرز عبر `case when`
- `20260704000011_council.sql:240-244` — نصّا قرار المجلس + تنويه حق التظلّم
- `20260704000012_execution.sql:31-33` — «فُعّلت حمايتك» + توقيع الاتفاقية (م11)
- `20260705000002_lifecycle_review.sql:39-41` — توصية دورة الحياة (م18)
- `20260710000001_seeker_secret_collision_safe.sql:65` — إشعار التقديم + الرمز السري
- `20260715000001_decision_approval_cycle.sql:196,205` — حلقتا الاعتماد
- `20260716000001_study_eval_portals.sql:116,124,151,248` — إسناد/مهلة/تسليم
- `20260719000004_tech_office_cycle.sql` (7 مواضع) + `20260719000005_tech_office_messaging.sql` (6 مواضع)
- بقية الملفات: `messages_notifications_realtime` · `referrals_wiring` · `staff_feeds` · `interior_feeds` · `competent_feeds` · `ag_tech_feeds` · `grievance_cycle` · `urgent_cycle` · `recommendation_receipt` · `seeker_sign_agreement` · `study_eval_resilience` · `triage_refer_branch` · `claim_paper_cases` · `assignment_guards` · `study_requires_recommendation` · `referral_center_wiring` · `paper_intake_receipt_link` · `notifications_type_check` · `seeker_conditional_entity`

### C2. نصوص إقرارات قانونية
| file:line | الوصف |
|---|---|
| `apps/seeker/components/screens-detailed.tsx:350` | إقرار صحّة البيانات |
| `apps/seeker/components/real-detail.jsx:30` | `OBLIGATIONS` — **5 التزامات المشمول (م11)** نصّ قانوني كامل |
| `real-detail.jsx:177,180` | إقرارا الاطّلاع والسرّية عند التوقيع |
| `real-detail.jsx:159` | لافتة «سرية للغاية» (م15/م16) |
| `real-detail.jsx:212` | نصّ مسار التظلّم النظامي |
| `RecommendationForm.jsx:274,382` | إقرار رفع التوصية + إقرار البلاغ العاجل |
| `PaperIntakePortal.jsx:310,436` | إقرارا المطابقة (توصية/إدخال ورقي) |
| `InteriorPortal.jsx:284` | إقرار المعاملة بالمثل (م6) |

### C3. نصوص قرارات/توصيات جاهزة
- `decision-store.js:38` — `REASON_SKELETON` هيكل حيثيات جاهز
- `branch-roles.jsx:76` — تسبيب توصية جاهز
- `TriagePortal.jsx:183` — 8 صيغ ردّ رسمية (تُرسل كرسائل)
- ✅ ممركزة فعلاً: `decision-state.ts:86-108` · `grievance.ts:43-44` · `portal-config.ts:157`

### C4. لافتات النظام (`InlineAlert`) — **114 موضعاً في 15 ملفاً**
أبرز التركّز: `TriagePortal.jsx` (15) · `PaperIntakePortal.jsx` (8) · `AttorneyGeneralPortal.jsx` (8، منها ديناميكية `:274,:376`) · `TechOfficePortal.jsx` (6، منها `:367` ديناميكية) · `StudyEvalPortal.jsx` (5) · `RecommendationForm.jsx` (6)

### C5. نصوص أخرى ذات طابع محتوى
- `ui/shell/PortalShell.jsx:30` — `roleTag = "سري للغاية"` (+ 9 تمريرات يدوية)
- `study-eval/screens.jsx:136` — نصّ العلامة المائية
- `seeker/realtime-screens.tsx:75,192` — الحالات الفارغة
- رسائل تحقّق عربية inline: `seeker-actions.ts` · `paper-intake-actions.ts` · `entity-actions.ts` · `api/schemas.ts:12-16,85-100`
- `OversightPortal.jsx:415-421` — إشعارات قيادية مركّبة في العميل (+ رقم تفويض ثابت `ت-1447/22`)
- `referral-bus.js` وتوائمه (×4) — `AUTH.ar` / `STATUS.ar`

---

## Section D — حالة قاعدة البيانات

**جداول طبقة المحتوى (`reference_lists/items`، `notification_templates`، `system_messages`، `legal_texts`، `content_change_requests`): لا يوجد أيٌّ منها.**

الموجود ذو الصلة:
| الجدول | ملاحظة |
|---|---|
| `notifications` (`20260704000001_schema.sql:153` + أعمدة لاحقة) | النصوص تُكتب حرفياً في الدوال — لا مرجع قالب |
| `20260805000002_notifications_type_check.sql` | قيد `check` على `type` — أقرب شيء لسجل الأنواع |
| `app_settings` | جدول إعدادات عام — مرشّح حالي وحيد لمحتوى قابل للتهيئة |
| `protection_documents` (`rights`,`terms` jsonb) + `obligations.text` | نصوص م11 لكل حالة — المصدر ما زال `real-detail.jsx:30` |
| `branches` / `approval_chains` | ستُهجَر لصالح `org_units` (قرار 7 أغسطس) |
| enums (`case_status`, `app_role`, `app_category`, `risk_level`, `case_source`, `referral_authority`, `region_code`, `msg_thread`) | المرساة الحالية — يربطها `label-coverage.test.ts` |

---

## الخلاصة العملية (أولويات)

1. **تعارضات حقيقية تُصلح فوراً** (قبل طبقة المحتوى أو معها): `decision-store.js:30` (6 أنواع بدل 13) · `DecisionPortal.jsx:124` («90 يوماً» ليست في `DURATIONS`) · `RISK_LEVEL` بثلاث صياغات · `DONE` vs `STAGE_INDEX` في seeker.
2. **تكرار كثيف قابل للتوحيد**: الجهات الخمس (8 نسخ) · خرائط الفئات (8 نسخ) · `WAQIA` (2) · حالات الإحالة (6) · `M13` (4 ملفات) · مجموعات التاريخ (4).
3. **محرّك الإشعارات أكبر مما يوحي به التسليم**: ~47 موضع `insert into notifications` داخل دوال SQL يجب أن تقرأ من `notification_templates` بدل النص الحرفي.
4. **حارس التغطية يُوسَّع** ليشمل القوائم غير المرتبطة بـenum بعد قيام `reference_items` (مقارنة الدومين ↔ القاعدة).
