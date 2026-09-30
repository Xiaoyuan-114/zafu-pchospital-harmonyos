"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  defaultRepairResult,
  formatBytes,
  repairEditorCopy,
  repairFieldLimits,
  repairResultLabels,
} from "@/config/repairs";
import { shanghaiToday } from "@/lib/shanghai-date";
import type { RepairCategoryView, RepairDetailView } from "@/types/contracts";

/** 点击整块日期输入框都弹出原生日历（默认只有右侧小图标会弹）。 */
function openDatePicker(event: ReactMouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {
    // 浏览器拒绝时（非用户手势、选择器已打开）忽略：原生点击行为不受影响。
  }
}

export function RepairEditor({ recordId }: { recordId: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<RepairDetailView>();
  const [categories, setCategories] = useState<RepairCategoryView[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "forbidden">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setState("loading");
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/v1/repairs/${recordId}`, { cache: "no-store" }),
        fetch("/api/v1/repair-categories", { cache: "no-store" }),
      ]);
      const detail = await a.json();
      const cats = await b.json();
      if (!detail.success) {
        setState(
          detail.error.code === "REPAIR_FORBIDDEN" || detail.error.code === "REPAIR_NOT_FOUND"
            ? "forbidden"
            : "error",
        );
        return;
      }
      if (!detail.data.canEdit) {
        setState("forbidden");
        return;
      }
      // 「不填默认今天」：空值（含更早留下的草稿）打开时即按今天显示，
      // 保存或提交那一刻才真正写进库。
      setRecord(
        detail.data.repairDate === null
          ? { ...detail.data, repairDate: shanghaiToday() }
          : detail.data,
      );
      setCategories(cats.success ? cats.data : []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [recordId]);
  useEffect(() => {
    void load();
  }, [load]);
  function field<K extends keyof RepairDetailView>(key: K, value: RepairDetailView[K]) {
    setRecord((current) => (current ? { ...current, [key]: value } : current));
  }
  /** 保存当前表单，返回服务端视图 —— `PATCH` 返回的是列表视图（无 `reviews` / `timeline`），故用合并。 */
  async function persist(): Promise<RepairDetailView> {
    if (!record) throw new Error("记录尚未加载");
    const response = await fetch(`/api/v1/repairs/${recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: record.version,
        repairDate: record.repairDate,
        categoryId: record.category?.id ?? null,
        content: record.content,
        result: record.result ?? defaultRepairResult,
      }),
    });
    const json = await response.json();
    if (!json.success) throw new Error(json.error.message);
    setRecord((current) => (current ? { ...current, ...json.data } : json.data));
    return json.data as RepairDetailView;
  }
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await persist();
      setMessage("草稿已保存。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      // 先把当前表单存一次再提交：否则「填了但没保存」会被服务端的完整性校验拦下。
      const saved = await persist();
      const response = await fetch(`/api/v1/repairs/${recordId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ version: saved.version }),
      });
      const json = await response.json();
      if (!json.success) {
        const fields = json.error.fieldErrors
          ? Object.values(json.error.fieldErrors).flat().join("；")
          : "";
        throw new Error(fields || json.error.message);
      }
      router.replace(`/member/repairs/${recordId}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "提交失败");
      setBusy(false);
    }
  }
  /** 照片是即时保存的，只合并照片 —— 整块重载会丢掉表单里还没保存的改动。 */
  async function refreshPhotos() {
    const response = await fetch(`/api/v1/repairs/${recordId}`, { cache: "no-store" });
    const json = await response.json();
    if (!json.success) return;
    setRecord((current) => (current ? { ...current, photos: json.data.photos } : current));
  }
  async function upload(files: File[]) {
    if (!files.length || !record) return;
    const selected = files;
    const { maxBytes, maxFiles } = record.photoLimits;
    // 先按服务端下发的上限拦一遍：超限的文件根本传不上去，不必等 multipart 走完再说。
    const oversized = selected.find((file) => file.size > maxBytes);
    if (oversized) {
      setMessage(
        repairEditorCopy.photoTooLarge
          .replace("{name}", oversized.name)
          .replace("{size}", formatBytes(oversized.size))
          .replace("{limit}", formatBytes(maxBytes)),
      );
      return;
    }
    if (record.photos.length + selected.length > maxFiles) {
      setMessage(
        repairEditorCopy.photoTooMany
          .replace("{count}", String(record.photos.length))
          .replace("{remain}", String(Math.max(maxFiles - record.photos.length, 0))),
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      selected.forEach((file) => form.append("photos", file));
      const response = await fetch(`/api/v1/repairs/${recordId}/photos`, {
        method: "POST",
        body: form,
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error.message);
      await refreshPhotos();
      setMessage("照片已上传。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }
  async function remove(photoId: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/repairs/${recordId}/photos/${photoId}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error.message);
      await refreshPhotos();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "移除失败");
    } finally {
      setBusy(false);
    }
  }
  async function reorder(photoId: string, sortOrder: number) {
    await fetch(`/api/v1/repairs/${recordId}/photos/${photoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder }),
    });
    await refreshPhotos();
  }
  if (state === "loading") return <p role="status">正在加载草稿…</p>;
  if (state === "error")
    return (
      <Card variant="notice">
        <p>记录加载失败。</p>
        <Button onClick={() => void load()}>重试</Button>
      </Card>
    );
  if (state === "forbidden")
    return (
      <Card variant="notice">
        <p>这条记录不存在，或当前状态不允许编辑。</p>
        <Button href="/member/repairs">返回列表</Button>
      </Card>
    );
  if (!record) return null;
  const rejection = [...record.reviews].reverse().find((item) => item.decision === "REJECTED");
  const photoHint = repairEditorCopy.photoHint
    .replace("{size}", formatBytes(record.photoLimits.maxBytes))
    .replace("{count}", String(record.photoLimits.maxFiles));
  return (
    <div className="repair-editor">
      {rejection ? (
        <Card variant="notice">
          <strong>最新退回原因</strong>
          <p>{rejection.note}</p>
        </Card>
      ) : null}
      <Card className="repair-panel">
        <form
          className="gap-s-5 grid"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="gap-s-4 grid items-start md:grid-cols-2">
            <label className="field">
              <span className="field__label">
                维修日期
                <span className="field__req">{repairEditorCopy.requiredMark}</span>
              </span>
              <input
                className="field__input"
                type="date"
                value={record.repairDate ?? ""}
                min={repairFieldLimits.repairDateMin}
                max={shanghaiToday()}
                onClick={openDatePicker}
                onChange={(e) => field("repairDate", e.target.value || null)}
              />
              <span className="field__hint">{repairEditorCopy.dateHint}</span>
            </label>
            <label className="field">
              <span className="field__label">
                故障分类
                <span className="field__req">{repairEditorCopy.requiredMark}</span>
              </span>
              <select
                className="field__input"
                value={record.category?.id ?? ""}
                onChange={(e) =>
                  field("category", categories.find((c) => c.id === e.target.value) ?? null)
                }
              >
                <option value="">请选择</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field__label">
              维修内容
              <span className="field__req">{repairEditorCopy.requiredMark}</span>
            </span>
            <textarea
              className="field__input min-h-40"
              maxLength={repairFieldLimits.contentMaxLength}
              value={record.content ?? ""}
              onChange={(e) => field("content", e.target.value)}
              aria-describedby="repair-content-hint"
            />
            <span className="field__hint" id="repair-content-hint">
              {repairEditorCopy.contentHint}
            </span>
          </label>
          <p className="field__hint">{repairEditorCopy.requiredNote}</p>
          <p className="field__hint">
            维修结果默认为「{repairResultLabels[defaultRepairResult]}」，保存与提交都会按此记录。
          </p>
          <p className="field__hint">当前版本：{record.version}</p>
          <div className="signup__actions">
            <Button type="submit" disabled={busy}>
              保存草稿
            </Button>
            <Button type="button" variant="solid" disabled={busy} onClick={() => void submit()}>
              提交审核
            </Button>
          </div>
          {message ? (
            <p className="signup__status" role="status">
              {message}
            </p>
          ) : null}
        </form>
      </Card>
      <Card className="repair-panel">
        <div>
          <h2 className="text-display-3 font-bold">维修照片</h2>
          <p className="text-ink-3">{photoHint}</p>
        </div>
        <label className="field">
          <span className="field__label">选择照片</span>
          <input
            className="field__input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => {
              // 先拷成数组再清空 input：Blink 的 FileList 是活视图，清空 value 会把它一起清空，
              // 存引用再清空等于传了个空列表；拷成数组后「同一张图片再选一次」也能触发 change。
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void upload(files);
            }}
          />
        </label>
        <div className="gap-s-4 grid md:grid-cols-2">
          {record.photos.map((photo, index) => (
            <figure className="gap-s-2 grid" key={photo.id}>
              <Image
                className="rounded-mid border-line h-56 w-full border object-cover"
                src={photo.contentUrl}
                alt={`维修照片 ${index + 1}`}
                width={720}
                height={480}
                unoptimized
              />
              <figcaption className="gap-s-2 flex flex-wrap">
                <Button
                  disabled={index === 0 || busy}
                  onClick={() => void reorder(photo.id, index - 1)}
                >
                  前移
                </Button>
                <Button
                  disabled={index === record.photos.length - 1 || busy}
                  onClick={() => void reorder(photo.id, index + 1)}
                >
                  后移
                </Button>
                <Button disabled={busy} onClick={() => void remove(photo.id)}>
                  移除
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
      </Card>
    </div>
  );
}
