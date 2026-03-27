# grouping

基于 `Vue3 + Vite + Element Plus + Pinia + Vue Router` 的前端项目框架，已接入知晓云 `minapp-sdk`，当前功能：

- 登录 / 注册
- 管理员页面查看用户昵称和性别（读取 `_userprofile`）

## 启动

```bash
pnpm install
pnpm dev
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
VITE_MINAPP_CLIENT_ID=你的ClientID
VITE_ADMIN_USER_IDS=管理员用户ID1,管理员用户ID2
```

## 知晓云后台准备

- 无需创建业务表
- 用户数据直接使用知晓云内置 `_userprofile`

性别约定：

- `1` 男
- `2` 女
- `0` 未知

## 管理员页面

- 路由：`/admin`
- 仅 `VITE_ADMIN_USER_IDS` 白名单用户可访问
- 显示字段：昵称、性别、用户ID、更新时间

## 代码规范

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```
