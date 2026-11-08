-- GH#252 (NFR-SEC-05, FR-PRD-02): images up to 15 MiB, and HEIC/HEIF originals.
-- The private bucket keeps every original (the worker converts public images from it), so it must accept
-- HEIC/HEIF as well; the public bucket only receives the converted AVIF/WebP.
update storage.buckets
   set file_size_limit = 15728640
 where id in ('vcraft-media', 'vcraft-private');

update storage.buckets
   set allowed_mime_types = array['image/avif', 'image/webp', 'image/jpeg', 'image/png',
                                  'image/heic', 'image/heif', 'application/pdf']
 where id = 'vcraft-private';
