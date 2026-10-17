-- AKTİVA Mal Kabul: bu komutu Supabase SQL Editor'de yalnızca bir kez çalıştırın.
-- Mevcut satırlar korunur; eski ürün kayıtları sayılmış kabul edilir.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS count_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS counted_at timestamptz;
UPDATE public.products SET count_completed = true
 WHERE count_completed = false AND created_at < now() - interval '1 minute';
