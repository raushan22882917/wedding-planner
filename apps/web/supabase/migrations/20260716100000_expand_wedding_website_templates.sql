-- Allow the complete invitation template library to be persisted.
ALTER TABLE public.wedding_websites
  DROP CONSTRAINT IF EXISTS wedding_websites_card_design_check;

ALTER TABLE public.wedding_websites
  ADD CONSTRAINT wedding_websites_card_design_check
  CHECK (card_design IN (
    'editorial', 'botanical', 'midnight', 'terracotta', 'coastal', 'regency',
    'modern-minimal', 'celestial', 'marigold', 'vintage', 'monogram', 'lavender',
    'tropical', 'pearl', 'art-deco', 'autumn', 'rosewater', 'desert', 'emerald',
    'citrus', 'atlas', 'blush', 'heritage', 'starlight'
  ));
