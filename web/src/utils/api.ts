import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const api = axios.create({
  baseURL: 'https://aj45ozgo95.execute-api.us-east-1.amazonaws.com/prod',
});

const noAuthPrefixes = [
  '/images',
  '/generate-presigned-url',
  '/upload-complete',
  '/ocr/start',
  '/ocr/endpoint-status',
];

api.interceptors.request.use(
  async (config) => {
    try {
      const url = config.url || '';
      const skipAuth = noAuthPrefixes.some((p) => url.startsWith(p));

      if (!skipAuth) {
        const { tokens } = await fetchAuthSession();
        const idToken = tokens?.idToken?.toString();
        if (idToken) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${idToken}`;
        }
      }
    } catch {}

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default api;

export const runAgent = async (imageId: string) => {
  const startResponse = await api.post(`/ocr/agent/${imageId}`);
  const jobId = startResponse.data.jobId;
  return pollAgentJobStatus(jobId);
};

export const pollAgentJobStatus = async (
  jobId: string,
  maxAttempts = 60,
  interval = 2000
): Promise<any> => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await api.get(`/ocr/agent/status/${jobId}`);
    const { status, suggestions, error } = response.data;

    if (status === 'completed') {
      return { status: 'success', suggestions };
    }

    if (status === 'failed') {
      throw new Error(error || 'Agent processing failed');
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Agent processing timed out');
};

export const getAgentTools = async () => {
  const response = await api.get('/ocr/agent/tools');
  return response.data;
};

export const deleteImage = async (imageId: string, appName?: string) => {
  return api.delete(`/images/${imageId}`, {
    params: { app_name: appName || undefined }
  });
};

export const updateVerificationStatus = async (imageId: string, completed: boolean) => {
  return api.post(`/ocr/extract/verification/${imageId}`, {
    verification_completed: completed
  });
};
