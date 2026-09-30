"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { communityCopy } from "@/config/community";

type Props = {
  recordId: string;
  isDifficult: boolean;
  isTypical: boolean;
  onChanged: (next: { isDifficult: boolean; isTypical: boolean }) => void;
};

export function RepairFlagControls({ recordId, isDifficult, isTypical, onChanged }: Props) {
  const copy = communityCopy.flags;
  const [difficult, setDifficult] = useState(isDifficult);
  const [typical, setTypical] = useState(isTypical);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/admin/repairs/${recordId}/flags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDifficult: difficult, isTypical: typical }),
      });
      const json = await response.json();
      if (!json.success) {
        setMessage(json.error?.message ?? copy.saveFailed);
        return;
      }
      onChanged({ isDifficult: difficult, isTypical: typical });
      setMessage(copy.saved);
    } catch {
      setMessage(copy.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="community-flags"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <label>
        <input
          type="checkbox"
          checked={difficult}
          onChange={(event) => setDifficult(event.target.checked)}
        />
        {copy.difficult}
      </label>
      <label>
        <input
          type="checkbox"
          checked={typical}
          onChange={(event) => setTypical(event.target.checked)}
        />
        {copy.typical}
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? copy.saving : copy.save}
      </Button>
      {message ? <p className="community-composer__hint">{message}</p> : null}
    </form>
  );
}
