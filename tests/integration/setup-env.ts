import { loadEnv } from "../../scripts/env";
loadEnv();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/lootbox_test";
process.env.DATA_ENCRYPTION_KEY ??= "11".repeat(32);
process.env.SESSION_SECRET ??= "22".repeat(32);
process.env.FEATURE_BOTS_ENABLED = "false";
