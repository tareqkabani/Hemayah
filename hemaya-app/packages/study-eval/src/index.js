// بوابتا الدارس والمقيّم — دوران مستقلّان معزولان من مكوّنٍ بارامتري واحد.
// <StudyEvalPortal role="studier" | "evaluator" /> — الفرق كلّه من PortalConfig.
export { StudyEvalPortal } from "./StudyEvalPortal";
// المستندان الكاملان والعارض السرّي — المصدر الواحد لعرضهما في كل البوابات
// (الدارس/المقيّم/حزمة اطّلاع القرار): طلب الحماية بكل حقوله، التوصية
// بأقسامها الثمانية، وكل فتح مرفقٍ صفُّ تدقيق عبر onOpenDoc.
export { SeekerReq, AuthRec, AttViewer, AttChip } from "./screens";
