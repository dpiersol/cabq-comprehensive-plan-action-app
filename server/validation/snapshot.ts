import { z } from "zod";

/** Loose validation for submitted JSON (aligns with client DraftSnapshot). */
export const draftSnapshotSchema = z.object({
  chapterIdx: z.number().int(),
  goalIdx: z.number().int(),
  goalDetailIdx: z.number().int(),
  policyIdx: z.number().int(),
  subPolicyIdx: z.number().int(),
  subLevelIdx: z.number().int(),
  actionDetails: z.string(),
  actionTitle: z.string(),
  department: z.string(),
  primaryContact: z.object({
    name: z.string(),
    role: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  alternateContact: z.object({
    name: z.string(),
    role: z.string(),
    email: z.string(),
    phone: z.string(),
  }),
  attachments: z.array(
    z.object({
      id: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      size: z.number(),
      dataBase64: z.string(),
    }),
  ),
});

export type ValidatedSnapshot = z.infer<typeof draftSnapshotSchema>;
