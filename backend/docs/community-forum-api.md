# 关注、圈子和积分 API（#103）

所有路径以 `/api/v1/forum` 开头。列表的分页数据位于 `meta.pagination`；需要登录的接口使用原生 Bearer 和 `X-Client-Type: native`，写请求同时执行已有写通道校验。身份由会话决定。

| 方法 | 路径 | 权限和行为 |
| --- | --- | --- |
| GET | `/posts?channel=recommended\|following&circleId=&sort=latest\|hot&category=&q=&page=` | 推荐公开；关注频道须登录，合并关注作者和已加入圈子的帖子并去重。最新按时间/ID 倒序，热门按最近七天有效评论数、时间、ID 倒序 |
| POST / DELETE | `/users/{id}/follow` | 登录用户关注/取消关注其他用户；重复操作返回当前状态 |
| GET | `/me/following` | 本人关注用户分页，仅返回公开 ID 和昵称 |
| GET | `/circles?joined=true&page=` | 全部圈子公开；已加入列表须登录。返回名称、分类、简介、封面、归档、本人加入状态及真实计数 |
| POST | `/circles` | `forum.circle:manage`；提交 name、description、category、coverUrl、archived 和 createRequestKey |
| GET / POST | `/circles/{id}` | 公开详情 / 管理员保存完整字段；归档阻止加入和新发帖 |
| POST / DELETE | `/circles/{id}/membership` | 登录用户加入/退出；重复操作返回当前状态 |
| POST | `/posts` | 原发帖请求可增加 circleId，服务端事务内复核圈子及成员关系；省略则为普通帖子 |
| GET / POST | `/me/check-in` | 本人打卡状态 / 今日打卡；上海日历日一天一次，七天奖励 1、1、1、2、2、2、3，重试不重复记分 |
| GET | `/me/points` | 本人积分流水分页，返回增减分、来源、说明和时间 |

每日打卡与维修活动现场签到独立。现场由已出勤授权成员完成；新规则生效后，按账号和活动最多发放 10 分，最后一条有效签到失效时冲正，重新签到恢复。匿名报名和旧签到不补发。活动删除及报名软删与积分更新在同一事务中执行。

圈子用户只公开 ID 和昵称；列表、详情中的操作状态只用于界面展示，服务端仍执行鉴权。关注状态及本人积分响应采用 `private, no-store`。
