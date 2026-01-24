import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// Mock createClient from supabase-js
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockOrder = vi.fn();
const mockQuery = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        auth: {
            getUser: mockGetUser,
        },
        from: mockFrom,
    })),
}));

// Mock the export utilities
vi.mock('@/lib/export', () => ({
    generateCSV: vi.fn((data) => {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((row: Record<string, unknown>) => Object.values(row).join(','));
        return [headers, ...rows].join('\n');
    }),
    generateXLSX: vi.fn(async () => Buffer.from([80, 75, 3, 4])),
    getTableColumns: vi.fn((tableName: string) => {
        const columns: Record<string, string[]> = {
            inventory: ['id', 'product_name', 'stock_kg'],
            sales: ['id', 'customer_id', 'total', 'created_at'],
            customers: ['id', 'name', 'phone'],
        };
        return columns[tableName] || ['id'];
    }),
    getDateColumn: vi.fn((tableName: string) => {
        const dateColumns: Record<string, string | null> = {
            sales: 'created_at',
            customer_contacts: 'contact_date',
        };
        return dateColumns[tableName] || null;
    }),
}));

describe('Export API Route', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default chain for from().select().eq().single()
        mockSingle.mockResolvedValue({ data: { role: 'admin', approved: true }, error: null });
        mockEq.mockReturnValue({ single: mockSingle });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        // Setup for queries with order/limit
        mockOrder.mockReturnValue({ data: [], error: null });
        mockLte.mockReturnValue({ order: mockOrder });
        mockGte.mockReturnValue({ lte: mockLte, order: mockOrder });
        mockLimit.mockReturnValue({ gte: mockGte, order: mockOrder });
        mockQuery.mockReturnValue({ limit: mockLimit });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('POST /api/export', () => {
        describe('Authentication', () => {
            it('should return 401 when no authorization header is provided', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {},
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(401);
                expect(data.error).toBe('No autorizado');
            });

            it('should return 401 when authorization header is malformed', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'InvalidToken abc123',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
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

                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
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

                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer invalid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
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

                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(403);
                expect(data.error).toBe('Usuario no aprobado');
            });

            it('should return 403 when user is not admin', async () => {
                mockSingle.mockResolvedValue({
                    data: { role: 'seller', approved: true },
                    error: null,
                });

                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(403);
                expect(data.error).toBe('Solo administradores pueden exportar datos');
            });

            it('should return 403 when profile is not found', async () => {
                mockSingle.mockResolvedValue({
                    data: null,
                    error: { message: 'Profile not found' },
                });

                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(403);
                expect(data.error).toBe('Usuario no aprobado');
            });
        });

        describe('Input Validation', () => {
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

            it('should return 400 when tables is missing', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Debe seleccionar al menos una tabla');
            });

            it('should return 400 when tables is empty array', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: [], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Debe seleccionar al menos una tabla');
            });

            it('should return 400 when tables is not an array', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: 'inventory', format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Debe seleccionar al menos una tabla');
            });

            it('should return 400 when format is invalid', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'pdf' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Formato inválido. Use csv o xlsx');
            });

            it('should return 400 when format is missing', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'] }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Formato inválido. Use csv o xlsx');
            });

            it('should return 400 for invalid table names', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['invalid_table', 'another_invalid'], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Tablas inválidas: invalid_table, another_invalid');
            });

            it('should return 400 for invalid date range (invalid dates)', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({
                        tables: ['sales'],
                        format: 'csv',
                        dateRange: { start: 'invalid-date', end: '2024-12-31' },
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Rango de fechas inválido');
            });

            it('should return 400 when end date is before start date', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({
                        tables: ['sales'],
                        format: 'csv',
                        dateRange: { start: '2024-12-31', end: '2024-01-01' },
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('La fecha de fin debe ser posterior a la de inicio');
            });
        });

        describe('Successful Export', () => {
            const mockInventoryData = [
                { id: '1', product_name: 'Cafe Especial', stock_kg: 10 },
                { id: '2', product_name: 'Cafe Premium', stock_kg: 5 },
            ];

            beforeEach(() => {
                mockGetUser.mockResolvedValue({
                    data: { user: { id: 'user-123' } },
                    error: null,
                });

                // Reset the from mock for data fetching
                let callCount = 0;
                mockFrom.mockImplementation((table: string) => {
                    callCount++;
                    if (callCount === 1) {
                        // First call is for profiles
                        return {
                            select: () => ({
                                eq: () => ({
                                    single: () => Promise.resolve({
                                        data: { role: 'admin', approved: true },
                                        error: null,
                                    }),
                                }),
                            }),
                        };
                    }
                    // Subsequent calls are for data tables
                    return {
                        select: () => ({
                            limit: () => ({
                                gte: () => ({
                                    lte: () => ({
                                        order: () => Promise.resolve({
                                            data: mockInventoryData,
                                            error: null,
                                        }),
                                    }),
                                }),
                                order: () => Promise.resolve({
                                    data: mockInventoryData,
                                    error: null,
                                }),
                            }),
                        }),
                    };
                });
            });

            it('should export single table as CSV', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
                });

                const response = await POST(request);

                expect(response.status).toBe(200);
                expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
                expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="inventory-.*\.csv"/);
            });

            it('should export single table as XLSX', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'xlsx' }),
                });

                const response = await POST(request);

                expect(response.status).toBe(200);
                expect(response.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="inventory-.*\.xlsx"/);
            });

            it('should export multiple tables as CSV with separators', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory', 'customers'], format: 'csv' }),
                });

                const response = await POST(request);

                expect(response.status).toBe(200);
                expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
                expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="export-.*\.csv"/);
            });

            it('should export multiple tables as XLSX', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory', 'customers'], format: 'xlsx' }),
                });

                const response = await POST(request);

                expect(response.status).toBe(200);
                expect(response.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="export-.*\.xlsx"/);
            });

            it('should apply date range filter when provided', async () => {
                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({
                        tables: ['sales'],
                        format: 'csv',
                        dateRange: { start: '2024-01-01', end: '2024-12-31' },
                    }),
                });

                const response = await POST(request);
                expect(response.status).toBe(200);
            });
        });

        describe('Error Handling', () => {
            beforeEach(() => {
                mockGetUser.mockResolvedValue({
                    data: { user: { id: 'user-123' } },
                    error: null,
                });
            });

            it('should return 500 when database query fails', async () => {
                let callCount = 0;
                mockFrom.mockImplementation(() => {
                    callCount++;
                    if (callCount === 1) {
                        return {
                            select: () => ({
                                eq: () => ({
                                    single: () => Promise.resolve({
                                        data: { role: 'admin', approved: true },
                                        error: null,
                                    }),
                                }),
                            }),
                        };
                    }
                    return {
                        select: () => ({
                            limit: () => ({
                                order: () => Promise.resolve({
                                    data: null,
                                    error: { message: 'Database connection error' },
                                }),
                            }),
                        }),
                    };
                });

                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(500);
                expect(data.error).toContain('Error al obtener datos de inventory');
            });

            it('should return 500 for unexpected errors', async () => {
                mockFrom.mockImplementation(() => {
                    throw new Error('Unexpected error');
                });

                const request = new NextRequest('http://localhost:3000/api/export', {
                    method: 'POST',
                    headers: {
                        authorization: 'Bearer valid-token',
                    },
                    body: JSON.stringify({ tables: ['inventory'], format: 'csv' }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(500);
                expect(data.error).toBe('Error interno del servidor');
            });
        });
    });

    describe('GET /api/export', () => {
        beforeEach(() => {
            mockGetUser.mockResolvedValue({
                data: { user: { id: 'user-123' } },
                error: null,
            });

            let callCount = 0;
            mockFrom.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: () => Promise.resolve({
                                    data: { role: 'admin', approved: true },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                // Return a fully chainable mock for data queries
                const queryResult = Promise.resolve({
                    data: [{ id: '1', product_name: 'Test', created_at: '2024-06-15T10:00:00Z' }],
                    error: null,
                });
                const orderMock = () => queryResult;
                const lteMock = () => ({ order: orderMock });
                const gteMock = () => ({ lte: lteMock, order: orderMock });
                const limitMock = () => ({ gte: gteMock, order: orderMock });
                return {
                    select: () => ({
                        limit: limitMock,
                    }),
                };
            });
        });

        it('should return 400 when table parameter is missing', async () => {
            const request = new NextRequest('http://localhost:3000/api/export?format=csv', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toBe('Parámetro table requerido');
        });

        it('should export single table via query params', async () => {
            const request = new NextRequest('http://localhost:3000/api/export?table=inventory&format=xlsx', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            expect(response.status).toBe(200);
        });

        it('should default to xlsx format when format is not specified', async () => {
            const request = new NextRequest('http://localhost:3000/api/export?table=inventory', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });

        it('should pass date range from query params to POST handler', async () => {
            const request = new NextRequest('http://localhost:3000/api/export?table=sales&format=csv&start=2024-01-01&end=2024-12-31', {
                method: 'GET',
                headers: {
                    authorization: 'Bearer valid-token',
                },
            });

            const response = await GET(request);
            expect(response.status).toBe(200);
        });
    });
});
