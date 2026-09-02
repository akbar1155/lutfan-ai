import type { Invitation } from "../api/client";
import { getSelectedSubtypeSlugs } from "./ceremonySchedule";

type ResumeInvitation = Pick<
  Invitation,
  | "id"
  | "status"
  | "inviter_type"
  | "generation_path"
  | "event_data"
  | "event_slug"
  | "subtype_slug"
  | "subtype_slugs"
>;

function hasVenue(inv: ResumeInvitation): boolean {
  const fields = (inv.event_data?.structured_fields || {}) as Record<string, unknown>;
  return Boolean(String(fields.venue_name || "").trim());
}

function hasBody(inv: ResumeInvitation): boolean {
  const blocks = (inv.event_data?.final_text_blocks || {}) as Record<string, unknown>;
  return Boolean(String(blocks.body || "").trim());
}

function hasCompletedDetails(inv: ResumeInvitation): boolean {
  if (inv.event_slug === "hayit" && !getSelectedSubtypeSlugs(inv).length) {
    return false;
  }
  if (inv.event_data?.details_done === true) return true;
  // Older drafts marked details as done by saving inviter_type.
  if (inv.inviter_type) return true;
  return hasVenue(inv) || hasBody(inv) || Boolean(inv.generation_path);
}

/** Resume a draft at the first incomplete wizard step. */
export function invitationContinuePath(inv: ResumeInvitation): string {
  const id = inv.id;
  if (inv.status === "ready") return `/create/${id}/result`;
  if (inv.status === "generating") return `/create/${id}/generating`;
  if (!hasCompletedDetails(inv)) return `/create/${id}/details`;
  if (!hasVenue(inv)) return `/create/${id}/data`;
  if (!hasBody(inv)) return `/create/${id}/text`;
  if (!inv.generation_path || inv.status === "failed") return `/create/${id}/style`;
  return `/create/${id}/style`;
}
