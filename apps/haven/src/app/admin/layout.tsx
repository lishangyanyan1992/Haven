import type { ReactNode } from "react";

import { requireAdminUser } from "@/lib/admin-auth";
import { AdminHeader } from "./AdminHeader";
import { AdminNavTabs } from "./AdminNavTabs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { email } = await requireAdminUser();

  return (
    <div className="min-h-screen bg-[var(--haven-cream,#fdfaf6)] text-[var(--haven-ink)]">
      <AdminHeader email={email} />
      <div className="content-container-wide py-8">
        <div className="mb-6">
          <AdminNavTabs />
        </div>
        {children}
      </div>
    </div>
  );
}
