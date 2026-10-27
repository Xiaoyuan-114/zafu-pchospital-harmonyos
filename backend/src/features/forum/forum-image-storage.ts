import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { AppError } from "@/lib/api/errors";

export type ForumImageStorage = {
  put(input: { bytes: Uint8Array; mimeType: string }): Promise<{ storageKey: string }>;
  open(storageKey: string): Promise<Uint8Array>;
  delete(storageKey: string): Promise<void>;
};

export function forumImageMaxBytes(): number {
  const value = Number(process.env.FORUM_UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new AppError("INTERNAL_ERROR", "FORUM_UPLOAD_MAX_BYTES 必须是正整数");
  return value;
}

function uploadRoot(): string {
  const root = resolve(process.env.UPLOAD_PATH ?? "./storage/uploads");
  const workspace = resolve(process.cwd());
  const publicDir = resolve(workspace, "public");
  if (root === workspace || root === publicDir || isWithin(publicDir, root))
    throw new AppError("INTERNAL_ERROR", "UPLOAD_PATH 配置不安全");
  return root;
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path !== "" && path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

/** 强制 forum/ 前缀，论坛内容接口即使遇到异常数据也不能读取 repairs/ 等内部资源。 */
function safePath(storageKey: string): string {
  if (
    !storageKey.startsWith("forum/") ||
    storageKey.includes("\\") ||
    storageKey.startsWith("/") ||
    isAbsolute(storageKey)
  )
    throw new AppError("FORUM_IMAGE_STORAGE_FAILED", "图片存储路径无效");
  const root = uploadRoot();
  const target = resolve(root, storageKey);
  if (!isWithin(root, target))
    throw new AppError("FORUM_IMAGE_STORAGE_FAILED", "图片存储路径无效");
  return target;
}

export const localForumImageStorage: ForumImageStorage = {
  async put(input) {
    const id = randomUUID();
    const extension =
      input.mimeType === "image/jpeg" ? ".jpg" : input.mimeType === "image/png" ? ".png" : ".webp";
    const storageKey = `forum/${id.slice(0, 2)}/${id}${extension}`;
    const target = safePath(storageKey);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, input.bytes, { flag: "wx" });
    return { storageKey };
  },
  async open(storageKey) {
    return readFile(safePath(storageKey));
  },
  async delete(storageKey) {
    try {
      await unlink(safePath(storageKey));
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
        throw error;
    }
  },
};
