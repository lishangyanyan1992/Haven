import type { ReactNode } from "react";

import { getAdminUser } from "@/lib/admin-auth";
import { AdminHeader } from "./AdminHeader";
import { AdminNavTabs } from "./AdminNavTabs";
import { AdminPasscodeForm } from "./AdminPasscodeForm";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    return <AdminPasscodeForm />;
  }

  return (
    <div className="min-h-screen bg-[var(--haven-cream,#fdfaf6)] text-[var(--haven-ink)]">
      <AdminHeader email={adminUser.email} />
      <div className="content-container-wide py-8">
        <div className="mb-6">
          <AdminNavTabs />
        </div>
        {children}
      </div>
    </div>
  );
}
