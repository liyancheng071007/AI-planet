# 前后端接口

客户端调用 `wx.cloud.callFunction({ name:'game', data:event })`，读取 `result`。身份只从云函数每次调用的 `cloud.getWXContext()` 获取。

读取：`{action:'get'}`。首次读取创建空白进度。

写入：`{ action, requestId, expectedRevision, payload }`。`requestId` 为16—80位字母、数字、下划线或连字符；同一次网络重试必须复用。先读取最新 `revision` 再写入。

| action | payload | 行为 |
|---|---|---|
| settings | `{mode:'90', collaborationItems:[true,false,false]}` | 只修改白名单设置 |
| hint | `{stage:0}` | 首次1币，同关重复不收费 |
| assist | `{stage:0}` | 前七关首次3币；第八关免费 |
| submit | `{stage:0, answer:{...}}` | 服务端重新校验，正常100分、辅助60分，只发一次奖励 |
| reset | `{confirm:true}` | 重置进度并推进版本 |
| delete | `{confirm:true}` | 删除当前账号的数据库记录 |

成功返回 `{ok:true,revision,state,award,replay}`；删除返回 `{ok:true,deleted:true}`。失败返回 `{ok:false,code,message}`。常见 code：`INVALID_INPUT`、`UNAUTHENTICATED`、`LOCKED`、`ANSWER_REJECTED`、`INSUFFICIENT_COINS`、`CONFLICT`、`REQUEST_REUSED`、`SERVICE_UNAVAILABLE`。

数据库事务将读取、版本判断、扣币/发奖、写入一起提交。最近32个请求保留摘要以防重复；超出窗口的旧请求仍因版本不匹配而拒绝。多个设备冲突需刷新重试，不采用客户端存档覆盖服务器。删除后重新创建的是新游戏进度，不延续旧请求历史。

## 八关答案格式（编号0—7）

0. `{picks:['猫',...],reason:'至少8字'}`，30项选择，各项为猫/狗/其他/剔除。
1. `{epochs:10,choice:1,reason:'至少8字'}`。
2. `{judgments:[0,1,1,0,1],confidence:1}`，0正确、1错误。
3. `{counts:[8,8,8],fairness:1}`。
4. `{prompt:'至少15字且含猫、头盔、卡通、火星',generatedPrompt:'与prompt相同'}`；匹配只能证明输入一致，不能证明客户端确实显示过作品。
5. `{claims:[0,1,1],evidence:'至少8字'}`，0有支持、1矛盾。
6. `{selected:[1,3,5],privacy:'至少8字',copyright:'至少8字',responsibility:'至少8字'}`。
7. `{problem:'至少8字',sense:'至少8字',think:'至少8字',act:'至少8字',tech:0,techReason:'至少8字',reviewed:true}`，tech为0—3。

每段文字最多500字，请求整体最多16000 UTF-8字节。协作与展示为自评，开放题只检验形式完整，不提供自动语义评卷。客户端传来的分数、算力币和完成列表均不参与结算。
