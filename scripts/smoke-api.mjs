const base = process.env.API ?? "http://127.0.0.1:8787";
const snap = {
  chapterIdx: 0,
  goalIdx: 0,
  goalDetailIdx: 0,
  policyIdx: 0,
  subPolicyIdx: -1,
  subLevelIdx: -1,
  actionDetails: "12345678901",
  actionTitle: "Smoke test",
  department: "D",
  primaryContact: { name: "A", role: "R", email: "a@b.gov", phone: "5055550100" },
  alternateContact: { name: "", role: "", email: "", phone: "" },
  attachments: [],
};
const r = await fetch(`${base}/api/submissions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ snapshot: snap }),
});
console.log(await r.json());
