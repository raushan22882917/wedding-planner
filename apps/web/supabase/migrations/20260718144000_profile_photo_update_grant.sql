-- Photo paths are written only through the authenticated profile server
-- function. Restore the column grant after the subscription migration's
-- narrower UPDATE grant so a missing portrait can be replaced.
grant update (partner_one_photo_path, partner_two_photo_path)
  on public.profiles to authenticated;
