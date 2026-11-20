import { isUuid, readString } from "@/features/auth/validation";

export function assessmentAdminHref(subjectId: string, assessmentId?: string, status?: string) {
  const query = new URLSearchParams();
  if (assessmentId) query.set("zaliczenie", assessmentId);
  if (status) query.set("status", status);
  return `/admin/katalog/zaliczenia/${subjectId}${query.size ? `?${query}` : ""}`;
}

export function readAssessmentVersion(form: FormData) {
  const value = readString(form, "editVersion");
  return /^\d{1,10}$/.test(value) && Number(value) <= 2147483647 ? Number(value) : null;
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const instant = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

export function assessmentDateFieldName(cohortId: string, locationId?: string) {
  return `date/${cohortId}/${locationId ?? "all"}`;
}

export function readAssessmentForm(form: FormData) {
  const name = readString(form, "name").trim();
  const editVersion = readAssessmentVersion(form);
  if (!name || name.length > 250 || editVersion === null) return null;

  const topicIds = new Set<string>();
  for (const submitted of form.getAll("topicId")) {
    if (!isUuid(submitted) || topicIds.has(submitted.toLowerCase())) return null;
    topicIds.add(submitted.toLowerCase());
  }

  const dates: { cohort_id: string; location_id: string | null; scheduled_on: string }[] = [];
  const dateFields = new Set<string>();
  for (const [field, value] of form) {
    if (!field.startsWith("date/")) continue;
    const [, cohortId, locationId, extra] = field.split("/");
    if (extra !== undefined || !isUuid(cohortId) || (locationId !== "all" && !isUuid(locationId))
      || typeof value !== "string" || dateFields.has(field.toLowerCase())) return null;
    dateFields.add(field.toLowerCase());
    if (value === "") continue;
    if (!isCalendarDate(value)) return null;
    dates.push({ cohort_id: cohortId, location_id: locationId === "all" ? null : locationId, scheduled_on: value });
  }

  return { name, editVersion, topicIds: [...topicIds], dates };
}
