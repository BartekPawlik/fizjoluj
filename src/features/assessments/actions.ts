"use server";

import { notFound, redirect } from "next/navigation";

import { isUuid } from "@/features/auth/validation";
import { requireAdministrator } from "@/features/auth/session";
import { assessmentAdminHref, readAssessmentForm, readAssessmentVersion } from "@/features/assessments/validation";

export type AssessmentFormState = { message?: string };

export async function saveAssessment(
  subjectId: string,
  assessmentId: string | null,
  _state: AssessmentFormState,
  form: FormData,
): Promise<AssessmentFormState> {
  const supabase = await requireAdministrator();
  if (!isUuid(subjectId) || (assessmentId !== null && !isUuid(assessmentId))) notFound();
  const assessment = readAssessmentForm(form);
  if (!assessment) return { message: "Sprawdź nazwę, wybrane tematy i daty." };

  const { data, error } = await supabase.rpc("save_study_assessment", {
    target_subject_id: subjectId,
    target_assessment_id: assessmentId,
    expected_version: assessment.editVersion,
    assessment_name: assessment.name,
    scope_topic_ids: assessment.topicIds,
    assessment_dates: assessment.dates,
  });
  if (error?.code === "40001") {
    return { message: "Zaliczenie zmieniło się w innej karcie. Otwórz aktualną wersję przed ponownym zapisem." };
  }
  if (error?.code === "23505") return { message: "Zaliczenie o tej nazwie już istnieje w tym przedmiocie." };
  if (error?.code === "22023") return { message: "Sprawdź wybrane tematy i terminy. Opublikowane zaliczenie musi mieć zakres." };
  if (error || !isUuid(data)) return { message: "Nie udało się zapisać zaliczenia. Spróbuj ponownie." };
  redirect(assessmentAdminHref(subjectId, data, "saved"));
}

export async function publishAssessment(subjectId: string, assessmentId: string, form: FormData) {
  const supabase = await requireAdministrator();
  if (!isUuid(subjectId) || !isUuid(assessmentId)) notFound();
  const version = readAssessmentVersion(form);
  if (version === null) redirect(assessmentAdminHref(subjectId, assessmentId, "invalid"));

  const { error } = await supabase.rpc("publish_study_assessment", {
    target_subject_id: subjectId,
    target_assessment_id: assessmentId,
    expected_version: version,
  });
  let status = "published";
  if (error) {
    if (error.code === "40001") status = "conflict";
    else if (error.code === "22023") status = "invalid";
    else status = "failed";
  }
  redirect(assessmentAdminHref(subjectId, assessmentId, status));
}
