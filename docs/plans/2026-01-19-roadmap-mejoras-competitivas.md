# Roadmap: Mejoras Competitivas Café Mirador

> **Fecha de creación**: 2026-01-19
> **Última actualización**: 2026-01-19
> **Estado general**: ✅ Completado (3 fases implementadas)

---

## Visión General

Este roadmap documenta las mejoras identificadas al comparar Café Mirador con las apps líderes del mercado de tostadores/distribuidores de café. El objetivo es maximizar el valor del sistema de recurrencia existente y escalar el negocio de manera eficiente.

### Filosofía de Café Mirador

Café Mirador **NO es una cafetería**. Es un **tostador/distribuidor de café en grano** que:

- Vende café en libras y medias libras
- Tiene clientes que recompran periódicamente
- Predice cuándo el cliente necesitará más café (sistema de recurrencia)
- Contacta proactivamente a clientes vía WhatsApp

### Ventajas Competitivas Actuales

| Característica                    | Estado          | Comparación                                             |
| --------------------------------- | --------------- | ------------------------------------------------------- |
| Sistema de recurrencia predictiva | ✅ Implementado | Similar a [RoasterTools](https://www.roastertools.com/) |
| Integración WhatsApp nativa       | ✅ Implementado | Diferenciador                                           |
| Gestión de prospectos             | ✅ Implementado | CRM básico                                              |
| Cálculo automático de profit      | ✅ Implementado | Estándar industria                                      |

---

## Fases del Roadmap

### Fase 1: Maximizar Sistema de Recurrencia ✅

📄 **Documento**: [2026-01-19-fase1-maximizar-recurrencia.md](./2026-01-19-fase1-maximizar-recurrencia.md)

| Feature                  | Descripción                            | Estado        |
| ------------------------ | -------------------------------------- | ------------- |
| 1.1 Repetir Pedido       | Un click para reordenar última compra  | ✅ Completado |
| 1.2 WhatsApp Inteligente | Mensajes automáticos según recurrencia | ✅ Completado |
| 1.3 Segmentación RFM     | Clasificación automática de clientes   | ✅ Completado |

**Impacto esperado**:

- 50% más valor por pedido (dato de RoasterTools)
- Mayor tasa de contacto a clientes
- Priorización inteligente de acciones

---

### Fase 2: Portal de Cliente Self-Service ✅

📄 **Documento**: [2026-01-19-fase2-portal-cliente-self-service.md](./2026-01-19-fase2-portal-cliente-self-service.md)

| Feature                | Descripción                     | Estado        |
| ---------------------- | ------------------------------- | ------------- |
| 2.1 Magic Links        | Autenticación sin contraseña    | ✅ Completado |
| 2.2 Portal del Cliente | Historial y nuevo pedido        | ✅ Completado |
| 2.3 Suscripciones      | Pedidos automáticos recurrentes | ✅ Completado |

**Impacto esperado**:

- 30% de clientes usando portal
- Reducción de carga operativa
- Churn de suscripciones <10%

---

### Fase 3: Crecimiento y Escalabilidad ✅

📄 **Documento**: [2026-01-19-fase3-crecimiento.md](./2026-01-19-fase3-crecimiento.md)

| Feature                | Descripción                    | Estado        |
| ---------------------- | ------------------------------ | ------------- |
| 3.1 Programa Referidos | Clientes traen nuevos clientes | ✅ Completado |
| 3.2 Listas de Precios  | Precios diferenciados por tipo | ✅ Completado |
| 3.3 Rutas de Entrega   | Optimización de delivery       | ✅ Completado |

**Impacto esperado**:

- 20% de nuevos clientes por referidos
- Clientes mayoristas bien identificados
- 20% reducción tiempo de entregas

---

## Resumen de Cambios en Base de Datos

### Fase 1

```
Nuevas tablas:
- whatsapp_templates

Nuevas vistas:
- customer_segments

Nuevas RPCs:
- get_last_sale_for_repeat()
- generate_whatsapp_message()
- get_customer_segment_stats()
```

### Fase 2

```
Nuevas tablas:
- customer_auth
- customer_subscriptions
- subscription_items

Nuevas columnas:
- sales.status
- sales.notes

Nuevas RPCs:
- generate_customer_magic_link()
- validate_customer_magic_link()
- validate_customer_session()
- get_customer_portal_dashboard()
- get_products_for_customer_order()
- create_customer_order()
- upsert_customer_subscription()
- toggle_subscription_status()
- get_subscriptions_due_today()
```

### Fase 3

```
Nuevas tablas:
- referrals
- referral_program_config
- price_lists
- price_list_items
- customer_type_price_lists
- delivery_zones
- deliveries
- delivery_items

Nuevas columnas en customers:
- customer_type
- custom_price_list_id
- delivery_zone_id
- delivery_notes
- delivery_address

Nuevas RPCs:
- generate_referral_code()
- apply_referral_code()
- complete_referral_on_purchase()
- get_product_price_for_customer()
- get_deliveries_for_date()
- get_customers_without_zone()
```

---

## Resumen de Nuevas Rutas

### Fase 1

```
Sin nuevas rutas (mejoras a páginas existentes)
```

### Fase 2

```
/portal                 → Dashboard cliente
/portal/auth            → Validación magic link
/portal/pedidos         → Historial de pedidos
/portal/nuevo-pedido    → Crear nuevo pedido
/portal/perfil          → Editar datos personales
/portal/suscripcion     → Gestionar suscripción
```

### Fase 3

```
/portal/referidos       → Código de referido
/referido/[code]        → Landing para referidos
/admin/precios          → Gestión listas de precios (nueva)
/admin/zonas            → Gestión zonas entrega (nueva)
/entregas               → Vista de entregas del día (nueva)
```

---

## Dependencias Entre Fases

```
Fase 1 (independiente)
    │
    └──▶ Fase 2 (requiere Fase 1)
            │
            └──▶ Fase 3 (requiere Fases 1 y 2)
```

**Nota**: Fase 1 puede implementarse inmediatamente. Fase 2 requiere que el sistema de recurrencia y WhatsApp estén optimizados. Fase 3 requiere el portal de clientes funcionando.

---

## Seguimiento de Progreso

### Checklist Global

#### Fase 1 ✅

- [x] Diseño aprobado
- [x] Migración SQL ejecutada
- [x] Feature 1.1 completada
- [x] Feature 1.2 completada
- [x] Feature 1.3 completada
- [x] Tests pasando
- [x] Deployed a producción

#### Fase 2 ✅

- [x] Diseño aprobado
- [x] Migración SQL ejecutada
- [x] Feature 2.1 completada
- [x] Feature 2.2 completada
- [x] Feature 2.3 completada
- [x] Tests pasando
- [x] Deployed a producción

#### Fase 3 ✅

- [x] Diseño aprobado
- [x] Migración SQL ejecutada
- [x] Feature 3.1 completada
- [x] Feature 3.2 completada
- [x] Feature 3.3 completada
- [x] Tests pasando
- [x] Deployed a producción

---

## Referencias de Investigación

### Software para Tostadores de Café

- [RoasterTools](https://www.roastertools.com/) - Portal wholesale, producción
- [Cropster](https://www.cropster.com/) - Quality control, inventory
- [Unleashed](https://www.unleashedsoftware.com/industry/coffee-roasters-inventory-management/) - Inventory management
- [Algrano CRM](https://algrano.com/learn/coffee-producers-in-the-forefront-of-sales-with-award-winning-crm) - CRM específico café

### Retención y Suscripciones

- [CodingKart - Coffee Subscription Churn](https://codingkart.com/blogs/tactics-to-reduce-coffee-subscription-churn/)
- [Blueprint - DTC Retention](https://blueprint.store/post/examples-of-dtc-subscription-retention)
- [Recharge - Subscription Metrics](https://getrecharge.com/blog/10-subscription-metrics-every-dtc-brand-should-track/)

### CRM y WhatsApp

- [NetHunt - WhatsApp CRM](https://nethunt.com/blog/whatsapp-crm/)
- [CleverTap - RFM Analysis](https://clevertap.com/blog/rfm-analysis/)

### B2B y Wholesale

- [WizCommerce - B2B Food](https://wizcommerce.com/b2b-food-and-beverage-commerce-platform/)
- [B2B Wave - Food & Beverage](https://www.b2bwave.com/industries/food-beverage)

---

## Notas de Implementación

### Prioridad de Desarrollo

1. **Alta**: Features que aprovechan datos existentes (Fase 1)
2. **Media**: Features que requieren nueva infraestructura (Fase 2)
3. **Baja**: Features de optimización y escala (Fase 3)

### Consideraciones Técnicas

- Todas las nuevas tablas deben tener RLS configurado
- Las RPCs deben usar `SECURITY DEFINER` con cuidado
- El portal de clientes usa autenticación separada (no Supabase Auth)
- Los magic links deben tener expiración corta (24h)
- Las suscripciones requieren un cron job o edge function

### Testing Requerido

- Tests unitarios para cada RPC nueva
- Tests E2E para flujos críticos (magic link, nueva venta, suscripción)
- Tests de integración para WhatsApp (mock de URLs)

---

_Documento generado basado en investigación de mercado y análisis de competidores._
