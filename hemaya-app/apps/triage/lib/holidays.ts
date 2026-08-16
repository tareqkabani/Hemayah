"use server";
/* تقويم العطل الرسمية — يُقرأ مرّةً في الصفحة الخادمية ويُحقن في حاسبة
   أيام العمل، فلا تفترق حاسبةُ الواجهة عن حاسبة القاعدة. */
import { createServerClient } from "@hemaya/supabase";

export async function getHolidays(): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("holidays").select("day").order("day");
  if (error) return [];
  return (data ?? []).map((r) => String((r as { day: string }).day).slice(0, 10));
}
