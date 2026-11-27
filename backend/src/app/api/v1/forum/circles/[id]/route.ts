import { communityRequest } from "@/features/forum/community-http";
import { communityService } from "@/features/forum/community-service";
import { readForumJsonBody } from "@/features/forum/forum-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityRequest(request, "optional", async actor => {
    const { id } = await context.params;
    return communityService.circle(id, actor);
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityRequest(request, "required", async actor => {
    const { id } = await context.params;
    return communityService.saveCircle(id, await readForumJsonBody(request), actor!);
  });
}
