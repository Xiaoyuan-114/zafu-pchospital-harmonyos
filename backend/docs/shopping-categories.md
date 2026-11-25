# 商城商品分类接口

`POST /api/v1/shopping/products` 的 `category` 支持 `COMPUTER`（整机）、`COMPONENT`（配件）、`PERIPHERAL`（外设）和 `CONSUMABLE`（维修耗材）；`GET /api/v1/shopping/products?category=...` 使用相同值筛选。

前三类由登录用户发布，创建时库存必须为 1，需填写成色；耗材由具有 `shopping.consumable:manage` 权限的用户发布，可填写 0–999 件库存。已有 `SECONDHAND` 仍按原二手规则兼容，分类在发布后不可修改。订单仍使用待取货、已完成、已取消状态，线下付款取货。
