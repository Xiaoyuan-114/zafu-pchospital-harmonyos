# Issue #101 本地验证与页面对照

模拟器 HarmonyOS API 24，后端和 MySQL 使用本机独立课设库。参考图：[选购首页](../../reference/my-huawei/shopping-category-navigation.jpg)、[订单空态](../../reference/my-huawei/shopping-orders-empty-state.jpg)。

| 页面 | 修改前 | 修改后 |
| --- | --- | --- |
| 选购首页 | [截图](before-shop.png) | [截图](after-shop.png) |
| 购物订单 | [截图](before-orders.png) | [截图](after-orders.png) |
| 卖家订单 | [历史截图（#84）](../issue-84/seller-orders-pending.jpeg) | [截图](after-seller-orders.png) |
| 发布商品 | [截图](before-edit.png) | [截图](after-edit.png) |
| 我发布的商品 | [截图](before-myproducts.png) | [截图](after-myproducts.png) |
| 商品详情 | [截图](before-detail.png) | [截图](after-detail.png) |
| 下单确认 | [历史截图（#84）](../issue-84/order-confirm-sheet.jpeg) | [截图](after-buy.png) |

模拟器上通过页面发布外设并显示商品详情：[截图](ui-published.png)；使用客户账号通过页面下单后看到待取货。四类入口分别筛选出对应商品，搜索 UI_keyboard 后横幅和列表同步显示该商品。本机接口另走通工作人员发布、客户下单、取消回补、再次下单、卖家完成、客户查看；4 类真实接口筛选通过。

`pnpm lint`、651 项单测、HAP 构建通过；真实接口与模拟器使用本机数据。订单、商品和商品图片记录仅在独立演示库 `pchospital_exp_demo20261125` 清理重建；其他业务数据保留。模拟器订单列表创建 21 笔课设样本并点击“加载更多”，可看到后续订单：[截图](after-long-orders.png)。模拟器卖家页面确认订单完成：[截图](after-seller-completed.png)。系统相册选图尚待设备操作验证。商品图为标注的课设示意图。商品详情修改前后使用不同商品；下单确认修改前采用 #84 历史截图。
