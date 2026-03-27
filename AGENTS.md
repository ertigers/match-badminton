# 项目协作速记（给后续会话快速上手）

## 1) 项目定位与技术栈
- 前端：`Vue 3 + Vite + Pinia + Vue Router + Element Plus`
- 目标端：**手机端优先**
- 启动与构建：
  - 开发：`pnpm dev`
  - 构建：`pnpm build`
- 已配置局域网访问：`vite.config.js` 中 `server.host` 与 `preview.host` 为 `0.0.0.0`

## 2) 路由结构（当前约定）
- 一级（底部 Tab）：
  - `/home`
  - `/mine`
  - 容器：`src/views/mobile/index.vue`
- 二级页面统一公共头部：
  - 公共布局：`src/layouts/subpage-layout.vue`
  - 管理模块布局：`src/views/admin/layout.vue`（含 admin 专属 subnav）
- 主要二级路由：
  - 管理：`/admin/users`、`/admin/permissions`
  - 赛事：`/tournaments/create`、`/tournaments/my`、`/tournaments/created`、`/tournaments/all`、`/tournaments/:id`

## 3) 权限模型（务必统一口径）
- 当前权限码：
  - `admin`：用户管理、全部赛事、管理模块访问
  - `admin-common`：我创建的赛事
- 首页入口显示规则：
  - `用户管理`、`全部赛事`：需要 `admin`
  - `我创建的赛事`：需要 `admin-common`
  - 其他入口：不需要权限
- 路由守卫：基于 `meta.requiresPermission` + `authStore.hasPermission(...)`
- `isAdmin` 只做白名单兜底（`VITE_ADMIN_USER_IDS`），白名单为空时默认 `false`

## 4) 关键页面与 UI 习惯
- 首页：`src/views/home/index.vue`
  - 顶部卡片为“欢迎 + 右上角性别/等级 + 统计”
  - 背景色与性别联动：男蓝 / 女粉 / 未知灰
  - 统计行展示：参赛次数、对局次数、胜率
- 用户管理页：`src/views/admin/index.vue`
  - 使用卡片列表，不用 table
  - 顶部统计区（总人数/男生/女生）一行展示
  - 男标签淡蓝、女标签粉色
  - 操作按钮区（导入/刷新）已做轻量化样式

## 5) 数据表与接口要点
- 用户相关：
  - `_userprofile`
  - `user_stats`（`level/tournament_count/match_count/win_rate`）
- 权限相关：
  - `permission`
  - `user_permission`
- 赛事相关：
  - `tournament`
  - `tournament_participant`
- 用户导入：
  - 通过注册接口（不是直接写内置表）
  - 批量策略：`username=nickname`、默认密码 `123456`
  - 注册后更新 `nickname`、`gender`

## 6) 已确认的实现细节
- `listAllUsers`：合并 `_userprofile` 与 `user_stats`
- 赛事“修改参赛人员”：使用 **delta** 策略（新增即加、移除即删/禁用，不全量重建）
- `subpage-layout` 内已支持 `<RouterView />` 兜底，二级父子路由可直接复用

## 7) 开发习惯（建议保持）
- 改完路由/权限/页面后，优先执行 `pnpm build` 做快速回归验证
- 保持移动端视觉优先：紧凑、卡片化、弱化复杂表格
- 权限判断尽量只用一套权限码，避免 `admin` / `admin.access` 混用
- 文案和文件编码保持 UTF-8，避免中文乱码
- 新增纪律：禁止将项目中的中文字符改成乱码（读写文件后需自检中文显示）

## 8) 可继续优化（非阻塞）
- 将权限码提取为常量文件，避免散落硬编码
- 对 `home/admin/permission` 页面中的历史乱码文案做一次统一清理
- 如需更强性能，可继续做 `manualChunks`（当前 build 有大包提示）

### 9.1 页面拆分与组件职责
- 赛事详情主页面：src/views/tournament/detail.vue
- 参赛人员与调整：src/views/tournament/components/tournament-participants-panel.vue
- 团体赛参数：src/views/tournament/components/tournament-team-settings-panel.vue
- 分组成员：src/views/tournament/components/tournament-team-groups-panel.vue
- 轮次排位：src/views/tournament/components/tournament-team-lineups-panel.vue
- 对局匹配与计分：src/views/tournament/components/tournament-team-matchups-panel.vue
- 约定：详情页负责状态编排、数据聚合、权限兜底；子组件负责单一业务块 UI 与提交事件。

### 9.2 团体赛关键参数定义
- 分队组数：team_group_count
- 团体项目（多选）：男双、混双、女双、男单、女单
- 每组人数：由项目自动推导（双打=2，单打=1，总和为每组最少人数）
- 轮数：round_count
- 对局分值：score_target（15 / 21 / 31）
- 约束：分组成员数、男女人数都受团体参数控制。

### 9.3 生命周期阶段（stage）与轮次状态（status）
- stage 只描述赛事大阶段，status（或 round_state）只描述当前轮次执行态，二者不混用。
- 当前采用阶段：participant_adjusting（参赛人员调整）、team_configuring（团体参数设置）、grouping（分配分组成员）、rounds_in_progress（轮次进行中）、finished（全部完成）。
- 轮次状态（在 rounds_in_progress 下）：waiting_lineup（待本轮排位）、playing（已确认排位并直接进入计分）、round_finished（本轮完成）。
- 历史兼容：lineup_submitted、scoring 统一按 playing 处理。

### 9.4 阶段展示与按钮行为
- 详情头部按阶段渐进展示：基础信息 -> 参赛人员 -> 团体参数 -> 分组结果。
- 未到当前阶段的设置区不展示。
- 阶段推进按钮放页面底部居中大按钮区域（与开始赛事同区域）。
- 点击阶段推进时，先触发当前阶段保存，再进入下一阶段。

### 9.5 权限口径（已统一）
- 管理类操作：admin 与赛事创建者同权（阶段推进、参数设置、分组等）。
- 特例：不在组内但查看全部组的兜底权限，仅 admin 允许。
- 参赛人员权限：可进行对局积分录入、可进行组内项目分配。

### 9.6 分组成员规则（核心）
- group_name 前端不展示不编辑，入库使用默认值。
- 成员待选列表只展示未被其他组占用的用户。
- 倒数第二组分配时，必须先满足当前组应选人数，剩余成员再自动归入最后一组。
- 待选项需展示性别标识，并通过 UI 区分男女。

### 9.7 轮次排位规则
- 编辑区仅展示当前轮次且属于当前用户分组的信息。
- 第一轮在各组提交项目分配后，展示区才显示组内项目分配结果。
- 创建者非组内不自动看全部组，仅 admin 可全组兜底查看。
- 项目分配待选项按项目性别要求筛选，且每次选择后需从其他项目待选中剔除。

### 9.8 对局生成与计分规则
- 对局生成采用同项目跨组全配对：每个项目下所有组两两对打一场。
- 状态简化：确认排位后直接分配对局并开始计分。
- 计分 UI：分数显示在 VS 两侧，按钮为图标（新增/编辑），胜方有明显高亮（event-row 背景渐变 + 胜方标识）。
- 计分弹窗：展示双方出场人员，支持快捷比分 21:11、21:15、21:18、21:20，支持比分反转。
- 移动端优先：计分输入与操作需保证可触达、可读。

### 9.9 对局计分入库（新增表）
- 表：tournament_team_match_score
- 字段：tournament_id、round_no、event_code、home_group_no、away_group_no、home_score、away_score、enabled。
- 前端 API（src/api/tournament.js）：listTournamentTeamMatchScores(tournamentId)、saveTournamentTeamMatchScore({ tournamentId, score })。
- 详情页流程：进入团体业务数据加载时拉取比分草稿，确认计分后写库并同步本地草稿。

### 9.10 实施注意事项
- 知晓云建表 JSON 必须严格匹配 table.json 规范，字段类型和默认值必须合法。
- 参数保存出现 schema 错误时，优先核对字段类型（number/string/array）与后端 schema 一致性。
- 文档与代码统一 UTF-8，避免中文乱码影响维护和排查。
