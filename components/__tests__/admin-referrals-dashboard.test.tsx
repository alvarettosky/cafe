import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminReferralsDashboard } from '../admin-referrals-dashboard';
import { supabase } from '@/lib/supabase';
import type { AdminReferralRow, AdminReferralStats } from '@/types/referrals';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const mockStats: AdminReferralStats = {
  total_referrals: 10,
  completed_referrals: 4,
  pending_referrals: 3,
  total_rewards_given: 20000,
  conversion_rate: 40,
  this_month_referrals: 2,
};

// Filas CRUDAS tal y como las devuelve PostgREST: nombres reales de columna
// (`referrer_code`, `referrer_customer_id`, `referrer_reward_value`,
// `referred_reward_value`, `referrer_reward_claimed`), no los viejos
// `code`/`referrer_id`/`*_reward_percent`/`reward_claimed` que ya no existen.
const mockReferralRows: AdminReferralRow[] = [
  {
    id: 'r1',
    referrer_code: 'CAFE-ABC1',
    status: 'completed',
    referrer_customer_id: 'c1',
    referrer: { full_name: 'María Gómez' },
    referred: { full_name: 'Pedro Ruiz' },
    referred_phone: '3001234567',
    created_at: '2026-07-01T00:00:00Z',
    expires_at: '2026-08-01T00:00:00Z',
    completed_at: '2026-07-10T00:00:00Z',
    referrer_reward_value: 5000,
    referred_reward_value: 2000,
    referrer_reward_claimed: true,
  },
  {
    id: 'r2',
    referrer_code: 'CAFE-XYZ2',
    status: 'pending',
    referrer_customer_id: 'c2',
    referrer: { full_name: 'Luis Torres' },
    referred: null,
    referred_phone: null,
    created_at: '2026-07-05T00:00:00Z',
    expires_at: '2026-08-05T00:00:00Z',
    completed_at: null,
    // Recompensa aun no asignada: debe verse como '—', no '$null' ni '$0'.
    referrer_reward_value: null,
    referred_reward_value: null,
    referrer_reward_claimed: false,
  },
];

function formatReward(amount: number) {
  const formatted = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
  // Testing Library normaliza el whitespace del DOM (incluye NBSP) a espacio
  // simple antes de comparar; el string de consulta debe llegar ya normalizado.
  return `+${formatted}`.replace(/ /g, ' ');
}

describe('AdminReferralsDashboard', () => {
  let selectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    const limitMock = vi.fn(() => Promise.resolve({ data: mockReferralRows, error: null }));
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    selectMock = vi.fn(() => ({ order: orderMock }));

    vi.mocked(supabase.from).mockImplementation(
      () =>
        ({
          select: selectMock,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockStats, error: null } as any);
  });

  it('should query customers through the real foreign key hint (referrals_referrer_customer_id_fkey)', async () => {
    render(<AdminReferralsDashboard />);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('referrals');
    });

    const selectArg = selectMock.mock.calls[0][0] as string;
    expect(selectArg).toContain('referrals_referrer_customer_id_fkey');
    expect(selectArg).toContain('referrals_referred_customer_id_fkey');
    // Regresión: el hint viejo no existe en el esquema real y rompía la
    // consulta entera (PGRST200).
    expect(selectArg).not.toContain('referrals_referrer_id_fkey)');
  });

  it('should map raw column names (referrer_code, referrer_customer_id) to the row shown in the table', async () => {
    render(<AdminReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('CAFE-ABC1')).toBeInTheDocument();
    });

    expect(screen.getByText('María Gómez')).toBeInTheDocument();
    expect(screen.getByText('Pedro Ruiz')).toBeInTheDocument();
  });

  it('should display reward values as currency (not as a percentage)', async () => {
    render(<AdminReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(formatReward(5000))).toBeInTheDocument();
    });

    expect(screen.getByText(formatReward(2000))).toBeInTheDocument();
    // Regresión: la columna es un valor absoluto en pesos, no un porcentaje.
    expect(screen.queryByText('+5000%')).not.toBeInTheDocument();
  });

  it('should show an em dash for a reward that has not been assigned yet, instead of $null or $0', async () => {
    render(<AdminReferralsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('CAFE-XYZ2')).toBeInTheDocument();
    });

    const row = screen.getByText('CAFE-XYZ2').closest('tr');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('—');
    expect(row?.textContent).not.toContain('null');
    expect(row?.textContent).not.toMatch(/\$\s*0(?!\d)/);
  });
});
