-- Enable required extensions only. Tables come in later migrations.
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
