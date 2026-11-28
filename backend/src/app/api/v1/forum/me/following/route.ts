import { communityRequest } from "@/features/forum/community-http";
import { communityService } from "@/features/forum/community-service";
import { parsePagination } from "@/lib/api/pagination";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return communityRequest(request, "required", async (actor) => {
    return communityService.following(actor!, parsePagination(new URL(request.url).searchParams));
  });
}
