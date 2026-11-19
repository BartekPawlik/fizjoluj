import type { ReactNode } from "react";

import { requireSession } from "@/features/auth/session";
import { AccountLayout } from "@/features/auth/ui";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return <AccountLayout>{children}</AccountLayout>;
}
