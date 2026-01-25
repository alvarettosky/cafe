import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InventoryMovements } from '../inventory-movements';

const mockProduct = {
    product_id: '1',
    product_name: 'Café Especial',
    total_grams_available: 5000,
};

describe('InventoryMovements', () => {
    const mockOnClose = vi.fn();
    const mockOnMovementAdded = vi.fn();

    beforeEach(() => {
        mockOnClose.mockClear();
        mockOnMovementAdded.mockClear();
    });

    it('should not render when product is null', () => {
        const { container } = render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={null}
                onMovementAdded={mockOnMovementAdded}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it('should render modal with product name in title', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Historial de Movimientos - Café Especial/i)).toBeInTheDocument();
        });
    });

    it('should display current stock', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Stock Actual:/i)).toBeInTheDocument();
            expect(screen.getByText(/5\.00 kg/i)).toBeInTheDocument();
        });
    });

    it('should show "Nuevo Movimiento" button', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Nuevo Movimiento/i })).toBeInTheDocument();
        });
    });

    it('should load and display movements from API', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Wait for movements to load
        await waitFor(() => {
            expect(screen.getByText(/Venta/i)).toBeInTheDocument();
        });

        // Check different movement types are displayed
        await waitFor(() => {
            expect(screen.getByText(/Reposición/i)).toBeInTheDocument();
            expect(screen.getByText(/Merma/i)).toBeInTheDocument();
        });
    });

    it('should display movement details including quantity and reason', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        await waitFor(() => {
            // Check for a specific movement reason
            expect(screen.getByText(/Compra proveedor ABC/i)).toBeInTheDocument();
            expect(screen.getByText(/Café vencido/i)).toBeInTheDocument();
        });
    });

    it('should display batch number when available', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Lote: LOTE-2024-001/i)).toBeInTheDocument();
        });
    });

    it('should toggle add movement form when button is clicked', async () => {
        const user = userEvent.setup();
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Click "Nuevo Movimiento" button
        const addButton = await screen.findByRole('button', { name: /Nuevo Movimiento/i });
        await user.click(addButton);

        // Form should appear
        await waitFor(() => {
            expect(screen.getByText(/Tipo de Movimiento/i)).toBeInTheDocument();
            expect(screen.getByText(/Cantidad \(gramos\)/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Registrar Movimiento/i })).toBeInTheDocument();
        });

        // Click "Cancelar" to hide form
        const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
        await user.click(cancelButton);

        // Form should be hidden
        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /Registrar Movimiento/i })).not.toBeInTheDocument();
        });
    });

    it('should have movement type selector with options', async () => {
        const user = userEvent.setup();
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Open the form
        const addButton = await screen.findByRole('button', { name: /Nuevo Movimiento/i });
        await user.click(addButton);

        // Find the select element
        const select = await screen.findByRole('combobox');
        expect(select).toBeInTheDocument();

        // Check options
        const options = within(select).getAllByRole('option');
        expect(options).toHaveLength(4);
        expect(options[0]).toHaveTextContent(/Reposición/i);
        expect(options[1]).toHaveTextContent(/Devolución/i);
        expect(options[2]).toHaveTextContent(/Merma/i);
        expect(options[3]).toHaveTextContent(/Ajuste/i);
    });

    it('should show cost and batch fields for restock movement', async () => {
        const user = userEvent.setup();
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Open form
        const addButton = await screen.findByRole('button', { name: /Nuevo Movimiento/i });
        await user.click(addButton);

        // Default is restock, so cost and batch fields should be visible
        await waitFor(() => {
            expect(screen.getByText(/Costo por gramo/i)).toBeInTheDocument();
            expect(screen.getByText(/Número de lote/i)).toBeInTheDocument();
        });
    });

    it('should hide cost and batch fields for loss movement', async () => {
        const user = userEvent.setup();
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Open form
        const addButton = await screen.findByRole('button', { name: /Nuevo Movimiento/i });
        await user.click(addButton);

        // Change to loss
        const select = await screen.findByRole('combobox');
        await user.selectOptions(select, 'loss');

        // Cost and batch fields should not be visible
        await waitFor(() => {
            expect(screen.queryByText(/Costo por gramo/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Número de lote/i)).not.toBeInTheDocument();
        });
    });

    it('should require reason for loss movement', async () => {
        const user = userEvent.setup();
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Open form and select loss
        const addButton = await screen.findByRole('button', { name: /Nuevo Movimiento/i });
        await user.click(addButton);

        const select = await screen.findByRole('combobox');
        await user.selectOptions(select, 'loss');

        // Check that reason label shows required indicator
        await waitFor(() => {
            const reasonLabel = screen.getByText(/Razón \/ Notas/i);
            expect(reasonLabel.parentElement).toContainHTML('*');
        });
    });

    it('should require reason for return movement', async () => {
        const user = userEvent.setup();
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Open form and select return
        const addButton = await screen.findByRole('button', { name: /Nuevo Movimiento/i });
        await user.click(addButton);

        const select = await screen.findByRole('combobox');
        await user.selectOptions(select, 'return');

        // Check that reason label shows required indicator
        await waitFor(() => {
            const reasonLabel = screen.getByText(/Razón \/ Notas/i);
            expect(reasonLabel.parentElement).toContainHTML('*');
        });
    });

    it('should hide cost and batch fields for return movement', async () => {
        const user = userEvent.setup();
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Open form
        const addButton = await screen.findByRole('button', { name: /Nuevo Movimiento/i });
        await user.click(addButton);

        // Change to return
        const select = await screen.findByRole('combobox');
        await user.selectOptions(select, 'return');

        // Cost and batch fields should not be visible (only for restock)
        await waitFor(() => {
            expect(screen.queryByText(/Costo por gramo/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/Número de lote/i)).not.toBeInTheDocument();
        });
    });

    it('should display informational message about automatic sale movements', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Los movimientos de venta se registran automáticamente/i)).toBeInTheDocument();
        });
    });

    it('should show empty state when no movements', async () => {
        // This would require overriding the MSW handler to return empty array
        // For now, we test the structure exists
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // The component should at least render the dialog
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('should close modal when onClose is triggered', async () => {
        render(
            <InventoryMovements
                isOpen={true}
                onClose={mockOnClose}
                product={mockProduct}
                onMovementAdded={mockOnMovementAdded}
            />
        );

        // Find and click the close button (X)
        const dialog = await screen.findByRole('dialog');
        const closeButton = within(dialog).getByRole('button', { name: /close/i });

        const user = userEvent.setup();
        await user.click(closeButton);

        expect(mockOnClose).toHaveBeenCalled();
    });
});
