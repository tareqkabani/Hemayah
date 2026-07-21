"use client";
// بندا الاطّلاع (تحديث 2026-07-21) في بطاقات حزمة الاطّلاع — ما أثبته
// الدارس/المقيّم بالاطّلاع: وجود توصية جهة مختصة / طلب مسبّب.
// null = مخرَج سابق للتحديث فلا يُعرض له شيء (البطاقة كما كانت).
import React from "react";
import { Tag } from "@hemaya/ui";

const Ic = ({ name, size = 12 }) => (
  <span className="material-symbols-rounded" style={{ fontSize: size }}>{name}</span>
);

export function FoundLine({ foundRec = null, foundReq = null }) {
  if (foundRec == null && foundReq == null) return null;
  const chip = (label, v) => (
    <Tag tone={v ? "success" : "neutral"} size="sm" iconLeft={<Ic name={v ? "check" : "close"} />}>
      {label}: {v ? "يوجد" : "لا يوجد"}
    </Tag>
  );
  return (
    <div className="row" style={{ gap: 6, marginBottom: 10 }}>
      <span className="muted" style={{ fontSize: 12 }}>بالاطّلاع تبيّن:</span>
      {foundRec != null && chip("توصية الجهة", foundRec)}
      {foundReq != null && chip("الطلب المسبّب", foundReq)}
    </div>
  );
}
