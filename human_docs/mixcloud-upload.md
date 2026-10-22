# Mixcloud Upload

here's the plan for mixcloud upload.

we need to support a lot of things for this.

1. mixcloud page

there will be a new section in the side bar called "Utils" there will be a
subentry called upload.

this upload page will have a way to sign into mixcloud and a way to upload a new
show.

figma designs will be provided for this.

proposed chunks:

1a. update side bar, create mixcloud page 1b. add banner for mixcloud sign in
1c. integrate mixcloud OAuth 2.0

- update .env and .env.sample for mixcloud keys
- get it working end to end, sign in a user and store sessions keys. probably
  use 3rd party framework for oauth 1d. enable signout of mixcloud

2. mixcloud upload

there will be a form for uploading to mixcloud. the user can upload an audio, an
image, and all the fields required by mixcloud.

mp3Required The audio file. No larger than 4.0GB. nameRequired The title of the
show. picture Cover art for the show. No larger than 10.0MB. description A
description for the show. Up to 1000 characters. tags-X-tag A tag name, where X
is a number from 0 to 4. Up to 5 tags per show. These are usually genres — the
upload flow on the site suggests a curated list that helps people find your
show, but you can use any tags you like.

2a. research

research what the endpoint takes. Opens: [ ] what format for image -- can we
upload webp? [ ] how are tags laid out? [ ] How can we coellate with existing
tags? [ ] what does the endpoint return? [ ] how do we correlate an upload with
an entry in the mixcloud import table and with a generated show (it'd be AWESOME
if they gave us mixcloud key back)

2b. build modal

---

that's it for now. as we work I will fill more of this out
