export const getUploadErrorMessage = (error, entityLabel = 'файлу') => {
  const status = error?.response?.status;
  const serverError = error?.response?.data?.error;

  if (serverError) {
    return status ? `${serverError} (HTTP ${status})` : serverError;
  }

  if (status === 413) {
    return 'Файл завеликий або проксі блокує завантаження (HTTP 413). Перевірте nginx client_max_body_size.';
  }

  if (status === 401) {
    return 'Сесія завершилася. Увійдіть повторно й спробуйте ще раз.';
  }

  if (status) {
    return `Помилка завантаження ${entityLabel} (HTTP ${status})`;
  }

  if (error?.request) {
    return `Сервер не відповів на завантаження ${entityLabel}. Перевірте проксі, nginx або API.`;
  }

  if (error?.message) {
    return `Помилка завантаження ${entityLabel}: ${error.message}`;
  }

  return `Помилка завантаження ${entityLabel}`;
};
