import { ElMessage } from 'element-plus';

export const getApiErrorMessage = (error, fallback = '操作失败') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  const maybeAxios = error;
  const response = maybeAxios?.response;
  if (response) {
    const status = response.status;
    const data = response.data;
    if (data) {
      if (typeof data === 'string') return data;
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
      if (typeof data.error === 'string' && data.error.trim()) return data.error;
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0];
        if (typeof first === 'string' && first.trim()) return first;
      }
    }
    return `${fallback} (HTTP ${status})`;
  }

  if (typeof maybeAxios?.message === 'string' && maybeAxios.message.trim()) return maybeAxios.message;
  return fallback;
};

export const notifyError = (error, fallback = '操作失败') => {
  ElMessage.error(getApiErrorMessage(error, fallback));
};

export const notifySuccess = (message) => {
  if (!message) return;
  ElMessage.success(String(message));
};

export const notifyWarning = (message) => {
  if (!message) return;
  ElMessage.warning(String(message));
};

