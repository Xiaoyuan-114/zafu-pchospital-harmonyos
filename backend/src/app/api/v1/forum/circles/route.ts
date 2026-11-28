import { communityRequest } from "@/features/forum/community-http";
import { communityService } from "@/features/forum/community-service";
import { readForumJsonBody } from "@/features/forum/forum-http";
import { parsePagination } from "@/lib/api/pagination";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return communityRequest(request, "optional", async (actor) => {
    return communityService.circles(
      actor,
      parsePagination(new URL(request.url).searchParams),
      new URL(request.url).searchParams.get("joined") === "true",
    );
  });
}

export async function POST(request: Request) {
  return communityRequest(
    request,
    "required",
    async (actor) => {
      return communityService.saveCircle(null, await readForumJsonBody(request), actor!);
    },
    { status: 201 },
  );
}
