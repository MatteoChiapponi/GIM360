-- Deja explícitos los tres medios de pago de cada gimnasio que ya existe:
-- habilitados y sin ajuste, que es el default con el que venían funcionando.
-- Idempotente: el unique (gymId, method) descarta lo que ya esté cargado.
INSERT INTO "PaymentMethodConfig" ("id", "gymId", "method", "enabled", "adjustmentType", "adjustmentPercent", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    g."id",
    m."method",
    true,
    'NONE'::"PaymentAdjustmentType",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Gym" g
CROSS JOIN (VALUES
    ('CASH'::"PaymentMethod"),
    ('TRANSFER'::"PaymentMethod"),
    ('CARD'::"PaymentMethod")
) AS m("method")
ON CONFLICT ("gymId", "method") DO NOTHING;
