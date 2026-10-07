#!/usr/bin/env bash
set -e

echo "--- Testing Idempotency ---"
# Run migrations twice
npx tsx server/modules/Platform/Database/migrate.ts
echo "First migration succeeded."
npx tsx server/modules/Platform/Database/migrate.ts
echo "Second migration succeeded - Idempotency confirmed."

echo "--- Testing pg_dump and restore ---"
DUMP_FILE="db_dump.sql"

# Using the docker setup to dump the db
docker exec nexora-project-postgres-1 pg_dump -U nexora -F c nexora > $DUMP_FILE
echo "Dump created successfully."

# Start a temporary postgres container for restore
docker run --name temp_pg_restore -e POSTGRES_USER=nexora -e POSTGRES_PASSWORD=password -e POSTGRES_DB=nexora -d postgres:17-alpine
echo "Started temporary postgres container. Waiting for initialization..."
sleep 5

# Restore to the temporary container
docker exec -i temp_pg_restore pg_restore -U nexora -d nexora < $DUMP_FILE
echo "Restore succeeded."

# Clean up
docker stop temp_pg_restore
docker rm temp_pg_restore
rm $DUMP_FILE

echo "pg_dump and restore verified successfully."
