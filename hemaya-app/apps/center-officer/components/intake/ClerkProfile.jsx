"use client";
/* الملف الشخصي — بيانات الحساب ونطاق الصلاحية في الوحدة (قرار ٤ و٦). */
import React from "react";
import { Tag } from "@hemaya/ui";
import { I } from "./parts";

export function ClerkProfile({ me }) {
  return (
    <div className="pi-wrap">
      <div className="kick">بوابة موظف المركز · الإدخال اليدوي للطلبات</div>
      <h1>الملف الشخصي</h1>
      <p className="sub">بيانات حسابك ونطاق صلاحيتك في هذه الوحدة.</p>
      <div className="card pad">
        <div className="row" style={{ gap: 14, marginBottom: 18 }}>
          <div className="su-av" style={{ width: 52, height: 52 }}><I name="person" size={26} /></div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-strong)" }}>{me.name}</div>
            <div className="muted">{me.role}{me.nid ? <> · الهوية <span className="mono" dir="ltr">{me.nid}</span></> : null}</div>
          </div>
          <Tag tone="success" size="sm" iconLeft={<I name="verified_user" size={13} fill />}>موثّق عبر نفاذ</Tag>
        </div>
        <div className="flags">
          <div className="flag"><I name="apartment" size={17} /> الوحدة: <b>مركز حماية الشهود والمبلّغين — الإدخال اليدوي للطلبات</b></div>
          <div className="flag"><I name="key" size={17} /> الصلاحية: <b>تفريغ الوارد الورقيّ وإحالته للفرز — لا قرار ولا تقييم</b></div>
          <div className="flag"><I name="history" size={17} /> كل إدخال وكشف هوية <b>مُسجّل في التدقيق باسمك</b></div>
          <div className="flag"><I name="description" size={17} /> القنوات: <b>الموقع الإلكتروني · حضوري · خطاب رسمي بالبريد</b></div>
        </div>
      </div>
    </div>
  );
}
