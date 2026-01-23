import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportForm } from '../export-form';
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

describe('ExportForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            session: { access_token: 'mock-token' },
        });

        global.URL.createObjectURL = mockCreateObjectURL;
        global.URL.revokeObjectURL = mockRevokeObjectURL;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Access Control', () => {
        it('should show restricted message for non-admin users', () => {
            mockUseAuth.mockReturnValue({
                isAdmin: false,
                session: null,
            });

            render(<ExportForm />);
            expect(screen.getByText('Solo los administradores pueden exportar datos.')).toBeInTheDocument();
        });

        it('should render form for admin users', () => {
            render(<ExportForm />);
            expect(screen.getByText('Exportar Datos')).toBeInTheDocument();
            expect(screen.getByText('Tablas a exportar')).toBeInTheDocument();
        });
    });

    describe('Table Selection', () => {
        it('should display all table options', () => {
            render(<ExportForm />);

            expect(screen.getByText('Inventario')).toBeInTheDocument();
            expect(screen.getByText('Ventas')).toBeInTheDocument();
            expect(screen.getByText('Items de Venta')).toBeInTheDocument();
            expect(screen.getByText('Clientes')).toBeInTheDocument();
            expect(screen.getByText('Contactos')).toBeInTheDocument();
        });

        it('should allow selecting tables', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            const inventoryLabel = screen.getByText('Inventario').closest('label');
            const inventoryCheckbox = inventoryLabel?.querySelector('input[type="checkbox"]');
            expect(inventoryCheckbox).not.toBeChecked();

            await user.click(inventoryCheckbox!);
            expect(inventoryCheckbox).toBeChecked();
        });

        it('should allow selecting all tables', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            await user.click(screen.getByText('Seleccionar todas'));

            // Check that inventory is selected (as a sample)
            const inventoryLabel = screen.getByText('Inventario').closest('label');
            const inventoryCheckbox = inventoryLabel?.querySelector('input[type="checkbox"]');
            expect(inventoryCheckbox).toBeChecked();
        });

        it('should allow deselecting all tables', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            // First select all
            await user.click(screen.getByText('Seleccionar todas'));
            // Then deselect all
            await user.click(screen.getByText('Ninguna'));

            const inventoryLabel = screen.getByText('Inventario').closest('label');
            const inventoryCheckbox = inventoryLabel?.querySelector('input[type="checkbox"]');
            expect(inventoryCheckbox).not.toBeChecked();
        });

        it('should show "Filtrable" badge for tables that support date filtering', () => {
            render(<ExportForm />);

            // Sales should have the badge
            const ventasLabel = screen.getByText('Ventas').closest('label');
            expect(within(ventasLabel!).getByText('Filtrable')).toBeInTheDocument();

            const itemsLabel = screen.getByText('Items de Venta').closest('label');
            expect(within(itemsLabel!).getByText('Filtrable')).toBeInTheDocument();

            const contactosLabel = screen.getByText('Contactos').closest('label');
            expect(within(contactosLabel!).getByText('Filtrable')).toBeInTheDocument();
        });
    });

    describe('Format Selection', () => {
        it('should have XLSX selected by default', () => {
            render(<ExportForm />);

            const xlsxLabel = screen.getByText('Excel (.xlsx)').closest('label');
            const xlsxRadio = xlsxLabel?.querySelector('input[type="radio"]');
            expect(xlsxRadio).toBeChecked();
        });

        it('should allow selecting CSV format', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            const csvLabel = screen.getByText('CSV (.csv)').closest('label');
            const csvRadio = csvLabel?.querySelector('input[type="radio"]');
            await user.click(csvRadio!);

            expect(csvRadio).toBeChecked();
        });
    });

    describe('Date Range Filter', () => {
        it('should show date filter option when filterable table is selected', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            // Select a filterable table (Ventas)
            const ventasLabel = screen.getByText('Ventas').closest('label');
            const ventasCheckbox = ventasLabel?.querySelector('input[type="checkbox"]');
            await user.click(ventasCheckbox!);

            expect(screen.getByText('Filtrar por rango de fechas')).toBeInTheDocument();
        });

        it('should show date inputs when filter is enabled', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            // Select a filterable table
            const ventasLabel = screen.getByText('Ventas').closest('label');
            const ventasCheckbox = ventasLabel?.querySelector('input[type="checkbox"]');
            await user.click(ventasCheckbox!);

            // Enable date filter
            const filterLabel = screen.getByText('Filtrar por rango de fechas').closest('label');
            const filterCheckbox = filterLabel?.querySelector('input[type="checkbox"]');
            await user.click(filterCheckbox!);

            expect(screen.getByText('Desde')).toBeInTheDocument();
            expect(screen.getByText('Hasta')).toBeInTheDocument();
        });
    });

    describe('Export Button', () => {
        it('should be disabled when no tables are selected', () => {
            render(<ExportForm />);

            const exportButton = screen.getByRole('button', { name: /Exportar/i });
            expect(exportButton).toBeDisabled();
        });

        it('should be enabled when tables are selected', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            const inventoryLabel = screen.getByText('Inventario').closest('label');
            const inventoryCheckbox = inventoryLabel?.querySelector('input[type="checkbox"]');
            await user.click(inventoryCheckbox!);

            const exportButton = screen.getByRole('button', { name: /Exportar/i });
            expect(exportButton).not.toBeDisabled();
        });

        it('should show selected table count', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            const inventoryLabel = screen.getByText('Inventario').closest('label');
            await user.click(inventoryLabel?.querySelector('input[type="checkbox"]')!);

            const clientesLabel = screen.getByText('Clientes').closest('label');
            await user.click(clientesLabel?.querySelector('input[type="checkbox"]')!);

            expect(screen.getByRole('button', { name: /Exportar \(2 tablas\)/i })).toBeInTheDocument();
        });
    });

    describe('Export Execution', () => {
        it('should call API and trigger download', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            // Select inventory
            const inventoryLabel = screen.getByText('Inventario').closest('label');
            await user.click(inventoryLabel?.querySelector('input[type="checkbox"]')!);

            // Click export
            await user.click(screen.getByRole('button', { name: /Exportar/i }));

            await waitFor(() => {
                expect(mockCreateObjectURL).toHaveBeenCalled();
            });
        });

        it('should show success message after export', async () => {
            const user = userEvent.setup();
            render(<ExportForm />);

            const inventoryLabel = screen.getByText('Inventario').closest('label');
            await user.click(inventoryLabel?.querySelector('input[type="checkbox"]')!);
            await user.click(screen.getByRole('button', { name: /Exportar/i }));

            await waitFor(() => {
                expect(screen.getByText('Exportacion completada')).toBeInTheDocument();
            });
        });

        it('should show error message on API failure', async () => {
            const user = userEvent.setup();

            // Override handler to return error
            server.use(
                http.post('/api/export', () => {
                    return HttpResponse.json(
                        { error: 'Error interno del servidor' },
                        { status: 500 }
                    );
                })
            );

            render(<ExportForm />);

            const inventoryLabel = screen.getByText('Inventario').closest('label');
            await user.click(inventoryLabel?.querySelector('input[type="checkbox"]')!);
            await user.click(screen.getByRole('button', { name: /Exportar/i }));

            await waitFor(() => {
                expect(screen.getByText('Error interno del servidor')).toBeInTheDocument();
            });
        });
    });
});
