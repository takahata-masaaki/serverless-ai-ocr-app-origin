declare const api: import("axios").AxiosInstance;
export default api;
export declare const runAgent: (imageId: string) => Promise<{
    status: string;
    suggestions: any;
}>;
export declare const pollAgentJobStatus: (_jobId: string) => Promise<any>;
export declare const getAgentTools: () => Promise<{
    tools: never[];
}>;
export declare const deleteImage: (imageId: string, appName?: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
export declare const updateVerificationStatus: (imageId: string, completed: boolean) => Promise<import("axios").AxiosResponse<any, any, {}>>;
