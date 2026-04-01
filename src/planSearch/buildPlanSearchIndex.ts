import type { Chapter, PlanData } from "../types";
import {
  chapterLabel,
  goalLabel,
  policyLabel,
  subLevelLabel,
  subPolicyOptionLabel,
} from "../labels";
import { mergeSearchParts } from "./searchText";
import type { PlanSearchEntry, PlanSearchLevel } from "./types";

const SEP = " › ";

function joinBreadcrumb(parts: string[]): string {
  return parts.filter(Boolean).join(SEP);
}

function safeChapter(ch: Chapter): { label: string; searchBase: string } {
  const title = ch.chapterTitle ?? "";
  const num = ch.chapterNumber;
  const label = chapterLabel({ chapterNumber: num, chapterTitle: title });
  const searchBase = mergeSearchParts(num, title, label);
  return { label, searchBase };
}

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `pse-${idSeq}`;
}

/**
 * Flatten the plan into searchable rows. Each row includes the full ancestor chain in `searchBlob`
 * (chapter → goal → goal detail → policy → sub-policy → sub-level text as applicable).
 */
export function buildPlanSearchIndex(plan: PlanData): PlanSearchEntry[] {
  idSeq = 0;
  const out: PlanSearchEntry[] = [];

  plan.chapters.forEach((ch, ci) => {
    const { label: chLabel, searchBase: chBlob } = safeChapter(ch);

    out.push({
      id: nextId(),
      level: "chapter",
      chapterIdx: ci,
      goalIdx: -1,
      goalDetailIdx: -1,
      policyIdx: -1,
      subPolicyIdx: -1,
      subLevelIdx: -1,
      breadcrumb: chLabel,
      label: chLabel,
      searchBlob: chBlob,
    });

    ch.goals.forEach((g, gi) => {
      const gNum = String(g.goalNumber ?? "");
      const gDesc = g.goalDescription ?? "";
      const gLabel = goalLabel({ goalNumber: gNum, goalDescription: gDesc });
      const gBlob = mergeSearchParts(gNum, gDesc, gLabel);
      const gBread = joinBreadcrumb([chLabel, gLabel]);

      out.push({
        id: nextId(),
        level: "goal",
        chapterIdx: ci,
        goalIdx: gi,
        goalDetailIdx: -1,
        policyIdx: -1,
        subPolicyIdx: -1,
        subLevelIdx: -1,
        breadcrumb: gBread,
        label: gLabel,
        searchBlob: mergeSearchParts(gBlob, chBlob),
      });

      g.goalDetails.forEach((gd, gdi) => {
        const detailText = gd.detail?.trim() ?? "";
        const gdDisplay = detailText || "(No goal detail text)";
        const gdBlob = mergeSearchParts(detailText, gdDisplay);
        const gdBread = joinBreadcrumb([chLabel, gLabel, gdDisplay]);

        out.push({
          id: nextId(),
          level: "goalDetail",
          chapterIdx: ci,
          goalIdx: gi,
          goalDetailIdx: gdi,
          policyIdx: -1,
          subPolicyIdx: -1,
          subLevelIdx: -1,
          breadcrumb: gdBread,
          label: gdDisplay,
          searchBlob: mergeSearchParts(gdBlob, gBlob, chBlob),
        });

        gd.policies.forEach((p, pi) => {
          const pNum = String(p.policyNumber ?? "");
          const pDesc = p.policyDescription ?? "";
          const pLabel = policyLabel({ policyNumber: pNum, policyDescription: pDesc });
          const pBlob = mergeSearchParts(pNum, pDesc, pLabel);
          const pBread = joinBreadcrumb([chLabel, gLabel, gdDisplay, pLabel]);

          out.push({
            id: nextId(),
            level: "policy",
            chapterIdx: ci,
            goalIdx: gi,
            goalDetailIdx: gdi,
            policyIdx: pi,
            subPolicyIdx: -1,
            subLevelIdx: -1,
            breadcrumb: pBread,
            label: pLabel,
            searchBlob: mergeSearchParts(pBlob, gdBlob, gBlob, chBlob),
          });

          p.subPolicies.forEach((sp, spi) => {
            const spLabel = subPolicyOptionLabel(sp, spi);
            const spBlob = mergeSearchParts(
              sp.letter,
              sp.description,
              sp.text,
              spLabel,
            );
            const spBread = joinBreadcrumb([chLabel, gLabel, gdDisplay, pLabel, spLabel]);

            out.push({
              id: nextId(),
              level: "subPolicy",
              chapterIdx: ci,
              goalIdx: gi,
              goalDetailIdx: gdi,
              policyIdx: pi,
              subPolicyIdx: spi,
              subLevelIdx: -1,
              breadcrumb: spBread,
              label: spLabel,
              searchBlob: mergeSearchParts(spBlob, pBlob, gdBlob, gBlob, chBlob),
            });

            const levels = sp.subLevels ?? [];
            levels.forEach((sl, sli) => {
              const slLabel = subLevelLabel(sl);
              const slBlob = mergeSearchParts(slLabel, sl.roman, sl.description);
              const slBread = joinBreadcrumb([
                chLabel,
                gLabel,
                gdDisplay,
                pLabel,
                spLabel,
                slLabel,
              ]);

              out.push({
                id: nextId(),
                level: "subLevel",
                chapterIdx: ci,
                goalIdx: gi,
                goalDetailIdx: gdi,
                policyIdx: pi,
                subPolicyIdx: spi,
                subLevelIdx: sli,
                breadcrumb: slBread,
                label: slLabel,
                searchBlob: mergeSearchParts(slBlob, spBlob, pBlob, gdBlob, gBlob, chBlob),
              });
            });
          });
        });
      });
    });
  });

  return out;
}

/** @deprecated Ranking no longer uses specificity; kept for tests / callers importing symbol. */
export function specificityRank(level: PlanSearchLevel): number {
  switch (level) {
    case "chapter":
      return 10;
    case "goal":
      return 20;
    case "goalDetail":
      return 30;
    case "policy":
      return 40;
    case "subPolicy":
      return 50;
    case "subLevel":
      return 60;
    default:
      return 0;
  }
}
