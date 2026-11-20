import { isUuid, readString } from "@/features/auth/validation";
import type { StudyAssetType } from "@/types/database";

export type StudyFlashcard = { id: string; prompt: string; answer: string };
export type StudyQuestion = { id: string; prompt: string; options: string[]; correctOption: number; explanation: string };
export const STUDY_ITEM_LIMIT = 40;
export const STUDY_ASSET_BUCKET = "study-topic-assets";
export const STUDY_ASSET_SIZE = 4 * 1024 * 1024;

function readText(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > maxLength || (required && !trimmed) ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCard(value: unknown): StudyFlashcard | null {
  if (!isRecord(value) || !isUuid(value.id)) return null;
  const prompt = readText(value.prompt, 1000, true);
  const answer = readText(value.answer, 8000, true);
  return prompt && answer ? { id: value.id, prompt, answer } : null;
}

function readQuestion(value: unknown): StudyQuestion | null {
  if (!isRecord(value) || !isUuid(value.id) || !Array.isArray(value.options) || value.options.length !== 4) return null;
  const prompt = readText(value.prompt, 1000, true);
  const options = value.options.map((option: unknown) => readText(option, 1000, true));
  const explanation = readText(value.explanation, 4000);
  if (!prompt || explanation === null || options.some((option) => option === null)
    || typeof value.correctOption !== "number" || ![0, 1, 2, 3].includes(value.correctOption)) return null;
  const labels = options.filter((option): option is string => option !== null);
  if (new Set(labels.map((label) => label.toLowerCase())).size !== 4) return null;
  return { id: value.id, prompt, options: labels, correctOption: value.correctOption, explanation };
}

function readItems<T extends { id: string }>(value: unknown, parse: (item: unknown) => T | null) {
  if (!Array.isArray(value) || value.length > STUDY_ITEM_LIMIT) return null;
  const ids = new Set<string>();
  const result: T[] = [];
  for (const raw of value) {
    const item = parse(raw);
    if (!item || ids.has(item.id.toLowerCase())) return null;
    ids.add(item.id.toLowerCase());
    result.push(item);
  }
  return result;
}

export function readFlashcards(value: unknown) {
  return readItems(value, readCard);
}

export function readQuestions(value: unknown) {
  return readItems(value, readQuestion);
}

function readJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function readDraftForm(form: FormData) {
  const target = readDraftTarget(form);
  const notes = readString(form, "notes").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const mnemonic = readText(form.get("mnemonic"), 4000);
  const correction = readText(form.get("correction"), 4000);
  const sourceLabel = readText(form.get("sourceLabel"), 200);
  const sourceUrl = readText(form.get("sourceUrl"), 2048);
  const flashcards = readFlashcards(readJson(readString(form, "flashcards")));
  const questions = readQuestions(readJson(readString(form, "questions")));
  if (!target || notes.length > 100 || notes.some((line) => line.length > 4000)
    || mnemonic === null || correction === null || !flashcards || !questions
    || sourceLabel === null || sourceUrl === null || Boolean(sourceUrl) !== Boolean(sourceLabel)
    || (sourceUrl && !isSourceUrl(sourceUrl))) return null;
  return { ...target, notes, mnemonic, correction, sourceLabel, sourceUrl, flashcards, questions };
}

export function isSourceUrl(value: string) {
  if (!value.startsWith("https://") || /\s/.test(value)) return false;
  const url = URL.parse(value);
  return url?.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
}

export function readDraftTarget(form: FormData) {
  return readDraftTargetValues(form.get("revisionId"), form.get("editVersion"));
}

function readDraftTargetValues(revisionId: unknown, version: unknown) {
  if (!isUuid(revisionId) || typeof version !== "string" || !/^\d{1,10}$/.test(version)
    || Number(version) > 2147483647) return null;
  return { revisionId, editVersion: Number(version) };
}

export function readSubjectDraftTargets(form: FormData) {
  const ids = form.getAll("revisionId");
  const versions = form.getAll("editVersion");
  if (!ids.length || ids.length !== versions.length) return null;

  const targets: { revisionId: string; editVersion: number }[] = [];
  const seen = new Set<string>();
  for (const [index, id] of ids.entries()) {
    const target = readDraftTargetValues(id, versions[index]);
    if (!target) return null;
    const revisionId = target.revisionId.toLowerCase();
    if (seen.has(revisionId)) return null;
    seen.add(revisionId);
    targets.push(target);
  }
  return targets;
}

const mediaTypes = {
  "image/png": { extension: "png", signatures: [[0, [137, 80, 78, 71, 13, 10, 26, 10]]] },
  "image/jpeg": { extension: "jpg", signatures: [[0, [255, 216, 255]]] },
  "image/webp": { extension: "webp", signatures: [[0, [82, 73, 70, 70]], [8, [87, 69, 66, 80]]] },
  "application/pdf": { extension: "pdf", signatures: [[0, [37, 80, 68, 70, 45]]] },
} satisfies Record<StudyAssetType, { extension: string; signatures: [number, number[]][] }>;

function isMediaType(value: string): value is StudyAssetType {
  return Object.hasOwn(mediaTypes, value);
}

export async function readAssetForm(form: FormData) {
  const file = form.get("file");
  const title = readText(form.get("title"), 200, true);
  const alt = readText(form.get("alt"), 300);
  if (!(file instanceof File) || file.size < 1 || file.size > STUDY_ASSET_SIZE
    || !title || alt === null || !isMediaType(file.type) || (file.type !== "application/pdf" && !alt)) return null;
  const contentType = file.type;
  const { extension, signatures } = mediaTypes[contentType];
  const prefix = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!signatures.every(([offset, bytes]) => bytes.every((byte, index) => prefix[offset + index] === byte))) return null;
  return { file, title, alt, extension, contentType };
}
