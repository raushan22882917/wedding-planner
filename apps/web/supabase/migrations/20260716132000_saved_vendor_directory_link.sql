-- A saved vendor is a private, wedding-specific selection. Keep its link to
-- the shared research record so a couple cannot add the same lead twice.

alter table public.saved_vendors
  add column if not exists source_directory_id uuid
    references public.vendor_directory(id) on delete set null;

create unique index if not exists saved_vendors_user_directory_unique
  on public.saved_vendors (user_id, source_directory_id)
  where source_directory_id is not null;
