import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 429) {
      return Promise.reject(new Error('Rate limit exceeded. Please try again later.'));
    }

    if (error.response?.status === 503) {
      return Promise.reject(new Error('Service temporarily unavailable. Please try again later.'));
    }

    return Promise.reject(error);
  }
);

export const healthService = {
  check: () => api.get('/health'),
  getStats: () => api.get('/health/stats'),
};

export const pdfService = {
  upload: (formData) => api.post('/pdfs/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list: (params) => api.get('/pdfs', { params }),
  getById: (id) => api.get(`/pdfs/${id}`),
  getViewUrl: (id) => `${api.defaults.baseURL}/pdfs/${id}/view`,
  compare: (id) => api.get(`/pdfs/${id}/compare`),
  analyze: (id) => api.post(`/pdfs/${id}/analyze`),
  verify: (id) => api.post(`/pdfs/${id}/verify`),
  saveCorrected: (id) => api.post(`/pdfs/${id}/save-corrected`),
  delete: (id) => api.delete(`/pdfs/${id}`),
  getPageImage: (pdfId, pageNumber) => api.get(`/pdfs/${pdfId}/page/${pageNumber}`, {
    responseType: 'blob',
  }),
};

export const questionService = {
  list: (params) => api.get('/questions', { params }),
  getById: (id) => api.get(`/questions/${id}`),
  getByStableId: (stableId) => api.get(`/questions/stable/${stableId}`),
  getOptions: () => api.get('/questions/options'),
};

export const jobService = {
  list: (params) => api.get('/jobs', { params }),
  getStats: () => api.get('/jobs/stats'),
  getById: (id) => api.get(`/jobs/${id}`),
  retry: (id) => api.post(`/jobs/${id}/retry`),
  queueVerification: (body) => api.post('/jobs/verify', body),
};

export const reviewService = {
  getQueue: (params) => api.get('/reviews/queue', { params }),
  approve: (questionId, data) => api.post(`/reviews/${questionId}/approve`, data),
  reject: (questionId, data) => api.post(`/reviews/${questionId}/reject`, data),
  edit: (questionId, data) => api.post(`/reviews/${questionId}/edit`, data),
  comment: (questionId, data) => api.post(`/reviews/${questionId}/comment`, data),
  getHistory: (questionId) => api.get(`/reviews/${questionId}/history`),
};

export const importService = {
  import: (formData) => api.post('/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const correctedService = {
  list: (params) => api.get('/corrected', { params }),
  getById: (id) => api.get(`/corrected/${id}`),
  approve: (id) => api.post(`/corrected/${id}/approve`),
  edit: (id, data) => api.post(`/corrected/${id}/edit`, data),
  verify: (id) => api.post(`/corrected/${id}/verify`),
};

export const exportService = {
  exportQuestions: (params) => {
    const url = new URL(api.defaults.baseURL + '/export/questions');
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    window.open(url.toString(), '_blank');
  },
  exportReviewQueue: (params) => {
    const url = new URL(api.defaults.baseURL + '/export/review-queue');
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));
    window.open(url.toString(), '_blank');
  },
};

export default api;
