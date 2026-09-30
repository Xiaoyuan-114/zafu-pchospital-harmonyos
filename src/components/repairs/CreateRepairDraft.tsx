"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
export function CreateRepairDraft() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: "{}",
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error.message);
      router.replace(`/member/repairs/${json.data.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建草稿失败");
      setBusy(false);
    }
  }
  return (
    <Card className="repair-panel repair-create">
      <h2 className="text-display-3 font-bold">建立一条空白草稿</h2>
      <p className="text-ink-2">草稿只对你和管理员可见。建立后即可上传照片并逐步填写。</p>
      {error ? (
        <p className="signup__status signup__status--alert" role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="solid" disabled={busy} onClick={() => void create()}>
        {busy ? "正在创建…" : "创建并继续编辑"}
      </Button>
    </Card>
  );
}
