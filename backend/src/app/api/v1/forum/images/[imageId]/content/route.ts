import { forumImageService } from "@/features/forum/forum-image-service";
import { getRequestId } from "@/lib/api/request-id";
import { apiFailure } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const requestId = getRequestId(request.headers);
  try {
    const { image, bytes } = await forumImageService.open((await params).imageId);
    const body = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.sizeBytes),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
