import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            './runtimeConfig': './runtimeConfig.browser', // ensures browser compatible version of AWS JS SDK is used
        },
    },
    server: {
        port: 3000,
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZS5jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ2aXRlLmNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sTUFBTSxDQUFBO0FBQ25DLE9BQU8sS0FBSyxNQUFNLHNCQUFzQixDQUFBO0FBQ3hDLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQTtBQUV2Qiw2QkFBNkI7QUFDN0IsZUFBZSxZQUFZLENBQUM7SUFDMUIsT0FBTyxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDbEIsT0FBTyxFQUFFO1FBQ1AsS0FBSyxFQUFFO1lBQ0wsR0FBRyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQztZQUNyQyxpQkFBaUIsRUFBRSx5QkFBeUIsRUFBRSwyREFBMkQ7U0FDMUc7S0FDRjtJQUNELE1BQU0sRUFBRTtRQUNOLElBQUksRUFBRSxJQUFJO0tBQ1g7Q0FDRixDQUFDLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgJy4vcnVudGltZUNvbmZpZyc6ICcuL3J1bnRpbWVDb25maWcuYnJvd3NlcicsIC8vIGVuc3VyZXMgYnJvd3NlciBjb21wYXRpYmxlIHZlcnNpb24gb2YgQVdTIEpTIFNESyBpcyB1c2VkXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMCxcbiAgfSxcbn0pXG4iXX0=