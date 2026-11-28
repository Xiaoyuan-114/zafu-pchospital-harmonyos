import { communityRequest } from "@/features/forum/community-http";
import { communityPoints } from "@/features/forum/community-points";
import { parsePagination } from "@/lib/api/pagination";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return communityRequest(request, "required", async (actor) => {
    return communityPoints.entries(actor!, parsePagination(new URL(request.url).searchParams));
  });
}
