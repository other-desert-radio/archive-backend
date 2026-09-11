# Features

- Digital Ocean Droplet
- Responsibilities
  - Handle upload, post to MixCloud
    - possible FFMPEG parsing
    - UI for setting the start and stop times for each tracklist
  - Management website
  - Add metadata to shows
    - post to github via actions

Handle Upload:

a user can take a show's mp3 file and use the admin dashboard served by this
repository to upload the file along with metadata to mixcloud. when the upload
finishes, it'll return a mixcloud URL to us. we will take that URL and then the
user will input information about the show -- who the DJ was, things like that,
and store that into the database.

once that action is complete, we will generate a new JSON output and publish
that to the archive github pages repo via actions.
