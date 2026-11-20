"use server";

import { notFound, redirect } from "next/navigation";

import { requireAdministrator } from "@/features/auth/session";
import { isUuid, readUuid } from "@/features/auth/validation";
import { readAssetForm, readDraftForm, readDraftTarget, readSubjectDraftTargets, STUDY_ASSET_BUCKET } from "@/features/editorial/validation";

export type DraftFormState = { message?: string };

function topicEditor(topicId: string, status: string, preview = false): never {
  if (!isUuid(topicId)) notFound();
  const query = new URLSearchParams({ status });
  if (preview) query.set("podglad", "1");
  redirect(`/admin/katalog/tematy/${topicId}?${query}`);
}

function failureStatus(code: string) {
  if (code === "40001") return "conflict";
  if (code === "22023" || code === "23514" || code === "23502") return "invalid";
  return "failed";
}

export async function startDraft(topicId: string) {
  const supabase = await requireAdministrator();
  if (!isUuid(topicId)) notFound();
  const { error } = await supabase.rpc("open_study_topic_draft", { target_topic_id: topicId });
  topicEditor(topicId, error ? failureStatus(error.code) : "opened");
}

export async function saveDraft(topicId: string, _state: DraftFormState, form: FormData): Promise<DraftFormState> {
  const supabase = await requireAdministrator();
  if (!isUuid(topicId)) notFound();
  const draft = readDraftForm(form);
  if (!draft) {
    return { message: "Sprawdź długość pól, adres źródła i pytania. Każde pytanie musi mieć cztery różne odpowiedzi." };
  }
  const { error } = await supabase.rpc("save_study_topic_draft", {
    target_revision_id: draft.revisionId,
    expected_version: draft.editVersion,
    note_lines: draft.notes,
    memory_hint: draft.mnemonic,
    source_correction: draft.correction,
    reference_label: draft.sourceLabel,
    reference_url: draft.sourceUrl,
    cards: draft.flashcards,
    quiz_items: draft.questions,
  });
  if (error?.code === "40001") {
    return { message: "Wersja szkicu zmieniła się w innej karcie. Skopiuj swoje zmiany przed odświeżeniem strony." };
  }
  if (error) return { message: "Nie udało się zapisać szkicu. Sprawdź dane i spróbuj ponownie." };
  topicEditor(topicId, "saved", form.get("next") === "preview");
}

export async function publishDraft(topicId: string, form: FormData) {
  const supabase = await requireAdministrator();
  if (!isUuid(topicId)) notFound();
  const target = readDraftTarget(form);
  if (!target) topicEditor(topicId, "invalid", true);
  const { error } = await supabase.rpc("publish_study_topic_draft", {
    target_revision_id: target.revisionId, expected_version: target.editVersion,
  });
  topicEditor(topicId, error ? failureStatus(error.code) : "published", Boolean(error));
}

export async function publishSubjectDrafts(subjectId: string, form: FormData) {
  const supabase = await requireAdministrator();
  if (!isUuid(subjectId)) notFound();
  const previewHref = `/admin/katalog/publikacja/${subjectId}`;
  const drafts = readSubjectDraftTargets(form);
  if (!drafts) redirect(previewHref + "?status=invalid");

  const { error } = await supabase.rpc("publish_study_subject_drafts", {
    target_subject_id: subjectId,
    expected_revision_ids: drafts.map(({ revisionId }) => revisionId),
    expected_edit_versions: drafts.map(({ editVersion }) => editVersion),
  });
  const status = error ? (error.code === "PGRST202" ? "setup" : failureStatus(error.code)) : "published";
  redirect(`${previewHref}?status=${status}`);
}

export async function withdrawPublication(topicId: string, form: FormData) {
  const supabase = await requireAdministrator();
  if (!isUuid(topicId)) notFound();
  const revision = readUuid(form, "revisionId");
  if (!revision) topicEditor(topicId, "invalid");
  const { error } = await supabase.rpc("withdraw_study_topic_publication", {
    target_topic_id: topicId, published_revision_id: revision,
  });
  topicEditor(topicId, error ? failureStatus(error.code) : "withdrawn");
}

export async function uploadStudyAsset(topicId: string, form: FormData) {
  const supabase = await requireAdministrator();
  if (!isUuid(topicId)) notFound();
  const target = readDraftTarget(form);
  const asset = await readAssetForm(form);
  if (!target || !asset) topicEditor(topicId, "asset-invalid");
  const bucket = supabase.storage.from(STUDY_ASSET_BUCKET);
  const objectPath = `${target.revisionId}/${crypto.randomUUID()}.${asset.extension}`;
  const upload = await bucket.upload(objectPath, asset.file, { contentType: asset.contentType, upsert: false });
  if (upload.error) topicEditor(topicId, "asset-failed");

  const { error } = await supabase.rpc("attach_study_topic_asset", {
    target_revision_id: target.revisionId, expected_version: target.editVersion,
    asset_path: objectPath, asset_title: asset.title, asset_alt: asset.alt, asset_content_type: asset.contentType,
  });
  if (error) {
    await bucket.remove([objectPath]);
    topicEditor(topicId, failureStatus(error.code));
  }
  topicEditor(topicId, "asset-saved");
}

export async function removeStudyAsset(topicId: string, form: FormData) {
  const supabase = await requireAdministrator();
  if (!isUuid(topicId)) notFound();
  const target = readDraftTarget(form);
  const assetId = readUuid(form, "assetId");
  if (!target || !assetId) topicEditor(topicId, "invalid");
  const { data: orphanPath, error } = await supabase.rpc("remove_study_topic_asset", {
    target_revision_id: target.revisionId, expected_version: target.editVersion, target_asset_id: assetId,
  });
  if (error) topicEditor(topicId, failureStatus(error.code));
  if (orphanPath) await supabase.storage.from(STUDY_ASSET_BUCKET).remove([orphanPath]);
  topicEditor(topicId, "asset-removed");
}
