import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { Prisma } from "@/generated/prisma/client";
import { forumRepository } from "@/features/forum/forum-repository";
import { disconnectDb, getDb } from "@/lib/db/client";
import { assertExperimentDatabase } from "./db-target.mjs";

// Local, synthetic fixture for the PR #109 hot-feed query record.
loadEnvFile(".env");
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
assertExperimentDatabase("test");
const db = getDb();
const userId = randomUUID();
const now = new Date();
const posts = Array.from({ length: 100 }, (_, index) => ({
  id: randomUUID(),
  authorId: userId,
  category: "GENERAL",
  title: `查询样本 ${index}`,
  body: "合成查询样本",
  createRequestKey: randomUUID(),
  createdAt: now,
  updatedAt: now,
}));

async function main() {
  try {
    await db.user.create({
      data: {
        id: userId,
        status: "ACTIVE",
        displayName: "查询样本",
        createdAt: now,
        updatedAt: now,
      },
    });
    await db.forumPost.createMany({ data: posts });
    await db.forumComment.createMany({
      data: posts.flatMap((post, index) =>
        Array.from({ length: index % 21 }, () => ({
          id: randomUUID(),
          postId: post.id,
          authorId: userId,
          body: "合成评论",
          createRequestKey: randomUUID(),
          createdAt: now,
        })),
      ),
    });
    console.log("Database:", await db.$queryRaw`SELECT VERSION() AS version, DATABASE() AS db`);
    console.log("Dataset:", {
      posts: await db.forumPost.count(),
      comments: await db.forumComment.count(),
    });
    const plan = await db.$queryRaw<Record<string, string>[]>(Prisma.sql`
    EXPLAIN ANALYZE SELECT p.id FROM forum_posts p LEFT JOIN forum_comments c ON c.post_id = p.id
      AND c.deleted_at IS NULL AND c.created_at >= ${new Date(now.getTime() - 7 * 86400000)}
    WHERE p.deleted_at IS NULL GROUP BY p.id, p.created_at
    ORDER BY COUNT(c.id) DESC, p.created_at DESC, p.id DESC
    LIMIT ${BigInt(20)} OFFSET ${BigInt(0)}`);
    for (const row of plan) console.log(Object.values(row).join("\n"));
    const samples: number[] = [];
    for (let index = 0; index < 5; index++) {
      const start = performance.now();
      const page = await forumRepository.listPublicPosts({ sort: "hot", skip: 0, take: 20 });
      samples.push(Number((performance.now() - start).toFixed(3)));
      if (page.items.length !== 20) throw new Error("Expected 20 hot-feed rows");
    }
    console.log("Repository listPublicPosts milliseconds (count + ranking + views):", samples);
    console.log(
      "Reward index:",
      await db.$queryRaw`
    SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'community_activity_rewards'
      AND INDEX_NAME = 'community_activity_rewards_activity_id_idx'`,
    );
  } finally {
    await db.forumComment.deleteMany({ where: { authorId: userId } });
    await db.forumPost.deleteMany({ where: { authorId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await disconnectDb();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
