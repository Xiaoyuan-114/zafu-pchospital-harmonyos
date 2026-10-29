# 论坛接口（Issue #85）

独立公开论坛帖子、普通评论与帖子图片，不复用内部维修备案评论或照片。成功响应为 `{ success:true, data, meta }`，失败为 `{ success:false, error:{ code,message,fieldErrors? }, meta }`；列表分页位于 `meta.pagination`。

游客可读取未删除的公开内容。写接口要求登录，原生 App 使用 `Authorization: Bearer <token>` 与 `X-Client-Type: native`；作者身份只取服务端会话，客户端传入的 `authorId` 不作为身份依据。作者可删除本人内容，持 `forum:moderate` 的管理员可删除任意帖子或评论；普通 MEMBER 不自动获得该权限。

## 字段与限制

- 分类：`GENERAL`（综合交流）、`EXPERIENCE`（经验分享）、`QUESTION`（问题求助）。
- 标题最长 120 字，帖子正文最长 10000 字，评论最长 2000 字，搜索关键词最长 60 字。
- `createRequestKey` / `uploadKey` 必填，最长 128 字。
- 每帖最多 9 张图片，支持 JPEG、PNG、WebP，声明 MIME 必须与魔数一致。单张默认不超过 10 MiB，可用 `FORUM_UPLOAD_MAX_BYTES` 调整。
- 分页默认 20 条，最大 100 条。帖子按 `createdAt,id` 倒序，评论按 `createdAt,id` 正序。

## 帖子

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/forum/posts?category=&q=&page=&pageSize=` | 游客 | 分类及标题/正文关键词搜索，仅返回未删除帖子 |
| POST | `/api/v1/forum/posts` | 登录 | 创建帖子，201 |
| GET | `/api/v1/forum/posts/{id}` | 游客 | 帖子、有效图片、真实评论数及当前会话 `actions` |
| DELETE | `/api/v1/forum/posts/{id}` | 作者或管理员 | 事务内软删帖子及其评论、图片；重复删除 404 |
| GET | `/api/v1/forum/me/posts?page=&pageSize=` | 登录 | 当前用户的未删除帖子 |

创建请求：

```json
{
  "category": "EXPERIENCE",
  "title": "清灰后的温度变化",
  "body": "正文",
  "createRequestKey": "客户端为本次尝试生成的唯一键"
}
```

同一作者重复使用该键时，完整 `category/title/body` 一致才返回原帖，不同则返回 `409 IDEMPOTENCY_CONFLICT`。原帖已删除时返回 `404 FORUM_POST_NOT_FOUND`，不返回旧正文，也不恢复记录。

帖子 `actions` 包含 `canDelete`、`canUploadImages`、`canComment`，只用于界面展示，服务端仍逐项鉴权。作者公开信息只有 `id` 与 `displayName`，不返回真实姓名或学号。

## 评论

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/v1/forum/posts/{id}/comments?page=&pageSize=` | 游客 | 有效评论分页；父帖删除后 404 |
| POST | `/api/v1/forum/posts/{id}/comments` | 登录 | 创建普通单层评论，201 |
| DELETE | `/api/v1/forum/comments/{id}` | 评论作者或管理员 | 软删评论；重复删除 404 |

创建请求为 `{ "body":"评论内容", "createRequestKey":"唯一键" }`。同键重放同时比较 `postId` 与 `body`，不一致返回 `409 IDEMPOTENCY_CONFLICT`。评论已删除返回 `404 FORUM_COMMENT_NOT_FOUND`；父帖已删除返回 `404 FORUM_POST_NOT_FOUND`。创建与上传均在事务内复核父帖，删帖后不能新增或重放旧内容。

## 帖子图片

### POST `/api/v1/forum/posts/{id}/images`

仅帖子作者可上传。使用 multipart，重复字段 `photos` 与 `uploadKeys` 按顺序一一对应；也兼容重复 `uploadKey` 字段。一次可传多张，但总量不能超过每帖 9 张，同一请求的键不得重复。

```text
photos=@first.png;type=image/png
uploadKeys=attempt-first-image
photos=@second.jpg;type=image/jpeg
uploadKeys=attempt-second-image
```

每个 `uploadKey` 与图片 SHA-256 绑定：同键同图重放返回原图，同键不同图返回 `409 IDEMPOTENCY_CONFLICT`。写库前校验全部文件；失败清理本次新建文件。事务内再次检查作者、父帖删除态和有效图片配额。

成功 201，`data` 为图片数组：`{ id, url, sortOrder }`。

### GET `/api/v1/forum/images/{imageId}/content`

游客可读取有效图片，但图片或父帖已删除时返回 404。响应带正确的 `Content-Type`、`X-Content-Type-Options: nosniff` 与 `Cache-Control: private, no-store`。底层存储键必须使用独立 `forum/` 前缀，不能通过此接口读取维修备案或其他业务资源。

## 相关错误码

| code | HTTP | 场景 |
| --- | --- | --- |
| `FORUM_POST_NOT_FOUND` | 404 | 帖子不存在、已删除，或父帖不允许继续写入 |
| `FORUM_COMMENT_NOT_FOUND` | 404 | 评论不存在或已删除 |
| `FORUM_IMAGE_LIMIT_EXCEEDED` | 400 | 单次或每帖图片总数超过限制 |
| `FORUM_IMAGE_TYPE_UNSUPPORTED` | 415 | 类型不支持或声明 MIME 与魔数不一致 |
| `FORUM_IMAGE_TOO_LARGE` | 413 | 图片或上传内容超过大小限制 |
| `IDEMPOTENCY_CONFLICT` | 409 | 同一幂等键对应不同帖子、评论或图片内容 |
| `VALIDATION_FAILED` | 400 | 字段、分页、重复上传键或 multipart 格式错误 |
| `UNAUTHENTICATED` | 401 | 写操作未登录或会话无效 |
| `FORBIDDEN` | 403 | 非作者且没有管理权限，或写通道校验失败 |

首版不提供帖子/评论编辑、点赞、关注、私信、积分、推荐算法、楼中楼回复或独立公告 CMS。
