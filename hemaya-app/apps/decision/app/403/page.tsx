export default function Denied() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <div>
        <h1 style={{ fontSize: 28 }}>غير مُصرَّح</h1>
        <p className="muted">حسابك لا يملك دوراً في مرحلة القرار (المسار الجديد). راجع مدير النظام.</p>
        <p style={{ marginTop: 16 }}><a className="pp-btn pp-btn--ghost" href="/auth/signout">تسجيل الخروج</a></p>
      </div>
    </div>
  );
}
