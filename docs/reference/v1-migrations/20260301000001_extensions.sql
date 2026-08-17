-- ============================================================================
-- Migration: extensions
-- Description: Enable required PostgreSQL extensions
-- Dependencies: None (first migration)
-- Sources: 001_extensions, 076_browse_extensions
-- ============================================================================

-- pgvector: vector data type and ivfflat/hnsw access methods for AI embeddings
create extension if not exists vector with schema extensions;

-- pg_trgm: trigram matching for fuzzy text search and typo tolerance
create extension if not exists pg_trgm schema extensions;

-- unaccent: text search dictionary for accent-insensitive matching
create extension if not exists unaccent schema extensions;
