type ReadTable<Row> = {
  Row: Row;
  Insert: never;
  Update: never;
  Relationships: [];
};

export type AppRole = "student" | "admin";

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
    };
    Enums: { app_role: AppRole };
    CompositeTypes: Record<never, never>;
  };
};
