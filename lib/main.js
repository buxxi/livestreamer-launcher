const {components,Cc,Ci,Cu} = require("chrome");
const buttons = require('sdk/ui/button/action');
const tabs = require("sdk/tabs");
const toolbar = require("sdk/ui/toolbar");
const prefs = require("sdk/simple-prefs");
const {env} = require("sdk/system/environment");
const sys = require("sdk/system");
const io_file = require("sdk/io/file");
const self = require("sdk/self");

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

/*
	Tries to open a video in with livestreamer
*/
function showVideoInLivestreamer(os, url, quality, callback) {
	runLivestreamer(os, [prefs.prefs.livestreamerArgs, url, quality], callback);	
}

/*
	Create a temporary file which will contain the output from livestreamer.
	It makes a call to python which creates a subprocess of livestreamer with the output redirect, this is done like this so it wont open a cmd.exe window in windows.
*/
function runLivestreamer(os, args, callback) {
	var tmpFile = FileUtils.getFile("TmpD", ["addon-external.tmp"]);
	tmpFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
	var a = [os.quote(prefs.prefs.livestreamerPath)].concat(args);
	var cmd = "import subprocess; tmp = open('" + os.quote(tmpFile.path) + "','w'); subprocess.call(" + os.subProcessCall(a) + ", shell = True, stdout = tmp, stdin=subprocess.PIPE); tmp.close()";	
	externalCommand(prefs.prefs.pythonPath, ["-c", cmd], tmpFile, callback);
}

/*
	Execute another program as a separate process and read the output from the temporary file provided.
	It will wait until the other process have finished before making the callback.
*/
function externalCommand(cmd, args, tmpFile, callback) {
	var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
	file.initWithPath(cmd);

	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	process.init(file);

	process.runAsync(args, args.length, function(subject, topic, data) {
		NetUtil.asyncFetch(tmpFile, function(inputStream, status) {
			if (components.isSuccessCode(status)) {
				callback(NetUtil.readInputStreamToString(inputStream, inputStream.available()));
			}
			tmpFile.remove(false);
		});
	});
}

/*
	Call a script in the active tab to modify the player and open the stream in VLC.
	The page is modified so we don't have to pause the stream on the web page manually.
*/
function replaceFlashPlayer(worker, quality) {
	worker.port.emit("replaceFlashWithLoading", quality);
}

/*
	When the user closes the player, restore the flash player that was displaying before
*/
function restoreFlash(worker) {
	worker.port.emit("restoreFlash");
}

/*
	Call a script in the active tab to display the error message
*/

function showError(worker, message) {
	worker.port.emit("showError", message);
}

/*
 	Definitions of the different supported operating systems since some small things differs, all implementations should have the same methods.
*/
function Windows()  {
	this.subProcessCall = function(args) {
		return "['" + args.join("','") + "']";
	}

	this.envPaths = function() {
		return env.PATH.split(";");
	}

	this.quote = function(path) {
		return path.replace(/\\/g,"\\\\");
	}		
}

function Linux() {
	this.subProcessCall = function(args) {
		return "'" + args.join(" ") + "'";
	}

	this.envPaths = function() {
		return env.PATH.split(":");
	}

	this.quote = function(path) {
		return path;
	}
}

/*
	Try to auto locate paths for the executables needed by searching through the PATH-environmental variable
*/
function initPrefs(os) {
	function locateAny(files, callback) {
		try {
			var paths = os.envPaths();
			for (var p in paths) {
				var path = paths[p];
				for (var f in files) {
					var file = files[f];
					var abspath = io_file.join(path, file);
					if (io_file.exists(abspath)) {
						callback(abspath);
					}
				}
			}
		} catch(err) {
			console.log("Failed to locate any of " + files);
		}
	}

	if (!prefs.prefs.livestreamerPath) {
		locateAny(["livestreamer", "livestreamer.exe"], function(path) {
			prefs.prefs.livestreamerPath = path;
		});
	}

	if (!prefs.prefs.pythonPath) {
		locateAny(["python", "pythonw.exe"], function(path) {
			prefs.prefs.pythonPath = path;
		});
	}
}

function getMatchingPreferredQuality(data) {
	var qualities = prefs.prefs.quickOpenQuality.split(",");
	for (var i in qualities) {
		qualities[i] = qualities[i].trim();		
	}

	while (qualities.length > 0) {
		var preferred = qualities.shift();
		for (var quality in data["streams"]) {
			if (preferred == quality) {
				return quality;	
			}
		}
	}
	return null;
}

/*
	Tries to open the best matching quality matching those specified by the user
*/
function openPreferredQuality() {
	var url = tabs.activeTab.url;
	var worker = tabs.activeTab.attach({
		contentScriptFile: self.data.url("integrate.js")
	});
	runLivestreamer(os, ["--json", url], function(data) {
		data = JSON.parse(data);
		if ("error" in data) {
			showError(worker, data["error"]);
		} else {
			var quality = getMatchingPreferredQuality(data);
			if (quality != null) {
				replaceFlashPlayer(worker, quality);
				showVideoInLivestreamer(os, url, quality, function() {
					restoreFlash(worker);
				});
			} else {
				showError(worker, "Found no matching quality for your settings");
			}
		}
	});
}

var button = buttons.ActionButton({
	id: "livestreamer-launcher",
	label: "Open with Livestreamer",
	icon: {
		"16": "./icon-16.png",
		"32": "./icon-32.png",
		"64": "./icon-64.png"
	},
	onClick: openPreferredQuality
});

/*
	Detect the operating system and bootstrap the addon
*/
var os = sys.platform == "winnt" ? new Windows() : new Linux();
initPrefs(os);

