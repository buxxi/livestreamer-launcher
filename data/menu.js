self.on("context", function(node, data) { 
	self.postMessage("load");
	return "Livestreamer";
});

self.on("click", function (node, data) {
	self.postMessage(data);
});