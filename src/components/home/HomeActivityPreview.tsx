import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { formatShanghaiDateTime } from "@/components/repair-activities/activity-format";
import { repairActivityStatusBadgeClass } from "@/components/repair-activities/activity-status-badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SectionHead } from "@/components/ui/SectionHead";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { homeActivityPreview } from "@/config/home";
import { pickNonEndedRepairActivitiesForHomePreview } from "@/features/repair-activities/repair-activity-sort";
import {
  repairActivityService,
  type RepairActivityPublicView,
} from "@/features/repair-activities/repair-activity-service";
import {
  repairActivityStatusLabels,
  type RepairActivityStatus,
} from "@/features/repair-activities/repair-activity-validation";

/**
 * 首页近场活动预览（UX R3 / R7）
 *
 * 服务端取 listPublic（口径 C6），再按首页预览口径挑未结束的前 1–3 条：
 * **报名开放中（OPEN）优先**，其次 UPCOMING，再其次 FULL / CLOSED，同档内 activityAt 升序
 * （`pickNonEndedRepairActivitiesForHomePreview`）。公开列表页自己的「方案 B」排序不受影响。
 * 无未结束活动或数据不可用时整块不渲染（口径 C5）。
 * 不改动公开列表页 RepairActivityList（#59）。
 */
export async function HomeActivityPreview() {
  noStore();
  let items: RepairActivityPublicView[] = [];
  try {
    const all = await repairActivityService.listPublic();
    items = pickNonEndedRepairActivitiesForHomePreview(all, 3);
  } catch {
    return null;
  }
  if (items.length === 0) return null;

  const copy = homeActivityPreview;

  return (
    <Section id="upcoming-activities" labelledBy="home-activities-title">
      <SectionHead index={copy.index} label={copy.label} />
      <div className="sec-titlebar">
        <SectionTitle id="home-activities-title">{copy.title}</SectionTitle>
        <Reveal className="ml-auto" index={1}>
          <Button href={copy.viewAllHref} trailingIcon="chevronRight">
            {copy.viewAll}
          </Button>
        </Reveal>
      </div>

      <ul className="activity-list activity-list--home-preview">
        {items.map((item, i) => (
          <Reveal as="li" index={i} key={item.id}>
            <Link href={`/repair-activities/${item.id}`} className="activity-card__link">
              <Card className="activity-card">
                <div className="activity-card__head">
                  <h2 className="activity-card__title">{item.title}</h2>
                  <span className={repairActivityStatusBadgeClass(item.status)}>
                    {repairActivityStatusLabels[item.status as RepairActivityStatus]}
                  </span>
                </div>
                <dl className="activity-card__meta">
                  <div>
                    <dt>{copy.activityAt}</dt>
                    <dd>{formatShanghaiDateTime(item.activityAt)}</dd>
                  </div>
                  <div>
                    <dt>名额</dt>
                    <dd>{formatCapacityLine(item)}</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

function formatCapacityLine(item: RepairActivityPublicView): string {
  const capacity = homeActivityPreview.capacity
    .replace("{registered}", String(item.registeredCount))
    .replace("{capacity}", String(item.capacity));
  const remaining = homeActivityPreview.remainingShort.replace("{count}", String(item.remaining));
  return `${remaining} · ${capacity}`;
}
