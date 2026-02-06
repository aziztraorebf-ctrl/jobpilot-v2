import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { getUser } from "@/lib/supabase/get-user";

type Props = {
  children: React.ReactNode;
};

export default async function AppLayout({ children }: Props) {
  const user = await getUser();
  const userName = (user?.user_metadata?.full_name as string) ?? "";
  const userEmail = user?.email ?? "";
  const initials = userName
    ? userName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
    : userEmail.slice(0, 2);

  return (
    <div className="flex h-screen">
      <AppSidebar userName={userName} userEmail={userEmail} userInitials={initials} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader userName={userName} userEmail={userEmail} userInitials={initials} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
