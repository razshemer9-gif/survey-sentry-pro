// The field photos on one checklist item.
//
// A photo used to be a single field, and reports in the field still carry it
// that way, so the list lives in two places: `photo` holds the first one and
// `photos` the rest. Reading and writing both go through here, so a report
// written before an element could carry more than one photo still opens with
// its photo in place — and anything that only ever looked at `photo` (the
// report list's thumbnail, an older build still on someone's phone) keeps
// finding it there.

import type { ChecklistItem } from "./types";

export type PhotoFields = Pick<ChecklistItem, "photo" | "photos">;

/** Every field photo on the item, in the order they were added. */
export function itemPhotos(item: PhotoFields): string[] {
  const list: string[] = item.photo ? [item.photo] : [];
  for (const p of item.photos ?? []) if (p && !list.includes(p)) list.push(p);
  return list;
}

/** The patch that stores a photo list back on an item. */
export function itemPhotosPatch(list: string[]): PhotoFields {
  const clean = list.filter(Boolean);
  return { photo: clean[0], photos: clean.length > 1 ? clean.slice(1) : undefined };
}
