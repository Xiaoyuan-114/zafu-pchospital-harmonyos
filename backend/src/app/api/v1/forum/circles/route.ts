import { communityRequest } from "@/features/forum/community-http";
import { communityService } from "@/features/forum/community-service";
import { readForumJsonBody } from "@/features/forum/forum-http";
import { AppError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return communityRequest(request, "optional", async (actor) => {
    const query = new URL(request.url).searchParams;
    if (query.get("view") === "categories") return communityService.circleCategories();
    const category = query.get("category")?.trim() ?? "";
    if (category.length > 40) throw new AppError("VALIDATION_FAILED", "圈子分类不能超过 40 字");
    return communityService.circles(
      actor,
      parsePagination(query),
      query.get("joined") === "true",
      category,
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
