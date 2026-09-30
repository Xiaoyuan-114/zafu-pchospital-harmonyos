import { repairPhotoService } from "@/features/repairs/repair-photo-service";
import { apiFailure, apiSuccess } from "@/lib/api/response";
import { getRequestId } from "@/lib/api/request-id";
import { assertSameOrigin, authenticateRequest } from "@/lib/auth/request";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request);
    const { actor } = await authenticateRequest(request, requestId);
    const form = await request.formData();
    const files = form.getAll("photos").filter((item): item is File => item instanceof File);
    return apiSuccess(await repairPhotoService.upload((await params).id, files, actor), requestId, {
      status: 201,
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
