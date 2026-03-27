# 知晓云建表文件

用户基础资料仍使用内置 `_userprofile`，权限采用最简两表方案：

- `permission`：权限字典
- `user_permission`：用户-权限关系（支持一人多权限）

## 推荐字段（最简）

### `permission`

- `code`（String，唯一）权限码，例如 `admin`
- `name`（String）权限名称
- `enabled`（Boolean，默认 `true`）是否启用

### `user_permission`

- `user_id`（String）用户 ID（对应 `_userprofile.id`）
- `permission_code`（String）权限码（对应 `permission.code`）
- `enabled`（Boolean，默认 `true`）是否生效

## 初始化示例

可先插入一条权限字典记录：

- `code: admin`
- `name: 管理员页访问`
- `enabled: true`

再给目标用户插入关系记录：

- `user_id: <某用户ID>`
- `permission_code: admin`
- `enabled: true`

## 前端接入点

- 权限查询 API：`src/api/permission.js`
- 登录态权限缓存：`src/stores/auth.js`
- 路由权限守卫：`src/router/index.js`
