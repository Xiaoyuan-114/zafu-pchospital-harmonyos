import type { Metadata } from "next";

import { RepairActivityAdminPanel } from "@/components/admin/RepairActivityAdminPanel";
import { Section } from "@/components/ui/Section";
import { adminCopy } from "@/config/admin";

export const metadata: Metadata = { title: adminCopy.repairActivities.title };

export default function AdminRepairActivitiesPage() {
  return (
    <Section
      variant="page-head"
      className="admin-workspace"
      labelledBy="admin-repair-activities-title"
    >
      <div className="admin-workspace__content">
        <RepairActivityAdminPanel />
      </div>
    </Section>
  );
}
