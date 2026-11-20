import { readString, readUuid } from "@/features/auth/validation";

export function readSemesterNumber(form: FormData) {
  const value = readString(form, "semesterNumber");
  return /^(?:[1-9]|10)$/.test(value) ? Number(value) : null;
}

export function readEntry(form: FormData) {
  const name = readString(form, "name").trim();
  const position = readString(form, "position");
  const id = readUuid(form, "entryId");
  if (!name || name.length > 250 || !/^\d{1,4}$/.test(position) || (form.has("entryId") && !id)) return null;
  return { id, values: { name, position: Number(position) } };
}

export type CatalogSelection = { semesterId?: string; subjectId?: string; sectionId?: string };

export function catalogEditorHref(selection: CatalogSelection, status?: string) {
  const query = new URLSearchParams();
  if (selection.semesterId) query.set("semestr", selection.semesterId);
  if (selection.subjectId) query.set("przedmiot", selection.subjectId);
  if (selection.sectionId) query.set("dzial", selection.sectionId);
  if (status) query.set("status", status);
  return query.size ? `/admin/katalog?${query}` : "/admin/katalog";
}

export function readSelection(form: FormData): CatalogSelection {
  return {
    semesterId: readUuid(form, "semesterId") ?? undefined,
    subjectId: readUuid(form, "subjectId") ?? undefined,
    sectionId: readUuid(form, "sectionId") ?? undefined,
  };
}
