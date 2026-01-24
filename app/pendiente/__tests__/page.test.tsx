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

// Mock auth provider
const mockUseAuth = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Import after mocks
import PendingApprovalPage from '../page';

describe('PendingApprovalPage', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockUseAuth.mockClear();
    mockSignOut.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner when isLoading is true', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: false,
        isLoading: true,
        signOut: mockSignOut,
      });

      render(<PendingApprovalPage />);

      // Check for the loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not show main content when loading', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: false,
        isLoading: true,
        signOut: mockSignOut,
      });

      render(<PendingApprovalPage />);

      expect(screen.queryByText('Tu cuenta está pendiente de aprobación')).not.toBeInTheDocument();
    });
  });

  describe('Redirect - No User', () => {
    it('should redirect to login when user is not authenticated', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        approved: false,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(<PendingApprovalPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('Redirect - Already Approved', () => {
    it('should redirect to dashboard when user is already approved', async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: true,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(<PendingApprovalPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Pending Approval State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: false,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should render page title', () => {
      render(<PendingApprovalPage />);

      expect(screen.getByText('Mirador Montañero')).toBeInTheDocument();
      expect(screen.getByText('Café Selecto')).toBeInTheDocument();
    });

    it('should render pending approval message', () => {
      render(<PendingApprovalPage />);

      expect(screen.getByText('Tu cuenta está pendiente de aprobación')).toBeInTheDocument();
    });

    it('should render informational text about admin review', () => {
      render(<PendingApprovalPage />);

      expect(screen.getByText(/El administrador revisar[aá] tu solicitud pronto/i)).toBeInTheDocument();
      expect(screen.getByText(/Recibir[aá]s acceso una vez que tu cuenta sea aprobada/i)).toBeInTheDocument();
    });

    it('should display user email', () => {
      render(<PendingApprovalPage />);

      expect(screen.getByText(/Registrado como:/)).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('should render clock icon', () => {
      render(<PendingApprovalPage />);

      const clockIcon = document.querySelector('svg.lucide-clock');
      expect(clockIcon).toBeInTheDocument();
    });

    it('should render logout button', () => {
      render(<PendingApprovalPage />);

      expect(screen.getByRole('button', { name: /cerrar sesi[oó]n/i })).toBeInTheDocument();
    });

    it('should have logout icon in button', () => {
      render(<PendingApprovalPage />);

      const logoutIcon = document.querySelector('svg.lucide-log-out');
      expect(logoutIcon).toBeInTheDocument();
    });
  });

  describe('Sign Out Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: false,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should call signOut when logout button clicked', async () => {
      const user = userEvent.setup();
      render(<PendingApprovalPage />);

      const logoutButton = screen.getByRole('button', { name: /cerrar sesi[oó]n/i });
      await user.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: false,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should have dark theme background', () => {
      render(<PendingApprovalPage />);

      const mainContainer = document.querySelector('.bg-zinc-950');
      expect(mainContainer).toBeInTheDocument();
    });

    it('should have amber themed clock icon container', () => {
      render(<PendingApprovalPage />);

      const iconContainer = document.querySelector('.bg-amber-500\\/10');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should have centered content', () => {
      render(<PendingApprovalPage />);

      const centerContainer = document.querySelector('.text-center');
      expect(centerContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: false,
        isLoading: false,
        signOut: mockSignOut,
      });
    });

    it('should have proper heading structure', () => {
      render(<PendingApprovalPage />);

      // Check for h1 (main title)
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();

      // Check for h2 (pending message)
      const h2 = screen.getByRole('heading', { level: 2 });
      expect(h2).toBeInTheDocument();
    });

    it('should have accessible button', () => {
      render(<PendingApprovalPage />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(/cerrar sesi[oó]n/i);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with undefined email gracefully', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: undefined },
        approved: false,
        isLoading: false,
        signOut: mockSignOut,
      });

      render(<PendingApprovalPage />);

      // Should still render the page without crashing
      expect(screen.getByText('Tu cuenta está pendiente de aprobación')).toBeInTheDocument();
    });

    it('should not redirect while still loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        approved: false,
        isLoading: true,
        signOut: mockSignOut,
      });

      render(<PendingApprovalPage />);

      // Should not redirect because isLoading is true
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should not redirect approved user while loading', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: true,
        isLoading: true,
        signOut: mockSignOut,
      });

      render(<PendingApprovalPage />);

      // Should not redirect because isLoading is true
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Multiple Redirects Prevention', () => {
    it('should only redirect once when user becomes approved', async () => {
      const { rerender } = render(<PendingApprovalPage />);

      // First render - loading
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: false,
        isLoading: true,
        signOut: mockSignOut,
      });
      rerender(<PendingApprovalPage />);

      expect(mockPush).not.toHaveBeenCalled();

      // Second render - approved
      mockUseAuth.mockReturnValue({
        user: mockUser,
        approved: true,
        isLoading: false,
        signOut: mockSignOut,
      });
      rerender(<PendingApprovalPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });

      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });
});
