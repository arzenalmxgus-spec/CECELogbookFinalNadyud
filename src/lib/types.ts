export interface Visitor {
  id: string;
  rfid_uid: string | null;
  full_name: string;
  company: string | null;
  contact_number: string | null;
  email: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** True while the record only exists locally and is waiting to sync. */
  _pending?: boolean;
}

export type VisitStatus = "inside" | "checked_out";

export interface VisitorLog {
  id: string;
  visitor_id: string;
  office_to_visit: string;
  purpose: string;
  remarks: string | null;
  visit_date: string;
  time_in: string;
  time_out: string | null;
  duration_minutes: number | null;
  status: VisitStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** True while the log only exists locally and is waiting to sync. */
  _pending?: boolean;
}

export interface VisitorLogWithVisitor extends VisitorLog {
  visitor: Visitor | null;
}

export interface AuditLog {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  description: string | null;
  created_at: string;
}

export interface LogFilters {
  search: string;
  status: "all" | VisitStatus;
  from: string | null;
  to: string | null;
  company: string;
  office: string;
  sort: "newest" | "oldest" | "name" | "time_in" | "time_out";
}

export const DEFAULT_LOG_FILTERS: LogFilters = {
  search: "",
  status: "all",
  from: null,
  to: null,
  company: "all",
  office: "all",
  sort: "newest",
};

export const VISIT_PURPOSES = [
  "Meeting",
  "Delivery",
  "Interview",
  "Job Application",
  "Maintenance",
  "Inquiry",
  "Billing",
  "Official Business",
  "Personal",
  "Other",
];

export interface Student {
  id: string;
  full_name: string;
  program: string;
  year_level: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  /** Set locally when the record has unsynced offline changes. */
  _pending?: boolean;
}

export const STUDENT_PROGRAMS = [
  "Bachelor of Science in Information Technology",
  "Bachelor of Science in Electronics Engineering",
  "Bachelor of Science in Computer Science",
  "Bachelor of Science in Civil Engineering",
  "Bachelor of Science in Computer Engineering",
];

export const STUDENT_YEAR_LEVELS = [1, 2, 3, 4];

export function formatYearLevel(level: number): string {
  const suffix =
    level === 1 || level === 21 ? "st"
      : level === 2 || level === 22 ? "nd"
      : level === 3 || level === 23 ? "rd"
      : "th";
  return `${level}${suffix} Year`;
}

