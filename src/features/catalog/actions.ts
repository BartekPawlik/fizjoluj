"use server";

import { redirect } from "next/navigation";

import { requireAdministrator } from "@/features/auth/session";
import { readString, readUuid } from "@/features/auth/validation";
import { catalogEditorHref, readEntry, readSelection, readSemesterNumber, type CatalogSelection } from "@/features/catalog/validation";

function finish(selection: CatalogSelection, status: string): never {
  redirect(catalogEditorHref(selection, status));
}

function saveStatus(error: { code: string } | null) {
  if (!error) return "saved";
  if (error.code === "23505") return "duplicate";
  if (["22023", "23503", "23514"].includes(error.code)) return "invalid";
  return "failed";
}

export async function createSemester(form: FormData) {
  const supabase = await requireAdministrator();
  const institution_id = readUuid(form, "institutionId");
  const semester_number = readSemesterNumber(form);
  if (!institution_id || !semester_number) finish({}, "invalid");
  const { data, error } = await supabase.from("study_semesters")
    .insert({ institution_id, semester_number }).select("id").single();
  finish({ semesterId: data?.id }, saveStatus(error));
}

export async function changeSemesterVisibility(form: FormData) {
  const supabase = await requireAdministrator();
  const selection = readSelection(form);
  const cohortId = readUuid(form, "cohortId");
  const visible = readString(form, "visible");
  if (!selection.semesterId || !cohortId || (visible !== "true" && visible !== "false")) {
    finish(selection, "invalid");
  }
  const { error } = await supabase.rpc("set_study_semester_visibility", {
    target_semester_id: selection.semesterId, target_cohort_id: cohortId, visible: visible === "true",
  });
  finish(selection, saveStatus(error));
}

export async function saveSubject(form: FormData) {
  const supabase = await requireAdministrator();
  const { semesterId } = readSelection(form);
  const entry = readEntry(form);
  if (!semesterId || !entry) finish({ semesterId }, "invalid");

  const subjects = supabase.from("study_subjects");
  const { data, error } = entry.id
    ? await subjects.update(entry.values).eq("id", entry.id).eq("semester_id", semesterId).select("id").single()
    : await subjects.insert({ ...entry.values, semester_id: semesterId }).select("id").single();
  finish({ semesterId, subjectId: data?.id ?? entry.id ?? undefined }, saveStatus(error));
}

export async function saveSection(form: FormData) {
  const supabase = await requireAdministrator();
  const { semesterId, subjectId } = readSelection(form);
  const entry = readEntry(form);
  if (!subjectId || !entry) finish({ semesterId, subjectId }, "invalid");

  const sections = supabase.from("study_sections");
  const { data, error } = entry.id
    ? await sections.update(entry.values).eq("id", entry.id).eq("subject_id", subjectId).select("id").single()
    : await sections.insert({ ...entry.values, subject_id: subjectId }).select("id").single();
  finish({ semesterId, subjectId, sectionId: data?.id ?? entry.id ?? undefined }, saveStatus(error));
}

export async function saveTopic(form: FormData) {
  const supabase = await requireAdministrator();
  const selection = readSelection(form);
  const { sectionId } = selection;
  const entry = readEntry(form);
  if (!sectionId || !entry) finish(selection, "invalid");

  const topics = supabase.from("study_topics");
  const { error } = entry.id
    ? await topics.update(entry.values).eq("id", entry.id).eq("section_id", sectionId).select("id").single()
    : await topics.insert({ ...entry.values, section_id: sectionId });
  finish(selection, saveStatus(error));
}
