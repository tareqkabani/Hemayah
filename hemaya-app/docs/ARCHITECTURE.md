# معمارية منصّة «حماية» — hemaya-app

مونوريبو pnpm + Turbo: كل بوابة تطبيق Next.js مستقل خلف منفذ الشاشة الموحّدة 3000
(Multi-Zones في `apps/landing`)، والحزم المشتركة في `packages/*` تُستهلك مصدراً عبر
`transpilePackages`. القاعدة Supabase self-hosted (RLS دائماً).

## قشرة البوابة الموحّدة

> القاعدة: **القشرة غبية والإعدادات ذكية** — الهيكل مشترك، وكل الفروق بين البوابات
> تأتي من `PortalConfig` في `@hemaya/domain` (مصدره `PORTAL-MATRIX.md` في مشروع
> التصميم). لا تفرّع بين الأدوار داخل كود القشرة.

### الإعداد — `@hemaya/domain/src/portal-config.ts`

`PortalConfig` يحمل لكل بوابة: `defaultScreen` · `screens` (الملف الشخصي آخرها) ·
`nextAction(record)` (الإجراء المطلوب في مرحلة البوابة حصراً) · `notifCategories` ·
`sla` (المادة + أيام العمل) · `emergencyButton` · `identityMode`
(رمز سري / اسم حقيقي / لا PII) · `messaging` (من يبدأ، مع من، عزل الخيط، إيصال
التسليم، وسم الهوية) · `isolationScope` · `stage` (المرحلة N من دورة الحياة الست
`STAGE_FLOW`). المدخلان الحاليان: `studier` و`evaluator`؛ بقية البوابات تُضاف
حرفياً من المصفوفة. اختبارات `nextAction` في `portal-config.test.ts`
(`pnpm --filter @hemaya/domain test`).

حساب أيام العمل (الأحد–الخميس) في `sla.ts`:
`isBusinessDay` · `addBusinessDays` · `businessDaysBetween` · `dueDateFor`.

### المكوّنات — `@hemaya/ui` (src/shell)

| المكوّن | الوظيفة |
|---|---|
| `PortalShell` | الجانبية القابلة للطي (264→78px) بشعار المركز، الذيل (بطاقة «موثّق عبر نفاذ» ← خروج أحمر بمودال ← © النيابة العامة)، الشريط العلوي بلا عنوان مكرّر + عدّادات حيّة + مودال الخروج + التوست |
| `SecretChip` | الرمز السري مقنّعاً (••••)؛ كشف مؤقت يُخفى آلياً (`identityRevealSeconds`) وكل كشف حدث تدقيق عبر `onReveal` |
| `NotificationsScreen` | فلاتر بعدّادات من `config.notifCategories`، تجميع زمني (اليوم/أمس/الأقدم بتواريخ فعلية)، فئة «عاجل» مثبّتة بمؤقّت `DeadlineTimer`، النقر يفتح الوجهة ويثبت القراءة في القاعدة |
| `MessagesScreen` | سياسة المراسلة كلّها من `config.messaging`؛ عدّاد غير مقروء لكل خيط وفتحه يصفّره؛ إيصال «سُلّمت — مسجّلة في التدقيق» |

الأنماط: `@hemaya/ui/shell.css` (منقول من مرجع التصميم `study-eval.css`) —
تُستورد مرة واحدة في `globals.css` بعد `@hemaya/ui/styles.css`.

### بوابتا الدارس والمقيّم — `apps/studier` (3015) · `apps/evaluator` (3016)

دوران مستقلّان معزولان من مكوّن بارامتري واحد `@hemaya/study-eval`
(`<StudyEvalPortal role="studier|evaluator" />`) — الفرق كلّه من الإعداد.
نموذج الدراسة/التقييم (AuthRec بهوية محجوبة · بطاقة المسار الأجنبي م6 ·
قبول كلي/جزئي/رفض · أنواع م14 المقترحة · التوقيع عبر نفاذ) منقول من المرجع
المعتمد دون إعادة بناء.

الطبقة البيانية (`supabase/migrations/20260716000001_study_eval_portals.sql`):

- **الإسناد الآليّ بالعبء**: عند انتقال الحالة إلى `under_study` يُنشئ المشغّل
  صفوفاً مبدئية في `studies`/`assessments` لأقلّ المؤلّفين عبئاً من كل دور —
  «كلٌّ يرى المُسنَد إليه فقط» (سياسات `study_eval_assigned_*` بدل الطابور المشترك).
- **العزل الصفّي**: سياسات المخطّط (`study_author_rw`/`assess_author_rw`) تمنع أي
  اطّلاع أفقي بين الأقران؛ الدارس لا يرى أي تقييم والمقيّم لا يرى أي دراسة؛
  عدّاد الأقران عبر `my_study_tasks()`/`my_assessment_tasks()` (SECURITY DEFINER —
  عدد فقط دون هويات).
- **حالة المستخدم في القاعدة لا الواجهة**: قراءة الإشعارات `notifications.read`
  (+`recipient_id`/`crit`)، طيّ الجانبية `user_prefs`، قراءة الخيوط
  `leadership_messages.read_at` — بدلاء مفاتيح `seSb-*`/`seNotifRead-*` في نموذج
  التصميم.
- **مراسلات القيادة**: `leadership_messages` بخيط معزول لكل (طلب، مؤلّف، قائد)؛
  الإرسال عبر `send_leader_message` (يتحقّق من الإسناد والطلب النشط ويسجّل في
  التدقيق)، والقيادة (رئيس/نائب) تطّلع وتردّ.
- **التدقيق**: `record_secret_reveal` لكل كشف رمز؛ `submit_study`/`submit_assessment`
  (أُضيف `_partial_reason` للقبول الجزئي) تسجّلان الاعتماد، والتجميع للمجلس آليّ
  (`_auto_send_to_decision` — يتجاهل الصفوف المبدئية غير المعتمدة).

الدخول عبر بوابة نفاذ الموحّدة: `2000000003` (خالد العنزي — دارس) ·
`2000000004` (منى الزهراني — مقيّمة)؛ سيناريو العرض في `supabase/seed.sql` §3
(البطل C-2026-0481 عاجل + أجنبي م6 C-2026-0512 + مهام مكتملة وأقران مساندون).
