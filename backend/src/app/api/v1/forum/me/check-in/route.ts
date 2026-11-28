import { communityRequest } from "@/features/forum/community-http";
import { communityPoints } from "@/features/forum/community-points";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return communityRequest(request, "required", async (actor) => {
    return communityPoints.status(actor!);
  });
}

export async function POST(request: Request) {
  return communityRequest(request, "required", async (actor) => {
    return communityPoints.checkIn(actor!);
  });
}
