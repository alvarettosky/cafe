import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the auth provider
const mockUseAuth = vi.fn();

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock framer-motion
vi.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: { children: React.ReactNode }, ref: React.Ref<HTMLDivElement>) =>
        React.createElement('div', { ...props, ref }, children)
      ),
      button: React.forwardRef(({ children, ...props }: { children: React.ReactNode }, ref: React.Ref<HTMLButtonElement>) =>
        React.createElement('button', { ...props, ref }, children)
      ),
    },
  };
});

// Mock child components
vi.mock('@/components/inventory-list', () => ({
  InventoryList: () => <div data-testid="inventory-list">Inventory List Mock</div>,
}));

// Import after mocks
import InventarioPage from '../page';

describe('InventarioPage', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockUseAuth.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAdmin: false,
      });

      render(<InventarioPage />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Unauthenticated State', () => {
    it('should return null when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAdmin: false,
      });

      const { container } = render(<InventarioPage />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAdmin: false,
      });
    });

    it('should render page title', async () => {
      render(<InventarioPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /inventario/i })).toBeInTheDocument();
      });
    });

    it('should render subtitle', async () => {
      render(<InventarioPage />);

      await waitFor(() => {
        expect(screen.getByText(/gesti[oó]n de productos y stock/i)).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      render(<InventarioPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('should navigate to home when back button clicked', async () => {
      const user = userEvent.setup();
      render(<InventarioPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });

      // The first button is the back button
      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);

      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should render inventory list component', async () => {
      render(<InventarioPage />);

      await waitFor(() => {
        expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
      });
    });
  });

  describe('Admin User', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAdmin: true,
      });
    });

    it('should render page for admin users', async () => {
      render(<InventarioPage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /inventario/i })).toBeInTheDocument();
        expect(screen.getByTestId('inventory-list')).toBeInTheDocument();
      });
    });
  });
});
