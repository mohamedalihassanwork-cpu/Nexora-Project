import 'dotenv/config';
import postgres from 'postgres';

const runVerification = async () => {
  // We use nexora as the DB name and standard postgres user for setup
  const rootClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  
  try {
    // 1. Give nexora_app login so we can test with it
    await rootClient`ALTER ROLE nexora_app WITH LOGIN PASSWORD 'testpass'`;
    
    // Create the DB URL for nexora_app
    const appUrl = process.env.DATABASE_URL!.replace('postgres:password', 'nexora_app:testpass');
    const appClient = postgres(appUrl, { max: 1 });
    
    console.log('--- Testing nexora_app restrictions ---');
    
    // 2. Cannot INSERT into public
    try {
      await appClient`CREATE TABLE public.test_table (id int)`;
      throw new Error('FAIL: Was able to create table in public');
    } catch (e: any) {
      if (e.message.includes('FAIL')) throw e;
      console.log('✅ INSERT/DDL into public blocked:', e.message);
    }
    
    // Create dummy owner to use in FKs
    const ownerRes = await rootClient`INSERT INTO nexora.owners (name, email, password_hash, status) VALUES ('Test', 'test@test.com', 'hash', 'active') RETURNING id`;
    const ownerId = ownerRes[0].id;

    // 3. Immutability trigger test
    const alRes = await rootClient`INSERT INTO nexora.audit_log (actor_type, action, entity_type, entity_id) VALUES ('system', 'test', 'test', '1') RETURNING id`;
    const logId = alRes[0].id;
    try {
      await appClient`UPDATE nexora.audit_log SET action = 'hacked' WHERE id = ${logId}`;
      throw new Error('FAIL: Was able to update audit_log');
    } catch (e: any) {
      if (e.message.includes('FAIL')) throw e;
      console.log('✅ UPDATE on immutable table blocked:', e.message);
    }
    
    // 4. Partial unique shift
    const shiftRes = await appClient`INSERT INTO nexora.shifts (owner_id) VALUES (${ownerId}) RETURNING id`;
    try {
      await appClient`INSERT INTO nexora.shifts (owner_id) VALUES (${ownerId})`;
      throw new Error('FAIL: Was able to create second open shift');
    } catch (e: any) {
      if (e.message.includes('FAIL')) throw e;
      console.log('✅ Partial unique index for shifts blocked second open shift:', e.message);
    }
    
    // 5. Stock pool check negative
    // Need category and product
    const catRes = await rootClient`INSERT INTO nexora.categories (name, slug) VALUES ('Test', 'test') RETURNING id`;
    const prodRes = await rootClient`INSERT INTO nexora.products (category_id, name, price, delivery_type, stock_type, status) VALUES (${catRes[0].id}, 'Test', 10, 'link', 'counted', 'active') RETURNING id`;
    
    try {
      await appClient`INSERT INTO nexora.stock_pools (product_id, available) VALUES (${prodRes[0].id}, -5)`;
      throw new Error('FAIL: Was able to insert negative stock');
    } catch (e: any) {
      if (e.message.includes('FAIL')) throw e;
      console.log('✅ Negative stock prevented by CHECK constraint:', e.message);
    }
    
    // 6. Ledger entries accept negative values
    const walletRes = await rootClient`INSERT INTO nexora.wallets (owner_id) VALUES (${ownerId}) RETURNING id`;
    await rootClient`INSERT INTO nexora.ledger_entries (wallet_id, kind, amount, business_date, source_type, source_id) VALUES (${walletRes[0].id}, 'adjustment', -10.50, current_date, 'manual', ${ownerId})`;
    console.log('✅ Ledger entry accepted negative value (-10.50)');
    
    // Clean up login
    await appClient.end();
    await rootClient`ALTER ROLE nexora_app WITH NOLOGIN`;
    
    console.log('All tests passed successfully.');
  } finally {
    await rootClient.end();
  }
};

runVerification().catch(console.error);
