"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { communityCopy } from "@/config/community";
import { repairCopy } from "@/config/repairs";

type Props = {
  recordId: string;
  isFavorited: boolean;
  onChanged: (favorited: boolean) => void;
};

export function FavoriteToggle({ recordId, isFavorited, onChanged }: Props) {
  const copy = communityCopy.favorite;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        isFavorited ? `/api/v1/member/favorites/${recordId}` : "/api/v1/member/favorites",
        {
          method: isFavorited ? "DELETE" : "POST",
          headers: isFavorited ? undefined : { "Content-Type": "application/json" },
          body: isFavorited ? undefined : JSON.stringify({ repairRecordId: recordId }),
        },
      );
      const json = await response.json();
      if (!json.success) {
        setError(json.error?.message ?? repairCopy.list.loadError);
        return;
      }
      onChanged(!isFavorited);
    } catch {
      setError(repairCopy.list.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="community-actions">
      <Button type="button" onClick={() => void toggle()} disabled={busy}>
        {busy ? (isFavorited ? copy.removing : copy.adding) : isFavorited ? copy.remove : copy.add}
      </Button>
      {error ? <p className="community-composer__error">{error}</p> : null}
    </div>
  );
}
