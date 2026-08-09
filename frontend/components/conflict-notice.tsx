"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { lead } from "@/components/entry-card";
import { useFailure } from "@/components/failure";
import { useToast } from "@/components/toast";
import { Button, Card } from "@/components/ui";
import { resolveConflict, type ConflictEntry, type ConflictVerdict } from "@/lib/api";

// Two entries that cannot both be true, and the one question worth asking about
// them: which one still stands.
//
// The pair is shown rather than described. "This contradicts an earlier entry"
// is not enough to decide on, and the decision is the point: an archive that
// knows it disagrees with itself and does nothing about it is worse than one
// that never noticed, because it answers questions from both sides.
//
// Three answers and no fourth. Two of them retire an entry - never delete it,
// so the record still says what was believed before and what replaced it - and
// the third says the model was wrong, which it sometimes is.

export function ConflictNotice({
  nodeId,
  conflicts,
  onResolved,
}: {
  /** The entry that was just written or is waiting to be settled. */
  nodeId: string;
  conflicts: ConflictEntry[];
  onResolved: () => void;
}) {
  const t = useTranslations("conflict");
  const toast = useToast();
  const failure = useFailure();
  const [busy, setBusy] = useState<string | null>(null);
  // Settled pairs leave the component rather than the screen reloading around
  // them: the answer to one clash must not take the others off screen.
  const [settled, setSettled] = useState<string[]>([]);

  const open = conflicts.filter((entry) => !settled.includes(entry.id));
  if (!open.length) return null;

  const settle = async (otherId: string, verdict: ConflictVerdict) => {
    setBusy(otherId);
    try {
      await resolveConflict(nodeId, otherId, verdict);
      setSettled((was) => [...was, otherId]);
      toast(t(`done.${verdict}`));
      onResolved();
    } catch (error) {
      toast(failure(error), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="pt-4">
      {open.map((entry) => (
        <Card key={entry.id} className="border-ochre-mark/40 p-5">
          <p className="text-label uppercase tracking-[0.12em] text-ochre">{t("title")}</p>
          <p className="pt-3 text-small leading-6 text-ink-2">{t("lead")}</p>

          {/* The older entry in full, because a ten word summary is not enough
              to retire something on. */}
          <div className="mt-4 border-l-2 border-ochre-mark/40 pl-5">
            <p className="text-body font-medium leading-7 text-ink">{lead(entry)}</p>
            <p className="whitespace-pre-wrap pt-2 text-small leading-6 text-ink-2">
              {entry.content}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-5">
            <Button disabled={busy !== null} onClick={() => void settle(entry.id, "new")}>
              {t("keepNew")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void settle(entry.id, "old")}
            >
              {t("keepOld")}
            </Button>
            <Button
              variant="quiet"
              disabled={busy !== null}
              onClick={() => void settle(entry.id, "both")}
            >
              {t("keepBoth")}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
