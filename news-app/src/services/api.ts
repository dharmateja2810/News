/**
 * API client (Axios) with auth token injection + global 401 handling
 */
import axios from 'axios';
import { APP_CONFIG } from '../constants/appConfig';

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const api = axios.create({
  baseURL: APP_CONFIG.API_BASE_URL,
  timeout: 20000,
});

export function setApiAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(err);
  },
);


