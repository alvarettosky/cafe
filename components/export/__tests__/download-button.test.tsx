import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DownloadButton } from '../download-button';
import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';

// Mock the auth provider
const mockUseAuth = vi.fn();
vi.mock('@/components/auth-provider', () => ({
    useAuth: () => mockUseAuth(),
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: 'mock-token' } },
            }),
        },
    },
}));

// Mock URL.createObjectURL and revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();

describe('DownloadButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: user is admin
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            session: { access_token: 'mock-token' },
        });

        // Setup URL mocks
        global.URL.createObjectURL = mockCreateObjectURL;
        global.URL.revokeObjectURL = mockRevokeObjectURL;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Visibility', () => {
        it('should render when user is admin', () => {
            render(<DownloadButton tables="inventory" />);
            expect(screen.getByRole('button')).toBeInTheDocument();
        });

        it('should not render when user is not admin', () => {
            mockUseAuth.mockReturnValue({
                isAdmin: false,
                session: null,
            });

            const { container } = render(<DownloadButton tables="inventory" />);
            expect(container.firstChild).toBeNull();
        });

        it('should display default label for XLSX format', () => {
            render(<DownloadButton tables="inventory" format="xlsx" />);
            expect(screen.getByText('Exportar Excel')).toBeInTheDocument();
        });

        it('should display default label for CSV format', () => {
            render(<DownloadButton tables="inventory" format="csv" />);
            expect(screen.getByText('Exportar CSV')).toBeInTheDocument();
        });

        it('should display custom label when provided', () => {
            render(<DownloadButton tables="inventory" label="Descargar Inventario" />);
            expect(screen.getByText('Descargar Inventario')).toBeInTheDocument();
        });

        it('should render icon only when iconOnly is true', () => {
            render(<DownloadButton tables="inventory" iconOnly />);
            expect(screen.queryByText('Exportar Excel')).not.toBeInTheDocument();
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Export Functionality', () => {
        it('should trigger download on click', async () => {
            const user = userEvent.setup();

            render(<DownloadButton tables="inventory" format="xlsx" />);

            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(mockCreateObjectURL).toHaveBeenCalled();
            });
        });

        it('should handle multiple tables', async () => {
            const user = userEvent.setup();

            render(<DownloadButton tables={['sales', 'sale_items']} format="xlsx" />);

            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(mockCreateObjectURL).toHaveBeenCalled();
            });
        });

        it('should show loading state during export', async () => {
            const user = userEvent.setup();

            // Add a delay to the handler
            server.use(
                http.post('/api/export', async () => {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    return new HttpResponse(new Uint8Array([80, 75, 3, 4]), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            'Content-Disposition': 'attachment; filename="test.xlsx"',
                        },
                    });
                })
            );

            render(<DownloadButton tables="inventory" />);

            await user.click(screen.getByRole('button'));

            // Button should be disabled during loading
            expect(screen.getByRole('button')).toBeDisabled();

            await waitFor(() => {
                expect(screen.getByRole('button')).not.toBeDisabled();
            });
        });

        it('should display error message on failure', async () => {
            const user = userEvent.setup();

            // Override handler to return error
            server.use(
                http.post('/api/export', () => {
                    return HttpResponse.json(
                        { error: 'Solo administradores pueden exportar datos' },
                        { status: 403 }
                    );
                })
            );

            render(<DownloadButton tables="inventory" />);

            await user.click(screen.getByRole('button'));

            await waitFor(() => {
                expect(screen.getByText('Solo administradores pueden exportar datos')).toBeInTheDocument();
            });
        });
    });

    describe('Button Variants', () => {
        it('should apply outline variant by default', () => {
            render(<DownloadButton tables="inventory" />);
            const button = screen.getByRole('button');
            expect(button.className).toContain('border');
        });

        it('should apply custom className', () => {
            render(<DownloadButton tables="inventory" className="custom-class" />);
            const button = screen.getByRole('button');
            expect(button.className).toContain('custom-class');
        });

        it('should apply sm size by default', () => {
            render(<DownloadButton tables="inventory" />);
            const button = screen.getByRole('button');
            expect(button.className).toContain('h-8');
        });
    });
});
