const normalizeCity = (value) => String(value || '').trim().toLowerCase();

const getBindingCity = (...values) => {
  for (const value of values) {
    const city = String(value || '').trim();
    if (city) {
      return city;
    }
  }

  return '';
};

const createCityBindingError = (message, status = 403) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const assertCityBinding = (bindingCity, submittedCity, label = 'посилання') => {
  const requiredCity = getBindingCity(bindingCity);
  if (!requiredCity) {
    return;
  }

  const providedCity = String(submittedCity || '').trim();
  if (!providedCity) {
    throw createCityBindingError(`Для ${label} потрібно вказати місто ${requiredCity}`, 400);
  }

  if (normalizeCity(providedCity) !== normalizeCity(requiredCity)) {
    throw createCityBindingError(`Це ${label} доступне лише для міста ${requiredCity}`);
  }
};

module.exports = {
  getBindingCity,
  assertCityBinding
};
