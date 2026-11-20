import { isUuid } from "@/features/auth/validation";
import type { StudyFlashcard } from "@/features/editorial/validation";
import type { StudyFlashcardRating } from "@/types/database";

export type FlashcardProgress = { rating: StudyFlashcardRating; version: number };

export type SessionFlashcard = StudyFlashcard & {
  topicId: string;
  topicName: string;
  revisionId: string;
  memoryHint: string;
  progress: FlashcardProgress | null;
};

export function flashcardKey(topicId: string, flashcardId: string) {
  return `${topicId}/${flashcardId.toLowerCase()}`;
}

export function readRatingInput(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { assessmentId, topicId, revisionId, flashcardId, rating, expectedVersion } = value as Record<string, unknown>;
  if ((assessmentId !== null && !isUuid(assessmentId)) || !isUuid(topicId) || !isUuid(revisionId) || !isUuid(flashcardId)
    || (rating !== "known" && rating !== "review") || typeof expectedVersion !== "number"
    || !Number.isInteger(expectedVersion) || expectedVersion < 0 || expectedVersion > 2147483646) return null;
  return { assessmentId, topicId, revisionId, flashcardId, rating, expectedVersion } as const;
}
