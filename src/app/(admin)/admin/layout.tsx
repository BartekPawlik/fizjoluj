import type { ReactNode } from "react";

import { requireAdministrator } from "@/features/auth/session";
import { AccountLayout } from "@/features/auth/ui";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdministrator();
  return <AccountLayout>{children}</AccountLayout>;
}
