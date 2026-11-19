"use server";

import { redirect } from "next/navigation";

import { requireAdministrator } from "@/features/auth/session";
import { readPage, readUuid } from "@/features/auth/validation";

function finish(form: FormData, status: string): never {
  redirect(`/admin?page=${readPage(form.get("page"))}&status=${status}`);
}

export async function saveStudentAccess(form: FormData) {
  const supabase = await requireAdministrator();
  const student_id = readUuid(form, "studentId");
  const campus_id = readUuid(form, "locationId");
  const intake_id = readUuid(form, "cohortId");
  if (!student_id || !campus_id || !intake_id) finish(form, "invalid");

  const { error } = await supabase.rpc("grant_student_access", { student_id, campus_id, intake_id });
  finish(form, error?.code === "22023" ? "invalid" : error ? "failed" : "saved");
}

export async function removeStudentAccess(form: FormData) {
  const supabase = await requireAdministrator();
  const student_id = readUuid(form, "studentId");
  if (!student_id) finish(form, "invalid");

  const { error } = await supabase.rpc("revoke_student_access", { student_id });
  finish(form, error ? "failed" : "revoked");
}
