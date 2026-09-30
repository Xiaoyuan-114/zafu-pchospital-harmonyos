import { Reveal } from "@/components/ui/Reveal";
import type { Service } from "@/config/home";
import { cn, pad2 } from "@/lib/utils";

/**
 * ServiceList —— 服务条目列表
 *
 * 对应设计基准的 `.svc-list` / `.svc`。首页「服务」区块与 /about 页的
 * 「服务范围」共用同一实现。
 *
 * 两个呈现变体：
 * - "compact"（默认）：紧凑版，编号在左、名称与描述同列，用于首页。
 * - "editorial"：编辑式，大编号独立成列，名称与描述靠右，行距与分割线更疏朗，用于 /about。
 */

export type ServiceListProps = {
  items: readonly Service[];
  /** 呈现变体，默认 "compact" */
  variant?: "compact" | "editorial";
  className?: string;
};

export function ServiceList({ items, variant = "compact", className }: ServiceListProps) {
  return (
    <ol className={cn("svc-list", variant === "editorial" && "svc-list--editorial", className)}>
      {items.map((service, index) => (
        <Reveal as="li" className="svc" index={index} key={service.name}>
          <span className="svc__idx">{pad2(index + 1)}</span>
          <h3 className="svc__name">{service.name}</h3>
          <p className="svc__desc">{service.description}</p>
        </Reveal>
      ))}
    </ol>
  );
}
