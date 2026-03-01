import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/supabase/get-user";

export default async function CareerChatPage() {
  const t = await getTranslations("careerChat");
  const user = await requireUser();

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <div className="text-muted-foreground">
        {t("description")}
      </div>
    </div>
  );
}
