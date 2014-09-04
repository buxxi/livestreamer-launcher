const {components,Cc,Ci,Cu} = require("chrome");
const buttons = require('sdk/ui/button/action');
const tabs = require("sdk/tabs");
const toolbar = require("sdk/ui/toolbar");
const cm = require("sdk/context-menu");
const prefs = require("sdk/simple-prefs");
const {env} = require("sdk/system/environment");
const sys = require("sdk/system");
const io_file = require("sdk/io/file");
const self = require("sdk/self");

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

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
function replaceFlashPlayer(os, url, quality, streamUrl) {
	var worker = tabs.activeTab.attach({
		contentScriptFile: self.data.url("integrate.js")
	});

	worker.port.emit("replaceFlashWithLoading");
	runLivestreamer(os, [prefs.prefs.livestreamerArgs, url, quality], function(data) {});
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

/*
	Tries to open the best matching quality matching those specified by the user
*/
function openBestQuality() {
	var url = tabs.activeTab.url;
	runLivestreamer(os, ["--json", url], function(data) {
		data = JSON.parse(data);
		if ("error" in data) {
			console.log(data["error"]);
		} else {
			var qualities = prefs.prefs.quickOpenQuality.split(",");
			for (var i in qualities) {
				qualities[i] = qualities[i].trim();		
			}

			while (qualities.length > 0) {
				var preferred = qualities.shift();
				for (var quality in data["streams"]) {
					if (preferred == quality) {
						replaceFlashPlayer(os, url, quality, data);
						return;
					}
				}
			}
		}
	});
}

/*
	Create a context menu with only one subitem, if none were set from the beginning the menu wont appear when items have loaded.
	Use that first item to display error/status messages and append all the stream qualities below.
	It keeps track of which was the last used URL when the context menu was opened to know if it needs to check with livestreamer for new qualities.
*/
var lastUrl = "";
cm.Menu({
	label: "Livestreamer",
	contentScriptFile : self.data.url('menu.js'),
	items: [cm.Item({ label: "Initializing...", data: "load" })],
	onMessage: function(data) {
		var url = tabs.activeTab.url;

		var menu = this;
		if ("load" == data) {
			if (lastUrl == url) {
				return;
			}
			lastUrl = url;
			menu.items[0].label = "Loading stream qualities...";

			runLivestreamer(os, ["--json", url], function(data) {
				while (menu.items.length != 1) {
					menu.removeItem(menu.items[menu.items.length - 1]);
				}
				data = JSON.parse(data);
				if ("error" in data) {
					menu.items[0].label = data["error"];
				} else {
					menu.items[0].label = "Select stream below to open in external player";
					for (var quality in data["streams"]) {
						menu.addItem(cm.Item({ label: quality, data: data["streams"][quality]["url"] }));
					}
				}
			});
		} else {
			var quality;
			for (var i in menu.items) {
				if (menu.items[i].data == data) {
					quality = menu.items[i].label;
				}
			}
			replaceFlashPlayer(os, url, quality, data);
		}
	}
});

var button = buttons.ActionButton({
  id: "livestreamer-launcher",
  label: "Open with Livestreamer",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: openBestQuality
});

/*
	Detect the operating system and bootstrap the addon
*/
var os = sys.platform == "winnt" ? new Windows() : new Linux();
initPrefs(os);

