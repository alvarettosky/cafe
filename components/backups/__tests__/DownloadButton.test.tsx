import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock useAuth hook before importing component
const mockUseAuth = vi.fn();
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

import { DownloadButton } from '../DownloadButton';

describe('DownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth mock to admin
    mockUseAuth.mockReturnValue({
      role: 'admin',
      isLoading: false,
    });
  });

  it('renderiza botón con etiqueta personalizada', () => {
    render(<DownloadButton tableName="inventory" label="Exportar Inventario" />);
    expect(screen.getByText('Exportar Inventario')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renderiza etiqueta por defecto cuando no se proporciona label', () => {
    render(<DownloadButton tableName="inventory" />);
    expect(screen.getByText('Exportar')).toBeInTheDocument();
  });

  it('no renderiza para usuarios no-admin', () => {
    mockUseAuth.mockReturnValue({
      role: 'seller',
      isLoading: false,
    });

    const { container } = render(<DownloadButton tableName="inventory" />);
    expect(container.firstChild).toBeNull();
  });

  it('no renderiza mientras auth está cargando', () => {
    mockUseAuth.mockReturnValue({
      role: 'admin',
      isLoading: true,
    });

    const { container } = render(<DownloadButton tableName="inventory" />);
    expect(container.firstChild).toBeNull();
  });

  it('no renderiza cuando role es null', () => {
    mockUseAuth.mockReturnValue({
      role: null,
      isLoading: false,
    });

    const { container } = render(<DownloadButton tableName="inventory" />);
    expect(container.firstChild).toBeNull();
  });

  it('aplica clases de tamaño sm correctamente', () => {
    render(<DownloadButton tableName="inventory" size="sm" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-2');
    expect(button).toHaveClass('py-1');
    expect(button).toHaveClass('text-xs');
  });

  it('aplica clases de tamaño md correctamente', () => {
    render(<DownloadButton tableName="inventory" size="md" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-3');
    expect(button).toHaveClass('py-2');
    expect(button).toHaveClass('text-sm');
  });

  it('aplica clases de tamaño lg correctamente', () => {
    render(<DownloadButton tableName="inventory" size="lg" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-4');
    expect(button).toHaveClass('py-3');
    expect(button).toHaveClass('text-base');
  });

  it('aplica clases de variante default correctamente', () => {
    render(<DownloadButton tableName="inventory" variant="default" />);
    expect(screen.getByRole('button')).toHaveClass('bg-blue-600');
  });

  it('aplica clases de variante outline correctamente', () => {
    render(<DownloadButton tableName="inventory" variant="outline" />);
    expect(screen.getByRole('button')).toHaveClass('border');
  });

  it('aplica clases de variante ghost correctamente', () => {
    render(<DownloadButton tableName="inventory" variant="ghost" />);
    expect(screen.getByRole('button')).toHaveClass('hover:bg-gray-100');
  });

  it('acepta className adicional', () => {
    render(<DownloadButton tableName="inventory" className="mi-clase-custom" />);
    expect(screen.getByRole('button')).toHaveClass('mi-clase-custom');
  });

  it('renderiza ícono de descarga', () => {
    render(<DownloadButton tableName="inventory" />);
    // Lucide icons render as SVG
    const button = screen.getByRole('button');
    const svg = button.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
