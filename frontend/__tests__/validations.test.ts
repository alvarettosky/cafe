import { describe, it, expect } from 'vitest';
import { CustomerSchema, SaleSchema } from '../lib/validations';

describe('DART Policies: Data Validation', () => {
    it('should validate a correct customer', () => {
        const validCustomer = { full_name: 'Juan Perez', email: 'juan@test.com' };
        const result = CustomerSchema.safeParse(validCustomer);
        expect(result.success).toBe(true);
    });

    it('should reject a customer with short name', () => {
        const invalidCustomer = { full_name: 'J' };
        const result = CustomerSchema.safeParse(invalidCustomer);
        expect(result.success).toBe(false);
    });

    it('should reject a sale with no items', () => {
        const invalidSale = {
            customer_id: '123e4567-e89b-12d3-a456-426614174000',
            items: []
        };
        const result = SaleSchema.safeParse(invalidSale);
        expect(result.success).toBe(false);
    });
});
