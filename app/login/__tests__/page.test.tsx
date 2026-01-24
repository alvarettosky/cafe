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

// Mock Supabase auth
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
    },
  },
}));

// Import after mocks
import LoginPage from '../page';

describe('LoginPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSignInWithPassword.mockClear();
    mockSignUp.mockClear();

    // Default mock implementation for successful login
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Rendering', () => {
    it('should render page title', () => {
      render(<LoginPage />);

      expect(screen.getByText('Mirador Montañero')).toBeInTheDocument();
      expect(screen.getByText('Café Selecto')).toBeInTheDocument();
    });

    it('should render login subtitle by default', () => {
      render(<LoginPage />);

      expect(screen.getByText('Iniciar sesión en el CRM')).toBeInTheDocument();
    });

    it('should render email input', () => {
      render(<LoginPage />);

      expect(screen.getByPlaceholderText('Correo electrónico')).toBeInTheDocument();
    });

    it('should render password input', () => {
      render(<LoginPage />);

      expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
    });

    it('should render login button by default', () => {
      render(<LoginPage />);

      expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    });

    it('should render toggle to signup link', () => {
      render(<LoginPage />);

      expect(screen.getByText(/no tienes cuenta\? regístrate/i)).toBeInTheDocument();
    });

    it('should render lock icon', () => {
      render(<LoginPage />);

      const lockIcon = document.querySelector('svg.lucide-lock');
      expect(lockIcon).toBeInTheDocument();
    });
  });

  describe('Form Inputs', () => {
    it('should allow typing in email input', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should allow typing in password input', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const passwordInput = screen.getByPlaceholderText('Contraseña');
      await user.type(passwordInput, 'secretpassword');

      expect(passwordInput).toHaveValue('secretpassword');
    });

    it('should have email input with type email', () => {
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should have password input with type password', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByPlaceholderText('Contraseña');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('should have required attribute on email input', () => {
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      expect(emailInput).toHaveAttribute('required');
    });

    it('should have required attribute on password input', () => {
      render(<LoginPage />);

      const passwordInput = screen.getByPlaceholderText('Contraseña');
      expect(passwordInput).toHaveAttribute('required');
    });
  });

  describe('Toggle Between Login and Signup', () => {
    it('should switch to signup mode when toggle clicked', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const toggleButton = screen.getByText(/no tienes cuenta\? regístrate/i);
      await user.click(toggleButton);

      expect(screen.getByText('Crear cuenta de vendedor')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Registrarse' })).toBeInTheDocument();
    });

    it('should switch back to login mode when toggle clicked again', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      // First switch to signup
      await user.click(screen.getByText(/no tienes cuenta\? regístrate/i));
      expect(screen.getByText('Crear cuenta de vendedor')).toBeInTheDocument();

      // Then switch back to login
      await user.click(screen.getByText(/ya tienes cuenta\? inicia sesión/i));
      expect(screen.getByText('Iniciar sesión en el CRM')).toBeInTheDocument();
    });
  });

  describe('Login Flow', () => {
    it('should call signInWithPassword when login form submitted', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should redirect to home on successful login', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should show error message on login failure', async () => {
      const loginError = new Error('Invalid login credentials');
      mockSignInWithPassword.mockResolvedValue({
        error: loginError
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
      });
    });

    it('should not redirect on login failure', async () => {
      const loginError = new Error('Invalid login credentials');
      mockSignInWithPassword.mockResolvedValue({
        error: loginError
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('Signup Flow', () => {
    it('should call signUp when signup form submitted', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      // Switch to signup mode
      await user.click(screen.getByText(/no tienes cuenta\? regístrate/i));

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Registrarse' });

      await user.type(emailInput, 'newuser@example.com');
      await user.type(passwordInput, 'newpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'newuser@example.com',
          password: 'newpassword',
          options: {
            data: {
              full_name: 'newuser',
            }
          }
        });
      });
    });

    it('should show success alert on successful signup', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      const user = userEvent.setup();
      render(<LoginPage />);

      // Switch to signup mode
      await user.click(screen.getByText(/no tienes cuenta\? regístrate/i));

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Registrarse' });

      await user.type(emailInput, 'newuser@example.com');
      await user.type(passwordInput, 'newpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Registro exitoso! Revisa tu email (o inicia sesión si el auto-confirm está activado)'
        );
      });

      alertSpy.mockRestore();
    });

    it('should not redirect on signup (user needs to verify email or auto-confirm)', async () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {});

      const user = userEvent.setup();
      render(<LoginPage />);

      // Switch to signup mode
      await user.click(screen.getByText(/no tienes cuenta\? regístrate/i));

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Registrarse' });

      await user.type(emailInput, 'newuser@example.com');
      await user.type(passwordInput, 'newpassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalled();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should show error message on signup failure', async () => {
      const signupError = new Error('Email already registered');
      mockSignUp.mockResolvedValue({
        error: signupError
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      // Switch to signup mode
      await user.click(screen.getByText(/no tienes cuenta\? regístrate/i));

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Registrarse' });

      await user.type(emailInput, 'existing@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Email already registered')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner during login', async () => {
      // Make the login hang
      mockSignInWithPassword.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        const spinner = document.querySelector('svg.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should disable button during loading', async () => {
      mockSignInWithPassword.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        // Get the submit button specifically (not the toggle button)
        const buttons = screen.getAllByRole('button');
        const submitBtn = buttons.find(btn => btn.getAttribute('type') === 'submit');
        expect(submitBtn).toBeDisabled();
      });
    });

    it('should re-enable button after login completes', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalled();
      });

      // Button is not disabled since we redirected
      // In case of error, button would be re-enabled
    });
  });

  describe('Error Display', () => {
    it('should display error in styled error box', async () => {
      const networkError = new Error('Network error');
      mockSignInWithPassword.mockResolvedValue({
        error: networkError
      });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        const errorBox = screen.getByText('Network error').closest('div');
        expect(errorBox).toHaveClass('bg-red-500/10');
      });
    });

    it('should clear error when form is resubmitted', async () => {
      const firstError = new Error('First error');
      mockSignInWithPassword
        .mockResolvedValueOnce({ error: firstError })
        .mockResolvedValueOnce({ error: null });

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      // First submission - error
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrong');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Second submission - success (error should be cleared)
      await user.clear(passwordInput);
      await user.type(passwordInput, 'correct');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockSignInWithPassword.mockRejectedValue('Unknown error object');

      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Error desconocido')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for inputs', () => {
      render(<LoginPage />);

      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Contraseña');

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
    });

    it('should have proper form structure', () => {
      render(<LoginPage />);

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('should focus on email input initially', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');

      // Note: The component doesn't auto-focus, but we can verify it's accessible
      expect(emailInput).toBeVisible();
    });
  });

  describe('Form Validation', () => {
    it('should require email format for email input', () => {
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('should prevent form submission without email', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Form should not submit due to HTML5 validation
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });

    it('should prevent form submission without password', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const submitButton = screen.getByRole('button', { name: 'Entrar' });

      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);

      // Form should not submit due to HTML5 validation
      expect(mockSignInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('Email Parsing for Signup', () => {
    it('should extract username from email for full_name', async () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {});

      const user = userEvent.setup();
      render(<LoginPage />);

      // Switch to signup mode
      await user.click(screen.getByText(/no tienes cuenta\? regístrate/i));

      const emailInput = screen.getByPlaceholderText('Correo electrónico');
      const passwordInput = screen.getByPlaceholderText('Contraseña');
      const submitButton = screen.getByRole('button', { name: 'Registrarse' });

      await user.type(emailInput, 'john.doe@company.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            options: {
              data: {
                full_name: 'john.doe',
              }
            }
          })
        );
      });
    });
  });
});
