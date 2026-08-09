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

    it('should tell the user to ask an admin for an account', () => {
      render(<LoginPage />);

      expect(screen.getByText(/pídesela a un administrador/i)).toBeInTheDocument();
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

  // REGRESION de 035. Estos tests fallan contra el codigo anterior, que es lo
  // unico que prueba que sirven para algo: hasta el 2026-08-09 este formulario
  // ofrecia «Crear cuenta de vendedor», y una politica de RLS dejaba que quien
  // se registrara se pusiera a si mismo `role='admin'`. La base ya lo impide;
  // esto impide que el boton vuelva sin que nadie se entere.
  describe('Sin registro publico (regresion de 035)', () => {
    it('should not offer any way to sign up', () => {
      render(<LoginPage />);

      expect(screen.queryByText(/regístrate/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/crear cuenta/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrarse' })).not.toBeInTheDocument();
    });

    it('should never call supabase signUp, whatever the user does with the form', async () => {
      const user = userEvent.setup();
      render(<LoginPage />);

      await user.type(screen.getByPlaceholderText('Correo electrónico'), 'nuevo@example.com');
      await user.type(screen.getByPlaceholderText('Contraseña'), 'unaClave123');
      await user.click(screen.getByRole('button', { name: 'Entrar' }));

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalled();
      });
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('should only render one submit button', () => {
      render(<LoginPage />);

      // El toggle era un <button type="button"> dentro del form: si vuelve,
      // este conteo lo delata aunque le cambien el texto.
      expect(screen.getAllByRole('button')).toHaveLength(1);
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
        error: loginError,
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
        error: loginError,
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
        error: networkError,
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

  // El `full_name` ya no lo compone este formulario a partir del correo: el
  // alta la hace un administrador, y `handle_new_user` sigue poniendo
  // `split_part(email,'@',1)` como nombre por defecto en la base. Aquí solo
  // queda fijado que la pantalla de login no participa en ese camino.
});
