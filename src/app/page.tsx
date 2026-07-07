import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.govbar}>
        <Image
          src="/brand/logo-center.png"
          alt="مركز حماية الشهود والمبلّغين والخبراء والضحايا — النيابة العامة"
          width={256}
          height={100}
          priority
          className={styles.logoCenter}
          style={{ height: 70, width: "auto" }}
        />
        <Image
          src="/brand/logo-2030.png"
          alt="رؤية السعودية 2030"
          width={96}
          height={96}
          className={styles.logo2030}
          style={{ height: 62, width: "auto" }}
        />
      </header>

      <main className={styles.wrap}>
        <span className={styles.eyebrow}>
          النيابة العامة · المملكة العربية السعودية
        </span>
        <h1 className={styles.hero}>منصّة «حماية»</h1>
        <p className={styles.sub}>
          مركز حماية الشهود والمبلّغين والخبراء والضحايا — رقمنةٌ كاملة لرحلة طلب
          الحماية، وفق نظام حماية الشهود والمبلّغين والخبراء والضحايا ولائحته
          التنفيذية.
        </p>

        <section aria-label="بوابات المنصّة" className={styles.grid}>
          <Link href="/seeker" className={`${styles.card} ${styles.cardPrimary}`}>
            <span className={styles.kicker}>الباب الأمامي · الدفعة الأولى</span>
            <span className={styles.cardTitle}>بوابة طالب الحماية</span>
            <span className={styles.cardDesc}>
              تقديم طلب الحماية · متابعة الحالة حيّاً · المراسلة مع المركز ·
              التظلّم · توقيع الاتفاقية — بالدخول عبر «نفاذ».
            </span>
            <span className={styles.cta}>ابدأ الدخول ←</span>
          </Link>

          <div className={`${styles.card} ${styles.cardSoon}`} aria-disabled="true">
            <span className={styles.kicker}>قيد الإعداد</span>
            <span className={styles.cardTitle}>بوابات المركز والجهات</span>
            <span className={styles.cardDesc}>
              الفرز · الدراسة والتقييم · القرار · التنفيذ — تُبنى في دفعاتٍ لاحقة
              وفق خطة المعالم.
            </span>
            <span className={`${styles.cta} ${styles.ctaMuted}`}>لاحقاً</span>
          </div>
        </section>
      </main>

      <footer className={styles.foot}>
        <span>
          مبنيّ على نظام «كود» (هيئة الحكومة الرقمية) · عربيٌّ RTL · الهوية تُعرض
          بالرمز السرّي.
        </span>
        <span className={styles.footVision}>رؤية 2030</span>
      </footer>
    </div>
  );
}
