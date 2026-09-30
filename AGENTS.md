# AGENTS.md

先读 README、docs/local-development.md 和 App 仓库的开发方案。用户自行决定开发进度，无需 Issue、固定周计划或另一位成员批准。

- 只修改本课设实验仓库；原 Web、生产数据库与线上服务不得改动。
- 本机直接运行 Node/Next 和 MySQL，不引入 Docker 或远端部署流程。
- `.env` 保留在本机；示例提供配置键和占位值即可。
- 接口位于 `src/app/api/v1`，业务位于 `src/features`，共享能力位于 `src/lib`。修改接口契约时同步客户端说明。
- 开发库与 `_test` 测试库分离。迁移、seed、数据库测试和重置使用标准脚本；保留库名保护。
- `repairDate` 是上海日历日 DATE，API 的 UTC 区间需转换为日历边界后查询。
- 按改动运行适当的 lint、构建和真实测试，记录失败及未验证范围。占位、模拟结果和未装机内容不得写为完成。
- 提交前检查 git status、diff 和 HEAD；不覆盖他人未提交文件，不强推或清理业务代码修复 ref 异常。
