# MIME Type to Directory Mappings

When categorizing files without clear extensions, rely on the output of `file --mime-type`.

## Documents (`/Documents`)
*   `application/pdf` -> `/Documents/PDFs`
*   `application/vnd.openxmlformats-officedocument.wordprocessingml.document` -> `/Documents/Word`
*   `application/msword` -> `/Documents/Word`
*   `text/plain` -> `/Documents/Text`
*   `text/markdown` -> `/Documents/Notes`

## Spreadsheets (`/Data`)
*   `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` -> `/Data/Excel`
*   `application/vnd.ms-excel` -> `/Data/Excel`
*   `text/csv` -> `/Data/CSV`

## Images (`/Images`)
*   `image/jpeg` -> `/Images/JPEG`
*   `image/png` -> `/Images/PNG`
*   `image/svg+xml` -> `/Images/Vector`
*   `image/heic` -> `/Images/HEIC`
*   `image/webp` -> `/Images/WebP`

## Archives (`/Archives`)
*   `application/zip` -> `/Archives`
*   `application/x-tar` -> `/Archives`
*   `application/gzip` -> `/Archives`
*   `application/x-7z-compressed` -> `/Archives`

## Code/Scripts (`/Scripts`)
*   `text/x-python` -> `/Scripts/Python`
*   `application/javascript` -> `/Scripts/JS`
*   `text/x-shellscript` -> `/Scripts/Bash`