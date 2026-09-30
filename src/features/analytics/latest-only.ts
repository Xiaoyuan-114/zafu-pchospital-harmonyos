/**
 * 「只有最新一次请求的结果才生效」守卫。
 *
 * 场景：排行榜页面允许快速切换范围/指标。若不加保护，较慢的**旧**响应可能在
 * 较快的**新**响应之后返回并覆盖它 —— 于是控件显示「本月」、列表却是「本学期」的数据。
 * 这类错配不会报错，只会安静地展示错误内容。
 *
 * 抽成独立模块（而不是在组件里写一个裸计数器）的理由与 `community-summary.ts` 相同：
 * **纯逻辑放在与 JSX 无关的模块里才能被 `tsx --test` 直接断言**。
 */
export type LatestOnlyGuard = {
  /** 开始一次新请求，返回本次请求的序号。 */
  begin(): number;
  /** 该序号是否仍是最新一次请求 —— 只有 `true` 才允许写入状态。 */
  isLatest(token: number): boolean;
};

export function createLatestOnlyGuard(): LatestOnlyGuard {
  let current = 0;
  return {
    begin: () => {
      current += 1;
      return current;
    },
    isLatest: (token: number) => token === current,
  };
}
