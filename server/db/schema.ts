import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  role: text("role").notNull(),
});

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  snapshotJson: text("snapshot_json").notNull(),
  status: text("status").notNull(),
  currentQueue: text("current_queue").notNull(),
  fiRequestedBy: text("fi_requested_by"),
  workflowComments: text("workflow_comments"),
  councilToPlanningComments: text("council_to_planning_comments"),
  fiAccessToken: text("fi_access_token"),
  createdByUserId: text("created_by_user_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedByUserId: text("updated_by_user_id"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const workflowEvents = sqliteTable("workflow_events", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  action: text("action").notNull(),
  actorUserId: text("actor_user_id"),
  payloadJson: text("payload_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  submissionId: text("submission_id").notNull(),
  channel: text("channel").notNull(),
  toAddresses: text("to_addresses").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
