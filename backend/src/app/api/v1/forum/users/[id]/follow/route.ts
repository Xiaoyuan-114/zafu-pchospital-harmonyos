import { communityRequest } from "@/features/forum/community-http";
import { communityService } from "@/features/forum/community-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityRequest(request, "required", async actor => {
    const { id } = await context.params;
    return communityService.follow(id, true, actor!);
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityRequest(request, "required", async actor => {
    const { id } = await context.params;
    return communityService.follow(id, false, actor!);
  });
}
