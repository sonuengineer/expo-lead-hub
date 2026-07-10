import axios, { AxiosInstance } from "axios";
import { useAuthStore } from "../stores/auth.store";

// Relative "/api" by default so the app works on any host (localhost, LAN IP for
// mobile testing, or a deployed domain) via the dev-server / reverse-proxy — and
// avoids CORS entirely since requests are same-origin. Override with VITE_API_URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

let apiClient: AxiosInstance;

export function initializeApiClient() {
  apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  // Request interceptor - add auth token
  apiClient.interceptors.request.use((config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  // Response interceptor - handle token refresh & errors
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // If 401 and not already retried, try to refresh token
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const { refreshToken } = useAuthStore.getState();

        if (refreshToken) {
          try {
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } = response.data;
            useAuthStore.setState({ accessToken: newAccessToken, refreshToken: newRefreshToken, user });

            // Retry original request
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
          } catch (_err) {
            // Refresh failed, logout
            useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
              window.location.href = "/login";
          }
        }
      }

      return Promise.reject(error);
    },
  );

  return apiClient;
}

export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    initializeApiClient();
  }
  return apiClient;
}

// Unauthenticated client for the public visitor lead form (no bearer token).
const publicClient = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

export const publicApi = {
  getForm: (shortCode: string) => publicClient.get(`/public/v/${shortCode}`),
  submitLead: (data: unknown) => publicClient.post("/public/leads", data),
};

// API Methods
export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      getApiClient().post("/auth/login", { email, password }),
    register: (email: string, password: string, name: string) =>
      getApiClient().post("/auth/register", { email, password, name }),
    logout: () => getApiClient().post("/auth/logout"),
    me: () => getApiClient().get("/auth/me"),
  },

  // Events
  events: {
    list: (params?: any) => getApiClient().get("/events", { params }),
    get: (id: string) => getApiClient().get(`/events/${id}`),
    create: (data: any) => getApiClient().post("/events", data),
    update: (id: string, data: any) => getApiClient().put(`/events/${id}`, data),
    delete: (id: string) => getApiClient().delete(`/events/${id}`),
  },

  // Booths
  booths: {
    list: (eventId: string, params?: any) =>
      getApiClient().get(`/events/${eventId}/booths`, { params }),
    get: (eventId: string, boothId: string) =>
      getApiClient().get(`/events/${eventId}/booths/${boothId}`),
    create: (eventId: string, data: any) =>
      getApiClient().post(`/events/${eventId}/booths`, data),
    update: (eventId: string, boothId: string, data: any) =>
      getApiClient().put(`/events/${eventId}/booths/${boothId}`, data),
    delete: (eventId: string, boothId: string) =>
      getApiClient().delete(`/events/${eventId}/booths/${boothId}`),
  },

  // Forms
  forms: {
    list: (eventId: string) => getApiClient().get(`/events/${eventId}/forms`),
    get: (eventId: string, formId: string) =>
      getApiClient().get(`/events/${eventId}/forms/${formId}`),
    create: (eventId: string, data: any) =>
      getApiClient().post(`/events/${eventId}/forms`, data),
    update: (eventId: string, formId: string, data: any) =>
      getApiClient().put(`/events/${eventId}/forms/${formId}`, data),
    delete: (eventId: string, formId: string) =>
      getApiClient().delete(`/events/${eventId}/forms/${formId}`),
  },

  // Form Fields (nested under a form definition)
  formFields: {
    list: (eventId: string, formId: string) =>
      getApiClient().get(`/events/${eventId}/forms/${formId}/fields`),
    create: (eventId: string, formId: string, data: any) =>
      getApiClient().post(`/events/${eventId}/forms/${formId}/fields`, data),
    update: (eventId: string, formId: string, fieldId: string, data: any) =>
      getApiClient().put(`/events/${eventId}/forms/${formId}/fields/${fieldId}`, data),
    remove: (eventId: string, formId: string, fieldId: string) =>
      getApiClient().delete(`/events/${eventId}/forms/${formId}/fields/${fieldId}`),
    activate: (eventId: string, formId: string, fieldId: string) =>
      getApiClient().post(`/events/${eventId}/forms/${formId}/fields/${fieldId}/activate`),
    deactivate: (eventId: string, formId: string, fieldId: string) =>
      getApiClient().post(`/events/${eventId}/forms/${formId}/fields/${fieldId}/deactivate`),
  },

  // OCR (business card scanning)
  ocr: {
    scan: (imageFile: File) => {
      const fd = new FormData();
      fd.append("image", imageFile);
      return getApiClient().post("/ocr/scan", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });
    },
    submit: (data: any) => getApiClient().post("/ocr/submit", data),
  },

  // QR Codes
  qr: {
    list: (eventId: string, boothId: string) =>
      getApiClient().get(`/events/${eventId}/booths/${boothId}/qr`),
    generate: (eventId: string, boothId: string, data: any) =>
      getApiClient().post(`/events/${eventId}/booths/${boothId}/qr`, data),
    delete: (eventId: string, boothId: string, qrId: string) =>
      getApiClient().delete(`/events/${eventId}/booths/${boothId}/qr/${qrId}`),
  },

  // CRM Config
  crm: {
    list: (eventId: string) => getApiClient().get(`/events/${eventId}/crm-config`),
    get: (eventId: string, configId: string) =>
      getApiClient().get(`/events/${eventId}/crm-config/${configId}`),
    create: (eventId: string, data: any) =>
      getApiClient().post(`/events/${eventId}/crm-config`, data),
    update: (eventId: string, configId: string, data: any) =>
      getApiClient().put(`/events/${eventId}/crm-config/${configId}`, data),
    delete: (eventId: string, configId: string) =>
      getApiClient().delete(`/events/${eventId}/crm-config/${configId}`),
    test: (eventId: string, configId: string) =>
      getApiClient().post(`/events/${eventId}/crm-config/${configId}/test`),
  },

  // Sync Queue
  syncQueue: {
    status: (params?: any) => getApiClient().get("/sync-queue/status", { params }),
    pending: () => getApiClient().get("/sync-queue/pending"),
    retry: (queueItemId: string) =>
      getApiClient().post(`/sync-queue/${queueItemId}/retry`),
    logs: (params?: any) => getApiClient().get("/sync-queue/logs", { params }),
    process: () => getApiClient().post("/sync-queue/process"),
  },

  // Dashboard
  dashboard: {
    stats: () => getApiClient().get("/dashboard/stats"),
  },

  // Leads
  leads: {
    list: (params?: any) => getApiClient().get("/leads", { params }),
    get: (id: string) => getApiClient().get(`/leads/${id}`),
    export: (filters?: any) =>
      getApiClient().post("/leads/export", filters ?? {}, { responseType: "blob" }),
  },

  // Audit Logs
  audit: {
    list: (params?: any) => getApiClient().get("/audit-logs", { params }),
  },

  // Users
  users: {
    list: () => getApiClient().get("/users"),
    get: (id: string) => getApiClient().get(`/users/${id}`),
    create: (data: any) => getApiClient().post("/users", data),
    update: (id: string, data: any) => getApiClient().put(`/users/${id}`, data),
    deactivate: (id: string) => getApiClient().post(`/users/${id}/deactivate`),
    resetPassword: (id: string) => getApiClient().post(`/users/${id}/reset-password`),
  },
};
