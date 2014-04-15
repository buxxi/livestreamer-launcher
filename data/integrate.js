function getStreamObject() {
	var maxObject;

	function size(o) {
		return o.clientHeight * o.clientWidth;
	}

	var objects = document.querySelectorAll("object");
	for (var i in objects) {
		if (!maxObject || size(maxObject) < size(objects[i])) {
			maxObject = objects[i];
	    	}    
	}
	return maxObject;
}

self.port.on("replaceFlashWithLoading", function() {
	var stream = getStreamObject();

	var newObj = document.createElement("div");
	newObj.innerHTML = "Starting Livestreamer...";
	stream.parentNode.replaceChild(newObj, stream);
});



