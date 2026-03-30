import API_URL from '../api';

const ABSOLUTE_URL_PATTERN = /^(?:https?:)?\/\//i;

const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);
const ensureTrailingSlash = (value) => (value.endsWith('/') ? value : `${value}/`);

const getAbsoluteApiBase = () => {
  const rawApiUrl = API_URL || '/api';

  if (ABSOLUTE_URL_PATTERN.test(rawApiUrl)) {
    return ensureTrailingSlash(rawApiUrl);
  }

  const normalizedApiUrl = ensureTrailingSlash(ensureLeadingSlash(rawApiUrl));
  return new URL(normalizedApiUrl, window.location.origin).toString();
};

export const isAssetUrl = (value = '') => (
  typeof value === 'string'
  && (
    ABSOLUTE_URL_PATTERN.test(value)
    || value.startsWith('/uploads/')
    || value.startsWith('/api/uploads/')
    || value.startsWith('uploads/')
    || value.startsWith('api/uploads/')
    || value.startsWith('data:')
    || value.startsWith('blob:')
  )
);

export const resolveAssetUrl = (value = '') => {
  if (!value || typeof value !== 'string') return value;

  if (ABSOLUTE_URL_PATTERN.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  const normalizedValue = ensureLeadingSlash(value);
  const apiBase = getAbsoluteApiBase();

  if (normalizedValue.startsWith('/api/uploads/')) {
    return new URL(normalizedValue, apiBase).toString();
  }

  if (normalizedValue.startsWith('/uploads/')) {
    const apiRelativePath = normalizedValue.replace(/^\/uploads\//, 'uploads/');
    return new URL(apiRelativePath, apiBase).toString();
  }

  return new URL(normalizedValue, window.location.origin).toString();
};
