declare const api: import("axios").AxiosInstance;
export default api;
export declare const runAgent: (imageId: string) => Promise<any>;
export declare const pollAgentJobStatus: (jobId: string, maxAttempts?: number, interval?: number) => Promise<any>;
export declare const getAgentTools: () => Promise<any>;
export declare const deleteImage: (imageId: string, appName?: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
export declare const updateVerificationStatus: (imageId: string, completed: boolean) => Promise<import("axios").AxiosResponse<any, any, {}>>;
