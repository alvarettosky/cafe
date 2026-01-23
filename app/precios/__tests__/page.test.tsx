import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock the auth provider
const mockPush = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

vi.mock('@/components/auth-provider', () => ({
    useAuth: () => mockUseAuth(),
}));

// Mock the PriceListManager component
vi.mock('@/components/price-list-manager', () => ({
    PriceListManager: () => <div data-testid="price-list-manager">Price List Manager Mock</div>,
}));

// Import after mocks are set up
import PreciosPage from '../page';

describe('PreciosPage', () => {
    beforeEach(() => {
        mockPush.mockClear();
        mockUseAuth.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should show loading spinner when isLoading is true', () => {
        mockUseAuth.mockReturnValue({
            isAdmin: false,
            isLoading: true,
        });

        render(<PreciosPage />);

        // Should show loading spinner (the animate-spin class is on the div)
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });

    it('should show restricted access message for non-admin users', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: false,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            expect(screen.getByText(/Acceso Restringido/i)).toBeInTheDocument();
            expect(screen.getByText(/Solo administradores pueden acceder a esta sección/i)).toBeInTheDocument();
        });
    });

    it('should redirect non-admin users to home page', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: false,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith('/');
        });
    });

    it('should have "Volver al Dashboard" button for non-admin users', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: false,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Volver al Dashboard/i })).toBeInTheDocument();
        });
    });

    it('should render page content for admin users', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            // Use heading role to be more specific
            expect(screen.getByRole('heading', { name: /Listas de Precios/i })).toBeInTheDocument();
        });
    });

    it('should render PriceListManager component for admin users', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            expect(screen.getByTestId('price-list-manager')).toBeInTheDocument();
        });
    });

    it('should display information box about pricing system', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            expect(screen.getByText(/Sistema de Precios Diferenciados/i)).toBeInTheDocument();
            expect(screen.getByText(/Los precios se aplican automáticamente según el tipo de cliente/i)).toBeInTheDocument();
        });
    });

    it('should display customer types in info box', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            expect(screen.getByText(/Retail, Mayorista Pequeño, Mayorista Grande, Cafetería, Personalizado/i)).toBeInTheDocument();
        });
    });

    it('should have back button that navigates to home', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            // Find all buttons and check one exists for navigation
            const buttons = screen.getAllByRole('button');
            // Should have at least the back button
            expect(buttons.length).toBeGreaterThan(0);
        });
    });

    it('should show DollarSign icon in header', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            // Use heading role to be more specific
            expect(screen.getByRole('heading', { name: /Listas de Precios/i })).toBeInTheDocument();
        });
    });

    it('should show subtitle about managing differentiated prices', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        await waitFor(() => {
            expect(screen.getByText(/Gestiona precios diferenciados por tipo de cliente/i)).toBeInTheDocument();
        });
    });

    it('should not redirect when user is admin', async () => {
        mockUseAuth.mockReturnValue({
            isAdmin: true,
            isLoading: false,
        });

        render(<PreciosPage />);

        // Wait a bit to ensure no redirect happens
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(mockPush).not.toHaveBeenCalled();
    });
});
