# TI 历史数据包 v2

当前包含 TI1—TI15（2011—2019、2021—2026），每届决赛阶段最终前八名的五人名单，共 120 池、600 张选手版本卡；可选教练为 TI10—TI15 八强每队一位，共 48 张届次卡。不是所有 TI 参赛队的集合。

## 来源

- 名单、最终名次、教练及代打说明：各届 [Liquipedia TI](https://liquipedia.net/dota2/The_International) 赛事资料，逐池 URL 已写入 `catalog-data.js`。2025 Tundra 收录实际代打 Tobi；2026 保留 TEAM VISION、BoomBoys、Iron Wing 等当届队名。
- TI1 原始名单参考：[Valve 2011 官方队伍档案](https://cdn.dota2.com/apps/dota2/international2011_static/teams.html)。其现代位置划分为游戏席位。
- 账号绑定：OpenDota 公开选手记录及 [Liquipedia IngameID 映射](https://liquipedia.net/dota2/Module:IngameID/data)。早期账号可能不再有职业姓名，不以当前 Steam 昵称代替历史身份。DD 与 DDC 的不同账号、Ame 与 Nisha 的多账号已分别关联。
- 逐局比赛：[OpenDota Explorer](https://www.opendota.com/explorer)。`events/YYYY.sql` 保存查询，`YYYY-source.json` 保存完整 URL、league ID、UTC 时间边界、采集时间、条数和 SHA-256，`YYYY.json` 保存原始响应。卡片提供逐局 OpenDota 链接。
- 英雄 ID、公开角色标签：OpenDota `/api/constants/heroes`，快照为 `research/heroes.json`。新页面不加载英雄图作为选手头像。
- 中文英雄名：[Valve Dota 2 官方英雄接口](https://www.dota2.com/datafeed/herolist?language=schinese)，快照为 `research/heroes-zh.json`，来源、采集时间及 SHA-256 在 `research/heroes-zh-source.json`。构建时核对数值 ID 和内部英雄 ID，缺少中文名则构建失败，不回退英文名称。

`rosters.tsv` 最后一列为赛区，教练列为空表示“未收录当届教练”。原始名单保留多人教练组用于统计；可选池由 `coach-selection.json` 指定每队一位代表，其他成员不展示为可选卡。教练影响来自共同的战队样本，不伪造其各自的个人比赛统计。2013 的 sydm 和后来的 Mikasa、G 和 God、CCnC 和 Quinn、Maybe 和 Somnus 等使用同一人物标识；中国 Q、泰国 Q 和两位 Super 则分开。

各届队名按池保存。稳定队伍键用于跨届重抽；跨俱乐部转会不合并，例如 OG 和 Team Spirit 完全独立。历史品牌改名（如 PARIVISION / TEAM VISION、BetBoom / BoomBoys）保留池中的当届显示名。

当前完整缺失范围及受影响成员见 [卡库信息缺失清单](coverage-audit.md)。

## 逐场样本口径

原始查询使用赛事 league ID、日期和比赛模式筛选；TI2 的历史记录使用 game_mode 0，后续赛事为队长模式 2。原始响应可能包含非八强、外卡或全明星等同票赛事；构建器只接受目标届次和目标战队 ID 的五个历史账号，不按选手全生涯聚合。因此全明星的不同战队 ID 不会混入选手卡。

目前对每个有统计的池，五位选手均覆盖该队在快照内的全部比赛。构建器遇到未知账号、额外代打、同池重复账号或缺失比赛会失败，不静默绑定剩余的人。原始快照完整性不等于所有历史比赛都被 OpenDota 解析，UI 使用“可用样本”描述。

- K、D、A：有效比赛的每局均值。
- GPM、XPM：按有效局时长加权。
- 参战率：有效样本中 K+A 合计 / 对应战队击杀合计，排除团队击杀为 0 的场次。
- 伤害/分：有效英雄伤害合计 × 60 / 有效秒数合计。
- 所有指标分别计数；合法 0 不视为缺失。字段缺失保持 `null`。
- 英雄使用次数：当届、当队、该账号使用该英雄的局数。教练卡为原战队五人合计。
- 备战候选英雄：仅取选手卡该届 `heroUsage` 中使用次数大于 0 的全部英雄，按次数排序；不截取为卡面显示的前六名，不混入其他选手或其他届次。备战不提供手动英雄选择。自动 BP 另取当届记录与保守位置规则的交集，必要时扩展本人选手生涯记录，资料缺失或英雄冲突时按位置兜底；不根据原始 observedRoles 直接放行核心打辅助。
- 教练战队胜率：可用样本中的该队胜局 / 局数。并列名次保存原区间。

TI1 没有可用 OpenDota 逐场快照：40 张选手卡 `stats=null`、`heroUsage={}`，UI 明示未收录。模拟的中性参数保存在运行时计算层，不写回历史统计。

## 重建

```sh
# 无网络，从现有快照确定性重建；哈希或身份不一致会失败
python3 scripts/build-catalog.py

# 有网络时，只补齐缺失的年度快照；不自动覆盖已有源文件
python3 scripts/import-events.py
```

改变名单或账号映射后必须重新构建，运行 Node 业务/来源测试和 Python 聚合测试。更新数据包结构应同时更新 `data.js` / `game.js` 的存档版本，不能让不兼容的旧结果继续恢复。

v1 两届原始资料仍保留在 `raw/` 和根目录 `stats-data.js`，用于审计先前页面；新版不加载它们。

## 教练生涯与风格

运行时由 data.js 按 person 聚合所有 role=6 条目，使用 poolId 去重，不计 role=1—5 的选手成绩。coachHistory 保留逐届 entries、总 games / wins、总胜率、最高 finish、该名次次数和缺少逐场数据的届次。统计范围是卡库已收录的 TI 八强执教记录，不表示全赛事执教生涯。缺失逐场数据的届次仍可计入最高名次，但不计入胜率分母。

recommendedTactic 仍按教练卡对应届次的执教英雄样本计算，是游戏风格设定。当前阵容和模拟对手自动采用各自教练的风格；无教练或无样本时使用均衡运营。原始 heroUsage 保留供 BP 内部使用，教练界面不展示常用英雄。

## TI10—TI15 教练池

`coach-selection.json` 显式列出 48 个战队池各自的代表教练，构建时验证六届 × 八队、每池恰好一位且确实存在于当届教练名单。多人组以一队一张代表卡处理；代表不等同于唯一主教练。OG TI10 采用 Misha，Liquid 各届采用 Blitz，beastcoast TI11 采用 Raykill，Spirit TI15 采用 Miposhka。

TI14 Xtreme Gaming 已依据 xiao8 的任职及执教成绩页面，将原误填的 LaNm、Maps 修正为 xiao8。修正应用于教练生涯统计；球员冠军不会计入执教荣誉。公开来源及核对日期保存在选择清单。

图鉴、选秀和比赛参赛阵容使用筛选后的教练卡；运行时保留历史教练记录用于执教生涯统计。因此 Heen 的 TI7 执教冠军等既有记录仍计入个人履历。新版本不兼容旧存档。
