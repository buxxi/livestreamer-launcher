const {components,Cc,Ci,Cu} = require("chrome");
const tabs = require("sdk/tabs");
const cm = require("sdk/context-menu");
const prefs = require("sdk/simple-prefs");
const system = require("sdk/system");
const io_file = require("sdk/io/file");
const self = require("sdk/self");

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");

function runLivestreamer(args, callback) {
    var commandFlag = system.platform == "winnt" ? "/c" : "-c";
    externalCommand(prefs.prefs.shellPath, [commandFlag, prefs.prefs.livestreamerPath + " " + args], callback);
}

function externalCommand(cmd, args, callback) {
	var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
	file.initWithPath(cmd);

	var process = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
	process.init(file);

	var tmpFile = FileUtils.getFile("TmpD", ["addon-external.tmp"]);
	tmpFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);

	args[args.length - 1] += " > " + tmpFile.path;

	process.runAsync(args, args.length, function(subject, topic, data) {
		NetUtil.asyncFetch(tmpFile, function(inputStream, status) {
			if (components.isSuccessCode(status)) {
				callback(NetUtil.readInputStreamToString(inputStream, inputStream.available()));
			}
			tmpFile.remove(false);
		});
	});

}

var lastUrl = "";
cm.Menu({
	label: "Livestreamer",
	contentScript: 	'self.on("context", function(node, data) { ' + 
			'	self.postMessage("load");' + 
			'});' + 
			'self.on("click", function (node, data) { ' + 
			'	self.postMessage(data);' +
			'});',
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

			runLivestreamer("--json " + url, function(data) {
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
			replaceFlashPlayer(url, quality, data);
		}
	}
});

function replaceFlashPlayer(url, quality, streamUrl) {
	var worker = tabs.activeTab.attach({
		contentScriptFile: self.data.url("integrate.js")
	});

	worker.port.emit("replaceFlashWithLoading");
	runLivestreamer(prefs.prefs.livestreamerArgs + " " + url + " " + quality, function(data) {});
}

function initPrefs() {
	function locateAny(files, callback) {
		var paths = system.env.PATH.split(":");
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
	}

	if (!prefs.prefs.livestreamerPath) {
		locateAny(["livestreamer"], function(path) {
			prefs.prefs.livestreamerPath = path;
		});
	}

	if (!prefs.prefs.shellPath) {
		locateAny(["bash", "cmd.exe"], function(path) {
			prefs.prefs.shellPath = path;
		});
	}
}

initPrefs();
