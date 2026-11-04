import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "login"
  | "logout"
  | "password_change"
  | "visitor_registered"
  | "rfid_registered"
  | "visitor_updated"
  | "visitor_deleted"
  | "visit_checked_in"
  | "visit_checked_out"
  | "log_updated"
  | "log_deleted"
  | "student_created"
  | "student_updated"
  | "student_deleted"
  | "export_excel"
  | "export_pdf"
  | "export_csv";

export async function recordAudit(action: AuditAction, description: string) {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;
  await supabase.from("audit_logs").insert({
    admin_id: user.id,
    admin_email: user.email ?? null,
    action,
    description,
  });
}
