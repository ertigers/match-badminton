import { ElMessage } from 'element-plus'

export const showErrorMessage = (error) => {
  const message = error?.message || '操作失败，请稍后重试'
  ElMessage.error(message)
}
