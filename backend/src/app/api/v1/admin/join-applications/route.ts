import { joinApplicationService } from "@/features/recruitment/join-application-service";
import { AppError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { authenticateRequest } from "@/lib/auth/request";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const { actor } = await authenticateRequest(request, requestId);
    const query = new URL(request.url).searchParams;
    const pagination = parsePagination(query);
    const result = await joinApplicationService.list(
      {
        ...pagination,
        status: optionalStatus(query.get("status")),
        provisionStatus: optionalProvisionStatus(query.get("provisionStatus")),
        submittedFrom: query.get("submittedFrom") ?? undefined,
        submittedTo: query.get("submittedTo") ?? undefined,
        query: query.get("query") ?? undefined,
      },
      actor,
    );
    return apiSuccess(result.items, requestId, { pagination: result.pagination });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}

function optionalStatus(value: string | null) {
  if (value === null) return undefined;
  return value === "SUBMITTED" ||
    value === "INTERVIEW_PENDING" ||
    value === "INTERVIEW_PASSED" ||
    value === "INTERVIEW_REJECTED" ||
    value === "WITHDRAWN"
    ? value
    : invalidFilter("status");
}

function optionalProvisionStatus(value: string | null) {
  if (value === null) return undefined;
  return value === "NOT_REQUIRED" ||
    value === "PENDING" ||
    value === "SUCCEEDED" ||
    value === "FAILED"
    ? value
    : invalidFilter("provisionStatus");
}

function invalidFilter(name: string): never {
  throw new AppError("VALIDATION_FAILED", `${name} 参数无效`);
}
