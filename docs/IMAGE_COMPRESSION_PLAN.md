# Image Compression Plan

## Goal

Store reusable square WebP variants for archive images. DJ images will finish
with only nullable `image_small` and `image_large` byte columns. The original
upload is transient; future browser cropping will submit an already-mutated
square image.

## Decisions

- Use Sharp with WebP quality 82.
- Generate exact 400 by 400 and 1024 by 1024 images, center-cropping and
  enlarging when necessary.
- Retain no original DJ image or filename after the final cleanup migration.
- Keep the create-DJ response and image endpoint URL. The endpoint serves the
  large WebP.
- Limit uploads to 1.5 MiB in both the UI and API.
- Do not show compressed image sizes in the onboarding modal.
- Keep archive asset paths under `assets/djs/`.

## Incremental Checklist

- [x] Study the exploratory branch and current implementation.
- [x] Add the plan document and generic Sharp image-variant helper with tests.
- [x] Add and backfill `image_small` and `image_large` in migration `0015`,
      while temporarily retaining existing originals for safe rollout.
- [x] Write new DJ uploads as variants, serve the large WebP, and enforce the
      1.5 MiB upload limit in the API and onboarding modal.
- [x] Export stored small and large variants without image processing or
      database writes during archive export.
- [ ] Drop the transitional original-image columns in migration `0016` and
      remove obsolete code, types, and fixtures.

Every unchecked item is a separate implementation and review checkpoint.
