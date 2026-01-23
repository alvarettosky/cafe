import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductVariantSelector, ProductVariantSelectCompact } from '../product-variant-selector';
import type { VariantForSale } from '@/types/products';

describe('ProductVariantSelector', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        mockOnChange.mockClear();
    });

    it('should show loading state initially', () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
            />
        );

        expect(screen.getByText(/Cargando productos/i)).toBeInTheDocument();
    });

    it('should load and display variants grouped by product', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            // Should have product groups as optgroup
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();

            // Check for product names in optgroups (they appear in the select's HTML)
            expect(select.innerHTML).toContain('Café Especial');
            expect(select.innerHTML).toContain('Café Premium');
        });
    });

    it('should show stock availability in options when showStock is true', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
                showStock={true}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            const options = within(select).getAllByRole('option');

            // Find an option that shows stock
            const optionWithStock = options.find(opt =>
                opt.textContent?.includes('disponibles')
            );
            expect(optionWithStock).toBeDefined();
        });
    });

    it('should not show stock when showStock is false', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
                showStock={false}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();
        });

        // Should not have "disponibles" text
        expect(screen.queryByText(/disponibles/)).not.toBeInTheDocument();
    });

    it('should have placeholder option as default', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toHaveValue('');
        });

        expect(screen.getByText(/Seleccionar Producto/i)).toBeInTheDocument();
    });

    it('should call onChange with variant when selection changes', async () => {
        const user = userEvent.setup();
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
            />
        );

        // Wait for variants to load (check that options are populated)
        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select.innerHTML).toContain('var-1');
        }, { timeout: 3000 });

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'var-1');

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant_id: 'var-1',
                    product_name: 'Café Especial',
                    presentation: 'libra',
                    grind_type: 'grano',
                })
            );
        });
    });

    it('should call onChange with null when deselected', async () => {
        const user = userEvent.setup();
        render(
            <ProductVariantSelector
                value="var-1"
                onChange={mockOnChange}
            />
        );

        // Wait for variants to load
        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select.innerHTML).toContain('var-1');
        }, { timeout: 3000 });

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, '');

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(null);
        });
    });

    it('should show selected variant info panel', async () => {
        render(
            <ProductVariantSelector
                value="var-1"
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            // Info panel should show product name
            const infoPanel = screen.getByText('Café Especial').closest('div');
            expect(infoPanel).toBeInTheDocument();
        });
    });

    it('should show SKU in info panel when available', async () => {
        render(
            <ProductVariantSelector
                value="var-1"
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/SKU: CAF-500G-GR/i)).toBeInTheDocument();
        });
    });

    it('should show stock units in info panel', async () => {
        render(
            <ProductVariantSelector
                value="var-1"
                onChange={mockOnChange}
                showStock={true}
            />
        );

        await waitFor(() => {
            // 5000g stock / 500g per unit = 10 units
            expect(screen.getByText(/10 unidades/i)).toBeInTheDocument();
        });
    });

    it('should disable options without stock when showStock is true', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
                showStock={true}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            const options = within(select).getAllByRole('option');

            // Find option for var-5 which has has_stock: false
            const outOfStockOption = options.find(opt =>
                opt.getAttribute('value') === 'var-5'
            );
            expect(outOfStockOption).toBeDisabled();
        });
    });

    it('should be disabled when disabled prop is true', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
                disabled={true}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toBeDisabled();
        });
    });

    it('should apply custom className', async () => {
        const { container } = render(
            <ProductVariantSelector
                onChange={mockOnChange}
                className="custom-class"
            />
        );

        await waitFor(() => {
            // The custom class is applied to the wrapper div
            const wrapper = container.querySelector('.custom-class');
            expect(wrapper).toBeInTheDocument();
        });
    });

    it('should display price in variant options', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            const options = within(select).getAllByRole('option');

            // Should have price in format $X.XX
            const optionWithPrice = options.find(opt =>
                opt.textContent?.includes('$10.00') || opt.textContent?.includes('$15.00')
            );
            expect(optionWithPrice).toBeDefined();
        });
    });

    it('should display presentation labels correctly', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select.innerHTML).toContain('Libra');
            expect(select.innerHTML).toContain('Media Libra');
        });
    });

    it('should display grind type labels correctly', async () => {
        render(
            <ProductVariantSelector
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select.innerHTML).toContain('Grano');
            expect(select.innerHTML).toContain('Medio');
        });
    });
});

describe('ProductVariantSelectCompact', () => {
    const mockOnChange = vi.fn();

    beforeEach(() => {
        mockOnChange.mockClear();
    });

    it('should render a compact select element', async () => {
        render(
            <ProductVariantSelectCompact
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toBeInTheDocument();
        });
    });

    it('should show loading text while loading', () => {
        render(
            <ProductVariantSelectCompact
                onChange={mockOnChange}
            />
        );

        expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
    });

    it('should load variants and show display names', async () => {
        render(
            <ProductVariantSelectCompact
                onChange={mockOnChange}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            // Check that the select contains variant display names
            expect(select.innerHTML).toContain('Café Especial');
        });
    });

    it('should call onChange with selected variant', async () => {
        const user = userEvent.setup();
        render(
            <ProductVariantSelectCompact
                onChange={mockOnChange}
            />
        );

        // Wait for variants to load
        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select.innerHTML).toContain('var-1');
        }, { timeout: 3000 });

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'var-1');

        await waitFor(() => {
            expect(mockOnChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant_id: 'var-1',
                })
            );
        });
    });

    it('should be disabled when disabled prop is true', async () => {
        render(
            <ProductVariantSelectCompact
                onChange={mockOnChange}
                disabled={true}
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toBeDisabled();
        });
    });

    it('should apply custom className', async () => {
        render(
            <ProductVariantSelectCompact
                onChange={mockOnChange}
                className="my-custom-class"
            />
        );

        await waitFor(() => {
            const select = screen.getByRole('combobox');
            expect(select).toHaveClass('my-custom-class');
        });
    });
});
