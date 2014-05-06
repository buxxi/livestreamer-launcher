# Livestreamer Launcher #

A plugin for Firefox that utilizes Livestreamer (https://github.com/chrippa/livestreamer) to open streams in an external player direct from the streams page.

## Requirements ##
* Mozilla Add-On SDK (for building manually)
* Firefox
* Python
* Livestreamer

## Installation ##
1. Generate the xpi-file with `cfx xpi` from the root-folder
2. Open the xpi-file in Firefox from File->Open file to install the plugin
3. Go to the preference page for the plugin to verify that all paths has been set correctly

## Usage ##
On a page which livestreamer supports, right-click to bring up the context-menu, there you should see an entry named "Livestreamer".
When opening the context-menu the plugin loads all the available qualities and adds them to that menu entry.
Click an entry to open it in an external player.
