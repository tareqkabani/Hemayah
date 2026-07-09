/**
 * عقد OpenAPI 3.1 لبوّابة Hemayah — يُخدَم على /v1/openapi.json كي يبني
 * مطوّرو الجوّال والشركاء عملاءهم من عقدٍ واضح. حدّثه مع كل نقطة جديدة.
 */
export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Hemayah API",
    version: "1.0.0",
    description: "بوّابة حماية الشهود والمبلّغين — طبقة REST رقيقة فوق Supabase (RLS مُفعَّل).",
  },
  servers: [{ url: "/v1" }],
  components: {
    securitySchemes: {
      nafathBearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "توكن جلسة نفاذ الصادر من Supabase Auth — هويّة مستخدم، محكومة بـ RLS.",
      },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "مفتاح API للجهات والشركاء — هويّة نظام، محكومة بالصلاحيات (scopes). الكتابة تتطلّب مستخدماً.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              requestId: { type: ["string", "null"] },
              details: {},
            },
            required: ["code", "message"],
          },
        },
      },
      Case: {
        type: "object",
        properties: {
          id: { type: "string" },
          ref_no: { type: "string" },
          status: { type: "string" },
          category: { type: "string" },
          classification: { type: ["string", "null"] },
          source: { type: "string" },
          created_at: { type: "string" },
          updated_at: { type: "string" },
        },
      },
      SubmitCase: {
        type: "object",
        required: ["applicantRole", "category", "entity", "crime", "reason"],
        properties: {
          applicantRole: { type: "string", enum: ["أصيل", "وليّ", "وصيّ", "وكيل", "محامٍ"] },
          category: { type: "string", enum: ["reporter", "witness", "expert", "victim", "related"] },
          entity: { type: "string" },
          crime: { type: "string" },
          reason: { type: "string" },
          priorSubmit: { type: "boolean", default: false },
          caseNo: { type: "string" },
          details: { type: "object", additionalProperties: true },
        },
      },
      StudyAssessment: {
        type: "object",
        required: ["recommendation"],
        properties: {
          recommendation: { type: "string" },
          rejectReasons: { type: "array", items: { type: "string" } },
          proposedType: { type: "array", items: { type: "string" } },
          proposedDuration: { type: "string" },
          notes: { type: "string" },
        },
      },
      TriageDecision: {
        type: "object",
        required: ["decision"],
        properties: {
          decision: { type: "string", enum: ["study", "refer", "close"] },
          reason: { type: "string" },
          formalCheck: { type: "object", additionalProperties: { type: "boolean" } },
          authority: { type: "string" },
        },
      },
    },
  },
  security: [{ nafathBearer: [] }, { apiKey: [] }],
  paths: {
    "/health": {
      get: {
        summary: "فحص صحّة",
        security: [],
        responses: { "200": { description: "الخدمة تعمل" } },
      },
    },
    "/auth/nafath/start": {
      post: {
        summary: "بدء تحدّي نفاذ",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["nationalId"], properties: { nationalId: { type: "string", pattern: "^\\d{10}$" } } } } },
        },
        responses: { "200": { description: "sessionId + رقم التحقّق" }, "400": { description: "رقم هوية غير صالح" } },
      },
    },
    "/auth/nafath/confirm": {
      post: {
        summary: "تأكيد نفاذ وإصدار توكن الجلسة (للجوّال)",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["nationalId", "sessionId"], properties: { nationalId: { type: "string" }, sessionId: { type: "string" } } } } },
        },
        responses: {
          "200": { description: "accessToken + refreshToken + user" },
          "401": { description: "لم تُنجَز المطابقة بعد" },
        },
      },
    },
    "/cases": {
      get: {
        summary: "قضايا المستخدم (محكومة بـ RLS)",
        responses: {
          "200": {
            description: "قائمة القضايا",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { type: "array", items: { $ref: "#/components/schemas/Case" } } },
                },
              },
            },
          },
          "401": { description: "غير مصادَق", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        summary: "تقديم طلب حماية",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "مفتاح اختياريّ لمنع تكرار الإنشاء عند إعادة الإرسال؛ التكرار يُعيد الاستجابة نفسها.",
          },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SubmitCase" } } },
        },
        responses: {
          "409": { description: "تعارض (قاعدة عملٍ أو مفتاح idempotency قيد المعالجة)", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "لا صلاحيّة", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "201": {
            description: "أُنشئت القضية",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "object",
                      properties: {
                        refNo: { type: "string" },
                        secretCode: { type: "string" },
                        caseId: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "422": { description: "مدخلات غير صالحة", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/cases/{ref}": {
      get: {
        summary: "تفاصيل قضية بالرقم المرجعيّ",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "القضية وطلباتها" },
          "404": { description: "غير موجودة", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/cases/{ref}/triage": {
      post: {
        summary: "قرار فرز (إجراء موظّف المركز)",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TriageDecision" } } },
        },
        responses: {
          "200": { description: "الحالة الجديدة للقضية" },
          "403": { description: "لا صلاحيّة لهذا الإجراء" },
          "404": { description: "غير موجودة" },
          "409": { description: "انتقال حالةٍ غير مسموح (قاعدة عمل)" },
        },
      },
    },
    "/cases/{ref}/study": {
      post: {
        summary: "تقديم دراسة (دارس)",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object", required: ["recommendation"],
            properties: {
              recommendation: { type: "string" },
              rejectReasons: { type: "array", items: { type: "string" } },
              proposedType: { type: "array", items: { type: "string" } },
              proposedDuration: { type: "string" },
              notes: { type: "string" },
            },
          } } },
        },
        responses: { "201": { description: "أُنشئت الدراسة" }, "403": { description: "لا صلاحيّة" }, "404": { description: "غير موجودة" }, "409": { description: "قاعدة عمل" } },
      },
    },
    "/cases/{ref}/assessment": {
      post: {
        summary: "تقديم تقييم (مقيّم)",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/StudyAssessment" } } },
        },
        responses: { "201": { description: "أُنشئ التقييم" }, "403": { description: "لا صلاحيّة" }, "404": { description: "غير موجودة" }, "409": { description: "قاعدة عمل" } },
      },
    },
    "/cases/{ref}/send-to-decision": {
      post: {
        summary: "إحالة القضية للقرار",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "الحالة الجديدة" }, "409": { description: "الدراسة/التقييم غير مكتملة" } },
      },
    },
    "/cases/{ref}/council/draft": {
      post: { summary: "حفظ مسوّدة القرار", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { types: { type: "array", items: { type: "string" } }, duration: { type: "string" }, reasoning: { type: "string" } } } } } },
        responses: { "200": { description: "حُفظت" }, "409": { description: "قاعدة عمل" } } },
    },
    "/cases/{ref}/council/submit": {
      post: { summary: "رفع القرار للاعتماد", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["reasoning"], properties: { types: { type: "array", items: { type: "string" } }, duration: { type: "string" }, reasoning: { type: "string" } } } } } },
        responses: { "200": { description: "الحالة الجديدة" }, "422": { description: "المسوّغات مطلوبة" }, "409": { description: "قاعدة عمل" } } },
    },
    "/cases/{ref}/council/approve": {
      post: { summary: "اعتماد القيادة", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "الحالة الجديدة" }, "409": { description: "قاعدة عمل" } } },
    },
    "/cases/{ref}/council/return": {
      post: { summary: "إعادة للمُعِدّ", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["note"], properties: { note: { type: "string" } } } } } },
        responses: { "200": { description: "أُعيدت" }, "422": { description: "السبب مطلوب" } } },
    },
    "/cases/{ref}/council/vote": {
      post: { summary: "تصويت عضو المجلس", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["choice"], properties: { choice: { type: "string", enum: ["accept", "reject"] }, note: { type: "string" } } } } } },
        responses: { "200": { description: "سُجّل الصوت" }, "409": { description: "ليست مرحلة تصويت" } } },
    },
    "/cases/{ref}/council/tally": {
      get: { summary: "فرز الأصوات", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "عدّ الأصوات والنتيجة" } } },
    },
    "/cases/{ref}/council/close": {
      post: { summary: "إغلاق التصويت", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "أُغلق" }, "409": { description: "قاعدة عمل" } } },
    },
    "/cases/{ref}/council/issue": {
      post: { summary: "إصدار القرار النهائيّ", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string" } } } } } },
        responses: { "200": { description: "النتيجة (accept/reject)" }, "409": { description: "التصويت غير مغلق / سبب الرفض مطلوب" } } },
    },
    "/cases/{ref}/sign-agreement": {
      post: { summary: "توقيع اتفاقية الحماية (موظّف المركز)", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "الحالة الجديدة" }, "409": { description: "قاعدة عمل" } } },
    },
    "/cases/{ref}/sign": {
      post: { summary: "توقيع المستفيد لاتفاقيّته (عبر نفاذ)", description: "owner-scoped — صاحب القضية يوقّع اتفاقيّته فتُفعّل الحماية.", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "الحالة الجديدة (active)" }, "403": { description: "ليست قضيّتك" }, "409": { description: "الحالة ليست مقبولةً" } } },
    },
    "/cases/{ref}/contact-logs": {
      post: { summary: "تسجيل محضر اتصال", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["channel", "summary"], properties: { channel: { type: "string" }, summary: { type: "string" } } } } } },
        responses: { "201": { description: "سُجّل المحضر" }, "422": { description: "مدخلات ناقصة" } } },
    },
    "/cases/{ref}/view": {
      get: {
        summary: "عرضٌ موحّد لقضيّة المستفيد (قضية + قرارٌ مُصدَر + آخر تظلّم)",
        description: "للمستفيد فقط — يكشف القرار (قبول/رفض · الأنواع · المدّة) بعد الإصدار، دون مداولات المجلس.",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "{ case, decision, grievance }" },
          "404": { description: "غير موجودة أو ليست للمستفيد", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/cases/{ref}/messages": {
      get: {
        summary: "مراسلات القضية (قراءة)",
        parameters: [
          { name: "ref", in: "path", required: true, schema: { type: "string" } },
          { name: "thread", in: "query", required: false, schema: { type: "string", enum: ["center", "body"] }, description: "فلترة بالخيط: المركز أو الجهة المختصة." },
        ],
        responses: { "200": { description: "قائمة الرسائل زمنيّاً" }, "404": { description: "غير موجودة" } },
      },
      post: {
        summary: "ردّ المستفيد (المركز/الجهة)",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["body"], properties: { thread: { type: "string", enum: ["center", "body"], default: "center" }, body: { type: "string" } } } } },
        },
        responses: { "201": { description: "أُرسلت الرسالة" }, "403": { description: "القناة غير مفتوحة / لا صلاحيّة" }, "422": { description: "نصّ ناقص" } },
      },
    },
    "/cases/{ref}/grievances": {
      get: {
        summary: "تظلّمات القضية (قراءة)",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "قائمة التظلّمات وحالاتها ونتائجها" }, "404": { description: "غير موجودة" } },
      },
      post: {
        summary: "رفع تظلّم أمام النائب العام",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["reason"], properties: { scope: { type: "string", description: "محلّ الاعتراض (اختياريّ)" }, reason: { type: "string" } } } } },
        },
        responses: { "201": { description: "رُفع التظلّم" }, "403": { description: "لا صلاحيّة" }, "422": { description: "السبب مطلوب" } },
      },
    },
    "/notifications": {
      get: {
        summary: "إشعارات المستخدم",
        responses: { "200": { description: "قائمة الإشعارات" } },
      },
    },
    "/notifications/{id}/read": {
      post: {
        summary: "تعليم إشعارٍ كمقروء",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "عُلِّم كمقروء" }, "404": { description: "الإشعار غير موجود" } },
      },
    },
  },
} as const;
