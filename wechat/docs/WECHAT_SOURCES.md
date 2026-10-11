# 官方资料与适配依据

查询日期：2026-10-12。优先使用微信官方开发者文档、微信官方示例仓库与腾讯云开发官方文档。

| 官方资料 | 本项目采用的做法 |
|---|---|
| [微信官方示例项目配置](https://github.com/wechat-miniprogram/miniprogram-demo/blob/master/project.config.json) | 独立 `miniprogramRoot`、`cloudfunctionRoot`、AppID 和小程序编译类型 |
| [微信官方示例 app.json](https://github.com/wechat-miniprogram/miniprogram-demo/blob/master/miniprogram/app.json) | 使用原生页面注册与小程序配置，而非浏览器 DOM |
| [云函数接入小程序](https://docs.cloudbase.net/en/recipes/add-cloud-function-wechat-miniprogram) | `wx.cloud.init`、`wx.cloud.callFunction`、服务端 `wx-server-sdk` 和 `getWXContext` |
| [微信官方云开发示例说明](https://github.com/wechat-miniprogram/miniprogram-demo/blob/master/miniprogram/page/cloud/README.md) | 开通环境、部署云函数、创建集合、设置权限 |
| [腾讯云开发事务](https://docs.cloudbase.net/database/transaction) | 在服务端事务内完成版本校验及存档更新 |
| [腾讯云开发安全规则](https://docs.cloudbase.net/database/security-rules) | 禁止客户端直接读写，云函数控制当前账号数据访问 |

微信开发者文档直链本次工具未能取得正文，因此以下仅作为注册后人工核对入口，不假称已阅读全文：

- [小程序目录结构](https://developers.weixin.qq.com/miniprogram/dev/framework/structure.html)
- [网络能力与合法域名](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- [云函数用户信息](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions/userinfo.html)
- [小程序开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

SDK核对：通过 npm 查询并安装 `wx-server-sdk@4.0.2`，实际阅读其数据库封装。该版本 `doc.get()` 默认在文档不存在时抛错，本项目显式设置 `throwOnNotFound:false`，避免首次用户初始化失败。底层事务返回回调结果，适配器直接返回该结果；不照搬另一 SDK 文档的包装返回值。锁文件记录可复现依赖。

这些资料支持技术选型，不表示微信已认可本项目上线资格；类目、隐私和审核项以注册后后台实际要求为准。
