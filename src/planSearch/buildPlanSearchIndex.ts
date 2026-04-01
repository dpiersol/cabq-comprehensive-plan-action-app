import type { PlanData } from "../types";
import {
  chapterLabel,
  goalLabel,
  policyLabel,
  subLevelLabel,
  subPolicyOptionLabel,
} from "../labels";
import type { PlanSearchEntry, PlanSearchLevel } from "./types";

const SEP = " › ";

function joinBreadcrumb(parts: string[]): string {
  return parts.filter(Boolean).join(SEP);
}

function levelRank(level: PlanSearchLevel): number {
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

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `pse-${idSeq}`;
}

/**
 * Flatten the plan into searchable rows. Each row can be applied as a hierarchy jump target.
 */
export function buildPlanSearchIndex(plan: PlanData): PlanSearchEntry[] {
  idSeq = 0;
  const out: PlanSearchEntry[] = [];

  plan.chapters.forEach((ch, ci) => {
    const chLabel = chapterLabel(ch);
    const chBlob = [chLabel, ch.chapterTitle, String(ch.chapterNumber)].join(" ").toLowerCase();

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
      const gLabel = goalLabel(g);
      const gBlob = [gLabel, g.goalNumber, g.goalDescription].join(" ").toLowerCase();
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
        searchBlob: `${gBlob} ${chBlob}`,
      });

      g.goalDetails.forEach((gd, gdi) => {
        const detailText = gd.detail?.trim() || "";
        const gdDisplay = detailText || "(No goal detail text)";
        const gdBlob = [gdDisplay, detailText].join(" ").toLowerCase();
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
          searchBlob: `${gdBlob} ${gBlob} ${chBlob}`,
        });

        gd.policies.forEach((p, pi) => {
          const pLabel = policyLabel(p);
          const pBlob = [pLabel, p.policyNumber, p.policyDescription].join(" ").toLowerCase();
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
            searchBlob: `${pBlob} ${gdBlob} ${gBlob} ${chBlob}`,
          });

          p.subPolicies.forEach((sp, spi) => {
            const spLabel = subPolicyOptionLabel(sp, spi);
            const spBlob = [
              spLabel,
              sp.letter ?? "",
              sp.description ?? "",
              sp.text ?? "",
            ]
              .join(" ")
              .toLowerCase();
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
              searchBlob: `${spBlob} ${pBlob} ${gdBlob} ${gBlob} ${chBlob}`,
            });

            const levels = sp.subLevels ?? [];
            levels.forEach((sl, sli) => {
              const slLabel = subLevelLabel(sl);
              const slBlob = [slLabel, sl.roman ?? "", sl.description ?? ""].join(" ").toLowerCase();
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
                searchBlob: `${slBlob} ${spBlob} ${pBlob} ${gdBlob} ${gBlob} ${chBlob}`,
              });
            });
          });
        });
      });
    });
  });

  return out;
}

/** Higher = more specific (used when scores tie). */
export function specificityRank(level: PlanSearchLevel): number {
  return levelRank(level);
}
