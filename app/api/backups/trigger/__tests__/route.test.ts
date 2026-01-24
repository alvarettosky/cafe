import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { http, HttpResponse } from 'msw';
import { server } from '@/__mocks__/server';
import { POST } from '../route';

// Mock createClient from supabase-js
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: mockGetUser,
        },
        from: mockFrom,
    })),
}));

describe('Backup Trigger API Route', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset env vars
        process.env = {
            ...originalEnv,
            NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
            GITHUB_TOKEN: 'ghp_testtoken123',
            GITHUB_REPOSITORY: 'alvarettosky/cafe',
        };

        // Setup default chain for from().select().eq().single()
        mockSingle.mockResolvedValue({ data: { role: 'admin', approved: true }, error: null });
        mockEq.mockReturnValue({ single: mockSingle });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.restoreAllMocks();
        server.resetHandlers();
    });

    describe('Authentication', () => {
        it('should return 401 when no authorization header is provided', async () => {
            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {},
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });

        it('should return 401 when authorization header is malformed', async () => {
            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'InvalidToken abc123',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });

        it('should return 401 when user is not found', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });

        it('should return 401 when auth returns an error', async () => {
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Auth error'),
            });

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer invalid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(401);
            expect(data.error).toBe('No autorizado');
        });

        it('should return 401 when token is empty', async () => {
            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer ',
                },
            });

            // Should still work but getUser should fail
            mockGetUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Invalid token'),
            });

            const response = await POST(request);
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

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ejecutar backups');
        });

        it('should return 403 when user is not admin', async () => {
            mockSingle.mockResolvedValue({
                data: { role: 'seller', approved: true },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ejecutar backups');
        });

        it('should return 403 when profile is not found', async () => {
            mockSingle.mockResolvedValue({
                data: null,
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ejecutar backups');
        });

        it('should return 403 when user is seller and not approved', async () => {
            mockSingle.mockResolvedValue({
                data: { role: 'seller', approved: false },
                error: null,
            });

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.error).toBe('Solo administradores pueden ejecutar backups');
        });
    });

    describe('GitHub Token Configuration', () => {
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

        it('should return 400 when GitHub token is not configured', async () => {
            process.env.GITHUB_TOKEN = '';

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('GitHub no configurado');
            expect(data.message).toBe('Configure GITHUB_TOKEN en las variables de entorno para habilitar backups manuales');
        });

        it('should return 400 when GitHub token is undefined', async () => {
            delete process.env.GITHUB_TOKEN;

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('GitHub no configurado');
        });
    });

    describe('Successful Backup Trigger', () => {
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

        it('should successfully trigger backup via GitHub Actions', async () => {
            // Use MSW to handle the GitHub API request
            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', () => {
                    return new HttpResponse(null, { status: 204 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Backup iniciado. Recibirás una notificación cuando termine.');
        });

        it('should use default repository when GITHUB_REPOSITORY is not set', async () => {
            delete process.env.GITHUB_REPOSITORY;

            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', () => {
                    return new HttpResponse(null, { status: 204 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it('should use custom repository when GITHUB_REPOSITORY is set', async () => {
            process.env.GITHUB_REPOSITORY = 'myorg/myrepo';

            server.use(
                http.post('https://api.github.com/repos/myorg/myrepo/actions/workflows/daily-backup.yml/dispatches', () => {
                    return new HttpResponse(null, { status: 204 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
        });
    });

    describe('GitHub API Error Handling', () => {
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

        it('should return 500 when GitHub API returns error', async () => {
            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', () => {
                    return new HttpResponse('Bad credentials', { status: 401 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Error al ejecutar backup en GitHub');
        });

        it('should return 500 when GitHub API returns 404 (workflow not found)', async () => {
            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', () => {
                    return new HttpResponse('Not Found', { status: 404 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Error al ejecutar backup en GitHub');
        });

        it('should return 500 when GitHub API returns 403 (rate limit or permissions)', async () => {
            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', () => {
                    return new HttpResponse('Rate limit exceeded', { status: 403 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Error al ejecutar backup en GitHub');
        });

        it('should return 500 when fetch throws network error', async () => {
            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', () => {
                    return HttpResponse.error();
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.error).toBe('Error al iniciar backup');
        });
    });

    describe('Request Body', () => {
        beforeEach(() => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });
            mockSingle.mockResolvedValue({
                data: { role: 'admin', approved: true },
                error: null,
            });

            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', () => {
                    return new HttpResponse(null, { status: 204 });
                })
            );
        });

        it('should work without request body', async () => {
            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
        });

        it('should work with empty request body', async () => {
            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({}),
            });

            const response = await POST(request);

            expect(response.status).toBe(200);
        });
    });

    describe('GitHub API Request Format', () => {
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

        it('should send correct body to GitHub API', async () => {
            let capturedBody: unknown;

            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 204 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            await POST(request);

            expect(capturedBody).toEqual({
                ref: 'main',
                inputs: {
                    debug: 'false',
                },
            });
        });

        it('should send correct authorization header to GitHub API', async () => {
            let capturedAuthHeader: string | null = null;

            server.use(
                http.post('https://api.github.com/repos/alvarettosky/cafe/actions/workflows/daily-backup.yml/dispatches', ({ request }) => {
                    capturedAuthHeader = request.headers.get('authorization');
                    return new HttpResponse(null, { status: 204 });
                })
            );

            const request = new NextRequest('http://localhost:3000/api/backups/trigger', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            await POST(request);

            expect(capturedAuthHeader).toBe('Bearer ghp_testtoken123');
        });
    });
});
