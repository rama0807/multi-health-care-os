-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create test database
CREATE DATABASE medicore_test;
GRANT ALL PRIVILEGES ON DATABASE medicore_test TO medicore;
