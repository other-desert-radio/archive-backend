# DJ table view

This document outlines the DJ table view and DJ onboarding screen. Much of this
logic and design language is to be shared across the tags and shows table views.

## DJ Table design

Black sidebar to the left. when DJs is active, that text on the sidebar is
bolded.

[figma](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=174-762&t=0oHWxo2QTkQR34BY-4)

starting from top to bottom:

there is a horizontal flex where 3 elements will live: search, grid | table, +
DJ

search allows the user to search by any keyword -- name, image, id, tags, etc.
when an item matches, the text that it matches on in the row is bolded. (that's
a nice to have, not a base level priority).

grid | table allows the user to switch between seeing these items in a grid or
as a table. its a segmented control like on iOS. for now, only table is
supported but the segmented control remains.

on the right is +DJ. this pops a modal up to onboard a DJ. to be discussed lated
in ## DJ Onboard design.

### table

the table has inner borders with center alligned headers. when a header is
"active" (the table is sorting by it), it is bold and the dropdown arrow is
filed in. clicked again, it toggle sort descending or ascending. in the figma
design, ID is sorted by descending. when not active, its normal font weight with
an outlined arrow. only one can be selected at a time.

this view is dense, overflow scrolls to the right.

the image column shows the URL of the image. local URLs are supported for the
time being (i.e. file paths).

## DJ Onboard Design

this modal is for onboarding a DJ.
[figma](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=207-1052&t=0oHWxo2QTkQR34BY-4)

there is a black transparent overlay on the background.

starting from top to bottom; onboard DJ and the x button to close live in a flex
box.

every field in the form lives in a flex box too. name -> input, image -> button.
those are 2 flex boxes.

image accepts a JPEG, PNG, or WebP file through drag and drop or the file
picker. The file itself is submitted to the API; browsers do not expose a
reliable local filesystem path.

If DJ creation fails, the modal shows the HTTP status and the API's error
description when one is available, so the problem can be corrected or reported
with useful context.

### tags

[figma](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=205-890&t=0oHWxo2QTkQR34BY-4)

tags is its own react component.

as you type in a tag, a dropdown of existing tags matching your typing shows up.
the user can click them to fill it in.

nice to have: grayed out text autocompleting the tag. if the user presses tab it
fills in the whole tag.

if the user copy and pastes a comma seperated list or types with commas, the
drop down dissapears and when they press enter or change focus to another input
cell, the tags are extracted by splitting via commas and trimming whitespace.

the resulting tags are buttons the user can hit `x` on to remove the tag.

if the tag doesn't exist -- text and border go red. and gray subtext appears

> the tag “foobar” does not exist elsewhere. it will be created after submit.

### Form

back to the form, socials and bio support rich text.

nice to have: bold and italic button

base level: just support normal text with indentations and stuff.

submitting saves the DJ into the database

## endpoints

/dj/create

this is the create endpoint. post as JSON using the fields contrainted by the
JSON transformer.

break that type out and make it more generic.

do the create endpoint last.

/dj/modify this will be for modifying a DJ. eventually the rows will be
editiable. thats under really nice to have.

## misc

break these up into priorities: base level, nice to have, really nice to have.
