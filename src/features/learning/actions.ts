"use server";

import { requireProfile } from "@/features/auth/session";
import { readRatingInput } from "@/features/learning/validation";

export async function rateFlashcard(value: unknown) {
  const { supabase, profile } = await requireProfile();
  if (profile?.role !== "student" || !profile.email_confirmed_at) return { status: "forbidden" } as const;
  const input = readRatingInput(value);
  if (!input) return { status: "failed" } as const;

  const { data, error } = await supabase.rpc("rate_study_flashcard", {
    target_assessment_id: input.assessmentId,
    target_topic_id: input.topicId,
    target_revision_id: input.revisionId,
    target_flashcard_id: input.flashcardId,
    target_rating: input.rating,
    expected_version: input.expectedVersion,
  });
  if (error?.code === "40001") return { status: "conflict" } as const;
  if (error?.code === "42501") return { status: "forbidden" } as const;
  if (error || data === null) return { status: "failed" } as const;
  return { status: "rated", version: data } as const;
}
