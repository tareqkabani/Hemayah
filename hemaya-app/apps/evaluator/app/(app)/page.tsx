// بوابة المقيّم — تقرأ PortalConfig من @hemaya/domain وتركّب القشرة الموحّدة.
export const dynamic = "force-dynamic";
import { StudyEvalPortal } from "@hemaya/study-eval";
import { getPortalData } from "@/lib/data";

export default async function Page() {
  const { me, initial } = await getPortalData("evaluator");
  return <StudyEvalPortal role="evaluator" me={me} initial={initial} basePath="/evaluator" />;
}
