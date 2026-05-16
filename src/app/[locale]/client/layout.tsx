import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@/lib/auth/session";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("client_session")?.value;

  if (!sessionToken) {
    redirect(`/${locale}/login`);
  }

  const { valid } = await validateSession(sessionToken);
  if (!valid) {
    redirect(`/${locale}/login`);
  }

  return <>{children}</>;
}
