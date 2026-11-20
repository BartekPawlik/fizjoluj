type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

type CatalogTable<Row, Insert, Update = never> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type CatalogEntry = { name: string; position: number };

export type AppRole = "student" | "admin";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
export type StudyRevisionState = "draft" | "published" | "archived";
export type StudyAssetType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

export type StudyTopicRevision = {
  id: string;
  topic_id: string;
  revision_number: number;
  edit_version: number;
  state: StudyRevisionState;
  notes: string[];
  mnemonic: string;
  correction: string;
  source_label: string;
  source_url: string;
  flashcards: Json;
  published_at: string | null;
};

export type StudyTopicAsset = {
  id: string;
  revision_id: string;
  object_path: string;
  title: string;
  alt_text: string;
  content_type: StudyAssetType;
  created_at: string;
};

export type StudyAssessment = {
  id: string;
  subject_id: string;
  name: string;
  edit_version: number;
  published_at: string | null;
};

export type StudyAssessmentDate = {
  id: string;
  assessment_id: string;
  cohort_id: string;
  location_id: string | null;
  scheduled_on: string;
};

export type StudyFlashcardRating = "known" | "review";

export type StudyFlashcardProgress = {
  student_id: string;
  topic_id: string;
  flashcard_id: string;
  rating: StudyFlashcardRating;
  edit_version: number;
  reviewed_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: ReadTable<{
        user_id: string;
        email: string;
        email_confirmed_at: string | null;
        role: AppRole;
      }>;
      institutions: ReadTable<{ id: string; slug: string; name: string }>;
      locations: ReadTable<{ id: string; institution_id: string; name: string }>;
      cohorts: ReadTable<{ id: string; institution_id: string; start_year: number }>;
      memberships: ReadTable<{
        user_id: string;
        institution_id: string;
        location_id: string;
        cohort_id: string;
        active: boolean;
      }>;
      study_semesters: CatalogTable<
        { id: string; institution_id: string; semester_number: number; study_year: number },
        { institution_id: string; semester_number: number }
      >;
      study_semester_offerings: ReadTable<{
        institution_id: string;
        semester_id: string;
        cohort_id: string;
        is_visible: boolean;
      }>;
      study_subjects: CatalogTable<
        CatalogEntry & { id: string; semester_id: string },
        CatalogEntry & { semester_id: string },
        CatalogEntry
      >;
      study_sections: CatalogTable<
        CatalogEntry & { id: string; subject_id: string },
        CatalogEntry & { subject_id: string },
        CatalogEntry
      >;
      study_topics: CatalogTable<
        CatalogEntry & { id: string; section_id: string },
        CatalogEntry & { section_id: string },
        CatalogEntry
      >;
      study_topic_revisions: ReadTable<StudyTopicRevision>;
      study_topic_revision_quizzes: ReadTable<{ revision_id: string; items: Json }>;
      study_topic_revision_assets: ReadTable<StudyTopicAsset>;
      study_assessments: ReadTable<StudyAssessment>;
      study_assessment_topics: ReadTable<{ assessment_id: string; topic_id: string }>;
      study_assessment_dates: ReadTable<StudyAssessmentDate>;
      study_flashcard_progress: ReadTable<StudyFlashcardProgress>;
    };
    Views: Record<never, never>;
    Functions: {
      grant_student_access: {
        Args: { student_id: string; campus_id: string; intake_id: string };
        Returns: undefined;
      };
      revoke_student_access: {
        Args: { student_id: string };
        Returns: undefined;
      };
      set_study_semester_visibility: {
        Args: { target_semester_id: string; target_cohort_id: string; visible: boolean };
        Returns: undefined;
      };
      open_study_topic_draft: { Args: { target_topic_id: string }; Returns: string };
      save_study_topic_draft: {
        Args: {
          target_revision_id: string;
          expected_version: number;
          note_lines: string[];
          memory_hint: string;
          source_correction: string;
          reference_label: string;
          reference_url: string;
          cards: Json;
          quiz_items: Json;
        };
        Returns: undefined;
      };
      publish_study_topic_draft: {
        Args: { target_revision_id: string; expected_version: number };
        Returns: undefined;
      };
      publish_study_subject_drafts: {
        Args: { target_subject_id: string; expected_revision_ids: string[]; expected_edit_versions: number[] };
        Returns: undefined;
      };
      withdraw_study_topic_publication: {
        Args: { target_topic_id: string; published_revision_id: string };
        Returns: undefined;
      };
      attach_study_topic_asset: {
        Args: {
          target_revision_id: string;
          expected_version: number;
          asset_path: string;
          asset_title: string;
          asset_alt: string;
          asset_content_type: StudyAssetType;
        };
        Returns: undefined;
      };
      remove_study_topic_asset: {
        Args: { target_revision_id: string; expected_version: number; target_asset_id: string };
        Returns: string | null;
      };
      save_study_assessment: {
        Args: {
          target_subject_id: string;
          target_assessment_id: string | null;
          expected_version: number;
          assessment_name: string;
          scope_topic_ids: string[];
          assessment_dates: Json;
        };
        Returns: string;
      };
      publish_study_assessment: {
        Args: { target_subject_id: string; target_assessment_id: string; expected_version: number };
        Returns: undefined;
      };
      rate_study_flashcard: {
        Args: {
          target_assessment_id: string | null;
          target_topic_id: string;
          target_revision_id: string;
          target_flashcard_id: string;
          target_rating: StudyFlashcardRating;
          expected_version: number;
        };
        Returns: number;
      };
    };
    Enums: { app_role: AppRole; study_revision_state: StudyRevisionState; study_flashcard_rating: StudyFlashcardRating };
    CompositeTypes: Record<never, never>;
  };
};
