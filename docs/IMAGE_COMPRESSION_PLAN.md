# Image Compression Plan

## Goal

Store reusable square WebP variants for archive images. DJ images will finish
with only nullable `image_small` and `image_large` byte columns. The original
upload is transient; future browser cropping will submit an already-mutated
square image.

## Decisions

- Use Sharp with WebP quality 82.
- The browser crops the supplied WebP to 1200 by 1200; Sharp generates exact 400
  by 400 and 1024 by 1024 derivatives from that crop.
- Retain no original DJ image or filename after the final cleanup migration.
- Expose `image_small` and `image_large` in the admin DJ response. Variant
  routes serve their matching WebPs, while the old image route remains a large
  image alias.
- Let the browser crop and convert source uploads before submission; do not
  impose an image-byte limit.
- Do not show compressed image sizes in the onboarding modal.
- Keep archive asset paths under `assets/djs/`.

## Incremental Checklist

- [x] Study the exploratory branch and current implementation.
- [x] Add the plan document and generic Sharp image-variant helper with tests.
- [x] Add and backfill `image_small` and `image_large` in migration `0015`,
      while temporarily retaining existing originals for safe rollout.
- [x] Write new DJ uploads as variants, serve the large WebP, and crop source
      images in the onboarding modal before submission.
- [x] Export stored small and large variants without image processing or
      database writes during archive export.
- [x] Drop the transitional original-image columns in migration `0016` and
      remove obsolete code, types, and fixtures.

Every unchecked item is a separate implementation and review checkpoint.
