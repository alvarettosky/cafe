import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock createClient from supabase-js
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockStorageFrom = vi.fn();
const mockStorageList = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn((url, key, options) => {
        // Admin client (service role key) - detected by auth options
        if (options?.auth?.autoRefreshToken === false) {
            return {
                storage: {
                    from: mockStorageFrom,
                },
            };
        }
        // Regular client - used for auth/profile
        return {
            auth: {
                getUser: mockGetUser,
            },
            from: mockFrom,
        };
    }),
}));

describe('Backups List API Route', () => {
    // Dynamically import after mocking
    let GET: typeof import('../route').GET;

    const originalEnv = process.env;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Reset module registry to reload with fresh env vars
        vi.resetModules();

        // Reset env vars
        process.env = {
            ...originalEnv,
            NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
            SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        };

        // Re-import the module after env vars are set
        const routeModule = await import('../route');
        GET = routeModule.GET;

        // Setup default chain for from().select().eq().single()
        mockSingle.mockResolvedValue({ data: { role: 'admin', approved: true }, error: null });
        mockEq.mockReturnValue({ single: mockSingle });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        // Setup storage mock
        mockStorageFrom.mockReturnValue({
            list: mockStorageList,
            createSignedUrl: mockCreateSignedUrl,
        });
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
    });

    describe('Authentication', () => {
        it('should return 401 when no authorization header is provided', async () => {
            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {},
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });

        it('should return 401 when authorization header is malformed', async () => {
            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'InvalidToken abc123',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });

        it('should return 401 when user is not found', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });

        it('should return 401 when auth returns an error', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Auth error'),
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer invalid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });
    });

    describe('Authorization', () => {
        beforeEach(() => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });
        });

        it('should return 403 when user is not approved', async () => {
            mockSingle.mockResolvedValue({
                data: { role: 'admin', approved: false },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ver backups');
        });

        it('should return 403 when user is not admin', async () => {
            mockSingle.mockResolvedValue({
                data: { role: 'seller', approved: true },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ver backups');
        });

        it('should return 403 when profile is not found', async () => {
            mockSingle.mockResolvedValue({
                data: null,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ver backups');
        });

        it('should return 403 when both approved is false and role is not admin', async () => {
            mockSingle.mockResolvedValue({
                data: { role: 'seller', approved: false },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ver backups');
        });
    });

    describe('Service Role Key Configuration', () => {
        it('should return configured: false when service role key is missing', async () => {
            // Need to re-import with different env
            vi.resetModules();
            process.env.SUPABASE_SERVICE_ROLE_KEY = '';

            const routeModule = await import('../route');
            const localGET = routeModule.GET;

            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });
            mockSingle.mockResolvedValue({
                data: { role: 'admin', approved: true },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await localGET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toEqual([]);
            expect(data.configured).toBe(false);
            expect(data.message).toBe('Supabase Storage no configurado (falta service role key)');
        });
    });

    describe('Successful Backup Listing', () => {
        beforeEach(() => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });
            mockSingle.mockResolvedValue({
                data: { role: 'admin', approved: true },
                error: null,
            });
        });

        it('should return empty backups list when no files exist', async () => {
            mockStorageList.mockResolvedValue({
                data: [],
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toEqual([]);
            expect(data.configured).toBe(true);
        });

        it('should return backup files with signed URLs', async () => {
            const mockFiles = [
                {
                    id: 'file-1',
                    name: 'backup-2024-01-15.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 1024 * 1024 }, // 1 MB
                },
                {
                    id: 'file-2',
                    name: 'backup-2024-01-14.zip',
                    created_at: '2024-01-14T10:00:00Z',
                    metadata: { size: 2048 * 1024 }, // 2 MB
                },
            ];

            mockStorageList.mockResolvedValue({
                data: mockFiles,
                error: null,
            });

            mockCreateSignedUrl.mockResolvedValue({
                data: { signedUrl: 'https://storage.supabase.co/signed/backup.zip' },
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.configured).toBe(true);
            expect(data.backups).toHaveLength(2);
            expect(data.backups[0]).toEqual({
                id: 'file-1',
                name: 'backup-2024-01-15.zip',
                createdTime: '2024-01-15T10:00:00Z',
                size: '1 MB',
                downloadUrl: 'https://storage.supabase.co/signed/backup.zip',
            });
        });

        it('should handle files with missing metadata', async () => {
            const mockFiles = [
                {
                    name: 'backup-2024-01-15.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    // No id or metadata
                },
            ];

            mockStorageList.mockResolvedValue({
                data: mockFiles,
                error: null,
            });

            mockCreateSignedUrl.mockResolvedValue({
                data: { signedUrl: 'https://storage.supabase.co/signed/backup.zip' },
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toHaveLength(1);
            expect(data.backups[0].id).toBe('backup-2024-01-15.zip'); // Falls back to name
            expect(data.backups[0].size).toBe('0 Bytes');
        });

        it('should skip files without names', async () => {
            const mockFiles = [
                {
                    id: 'file-1',
                    name: 'backup-2024-01-15.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 1024 },
                },
                {
                    id: 'file-2',
                    name: '', // Empty name
                    created_at: '2024-01-14T10:00:00Z',
                    metadata: { size: 1024 },
                },
                {
                    id: 'file-3',
                    // No name property
                    created_at: '2024-01-13T10:00:00Z',
                    metadata: { size: 1024 },
                },
            ];

            mockStorageList.mockResolvedValue({
                data: mockFiles,
                error: null,
            });

            mockCreateSignedUrl.mockResolvedValue({
                data: { signedUrl: 'https://storage.supabase.co/signed/backup.zip' },
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toHaveLength(1);
            expect(data.backups[0].name).toBe('backup-2024-01-15.zip');
        });

        it('should handle failed signed URL generation', async () => {
            const mockFiles = [
                {
                    id: 'file-1',
                    name: 'backup-2024-01-15.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 1024 },
                },
            ];

            mockStorageList.mockResolvedValue({
                data: mockFiles,
                error: null,
            });

            mockCreateSignedUrl.mockResolvedValue({
                data: null, // Failed to generate URL
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toHaveLength(1);
            expect(data.backups[0].downloadUrl).toBe('');
        });

        it('should handle null data from storage list', async () => {
            mockStorageList.mockResolvedValue({
                data: null,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toEqual([]);
            expect(data.configured).toBe(true);
        });
    });

    describe('Bucket Not Found', () => {
        beforeEach(() => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });
            mockSingle.mockResolvedValue({
                data: { role: 'admin', approved: true },
                error: null,
            });
        });

        it('should return empty backups when bucket is not found', async () => {
            mockStorageList.mockResolvedValue({
                data: null,
                error: { message: 'Bucket not found' },
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toEqual([]);
            expect(data.configured).toBe(true);
            expect(data.message).toBe('No hay backups aún');
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });
            mockSingle.mockResolvedValue({
                data: { role: 'admin', approved: true },
                error: null,
            });
        });

        it('should return 500 when storage list fails with non-bucket-not-found error', async () => {
            mockStorageList.mockResolvedValue({
                data: null,
                error: { message: 'Internal server error' },
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Error al listar backups');
        });

        it('should return 500 for unexpected errors', async () => {
            mockStorageList.mockRejectedValue(new Error('Unexpected error'));

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Error al listar backups');
        });
    });

    describe('formatBytes utility', () => {
        beforeEach(() => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });
            mockSingle.mockResolvedValue({
                data: { role: 'admin', approved: true },
                error: null,
            });
        });

        it('should format bytes correctly', async () => {
            const mockFiles = [
                {
                    id: '1',
                    name: 'zero.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 0 },
                },
                {
                    id: '2',
                    name: 'bytes.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 500 },
                },
                {
                    id: '3',
                    name: 'kb.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 1024 },
                },
                {
                    id: '4',
                    name: 'mb.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 1024 * 1024 },
                },
                {
                    id: '5',
                    name: 'gb.zip',
                    created_at: '2024-01-15T10:00:00Z',
                    metadata: { size: 1024 * 1024 * 1024 },
                },
            ];

            mockStorageList.mockResolvedValue({
                data: mockFiles,
                error: null,
            });

            mockCreateSignedUrl.mockResolvedValue({
                data: { signedUrl: 'https://url' },
            });

            const request = new NextRequest('http://localhost:3000/api/backups/list', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.backups).toHaveLength(5);
            expect(data.backups[0].size).toBe('0 Bytes');
            expect(data.backups[1].size).toBe('500 Bytes');
            expect(data.backups[2].size).toBe('1 KB');
            expect(data.backups[3].size).toBe('1 MB');
            expect(data.backups[4].size).toBe('1 GB');
        });
    });
});
