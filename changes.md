# Changes Log

## 1.0.0

* Initial Release.

## 1.1.0

* Added Docker support.
* Added command-line interface.

## 1.2.0

* Initial git release.
* Greatly improved support for images.

## 1.3.0

* Improved handling of unordered lists. (fixes #1)
* Refactored code for readability.
* Fixed an issue where some paths for images wouldn't properly resolve.
* Introduced admonitions. They will look like regular blockquotes in normal rendered markdown, but will have special styling in PDF. (closes #2)
* Tweaked styles for increased readability and broke out some hardcoded styles into the stylesheet.
* Improved the command line interface to include support for folders, custom page sizes and custom margins.

## 1.4.0

* Added an imgsize argument for specifying the maximum allowed image size. (closes #4)
* Added 'Important' as a warning-class keyword for admonitions. (closes #5)
* Added 'linkify' to markdown-it to auto-convert urls to links. (closes #3)
* Added a top margin to headings. (closes #6)