import 'dotenv/config';
import postgres from 'postgres';

const runVerification = async () => {
  const rootClient = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    await rootClient`ALTER ROLE nexora_app WITH LOGIN PASSWORD 'testpass'`;
    const appUrl = process.env.DATABASE_URL!.replace('postgres:password', 'nexora_app:testpass');
    const appClient = postgres(appUrl, { max: 1 });

    console.log('--- Testing nexora_app restrictions ---');

    // 2. Cannot INSERT into public
    try {
      await rootClient`CREATE TABLE IF NOT EXISTS public.test_table_public (id int)`;
      await appClient`INSERT INTO public.test_table_public (id) VALUES (1)`;
      throw new Error('FAIL: Was able to insert into public');
    } catch (e: any) {
      if (e.message.includes('FAIL')) throw e;
      console.log('✅ INSERT into public blocked:', e.message);
    }

    // 3. Immutability trigger/privilege test for ALL 7 tables
    const immutableTables = [
      'message_template_versions',
      'inventory_movements',
      'order_status_history',
      'payment_submissions',
      'delivery_errors',
      'ledger_entries',
      'audit_log',
    ];

    for (const table of immutableTables) {
      // Test UPDATE
      try {
        await appClient.unsafe(`UPDATE nexora.${table} SET id = id`);
        throw new Error(`FAIL: Was able to update ${table}`);
      } catch (e: any) {
        if (e.message.includes('FAIL')) throw e;
        console.log(`✅ UPDATE on ${table} blocked:`, e.message);
      }

      // Test DELETE
      try {
        await appClient.unsafe(`DELETE FROM nexora.${table}`);
        throw new Error(`FAIL: Was able to delete from ${table}`);
      } catch (e: any) {
        if (e.message.includes('FAIL')) throw e;
        console.log(`✅ DELETE on ${table} blocked:`, e.message);
      }
    }

    // 4. UUIDv7 test
    const uuidRes: any = await rootClient`SELECT nexora.uuid_generate_v7() as id`;
    const generatedId = uuidRes[0].id;
    // UUID format is 8-4-4-4-12 hex chars. V7 means the 3rd group starts with '7'.
    // The variant means the 4th group starts with '8', '9', 'a', or 'b'.
    const uuidParts = generatedId.split('-');
    if (uuidParts[2]?.[0] !== '7') {
      throw new Error(`FAIL: UUID is not v7. Generated: ${generatedId}`);
    }
    const variantChar = uuidParts[3]?.[0] || '';
    if (!['8', '9', 'a', 'b'].includes(variantChar)) {
      throw new Error(`FAIL: UUID variant is incorrect. Generated: ${generatedId}`);
    }
    console.log(`✅ UUIDv7 generation verified (id: ${generatedId})`);

    // Create dummy owner for further tests
    const ownerRes: any =
      await rootClient`INSERT INTO nexora.owners (name, email, password_hash, status) VALUES ('Test', 'test@test.com', 'hash', 'active') ON CONFLICT DO NOTHING RETURNING id`;
    const ownerId =
      ownerRes.length > 0
        ? ownerRes[0].id
        : (await rootClient<any[]>`SELECT id FROM nexora.owners LIMIT 1`)[0].id;

    // 5. Partial unique shift
    await rootClient`DELETE FROM nexora.shifts`;
    const shiftRes =
      await appClient`INSERT INTO nexora.shifts (owner_id) VALUES (${ownerId}) RETURNING id`;
    try {
      await appClient`INSERT INTO nexora.shifts (owner_id) VALUES (${ownerId})`;
      throw new Error('FAIL: Was able to create second open shift');
    } catch (e: any) {
      if (e.message.includes('FAIL')) throw e;
      console.log('✅ Partial unique index for shifts blocked second open shift:', e.message);
    }

    // 6. Stock pool check negative
    const catRes: any =
      await rootClient`INSERT INTO nexora.categories (name, slug) VALUES ('Test', 'test') ON CONFLICT DO NOTHING RETURNING id`;
    const catId =
      catRes.length > 0
        ? catRes[0].id
        : (await rootClient<any[]>`SELECT id FROM nexora.categories LIMIT 1`)[0].id;

    const prodRes: any =
      await rootClient`INSERT INTO nexora.products (category_id, name, price, delivery_type, stock_type, status) VALUES (${catId}, 'Test', 10, 'link', 'counted', 'active') RETURNING id`;
    const prodId = prodRes[0].id;

    try {
      await appClient`INSERT INTO nexora.stock_pools (product_id, available) VALUES (${prodId}, -5)`;
      throw new Error('FAIL: Was able to insert negative stock');
    } catch (e: any) {
      if (e.message.includes('FAIL')) throw e;
      console.log('✅ Negative stock prevented by CHECK constraint:', e.message);
    }

    // 7. Ledger entries accept negative values
    const walletRes: any =
      await rootClient`INSERT INTO nexora.wallets (owner_id) VALUES (${ownerId}) ON CONFLICT DO NOTHING RETURNING id`;
    const walletId =
      walletRes.length > 0
        ? walletRes[0].id
        : (await rootClient<any[]>`SELECT id FROM nexora.wallets WHERE owner_id=${ownerId}`)[0].id;

    await rootClient`INSERT INTO nexora.ledger_entries (wallet_id, kind, amount, business_date, source_type, source_id) VALUES (${walletId}, 'adjustment', -10.50, current_date, 'manual', ${ownerId})`;
    console.log('✅ Ledger entry accepted negative value (-10.50)');

    // Clean up login
    await appClient.end();
    await rootClient`ALTER ROLE nexora_app WITH NOLOGIN`;

    console.log('All tests passed successfully.');
  } finally {
    await rootClient.end();
  }
};

runVerification().catch((e) => {
  console.error(e);
  process.exit(1);
});
