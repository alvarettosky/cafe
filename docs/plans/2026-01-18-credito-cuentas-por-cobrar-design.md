# Sistema de Crédito y Cuentas por Cobrar

**Fecha:** 2026-01-18
**Estado:** Diseño validado, pendiente implementación
**Autor:** Diseño colaborativo con usuario

## Resumen Ejecutivo

Sistema completo de gestión de crédito y cuentas por cobrar para Café Mirador CRM. Permite ventas a crédito con abonos parciales, plazos flexibles (3, 15, 30, 60+ días), registro de pagos desde múltiples puntos, y reportes detallados de cartera.

**Características principales:**

- Ventas con abono inicial y saldo a crédito
- Plazos predefinidos o personalizados
- Tabla de pagos con historial completo de abonos
- Estados automáticos: paid, partial, pending, overdue
- Registro de abonos desde 4 puntos de acceso
- Página dedicada `/cuentas-por-cobrar` con filtros y búsqueda
- Integración con página `/contactos` para deudas vencidas
- Reportes intermedios: total por cobrar, antigüedad, top deudores
- Validaciones robustas y seguridad por roles

## 1. Arquitectura de Base de Datos

### Modificaciones a tabla `sales` existente

```sql
-- Agregar columnas para crédito
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_status TEXT
    CHECK (payment_status IN ('paid', 'partial', 'pending', 'overdue'))
    DEFAULT 'pending';

ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS balance NUMERIC(10, 2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_days INTEGER;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_notes TEXT;

-- Trigger para calcular balance automáticamente
CREATE OR REPLACE FUNCTION calculate_sale_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.balance := NEW.total_amount - NEW.amount_paid;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_calculate_balance
    BEFORE INSERT OR UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION calculate_sale_balance();

-- Trigger para actualizar payment_status automáticamente
CREATE OR REPLACE FUNCTION update_sale_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar la venta asociada al pago
    UPDATE sales
    SET payment_status = CASE
        WHEN balance = 0 THEN 'paid'
        WHEN amount_paid > 0 AND balance > 0 THEN 'partial'
        WHEN amount_paid = 0 THEN 'pending'
        ELSE payment_status
    END
    WHERE id = NEW.sale_id;

    -- Si está vencida, marcar como overdue
    UPDATE sales
    SET payment_status = 'overdue'
    WHERE id = NEW.sale_id
      AND balance > 0
      AND due_date < NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Nueva tabla `payments`

```sql
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);

-- Comentarios
COMMENT ON TABLE payments IS 'Registro de todos los pagos/abonos realizados a ventas';
COMMENT ON COLUMN payments.sale_id IS 'Venta a la que corresponde este pago';
COMMENT ON COLUMN payments.amount IS 'Monto del pago/abono';
COMMENT ON COLUMN payments.payment_method IS 'Método: Efectivo, Nequi, Transf Davivienda, etc.';
COMMENT ON COLUMN payments.received_by IS 'Usuario que registró el pago';
```

### Trigger para actualizar estado después de pago

```sql
CREATE TRIGGER update_payment_status_trigger
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_sale_payment_status();
```

### Estados de pago (calculados automáticamente)

- **`paid`**: balance = 0 (totalmente pagado)
- **`partial`**: balance > 0 AND amount_paid > 0 (con abonos pero debe algo)
- **`pending`**: amount_paid = 0 (no ha pagado nada)
- **`overdue`**: balance > 0 AND NOW() > due_date (vencida y debe)

## 2. Flujo de Creación de Venta con Crédito

### Modificaciones al componente `NewSaleModal`

**Nuevos campos en el modal:**

```typescript
interface SaleFormData {
  // ... campos existentes

  // Nuevos campos para crédito
  paymentType: 'complete' | 'credit'; // Radio buttons
  initialPayment?: number; // Si paymentType = 'credit'
  creditDays?: number; // Días de crédito
  dueDate?: Date; // Calculada automáticamente
  creditNotes?: string; // Notas opcionales
  initialPaymentMethod?: string; // Si hay initialPayment > 0
}
```

**UI del modal (cuando selecciona "Pago a crédito"):**

1. **Tipo de Pago** (arriba, antes de productos):

   ```typescript
   Radio buttons:
   - "Pago completo" (default)
   - "Pago a crédito" → muestra sección de crédito
   ```

2. **Sección de Crédito** (condicional):

   ```typescript
   a) Abono inicial (opcional):
      <Input
        type="number"
        label="¿Cuánto paga ahora?"
        placeholder="$0"
        min={0}
        max={totalAmount}
      />

   b) Plazo de crédito:
      <Select label="Plazo de pago">
        <option value={3}>3 días</option>
        <option value={15}>15 días</option>
        <option value={30}>30 días</option>
        <option value={60}>60 días</option>
        <option value="custom">Personalizado...</option>
      </Select>

      {/* Si selecciona "custom" */}
      <Input type="number" label="Días de crédito" />
      {/* O alternativamente */}
      <DatePicker label="Fecha límite de pago" />

   c) Método de pago del abono (si initialPayment > 0):
      <Select label="Método de pago del abono">
        <option>Efectivo</option>
        <option>Nequi Alvaretto</option>
        <option>Transf. Davivienda</option>
      </Select>

   d) Notas (opcional):
      <Textarea
        label="Notas del crédito"
        placeholder="Acordado con el cliente..."
      />
   ```

3. **Resumen Visual** (card destacado):
   ```typescript
   <Card className="bg-blue-50 border-blue-200">
     <CardContent>
       <div>Total venta: ${formatCurrency(totalAmount)}</div>
       <div>Abono inicial: ${formatCurrency(initialPayment)}</div>
       <div className="font-bold text-lg">
         Saldo pendiente: ${formatCurrency(balance)}
       </div>
       <div className="text-sm text-gray-600">
         Fecha límite: {formatDate(dueDate)}
       </div>
     </CardContent>
   </Card>
   ```

### Actualización del RPC `process_coffee_sale`

```sql
CREATE OR REPLACE FUNCTION process_coffee_sale(
    p_customer_id UUID,
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NOW(),
    p_payment_method TEXT DEFAULT 'Efectivo',
    p_customer_recurrence_days INTEGER DEFAULT NULL,
    -- Nuevos parámetros para crédito
    p_initial_payment NUMERIC DEFAULT NULL,
    p_payment_method_initial TEXT DEFAULT NULL,
    p_credit_days INTEGER DEFAULT NULL,
    p_credit_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_sale_id UUID;
    v_total_amount NUMERIC := 0;
    v_total_cost NUMERIC := 0;
    v_total_profit NUMERIC;
    v_profit_margin NUMERIC;
    v_due_date TIMESTAMPTZ;
    v_amount_paid NUMERIC := 0;
    v_balance NUMERIC;
    v_payment_status TEXT;
BEGIN
    -- Calcular totales (código existente...)
    -- ...

    -- Determinar payment_status y fechas
    IF p_credit_days IS NOT NULL AND p_credit_days > 0 THEN
        v_due_date := p_created_at + (p_credit_days || ' days')::INTERVAL;
        v_amount_paid := COALESCE(p_initial_payment, 0);
        v_balance := v_total_amount - v_amount_paid;

        IF v_balance = 0 THEN
            v_payment_status := 'paid';
        ELSIF v_amount_paid > 0 THEN
            v_payment_status := 'partial';
        ELSE
            v_payment_status := 'pending';
        END IF;
    ELSE
        -- Pago completo (lógica existente)
        v_payment_status := 'paid';
        v_amount_paid := v_total_amount;
        v_balance := 0;
        v_due_date := NULL;
    END IF;

    -- Crear venta con campos de crédito
    INSERT INTO sales (
        customer_id,
        total_amount,
        total_cost,
        total_profit,
        profit_margin,
        created_at,
        payment_method,
        payment_status,
        amount_paid,
        balance,
        credit_days,
        due_date,
        credit_notes
    )
    VALUES (
        p_customer_id,
        v_total_amount,
        v_total_cost,
        v_total_profit,
        v_profit_margin,
        p_created_at,
        p_payment_method,
        v_payment_status,
        v_amount_paid,
        v_balance,
        p_credit_days,
        v_due_date,
        p_credit_notes
    )
    RETURNING id INTO v_sale_id;

    -- Insertar items (código existente...)
    -- ...

    -- Si hay pago inicial, registrarlo en tabla payments
    IF p_initial_payment IS NOT NULL AND p_initial_payment > 0 THEN
        INSERT INTO payments (sale_id, amount, payment_method, payment_date, notes)
        VALUES (
            v_sale_id,
            p_initial_payment,
            COALESCE(p_payment_method_initial, p_payment_method),
            p_created_at,
            'Abono inicial'
        );
    END IF;

    -- Actualizar inventario (código existente...)
    -- ...

    RETURN json_build_object(
        'sale_id', v_sale_id,
        'total_amount', v_total_amount,
        'balance', v_balance,
        'payment_status', v_payment_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 3. Registro de Abonos

### Componente `PaymentModal`

**Props:**

```typescript
interface PaymentModalProps {
  sale: {
    id: string;
    customer_id: string;
    customer_name: string;
    total_amount: number;
    amount_paid: number;
    balance: number;
    due_date: string;
    payment_status: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onPaymentRegistered: () => void;
}
```

**Estructura del modal:**

```typescript
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Registrar Pago</DialogTitle>
    </DialogHeader>

    {/* Información de la venta (read-only) */}
    <Card className="bg-gray-50">
      <CardContent className="space-y-2 pt-4">
        <div className="flex justify-between">
          <span>Cliente:</span>
          <span className="font-medium">{sale.customer_name}</span>
        </div>
        <div className="flex justify-between">
          <span>Venta #:</span>
          <span className="text-sm text-gray-600">{shortId(sale.id)}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span>Total:</span>
          <span>${formatCurrency(sale.total_amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Pagado:</span>
          <span className="text-green-600">${formatCurrency(sale.amount_paid)}</span>
        </div>
        <div className="flex justify-between font-bold text-lg">
          <span>Saldo:</span>
          <span className="text-red-600">${formatCurrency(sale.balance)}</span>
        </div>
        {sale.due_date && (
          <div className="flex justify-between">
            <span>Vencimiento:</span>
            <Badge variant={isOverdue ? "destructive" : "secondary"}>
              {formatDate(sale.due_date)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Formulario de pago */}
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        {/* Monto del abono */}
        <div>
          <Label>Monto del abono *</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              min={0.01}
              max={sale.balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="$0.00"
              required
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setAmount(sale.balance)}
            >
              Pago completo
            </Button>
          </div>
        </div>

        {/* Método de pago */}
        <div>
          <Label>Método de pago *</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Nequi Alvaretto">Nequi Alvaretto</SelectItem>
              <SelectItem value="Transf. Davivienda">Transf. Davivienda</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fecha del pago */}
        <div>
          <Label>Fecha del pago</Label>
          <DatePicker
            value={paymentDate}
            onChange={setPaymentDate}
            maxDate={new Date()}
          />
        </div>

        {/* Notas opcionales */}
        <div>
          <Label>Notas (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Segundo abono, pago final, etc."
            rows={2}
          />
        </div>

        {/* Preview del resultado */}
        {amount > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="text-sm text-gray-700">Después de este pago:</div>
              <div className="font-bold text-lg">
                Nuevo saldo: ${formatCurrency(sale.balance - amount)}
              </div>
              <Badge variant={newBalance === 0 ? "success" : "warning"}>
                {newBalance === 0 ? "✓ Pagado" : `Parcial (${formatCurrency(newBalance)} pendiente)`}
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!amount || amount <= 0}>
          Registrar Pago
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### RPC `register_payment`

```sql
CREATE OR REPLACE FUNCTION register_payment(
    p_sale_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_payment_date TIMESTAMPTZ DEFAULT NOW(),
    p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_payment_id UUID;
    v_new_amount_paid NUMERIC;
    v_new_balance NUMERIC;
    v_new_status TEXT;
    v_current_balance NUMERIC;
BEGIN
    -- Validar que la venta existe y tiene saldo pendiente
    SELECT balance INTO v_current_balance
    FROM sales
    WHERE id = p_sale_id;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Venta no encontrada';
    END IF;

    IF v_current_balance = 0 THEN
        RAISE EXCEPTION 'Esta venta ya está completamente pagada';
    END IF;

    IF p_amount > v_current_balance THEN
        RAISE EXCEPTION 'El monto del pago (%) excede el saldo pendiente (%)', p_amount, v_current_balance;
    END IF;

    -- Insertar el pago
    INSERT INTO payments (sale_id, amount, payment_method, payment_date, notes, received_by)
    VALUES (
        p_sale_id,
        p_amount,
        p_payment_method,
        p_payment_date,
        p_notes,
        auth.uid()
    )
    RETURNING id INTO v_payment_id;

    -- Actualizar la venta
    UPDATE sales
    SET
        amount_paid = amount_paid + p_amount,
        balance = balance - p_amount,
        payment_status = CASE
            WHEN (balance - p_amount) = 0 THEN 'paid'
            WHEN (balance - p_amount) > 0 AND (amount_paid + p_amount) > 0 THEN 'partial'
            ELSE payment_status
        END
    WHERE id = p_sale_id
    RETURNING amount_paid, balance, payment_status
    INTO v_new_amount_paid, v_new_balance, v_new_status;

    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'payment_id', v_payment_id,
        'new_amount_paid', v_new_amount_paid,
        'new_balance', v_new_balance,
        'new_status', v_new_status
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 4. Puntos de Acceso para Registrar Abonos

### 1. Página `/cuentas-por-cobrar` (Nueva)

**Componente:** `app/cuentas-por-cobrar/page.tsx`

**Estructura:**

```typescript
export default function CuentasPorCobrarPage() {
  return (
    <div className="container mx-auto p-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total por Cobrar"
          value={totalPorCobrar}
          icon={DollarSign}
          trend="+5% vs mes anterior"
        />
        <StatsCard
          title="Ventas Vencidas"
          value={ventasVencidas}
          subtitle={`$${montoVencido}`}
          icon={AlertTriangle}
          variant="destructive"
        />
        <StatsCard
          title="Vence esta Semana"
          value={venceEstaSemana}
          subtitle={`$${montoVenceEstaSemana}`}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Pagos Hoy"
          value={`$${pagosHoy}`}
          subtitle={`${cantidadPagosHoy} pagos`}
          icon={CheckCircle}
          variant="success"
        />
      </div>

      {/* Filtros y búsqueda */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="overdue">Vencidas</TabsTrigger>
                <TabsTrigger value="due_soon">Por vencer (7d)</TabsTrigger>
                <TabsTrigger value="partial">Parciales</TabsTrigger>
              </TabsList>
            </Tabs>

            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_date_asc">Vencimiento (próximo)</SelectItem>
                <SelectItem value="balance_desc">Saldo (mayor)</SelectItem>
                <SelectItem value="created_desc">Fecha venta (reciente)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de ventas a crédito */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Venta</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(sale.customer_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{sale.customer_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="text-gray-500">#{shortId(sale.id)}</div>
                      <div>{formatDate(sale.created_at)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    ${formatCurrency(sale.total_amount)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    ${formatCurrency(sale.amount_paid)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">
                    ${formatCurrency(sale.balance)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(sale)}>
                      {getDueDateLabel(sale.due_date)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => openPaymentModal(sale)}
                    >
                      Registrar pago
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de pago */}
      <PaymentModal
        sale={selectedSale}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onPaymentRegistered={handlePaymentRegistered}
      />
    </div>
  );
}
```

### 2. Desde perfil del cliente `/clientes/[id]`

**Agregar al componente existente:**

```typescript
{/* Nueva sección en CustomerModal o página de detalle */}
<Card>
  <CardHeader>
    <CardTitle>Cuentas Pendientes</CardTitle>
  </CardHeader>
  <CardContent>
    {creditSales.length > 0 ? (
      <div className="space-y-3">
        {creditSales.map((sale) => (
          <div key={sale.id} className="flex justify-between items-center p-3 border rounded">
            <div>
              <div className="text-sm text-gray-500">
                Venta {formatDate(sale.created_at)}
              </div>
              <div className="font-medium">
                Saldo: ${formatCurrency(sale.balance)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => viewPaymentHistory(sale.id)}
              >
                Ver pagos
              </Button>
              <Button
                size="sm"
                onClick={() => openPaymentModal(sale)}
              >
                Registrar pago
              </Button>
            </div>
          </div>
        ))}
        <div className="pt-3 border-t">
          <div className="flex justify-between font-bold text-lg">
            <span>Total Adeuda:</span>
            <span className="text-red-600">
              ${formatCurrency(totalBalance)}
            </span>
          </div>
        </div>
      </div>
    ) : (
      <p className="text-gray-500 text-center py-4">
        No tiene cuentas pendientes
      </p>
    )}
  </CardContent>
</Card>
```

### 3. Desde lista de ventas (mejorar existente)

**Agregar columna y acción:**

```typescript
// En el componente que lista ventas
<TableHead>Estado de Pago</TableHead>

// En cada fila:
<TableCell>
  <Badge variant={getPaymentStatusVariant(sale.payment_status)}>
    {getPaymentStatusLabel(sale.payment_status)}
  </Badge>
  {sale.balance > 0 && (
    <div className="text-sm text-red-600 mt-1">
      Debe: ${formatCurrency(sale.balance)}
    </div>
  )}
</TableCell>

// En acciones:
{sale.balance > 0 && (
  <DropdownMenuItem onClick={() => openPaymentModal(sale)}>
    <DollarSign className="mr-2 h-4 w-4" />
    Registrar pago
  </DropdownMenuItem>
)}
```

### 4. Desde página `/contactos` (integración)

**Agregar nueva sección:**

```typescript
{/* En app/contactos/page.tsx, después de sección de recurrencia */}
<div className="mt-8">
  <h2 className="text-2xl font-bold mb-4">Clientes con Deudas Vencidas</h2>

  <Tabs defaultValue="overdue">
    <TabsList>
      <TabsTrigger value="overdue">
        Vencidas ({overdueCount})
      </TabsTrigger>
      <TabsTrigger value="due_soon">
        Por vencer ({dueSoonCount})
      </TabsTrigger>
    </TabsList>

    <TabsContent value="overdue">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {overdueCustomers.map((customer) => (
          <Card key={customer.id} className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{customer.name}</span>
                <Badge variant="destructive">
                  {customer.days_overdue}d vencido
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total debe:</span>
                  <span className="font-bold text-red-600">
                    ${formatCurrency(customer.total_balance)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ventas pendientes:</span>
                  <span>{customer.pending_sales_count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Más antigua:</span>
                  <span>{formatDate(customer.oldest_sale_date)}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openWhatsApp(customer)}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => viewCustomerDebts(customer.id)}
                >
                  Ver detalles
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TabsContent>
  </Tabs>
</div>

{/* Función para generar mensaje de WhatsApp */}
function getDebtWhatsAppMessage(customer) {
  return `Hola ${customer.name}, te recordamos que tienes un saldo pendiente de ${formatCurrency(customer.total_balance)}. ${customer.days_overdue > 0 ? `Vencido hace ${customer.days_overdue} días.` : ''} ¿Cuándo podrías realizar el pago? ¡Gracias!`;
}
```

## 5. Reportes y Métricas

### RPC `get_accounts_receivable_stats`

```sql
CREATE OR REPLACE FUNCTION get_accounts_receivable_stats(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    WITH sales_data AS (
        SELECT
            s.id,
            s.customer_id,
            c.full_name as customer_name,
            s.total_amount,
            s.amount_paid,
            s.balance,
            s.payment_status,
            s.due_date,
            s.created_at,
            CASE
                WHEN s.due_date < NOW() THEN
                    EXTRACT(DAY FROM NOW() - s.due_date)
                ELSE 0
            END as days_overdue,
            CASE
                WHEN s.due_date >= NOW() AND s.due_date <= NOW() + INTERVAL '7 days'
                THEN true
                ELSE false
            END as due_within_week
        FROM sales s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.balance > 0
          AND (p_start_date IS NULL OR s.created_at >= p_start_date)
          AND s.created_at <= p_end_date
    ),
    payments_today AS (
        SELECT
            COALESCE(SUM(amount), 0) as total_amount,
            COUNT(*) as count
        FROM payments
        WHERE payment_date::date = CURRENT_DATE
    )
    SELECT json_build_object(
        'total_receivable', (
            SELECT COALESCE(SUM(balance), 0)
            FROM sales_data
        ),
        'overdue_sales', (
            SELECT json_build_object(
                'count', COUNT(*),
                'total_amount', COALESCE(SUM(balance), 0)
            )
            FROM sales_data
            WHERE payment_status = 'overdue'
        ),
        'due_this_week', (
            SELECT json_build_object(
                'count', COUNT(*),
                'total_amount', COALESCE(SUM(balance), 0)
            )
            FROM sales_data
            WHERE due_within_week = true AND payment_status != 'overdue'
        ),
        'payments_today', (
            SELECT json_build_object(
                'total_amount', total_amount,
                'count', count
            )
            FROM payments_today
        ),
        'top_debtors', (
            SELECT json_agg(debtor_data)
            FROM (
                SELECT
                    customer_id,
                    customer_name,
                    SUM(balance) as total_balance,
                    COUNT(*) as pending_sales_count,
                    AVG(days_overdue) as avg_days_overdue
                FROM sales_data
                WHERE balance > 0
                GROUP BY customer_id, customer_name
                ORDER BY total_balance DESC
                LIMIT 10
            ) debtor_data
        ),
        'aging_report', (
            SELECT json_build_object(
                '0_30_days', COALESCE(SUM(CASE WHEN days_overdue BETWEEN 0 AND 30 THEN balance END), 0),
                '31_60_days', COALESCE(SUM(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN balance END), 0),
                '61_90_days', COALESCE(SUM(CASE WHEN days_overdue BETWEEN 61 AND 90 THEN balance END), 0),
                'over_90_days', COALESCE(SUM(CASE WHEN days_overdue > 90 THEN balance END), 0)
            )
            FROM sales_data
            WHERE payment_status = 'overdue'
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Componentes de Reportes

**1. Top Deudores - `TopDebtorsCard`:**

```typescript
export function TopDebtorsCard({ data }: { data: TopDebtor[] }) {
  const totalReceivable = data.reduce((sum, d) => sum + d.total_balance, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mayores Saldos Pendientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((debtor, index) => {
            const percentage = (debtor.total_balance / totalReceivable) * 100;

            return (
              <div key={debtor.customer_id} className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">#{index + 1}</span>
                    <span className="font-medium">{debtor.customer_name}</span>
                  </div>
                  <span className="font-bold text-red-600">
                    ${formatCurrency(debtor.total_balance)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{debtor.pending_sales_count} ventas pendientes</span>
                  <span>
                    {debtor.avg_days_overdue > 0
                      ? `${Math.round(debtor.avg_days_overdue)}d promedio atraso`
                      : 'Sin atraso'}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

**2. Antigüedad de Cartera - `AgingReportCard`:**

```typescript
export function AgingReportCard({ data }: { data: AgingReport }) {
  const total =
    data['0_30_days'] +
    data['31_60_days'] +
    data['61_90_days'] +
    data.over_90_days;

  const chartData = [
    { name: '0-30 días', value: data['0_30_days'], color: '#22c55e' },
    { name: '31-60 días', value: data['31_60_days'], color: '#eab308' },
    { name: '61-90 días', value: data['61_90_days'], color: '#f97316' },
    { name: '+90 días', value: data.over_90_days, color: '#ef4444' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Antigüedad de Cartera</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {chartData.map((item) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0;

            return (
              <div key={item.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-sm font-bold">
                    ${formatCurrency(item.value)} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress
                  value={percentage}
                  className="h-3"
                  style={{
                    '--progress-background': item.color
                  } as React.CSSProperties}
                />
              </div>
            );
          })}

          <Separator />

          <div className="flex justify-between font-bold text-lg">
            <span>Total Vencido:</span>
            <span className="text-red-600">${formatCurrency(total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**3. Pagos Recibidos - `PaymentsReceivedCard`:**

```typescript
export function PaymentsReceivedCard() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [payments, setPayments] = useState<Payment[]>([]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Pagos Recibidos</span>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="today">Hoy</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Venta</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Método</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{formatDateTime(payment.payment_date)}</TableCell>
                <TableCell>{payment.customer_name}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  #{shortId(payment.sale_id)}
                </TableCell>
                <TableCell className="text-right font-medium text-green-600">
                  ${formatCurrency(payment.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{payment.payment_method}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Separator className="my-4" />

        <div className="flex justify-between font-bold text-lg">
          <span>Total Recibido:</span>
          <span className="text-green-600">
            ${formatCurrency(totalReceived)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Analytics - Nueva sección

**Agregar tab en `/analytics`:**

```typescript
{/* En app/analytics/page.tsx */}
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Resumen</TabsTrigger>
    <TabsTrigger value="products">Productos</TabsTrigger>
    <TabsTrigger value="receivables">Cuentas por Cobrar</TabsTrigger>
  </TabsList>

  <TabsContent value="receivables">
    <div className="space-y-6">
      {/* Gráfico de evolución */}
      <Card>
        <CardHeader>
          <CardTitle>Evolución del Saldo por Cobrar</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            data={receivablesEvolution}
            xKey="month"
            yKeys={['total_receivable', 'overdue_amount']}
            colors={['#3b82f6', '#ef4444']}
            height={300}
          />
        </CardContent>
      </Card>

      {/* Métricas clave */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tiempo Promedio de Cobro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgCollectionDays}d</div>
            <p className="text-sm text-gray-600">Días desde venta hasta pago</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">% Ventas a Crédito</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{creditSalesPercentage}%</div>
            <p className="text-sm text-gray-600">vs pago de contado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tasa de Morosidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {delinquencyRate}%
            </div>
            <p className="text-sm text-gray-600">Ventas vencidas vs total</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </TabsContent>
</Tabs>
```

## 6. Validaciones y Reglas de Negocio

### Validaciones en Frontend

**Al crear venta a crédito:**

```typescript
function validateCreditSale(formData: SaleFormData): ValidationResult {
  const errors: string[] = [];

  // 1. Validar abono inicial
  if (formData.initialPayment) {
    if (formData.initialPayment < 0) {
      errors.push('El abono inicial no puede ser negativo');
    }
    if (formData.initialPayment >= formData.totalAmount) {
      errors.push('El abono inicial debe ser menor al total');
    }
  }

  // 2. Validar plazo de crédito
  if (!formData.creditDays || formData.creditDays <= 0) {
    errors.push('Debe especificar un plazo de crédito válido');
  }

  if (formData.creditDays > 90) {
    return {
      valid: true,
      warnings: ['Plazo de crédito inusualmente largo (>90 días)'],
    };
  }

  // 3. Advertencia de saldo bajo
  const balance = formData.totalAmount - (formData.initialPayment || 0);
  if (balance < 1000) {
    return {
      valid: true,
      warnings: ['Saldo muy bajo. ¿Mejor registrar como pago completo?'],
    };
  }

  // 4. Advertencia de venta 100% a crédito
  if (!formData.initialPayment || formData.initialPayment === 0) {
    return {
      valid: true,
      warnings: ['Venta 100% a crédito (sin abono inicial)'],
    };
  }

  return { valid: errors.length === 0, errors };
}
```

**Al registrar abono:**

```typescript
function validatePayment(payment: PaymentFormData, sale: Sale): ValidationResult {
  const errors: string[] = [];

  // 1. Validar monto
  if (payment.amount <= 0) {
    errors.push('El monto debe ser mayor a cero');
  }

  if (payment.amount > sale.balance) {
    errors.push(`El monto (${payment.amount}) no puede ser mayor al saldo (${sale.balance})`);
  }

  // 2. Validar fecha
  const paymentDate = new Date(payment.paymentDate);
  const saleDate = new Date(sale.created_at);
  const now = new Date();

  if (paymentDate > now) {
    errors.push('La fecha del pago no puede ser futura');
  }

  if (paymentDate < saleDate) {
    return {
      valid: true,
      warnings: ['La fecha del pago es anterior a la venta. ¿Es correcto?'],
    };
  }

  // 3. Confirmar liquidación
  if (Math.abs(payment.amount - sale.balance) < 0.01) {
    return {
      valid: true,
      confirmations: ['Esto liquidará completamente la deuda. ¿Continuar?'],
    };
  }

  return { valid: errors.length === 0, errors };
}
```

**Prevención de duplicados:**

```typescript
// En PaymentModal
const [lastPayment, setLastPayment] = useState<{
  amount: number;
  timestamp: number;
} | null>(null);

function handleSubmit(e: FormEvent) {
  e.preventDefault();

  const now = Date.now();

  // Verificar si es un posible duplicado
  if (lastPayment && lastPayment.amount === amount && now - lastPayment.timestamp < 5 * 60 * 1000) {
    // 5 minutos

    const confirmed = window.confirm(
      'Acabas de registrar un pago idéntico hace menos de 5 minutos. ¿Estás seguro de continuar?'
    );

    if (!confirmed) return;
  }

  // Procesar pago...
  await registerPayment(paymentData);

  // Guardar para prevenir duplicados
  setLastPayment({
    amount,
    timestamp: now,
  });
}
```

### Políticas RLS (Row Level Security)

```sql
-- Payments - Sellers pueden insertar, todos pueden leer
CREATE POLICY payments_sellers_insert ON payments
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY payments_read_all ON payments
    FOR SELECT
    TO authenticated
    USING (true);

-- Solo super admins pueden eliminar pagos (para corregir errores)
CREATE POLICY payments_admin_delete ON payments
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- No permitir UPDATE en payments (inmutabilidad)
-- Si se necesita corregir, eliminar y crear nuevo

-- Sales con balance - No permitir edición si tiene pagos
CREATE OR REPLACE FUNCTION prevent_edit_sales_with_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM payments
        WHERE sale_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'No se puede editar una venta que tiene pagos registrados';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_sale_edit_trigger
    BEFORE UPDATE ON sales
    FOR EACH ROW
    WHEN (OLD.id IS NOT NULL)
    EXECUTE FUNCTION prevent_edit_sales_with_payments();
```

### Validaciones en Backend (RPC)

```sql
-- En register_payment, agregar validaciones adicionales
CREATE OR REPLACE FUNCTION register_payment(
    p_sale_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_payment_date TIMESTAMPTZ DEFAULT NOW(),
    p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_payment_id UUID;
    v_sale_created_at TIMESTAMPTZ;
    v_current_balance NUMERIC;
    v_recent_duplicate_count INTEGER;
BEGIN
    -- Validación 1: Venta existe y tiene saldo
    SELECT balance, created_at INTO v_current_balance, v_sale_created_at
    FROM sales
    WHERE id = p_sale_id;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Venta no encontrada';
    END IF;

    IF v_current_balance = 0 THEN
        RAISE EXCEPTION 'Esta venta ya está completamente pagada';
    END IF;

    -- Validación 2: Monto válido
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a cero';
    END IF;

    IF p_amount > v_current_balance THEN
        RAISE EXCEPTION 'El monto (%) excede el saldo pendiente (%)',
            p_amount, v_current_balance;
    END IF;

    -- Validación 3: Fecha no puede ser futura
    IF p_payment_date > NOW() THEN
        RAISE EXCEPTION 'La fecha del pago no puede ser futura';
    END IF;

    -- Validación 4: Advertencia de fecha anterior a venta
    IF p_payment_date < v_sale_created_at THEN
        -- Solo advertencia, no bloquear
        RAISE NOTICE 'Advertencia: Fecha de pago anterior a la fecha de venta';
    END IF;

    -- Validación 5: Detectar posibles duplicados (mismo monto en últimos 5 min)
    SELECT COUNT(*) INTO v_recent_duplicate_count
    FROM payments
    WHERE sale_id = p_sale_id
      AND amount = p_amount
      AND created_at > NOW() - INTERVAL '5 minutes';

    IF v_recent_duplicate_count > 0 THEN
        RAISE NOTICE 'Advertencia: Pago similar registrado recientemente';
    END IF;

    -- Proceder con la inserción...
    -- (código existente)

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 7. Tipos TypeScript

### Nuevos tipos para crédito

```typescript
// types/credit.ts

export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export interface CreditSale {
  id: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  payment_status: PaymentStatus;
  credit_days: number | null;
  due_date: string | null;
  credit_notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface PaymentWithDetails extends Payment {
  customer_name: string;
  sale_total: number;
  sale_balance: number;
}

export interface AccountsReceivableStats {
  total_receivable: number;
  overdue_sales: {
    count: number;
    total_amount: number;
  };
  due_this_week: {
    count: number;
    total_amount: number;
  };
  payments_today: {
    total_amount: number;
    count: number;
  };
  top_debtors: TopDebtor[];
  aging_report: AgingReport;
}

export interface TopDebtor {
  customer_id: string;
  customer_name: string;
  total_balance: number;
  pending_sales_count: number;
  avg_days_overdue: number;
}

export interface AgingReport {
  '0_30_days': number;
  '31_60_days': number;
  '61_90_days': number;
  over_90_days: number;
}

export interface CustomerWithDebt {
  id: string;
  name: string;
  phone: string;
  total_balance: number;
  pending_sales_count: number;
  oldest_sale_date: string;
  days_overdue: number;
  urgency: 'high' | 'medium' | 'low';
}
```

## 8. Plan de Implementación

### Fase 1 - Base de Datos (1 día)

1. Crear migración `020_credit_system.sql`:
   - Modificar tabla `sales`
   - Crear tabla `payments`
   - Crear triggers
   - Crear RPC `register_payment`
   - Actualizar RPC `process_coffee_sale`
   - Crear RPC `get_accounts_receivable_stats`
   - Configurar políticas RLS

2. Ejecutar migración en Supabase
3. Crear tipos TypeScript en `types/credit.ts`

### Fase 2 - Componentes Core (2 días)

4. Crear `PaymentModal` component
5. Actualizar `NewSaleModal` con campos de crédito
6. Crear helpers y utilidades:
   - `formatPaymentStatus()`
   - `getDueDateLabel()`
   - `calculateBalance()`
   - Validaciones

### Fase 3 - Página Cuentas por Cobrar (2 días)

7. Crear página `app/cuentas-por-cobrar/page.tsx`
8. Crear componentes de stats cards
9. Implementar tabla con filtros y búsqueda
10. Implementar sorting
11. Integrar `PaymentModal`

### Fase 4 - Integración con Páginas Existentes (1 día)

12. Agregar sección de deudas en `/clientes/[id]`
13. Agregar columna de estado en lista de ventas
14. Agregar sección de deudas vencidas en `/contactos`
15. Actualizar mensajes de WhatsApp

### Fase 5 - Reportes y Analytics (1-2 días)

16. Crear componentes de reportes:
    - `TopDebtorsCard`
    - `AgingReportCard`
    - `PaymentsReceivedCard`
17. Agregar tab en `/analytics`
18. Crear gráficos de evolución

### Fase 6 - Testing y Deploy (1 día)

19. Escribir tests para:
    - RPCs de crédito
    - Validaciones
    - Componentes clave
20. Testing manual de flujos completos
21. Documentación de uso
22. Deploy a producción

**Total estimado: 8-10 días de desarrollo**

## 9. Criterios de Éxito

✅ Crear ventas con abono inicial y saldo a crédito
✅ Registrar abonos desde múltiples puntos de acceso
✅ Ver historial completo de pagos por venta
✅ Estados de pago se actualizan automáticamente
✅ Página `/cuentas-por-cobrar` funcional con filtros
✅ Integración con `/contactos` para deudas vencidas
✅ Reportes de antigüedad, top deudores, y pagos recibidos
✅ Validaciones previenen errores comunes
✅ Solo admins pueden eliminar pagos
✅ No se puede editar venta con pagos registrados
✅ Mensajes de WhatsApp incluyen info de deudas

## 10. Notas Importantes

1. **Inmutabilidad de pagos**: Los registros en `payments` son inmutables (solo INSERT). Si hay error, el admin puede eliminar y crear nuevo.

2. **Balance calculado**: El campo `balance` se calcula automáticamente con trigger, nunca se actualiza manualmente.

3. **Estados automáticos**: El `payment_status` se actualiza automáticamente después de cada pago.

4. **Fechas vencidas**: Un cron job o verificación al inicio puede marcar ventas como `overdue` si `due_date < NOW()`.

5. **Plazos flexibles**: Se permiten plazos personalizados además de los predefinidos (3, 15, 30, 60 días).

6. **Integración WhatsApp**: Los mensajes se generan automáticamente con info de deudas y días de atraso.

7. **Permisos**: Sellers pueden crear ventas a crédito y registrar pagos. Solo admins pueden eliminar pagos.

8. **Auditoría**: El campo `received_by` registra quién recibió cada pago para trazabilidad completa.

---

**Documento validado el 2026-01-18**
**Listo para implementación**
