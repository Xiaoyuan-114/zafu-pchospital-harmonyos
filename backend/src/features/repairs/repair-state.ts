import { AppError } from "@/lib/api/errors";
import type { RepairStatus } from "@/types/contracts";
const allowed = new Set([
  "DRAFT:PENDING",
  "REJECTED:PENDING",
  "PENDING:APPROVED",
  "PENDING:REJECTED",
]);
export function isRepairTransitionAllowed(from: RepairStatus, to: RepairStatus): boolean {
  return allowed.has(`${from}:${to}`);
}
export function assertRepairTransition(from: RepairStatus, to: RepairStatus): void {
  if (!isRepairTransitionAllowed(from, to))
    throw new AppError("REPAIR_STATE_INVALID", `不允许从 ${from} 变更为 ${to}`);
}
