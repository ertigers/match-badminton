<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listAllUsers } from '../../api/admin'
import {
  createPermission,
  grantPermissionToUser,
  listPermissions,
  listUserPermissions,
  revokeUserPermission,
} from '../../api/permission'
import { showErrorMessage } from '../../utils/error'

const loading = ref(false)
const creating = ref(false)
const granting = ref(false)

const users = ref([])
const permissions = ref([])
const userPermissions = ref([])

const createForm = ref({
  code: '',
  name: '',
})

const grantForm = ref({
  userId: '',
  permissionCode: '',
})
const filterUserId = ref('')

const userMap = computed(() => {
  const map = new Map()
  users.value.forEach((item) => {
    map.set(String(item.user_id || item.id), item.nickname || item.user_id || item.id)
  })
  return map
})

const enrichedUserPermissions = computed(() => {
  const list = userPermissions.value
    .map((item) => ({
      ...item,
      user_name: userMap.value.get(item.user_id) || item.user_id,
    }))
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))

  if (!filterUserId.value) return list
  return list.filter((item) => item.user_id === filterUserId.value)
})

const loadData = async () => {
  try {
    loading.value = true
    const [userList, permissionList, relationList] = await Promise.all([
      listAllUsers(),
      listPermissions(),
      listUserPermissions(),
    ])
    users.value = userList
    permissions.value = permissionList
    userPermissions.value = relationList
  } catch (error) {
    showErrorMessage(error)
  } finally {
    loading.value = false
  }
}

const onCreatePermission = async () => {
  try {
    creating.value = true
    await createPermission(createForm.value)
    ElMessage.success('权限创建成功')
    createForm.value = { code: '', name: '' }
    await loadData()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    creating.value = false
  }
}

const onGrantPermission = async () => {
  try {
    granting.value = true
    await grantPermissionToUser({
      userId: grantForm.value.userId,
      permissionCode: grantForm.value.permissionCode,
    })
    ElMessage.success('授权成功')
    await loadData()
  } catch (error) {
    showErrorMessage(error)
  } finally {
    granting.value = false
  }
}

const onRevokePermission = async (item) => {
  try {
    await ElMessageBox.confirm(
      `确认撤销用户「${item.user_name}」的权限「${item.permission_code}」吗？`,
      '撤销确认',
      {
        type: 'warning',
        confirmButtonText: '确认撤销',
        cancelButtonText: '取消',
      }
    )
  } catch {
    return
  }

  try {
    await revokeUserPermission(item.id)
    ElMessage.success('撤销成功')
    await loadData()
  } catch (error) {
    showErrorMessage(error)
  }
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <section class="permission-page" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="title">新建权限</div>
      </template>

      <div class="form-grid">
        <el-input v-model="createForm.code" placeholder="权限码，如 admin" />
        <el-input v-model="createForm.name" placeholder="权限名称，如 管理员访问" />
        <el-button type="primary" :loading="creating" @click="onCreatePermission">新增权限</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="title">用户授权</div>
      </template>

      <div class="form-grid">
        <el-select v-model="grantForm.userId" filterable placeholder="选择用户">
          <el-option
            v-for="item in users"
            :key="item.user_id || item.id"
            :label="`${item.nickname || '未命名'} (${item.user_id})`"
            :value="item.user_id || item.id"
          />
        </el-select>
        <el-select v-model="grantForm.permissionCode" filterable placeholder="选择权限">
          <el-option v-for="item in permissions" :key="item.code" :label="`${item.name} (${item.code})`" :value="item.code" />
        </el-select>
        <el-button type="primary" :loading="granting" @click="onGrantPermission">授权</el-button>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="title">权限字典</div>
      </template>
      <div v-if="permissions.length" class="tag-wrap">
        <el-tag v-for="item in permissions" :key="item.code" type="primary">
          {{ item.name }}（{{ item.code }}）
        </el-tag>
      </div>
      <el-empty v-else description="暂无权限数据" />
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="title">授权列表</div>
      </template>
      <div class="filter-wrap">
        <el-select v-model="filterUserId" clearable filterable placeholder="按用户筛选授权记录">
          <el-option
            v-for="item in users"
            :key="item.user_id || item.id"
            :label="`${item.nickname || '未命名'} (${item.user_id})`"
            :value="item.user_id || item.id"
          />
        </el-select>
      </div>
      <div v-if="enrichedUserPermissions.length" class="relation-list">
        <div v-for="item in enrichedUserPermissions" :key="item.id" class="relation-item">
          <div class="user">{{ item.user_name }}</div>
          <div class="relation-right">
            <el-tag size="small">{{ item.permission_code }}</el-tag>
            <el-button type="danger" link @click="onRevokePermission(item)">撤销</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无授权记录" />
    </el-card>
  </section>
</template>

<style scoped>
.permission-page {
  display: grid;
  gap: 12px;
}

.title {
  font-size: 15px;
  font-weight: 600;
}

.form-grid {
  display: grid;
  gap: 10px;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.relation-list {
  display: grid;
  gap: 8px;
}

.relation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  padding: 10px;
}

.user {
  font-size: 13px;
  color: #303133;
}

.relation-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-wrap {
  margin-bottom: 10px;
}
</style>
