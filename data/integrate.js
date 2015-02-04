function getStreamObject() {
	var maxObject;

	function size(o) {
		return o.clientHeight * o.clientWidth;
	}

	var objects = document.querySelectorAll("object,embed,video");
	for (var i in objects) {
		if (!maxObject || size(maxObject) < size(objects[i])) {
			maxObject = objects[i];
	    }    
	}
	return maxObject;
}

var stream;
var loading;

self.port.on("replaceFlashWithLoading", function(quality) {
	stream = getStreamObject();

	loading = document.createElement("div");
	loading.innerHTML = "Starting Livestreamer with quality " + quality;
	loading.style.fontSize = '24px';
	loading.style.fontWeight = 'bold';
	loading.style.background = 'black';
	loading.style.color = 'white';
	loading.style.textAlign = 'center';
	stream.parentNode.replaceChild(loading, stream); 
});

self.port.on("restoreFlash", function() {
	loading.parentNode.replaceChild(stream, loading);
	stream = null;
});

self.port.on("showError", function(event) {
	alert(event);
});



