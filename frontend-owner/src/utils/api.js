import axios from 'axios';

const API_TIMEOUT_MS = 12000;
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

export function configureAxios() {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
  axios.defaults.timeout = API_TIMEOUT_MS;

  axios.interceptors.response.use(
    (response) => {
      console.log('[Owner API response]', {
        method: response.config?.method?.toUpperCase(),
        url: response.config?.url,
        status: response.status,
        data: response.data,
      });
      return response;
    },
    (error) => {
      console.error('[Owner API error]', {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return Promise.reject(error);
    }
  );
}

export function getApiErrorMessage(error, fallbackMessage) {
  if (error.code === 'ECONNABORTED') {
    return 'Server is taking too long to respond. Please try again.';
  }

  if (!error.response) {
    return 'Unable to reach the server. If it was sleeping, please retry.';
  }

  return error.response.data?.message || fallbackMessage;
}

export async function requestWithRetry(requestFactory, options = {}) {
  const { retries = 1, retryDelayMs = 1500 } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFactory();
    } catch (error) {
      lastError = error;

      const status = error.response?.status;
      const shouldRetry =
        attempt < retries &&
        (!error.response ||
          error.code === 'ECONNABORTED' ||
          RETRYABLE_STATUS_CODES.has(status) ||
          error.response?.data?.code === 'DB_NOT_READY');

      if (!shouldRetry) {
        break;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, retryDelayMs);
      });
    }
  }

  throw lastError;
}
