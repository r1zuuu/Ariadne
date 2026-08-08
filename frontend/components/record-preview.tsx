"use client";

// The right column of the onboarding screen: the record as it stands, growing as
// the answers come in.
//
// It exists to fill a void with something that teaches rather than decorates.
// Two thirds of the screen was empty plaster, and the question "why am I typing
// this" had no answer on screen. Now the answer is visible: this is the record,
// and the agent reads it.
//
// Nothing here is a card. A border on the left of the column and a background
// step, per the Paper Rule.

export type Entry = { label: string; value: string };

export function RecordPreview({
  title,
  note,
  entries,
  emptyNote,
}: {
  title: string;
  note?: string;
  entries: Entry[];
  emptyNote: string;
}) {
  const filled = entries.filter((entry) => entry.value.trim());

  return (
    <aside className="border-l border-hairline pl-8">
      <h2 className="text-label uppercase tracking-[0.12em] text-ink-3">{title}</h2>

      {filled.length === 0 ? (
        <p className="pt-5 text-small text-ink-3">{emptyNote}</p>
      ) : (
        <dl className="pt-5">
          {filled.map((entry) => (
            <div key={entry.label} className="border-b border-hairline py-4 first:pt-0">
              <dt className="text-label uppercase tracking-[0.12em] text-ink-3">
                {entry.label}
              </dt>
              <dd className="pt-2 text-small text-ink">{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {note && filled.length > 0 ? <p className="pt-6 text-small text-ink-2">{note}</p> : null}
    </aside>
  );
}
