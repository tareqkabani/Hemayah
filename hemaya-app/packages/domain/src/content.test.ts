// اختبار طبقة قراءة المحتوى — عميل مُقلَّد (لا قاعدة): السلوك والذاكرة المؤقتة.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getList, getLists, getTemplate, labelOf, invalidateContent, type ContentClient } from "./content";

const ITEMS = [
  { list_key: "ec_relation", item_key: "father", label: "أب", label_short: null, meta: {} },
  { list_key: "ec_relation", item_key: "mother", label: "أم", label_short: null, meta: {} },
  { list_key: "call_channel", item_key: "phone", label: "هاتف", label_short: null, meta: {} },
];

/** عميل مُقلَّد يدعم سلاسل from().select().eq/in().order()/maybeSingle() */
function stubClient(rows: unknown[] = ITEMS, error: { message: string } | null = null) {
  const calls: string[] = [];
  const result = (data: unknown) => ({ data: error ? null : data, error });
  const chain = (table: string) => {
    const filters: Record<string, unknown> = {};
    const q: any = {
      select: () => q,
      eq: (col: string, v: unknown) => { filters[col] = v; return q; },
      in: (col: string, v: unknown) => { filters[col] = v; return q; },
      order: () => {
        calls.push(table);
        let out = rows as any[];
        if (typeof filters.list_key === "string") out = out.filter((r) => r.list_key === filters.list_key);
        if (Array.isArray(filters.list_key)) out = out.filter((r) => (filters.list_key as string[]).includes(r.list_key));
        return Promise.resolve(result(out));
      },
      maybeSingle: () => {
        calls.push(table);
        return Promise.resolve(result((rows as any[])[0] ?? null));
      },
    };
    return q;
  };
  return { client: { from: chain } as unknown as ContentClient, calls };
}

beforeEach(() => {
  invalidateContent();
  vi.restoreAllMocks();
});

describe("getList", () => {
  it("يرجع البنود بمفاتيحها ونصوصها", async () => {
    const { client } = stubClient();
    const items = await getList(client, "ec_relation");
    expect(items.map((i) => i.key)).toEqual(["father", "mother"]);
    expect(items[0].label).toBe("أب");
  });

  it("الطلب الثاني من الذاكرة المؤقتة — لا رحلة ثانية للقاعدة", async () => {
    const { client, calls } = stubClient();
    await getList(client, "ec_relation");
    await getList(client, "ec_relation");
    expect(calls.length).toBe(1);
  });

  it("invalidateContent يبطل الذاكرة", async () => {
    const { client, calls } = stubClient();
    await getList(client, "ec_relation");
    invalidateContent();
    await getList(client, "ec_relation");
    expect(calls.length).toBe(2);
  });

  it("خطأ القاعدة يُرمى صريحاً", async () => {
    const { client } = stubClient([], { message: "boom" });
    await expect(getList(client, "ec_relation")).rejects.toThrow("getList(ec_relation): boom");
  });
});

describe("getLists", () => {
  it("رحلة واحدة لعدة قوائم مع تجميع صحيح", async () => {
    const { client, calls } = stubClient();
    const out = await getLists(client, ["ec_relation", "call_channel"]);
    expect(out.ec_relation.length).toBe(2);
    expect(out.call_channel.map((i) => i.key)).toEqual(["phone"]);
    expect(calls.length).toBe(1);
  });

  it("القائمة الغائبة ترجع مصفوفة فارغة لا undefined", async () => {
    const { client } = stubClient();
    const out = await getLists(client, ["no_such_list"]);
    expect(out.no_such_list).toEqual([]);
  });

  it("ما في الذاكرة لا يُطلب ثانية", async () => {
    const { client, calls } = stubClient();
    await getList(client, "ec_relation");
    await getLists(client, ["ec_relation", "call_channel"]);
    // الرحلة الثانية تطلب call_channel فقط
    expect(calls.length).toBe(2);
  });
});

describe("labelOf", () => {
  const items = [
    { key: "father", label: "أب", short: null, meta: {} },
    { key: "spouse", label: "زوج/زوجة", short: null, meta: {} },
  ];
  it("المفتاح المخزَّن → نصّه", () => expect(labelOf(items, "father")).toBe("أب"));
  it("السجل القديم (نصّ عربي مخزَّن) → يُعرض كما هو", () => expect(labelOf(items, "قريب")).toBe("قريب"));
  it("الفارغ → شرطة", () => expect(labelOf(items, null)).toBe("—"));
});

describe("getTemplate", () => {
  it("يرجع القالب ويخزّنه مؤقتاً", async () => {
    const tpl = { template_key: "n_received", subject: "س", body: "ب", active: true };
    const { client, calls } = stubClient([tpl]);
    const a = await getTemplate(client, "n_received");
    const b = await getTemplate(client, "n_received");
    expect(a?.template_key).toBe("n_received");
    expect(b?.template_key).toBe("n_received");
    expect(calls.length).toBe(1);
  });
});
