// بندا الاطّلاع في بطاقات حزمة الاطّلاع — وصلة الدارس/المقيّم إلى المجلس
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FoundLine } from "./FoundLine";

describe("FoundLine", () => {
  it("مخرَج سابق للتحديث (null/null) لا يعرض شيئاً", () => {
    const { container } = render(<FoundLine foundRec={null} foundReq={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("يعرض «يوجد» و«لا يوجد» بحسب ما أثبته المؤلّف", () => {
    render(<FoundLine foundRec={true} foundReq={false} />);
    expect(screen.getByText("بالاطّلاع تبيّن:")).toBeTruthy();
    expect(screen.getByText(/توصية الجهة: يوجد/)).toBeTruthy();
    expect(screen.getByText(/الطلب المسبّب: لا يوجد/)).toBeTruthy();
  });

  it("بند واحد محدّد يظهر وحده والآخر يُخفى", () => {
    render(<FoundLine foundRec={true} foundReq={null} />);
    expect(screen.getByText(/توصية الجهة: يوجد/)).toBeTruthy();
    expect(screen.queryByText(/الطلب المسبّب/)).toBeNull();
  });
});
