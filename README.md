# Livestreamer Launcher #

A plugin for Firefox that utilizes Livestreamer (https://github.com/chrippa/livestreamer) to open streams in an external player direct from the streams page.

## Requirements ##
* Mozilla Add-On SDK (for building manually)
* Firefox
* Python
* Livestreamer

## Installation ##
1. Generate the xpi-file with `jpm xpi` from the root-folder
2. Open the xpi-file in Firefox from File->Open file to install the plugin
3. Go to the preference page for the plugin to verify that all paths has been set correctly

## Usage ##
Configure in settings the paths to Livestreamer and Python and your preferred quality.
On a page which Livestreamer supports, click on the icon in the toolbar to open the stream with Livestreamer.
The stream on the page will be replaced with a message, when closing the external player the stream will be restored.
