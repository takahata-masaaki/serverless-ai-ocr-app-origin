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
  const { tokens } = await fetchAuthSession();
  const idToken = tokens?.idToken?.toString();

  const response = await axios.post(
    `https://6bqdzmlw1i.execute-api.us-east-1.amazonaws.com/prod/ocr/agent/${encodeURIComponent(imageId)}`,
    {},
    {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    }
  );

  return {
    status: 'success',
    suggestions: response.data.suggestions || [],
  };
};

export const pollAgentJobStatus = async (_jobId: string): Promise<any> => {
  throw new Error('pollAgentJobStatus is not used in the current agent flow');
};

export const getAgentTools = async () => {
  return { tools: [] };
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
