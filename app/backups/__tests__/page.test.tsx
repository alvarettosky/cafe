import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../__mocks__/server';

// Mock next/navigation
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Supabase
const mockGetSession = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
}));

// Mock ExportForm component
vi.mock('@/components/export', () => ({
  ExportForm: () => (
    <div data-testid="export-form">Export Form Mock</div>
  ),
}));

// Import after mocks
import BackupsPage from '../page';

describe('BackupsPage', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _mockBackups = [
    {
      id: 'backup-1',
      name: 'cafe-mirador-backup-2026-01-22.zip',
      createdTime: '2026-01-22T02:00:00Z',
      size: '1.5 MB',
      webViewLink: 'https://storage.example.com/backup-1',
    },
    {
      id: 'backup-2',
      name: 'cafe-mirador-backup-2026-01-21.zip',
      createdTime: '2026-01-21T02:00:00Z',
      size: '1.4 MB',
      webViewLink: 'https://storage.example.com/backup-2',
    },
    {
      id: 'backup-3',
      name: 'cafe-mirador-backup-2026-01-20.zip',
      createdTime: '2026-01-20T02:00:00Z',
      size: '1.3 MB',
      webViewLink: null,
    },
  ];

  const mockAdminUser = {
    user: { id: 'user-1', email: 'admin@test.com' },
    session: { access_token: 'admin-token' },
    role: 'admin' as const,
    approved: true,
    isLoading: false,
    isAdmin: true,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };

  const mockSellerUser = {
    user: { id: 'user-2', email: 'seller@test.com' },
    session: { access_token: 'seller-token' },
    role: 'seller' as const,
    approved: true,
    isLoading: false,
    isAdmin: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(() => {
    mockPush.mockClear();
    mockUseAuth.mockClear();
    mockGetSession.mockClear();

    // Default admin user
    mockUseAuth.mockReturnValue(mockAdminUser);

    // Default session - returns promise with session data
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'admin-token' } },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication and Authorization', () => {
    it('should show loading spinner while authenticating', () => {
      mockUseAuth.mockReturnValue({
        ...mockAdminUser,
        isLoading: true,
      });

      render(<BackupsPage />);

      const loadingElement = document.querySelector('.animate-spin');
      expect(loadingElement).toBeInTheDocument();
    });

    it('should redirect to home if not admin', async () => {
      mockUseAuth.mockReturnValue(mockSellerUser);

      render(<BackupsPage />);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should show access restricted message for non-admin users', async () => {
      mockUseAuth.mockReturnValue(mockSellerUser);

      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Acceso Restringido')).toBeInTheDocument();
        expect(screen.getByText(/Solo administradores pueden acceder/)).toBeInTheDocument();
      });
    });

    it('should render page content for admin users', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Backups y Exportacion')).toBeInTheDocument();
      });
    });

    it('should show back to dashboard button on restricted page', async () => {
      mockUseAuth.mockReturnValue(mockSellerUser);

      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Volver al Dashboard')).toBeInTheDocument();
      });
    });

    it('should navigate to home when back button clicked on restricted page', async () => {
      const user = userEvent.setup();
      mockUseAuth.mockReturnValue(mockSellerUser);

      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Volver al Dashboard')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Volver al Dashboard'));

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Page Header', () => {
    it('should render page title', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Backups y Exportacion')).toBeInTheDocument();
      });
    });

    it('should render subtitle', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Gestiona backups automaticos y exporta datos manualmente/)).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const backButton = buttons.find(btn => btn.querySelector('svg'));
        expect(backButton).toBeInTheDocument();
      });
    });

    it('should navigate to home when back button clicked', async () => {
      const user = userEvent.setup();
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Backups y Exportacion')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      await user.click(buttons[0]);

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Backup Status Cards', () => {
    it('should display last backup card', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ultimo Backup')).toBeInTheDocument();
      });
    });

    it('should display last backup date when backups exist', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        // Wait for backups to load - look for the backup name
        expect(screen.getByText('cafe-mirador-backup-2026-01-22.zip')).toBeInTheDocument();
      });
    });

    it('should display "Sin backups" when no backups exist', async () => {
      server.use(
        http.get('/api/backups/list', () => {
          return HttpResponse.json({ backups: [], configured: true });
        })
      );

      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Sin backups')).toBeInTheDocument();
      });
    });

    it('should display next backup card', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Proximo Backup')).toBeInTheDocument();
      });
    });

    it('should render "Ejecutar Ahora" button', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument();
      });
    });
  });

  describe('Trigger Backup', () => {
    it('should call trigger API when "Ejecutar Ahora" clicked', async () => {
      const user = userEvent.setup();
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ejecutar Ahora'));

      // Success message should appear
      await waitFor(() => {
        expect(screen.getByText('Backup iniciado correctamente')).toBeInTheDocument();
      });
    });

    it('should show success message after triggering backup', async () => {
      const user = userEvent.setup();
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ejecutar Ahora'));

      await waitFor(() => {
        expect(screen.getByText('Backup iniciado correctamente')).toBeInTheDocument();
      });
    });

    it('should show error message when trigger fails', async () => {
      server.use(
        http.post('/api/backups/trigger', () => {
          return HttpResponse.json({ error: 'Error al ejecutar backup' }, { status: 500 });
        })
      );

      const user = userEvent.setup();
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ejecutar Ahora'));

      await waitFor(() => {
        expect(screen.getByText('Error al ejecutar backup')).toBeInTheDocument();
      });
    });

    it('should show session expired error when no session', async () => {
      // Initial render needs session to load page properly
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'admin-token' } },
      });

      const user = userEvent.setup();
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument();
      });

      // Now mock getSession to return null for the trigger backup call
      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      await user.click(screen.getByText('Ejecutar Ahora'));

      await waitFor(() => {
        expect(screen.getByText('Sesion expirada')).toBeInTheDocument();
      });
    });

    it('should disable button when not configured', async () => {
      server.use(
        http.get('/api/backups/list', () => {
          return HttpResponse.json({ backups: [], configured: false });
        })
      );

      render(<BackupsPage />);

      await waitFor(() => {
        const button = screen.getByText('Ejecutar Ahora');
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Backup History Table', () => {
    it('should display backup history section when configured', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Historial de Backups en Google Drive')).toBeInTheDocument();
      });
    });

    it('should display backup table headers', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Nombre')).toBeInTheDocument();
        expect(screen.getByText('Fecha')).toBeInTheDocument();
        expect(screen.getByText('Tamano')).toBeInTheDocument();
        expect(screen.getByText('Acciones')).toBeInTheDocument();
      });
    });

    it('should display backup names', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('cafe-mirador-backup-2026-01-22.zip')).toBeInTheDocument();
        expect(screen.getByText('cafe-mirador-backup-2026-01-21.zip')).toBeInTheDocument();
        expect(screen.getByText('cafe-mirador-backup-2026-01-20.zip')).toBeInTheDocument();
      });
    });

    it('should display backup sizes', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('cafe-mirador-backup-2026-01-22.zip')).toBeInTheDocument();
      });

      // Sizes should be displayed
      expect(screen.getAllByText('1.5 MB').length).toBeGreaterThan(0);
    });

    it('should display "Abrir" links for backups with webViewLink', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        const openLinks = screen.getAllByText('Abrir');
        expect(openLinks).toHaveLength(2); // First two have webViewLink
      });
    });

    it('should display "Ver en Drive" link for last backup', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ver en Drive')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching backups', async () => {
      server.use(
        http.get('/api/backups/list', async () => {
          await new Promise(() => {}); // Never resolves
          return HttpResponse.json({ backups: [], configured: true });
        })
      );

      render(<BackupsPage />);

      await waitFor(() => {
        const loadingElements = document.querySelectorAll('.animate-spin');
        expect(loadingElements.length).toBeGreaterThan(0);
      });
    });

    it('should show empty message when no backups in Drive', async () => {
      server.use(
        http.get('/api/backups/list', () => {
          return HttpResponse.json({ backups: [], configured: true });
        })
      );

      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('No hay backups almacenados en Google Drive')).toBeInTheDocument();
      });
    });
  });

  describe('Configuration Notice', () => {
    it('should show configuration notice when not configured', async () => {
      server.use(
        http.get('/api/backups/list', () => {
          return HttpResponse.json({ backups: [], configured: false });
        })
      );

      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Backups Automaticos No Configurados')).toBeInTheDocument();
      });
    });

    it('should list required environment variables when not configured', async () => {
      server.use(
        http.get('/api/backups/list', () => {
          return HttpResponse.json({ backups: [], configured: false });
        })
      );

      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText(/GOOGLE_DRIVE_CREDENTIALS/)).toBeInTheDocument();
        expect(screen.getByText(/GOOGLE_DRIVE_FOLDER_ID/)).toBeInTheDocument();
      });
    });

    it('should not show configuration notice when configured', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('cafe-mirador-backup-2026-01-22.zip')).toBeInTheDocument();
      });

      expect(screen.queryByText('Backups Automaticos No Configurados')).not.toBeInTheDocument();
    });
  });

  describe('Info Box', () => {
    it('should display manual export info box', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Exportacion Manual de Datos')).toBeInTheDocument();
      });
    });

    it('should display export instructions', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Selecciona las tablas que deseas exportar/)).toBeInTheDocument();
        expect(screen.getByText(/El formato Excel/)).toBeInTheDocument();
      });
    });
  });

  describe('Export Form', () => {
    it('should render export form component', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('export-form')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Export Cards', () => {
    it('should render quick export cards', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventario Completo')).toBeInTheDocument();
        expect(screen.getByText('Clientes')).toBeInTheDocument();
        expect(screen.getByText('Reporte de Ventas')).toBeInTheDocument();
      });
    });

    it('should render export buttons for quick exports', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        const exportButtons = screen.getAllByText('Exportar');
        expect(exportButtons.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should display descriptions for quick exports', async () => {
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Stock actual de todos los productos')).toBeInTheDocument();
        expect(screen.getByText('Datos de clientes con recurrencia')).toBeInTheDocument();
        expect(screen.getByText('Ventas con detalle de items')).toBeInTheDocument();
      });
    });

    it('should call export API when quick export button clicked', async () => {
      // Mock URL methods
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:test');
      URL.revokeObjectURL = vi.fn();

      // Track export API calls
      let exportCalled = false;
      server.use(
        http.post('/api/export', async () => {
          exportCalled = true;
          return new HttpResponse(new Uint8Array([80, 75, 3, 4]), {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': 'attachment; filename="inventory-2026-01-23.xlsx"',
            },
          });
        })
      );

      const user = userEvent.setup();
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Inventario Completo')).toBeInTheDocument();
      });

      const exportButtons = screen.getAllByText('Exportar');
      await user.click(exportButtons[0]);

      await waitFor(() => {
        expect(exportCalled).toBe(true);
      });

      // Restore URL methods
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('Error Handling', () => {
    it('should handle API error when loading backups', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.get('/api/backups/list', () => {
          return HttpResponse.error();
        })
      );

      render(<BackupsPage />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.getByText('Backups y Exportacion')).toBeInTheDocument();
      });

      // Should log error
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle connection error when triggering backup', async () => {
      server.use(
        http.post('/api/backups/trigger', () => {
          return HttpResponse.error();
        })
      );

      const user = userEvent.setup();
      render(<BackupsPage />);

      await waitFor(() => {
        expect(screen.getByText('Ejecutar Ahora')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Ejecutar Ahora'));

      await waitFor(() => {
        expect(screen.getByText('Error de conexion')).toBeInTheDocument();
      });
    });
  });
});
