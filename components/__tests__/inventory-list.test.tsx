import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/__mocks__/server';
import { InventoryList } from '../inventory-list';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';

const mockUseAuth = vi.fn();
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../product-modal', () => ({
  ProductModal: () => null,
}));

vi.mock('../inventory-movements', () => ({
  InventoryMovements: () => null,
}));

vi.mock('../export', () => ({
  DownloadButton: () => null,
}));

describe('InventoryList', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ isAdmin: false });
  });

  it('should render inventory items from the default mock', async () => {
    render(<InventoryList />);

    await waitFor(() => {
      expect(screen.getByText('Café Especial')).toBeInTheDocument();
    });
  });

  it('should log the error and stop loading when fetching inventory fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    server.use(
      http.get(`${SUPABASE_URL}/rest/v1/inventory`, () => {
        return HttpResponse.json({ message: 'Database error' }, { status: 500 });
      })
    );

    render(<InventoryList />);

    // Loading must resolve (not hang) even though the fetch failed
    await waitFor(() => {
      expect(screen.getByText('No hay productos registrados.')).toBeInTheDocument();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching inventory:', expect.anything());

    consoleErrorSpy.mockRestore();
  });
});
