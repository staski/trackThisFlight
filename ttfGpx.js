var pointarray = [];
var loops = [];

var poly;
var map;
var planePosition;
var offset = 0;
var planePositionIndex = 0;
var displaySteepTurns;

var maxlat, minlat, maxlon, minlon;

var firstCallFindSteepTurns = true;

function globalInit () {
	pointarray = [];
	crossings = [];
	loops = [];
	poly = null;
	map = null;
	planePosition = null;
	offset = planePostionIndex = 0;
	displaySteepTurns = false;
	firstCallFindSteepTurns = true;

    maxlat = 0;
    maxlon = 0;
    minlat = 10000;
    minlon = 10000;
    
    UIInit();
}

function latLngToDec(lat1, lat2, lat3) {
    return lat1 + lat2/60 + lat3 / 3600;
}

const K_factor = (2 * 3.14 * 18.52) / ( 36 * 9.81);

// the loop defined by the union of segments between the crossing of the start 
// segment (s, s+ 1) and the end segment (e, e + 1)
// note that some calculations are inaccurate as we assume the loop starts
// at point s and ends at point e. These inaccuracy is neglectable 
function Loop(s,e){
	var i, vel = 0;
	var minA = 1000000000, maxA = 0;
	var locs = [];
	
	this.entry = s;
	this.exit = e;
	this.altDiff = 0;
	this.avgSpeed = 0;
	this.length = 0;

	for (i = s; i < e + 1; i++){
		vel += pointarray[i].vel;
		if (pointarray[i].ele < minA){
			minA = pointarray[i].ele;
		}	
		if (pointarray[i].ele > maxA){
			maxA = pointarray[i].ele;
		}	
		locs[i - s] = pointarray[i].LatLng;	
	}
	
	// get the intersection between starting and closing segment and augment the resulting 
	// path by this point to get a circle. Note that the first element of the path gets 
	// replaced by this intersection point 
	var crossing = getIntersection(s,e);
	locs[0] = google.maps.geometry.spherical.interpolate(pointarray[s].LatLng, pointarray[s+1].LatLng, crossing);
	locs[e - s + 1] = locs[0];	
	this.locs = locs;
	this.avgSpeed = vel / (e - s + 1);
	this.altDiff = maxA - minA;
    
    this.area = google.maps.geometry.spherical.computeSignedArea(locs);
	this.length = google.maps.geometry.spherical.computeLength(locs);

	// this is somewhat inaccurate, see the introductory comment
	this.timeEntry = pointarray[this.entry].time;
	this.timeExit = pointarray[this.exit].time; 
	
	var duration = (this.timeExit - this.timeEntry)/1000;	
	this.bankAngle = Math.atan((K_factor * this.avgSpeed) / duration) * 180 / 3.14;	 
}

Loop.prototype.log = function() {
	var myLog = "Speed: " + Math.round(this.avgSpeed) +" kts; <br>";
	myLog += "Altitude: " + Math.round(this.altDiff) + " ft;<br>";
	myLog += "Length: " + Math.round(this.length) + " m;<br>";
	myLog += "Time: " + (this.timeExit - this.timeEntry) /1000 + " secs<br>";
	if (this.area >0)
	{
		myLog += " Left Turn; <br>";
	}
	else 
	{
		myLog += " Right Turn; <br>";
	}
	myLog += "Heading at entry: " + Math.round(pointarray[this.entry].heading);
	myLog += "<br>Heading at exit: " + Math.round(pointarray[this.exit].heading);  
	myLog += "<br>Average bank angle: " + Math.round(this.bankAngle);  
	
	return myLog;
} 

Loop.prototype.logInfo = function() {
	var myLog = "Loop from: " + this.entry  + " to " + this.exit + ";";
	myLog += "Speed: " + this.avgSpeed +" kts;";
	myLog += "Altitude: " + this.altDiff + " ft;";
	myLog += "Length: " + this.length + " m;";
	myLog += "Time: " + (pointarray[this.exit].time - pointarray[this.entry].time)/1000 + " secs";
	myLog += "Time1: " + (pointarray[this.exit + 1].time - pointarray[this.entry].time)/1000 + " secs";
	
	return myLog;
} 

Loop.prototype.setPolyline = function ( p ) {
	this.polyline = p;
}

Loop.prototype.getPolyline = function () {
	return this.polyline;
}

Loop.prototype.setInfowindow = function ( iw ) {
	this.infowindow = iw;
}

Loop.prototype.getInfowindow = function () {
	return this.infowindow;
}

function showLoops()
{
	var first = loops[0].entry; var last = loops[loops.length -1].exit;
	
	for (var i = 0; i < loops.length; i++){
		loops[i].show();
	}	
	map.fitBounds(getBounds(first, last));
}


Loop.prototype.show = function () {
	this.polyline = new google.maps.Polyline ();
	
	var polyOptions = {
    	strokeColor: '#ff0000',
    	strokeOpacity: 1.0,
    	strokeWeight: 2,
    	map: map,
	};

	var bounds = getBoundsForArray(this.locs, 0, this.exit - this.entry);

	var rectOptions = {
		bounds: bounds,
		fillColor: '#FF0000',
		fillOpacity: 0.1,
		strokeOpacity: 0.0,
		map: map,
	};
	
	this.polyline.setOptions(polyOptions);
	this.polyline.setPath(this.locs);

	var rect = new google.maps.Rectangle(rectOptions);

	var iw = new google.maps.InfoWindow({
    			content: this.log(),
  				position: rect.bounds.getNorthEast(),
  			});
	
	this.infowindow = iw;
	this.rect = rect;
	this.polyline.setVisible(true);

	this.l1 = rect.addListener('mouseover', function(){
  			iw.open(map);
  	});
  	
  	this.l2 = rect.addListener('mouseout', function () {
  		iw.close();
  	});  	
}

Loop.prototype.hide = function () {
	this.polyline.setVisible(false);
	this.rect.setVisible(false);
	google.maps.event.removeListener(this.l1);
	google.maps.event.removeListener(this.l2);
	
}
	

function hideLoops ( ) {
	for (var i = 0; i < loops.length; i++ ){
		loops[i].hide();
	}
}


	
function CLocTime(a,b,c,d,e,f,g){
    this.LatLng = a;
    this.ele = b;
    this.time = c;
    this.vel = d;
    this.velFromDist = e;
    this.heading = f;
    this.feetPerMinute= g;
}

CLocTime.prototype.log = function () {

    var myLog = "Time: " + new Date(this.time) + " ; ";
    myLog += "Heading: " + this.heading.toFixed() + " °; ";
    myLog += "GS: " + this.vel.toFixed() + " kts; ";
    myLog += "Altitude: " + this.ele.toFixed() + " ft; ";
    myLog += "Climbrate: " + this.feetPerMinute.toFixed() + " ft/min";

    return myLog;
}


GPXParser.prototype.getpoints = function () {
    return pointarray;
}

function GPXParser(xmlDoc)
{
    this.xmlDoc = xmlDoc;
    this.mintrackpointdelta = 0.0001;
    this.pts = pointarray;
}

GPXParser.prototype.addTrackpoints = function() {

    var tracks = this.xmlDoc.documentElement.getElementsByTagName("trk");
    for(var i = 0; i < tracks.length; i++) {
        this.addTrack(tracks[i]);
    }
}

GPXParser.prototype.addTrack = function(track) {
    var segments = track.getElementsByTagName("trkseg");
    var name = track.getElementsByTagName("name");
    for(var i = 0; i < segments.length; i++) {
        var segmentlatlngbounds = this.addTrackSegment(segments[i]);
    }
}

GPXParser.prototype.addTrackSegment = function(trackSegment)
{

    var lon, lat; 
    var ele, lastele;
    var speed; 
    var time = 0, oldtime = 0;
    var feetPerMinute = 0, lastFeetPerMinute = 0;
    var latlng, oldlatlng; 
    var heading = 0, oldheading = 0;
    var speedFromTrack, speedFromDist;
    var etmp;
    var trackpoints; 
    var dist = 0, totalDist = 0;
    var maxEle = 0;
    var maxSpeed=0;

    maxlat = 0;
    maxlon = 0;
    minlat = 10000;
    minlon = 10000;

    trackpoints = trackSegment.getElementsByTagName("trkpt");
    if (trackpoints.length == 0)
    {
            return; //latlngbounds;
    }

    var hasSpeed = trackpoints[0].getElementsByTagName("speed").length > 0 ? true : false;
    console.log(" hasSpeed: " + hasSpeed);

    speedFromDist = 0;

    for (var i=0; i < trackpoints.length; i++)
    {

            lon = parseFloat(trackpoints[i].getAttribute("lon"));
            lat = parseFloat(trackpoints[i].getAttribute("lat"));

            if (lon > maxlon) {
                maxlon = lon;	
            }
            if (lon < minlon){
                minlon = lon;
            }
            if (lat > maxlat) {
                maxlat = lat;	
            }
            if (lat < minlat){
                minlat = lat;
            }

            oldlatlng = latlng; 

            etmp = trackpoints[i].getElementsByTagName("ele");
            if (etmp.length > 0){
                ele = parseFloat(etmp[0].textContent);
            }
            etmp = trackpoints[i].getElementsByTagName("time");
            if (etmp.length > 0){
                time = Date.parse(etmp[0].textContent);
            }
            etmp = trackpoints[i].getElementsByTagName("speed");
            if (etmp.length > 0){
                speedFromTrack = (parseFloat(etmp[0].textContent) * 3600) / 1852;
            }

            ele = ele * 3.28084; // m => feet
            if (ele > maxEle)
            {
                maxEle = ele;
            }

            latlng = new google.maps.LatLng(lat, lon);

            if (i > 0) 
            {
                if (time > oldtime)
                {
                    dist = google.maps.geometry.spherical.computeDistanceBetween(
                                        latlng, oldlatlng);
                    totalDist += dist;
                    speedFromDist = dist * 1000 * 3600  / (1852 * (time - oldtime));

                    if (speedFromDist)
                    {
                        heading = google.maps.geometry.spherical.computeHeading(oldlatlng, latlng);
                        oldheading = heading;
                    } 
                    else // distance is too small to calculate proper heading
                    {	
                        heading = oldheading;
                    }	

                    feetPerMinute = (ele - lastele) * 60 * 1000/ (time - oldtime);

                    oldtime = time;
                    lastele = ele;
                    lastFeetPerMinute = feetPerMinute;

                } 
                else // time <= oldtime
                {
                    heading = oldheading;
                    feetPerMinute = lastFeetPerMinute;
                }				
            }  
            else 
            {
                heading = oldheading;
                lastele = ele;
                feetPerMinute = 0;
            }

            heading = ( heading + 360 )% 360; //make sure heading is between 0 and 360

            if (hasSpeed)
            {
                speed = speedFromTrack;

            }
            else
            {
                speed = speedFromDist;
            }	

            if (speed > maxSpeed)
            {
                maxSpeed = speed;
            }

            var clatlng = new CLocTime(latlng, ele, time, speed, speedFromDist, heading, feetPerMinute);

            pointarray.push(clatlng);
    }


}

// set the planes marker in the map using the selected position in the chart view
function setPlanePosition( i ){

	var k = i + offset; // offset is adjusted to the first index in the currently filtered
						// segment when this segment is displayed
	if (planePosition != null && k >= 0 && k < pointarray.length){
		planePosition.setPosition(pointarray[k].LatLng);
		
		$("#heading").text(new String(pointarray[k].heading.toFixed()) + " °");
		$("#groundspeed").text(new String(pointarray[k].vel.toFixed()) + " kts");
		$("#altitude").text(new String(pointarray[k].ele.toFixed()) + " ft");
		$("#climbrate").text(new String(pointarray[k].feetPerMinute.toFixed()) + "\tft/min");
		
		planePositionIndex = k;
	}
}

function getPlanePositionIndex() {
	return planePositionIndex;
}

// get the bounds of any segment in the track
function getBounds(firstIndex, lastIndex)
{
var maxlat = 0;
	var	maxlng = 0;
	var	minlat = 10000;
	var	minlng = 10000;
	var bounds;
	
	for (var i = firstIndex; i < lastIndex; i++)
	{
		var lat = pointarray[i].LatLng.lat();
		var lng = pointarray[i].LatLng.lng();
		if (lat > maxlat)
		{
			maxlat = lat;
		} 
		if (lat < minlat)
		{
			minlat = lat;
		}
		if (lng > maxlng)
		{
			maxlng = lng;
		}
		if (lng < minlng)
		{
			minlng = lng;
		}
	}
	
	bounds = new google.maps.LatLngBounds(new google.maps.LatLng(minlat, minlng), 
										  new google.maps.LatLng(maxlat, maxlng));	
	
	return bounds;} 


// get the bounds of any segment in the track
function getBoundsForArray(a)
{
	var maxlat = 0;
	var	maxlng = 0;
	var	minlat = 10000;
	var	minlng = 10000;
	var bounds;
	
	for (var i = 0; i < a.length; i++)
	{
		var lat = a[i].lat();
		var lng = a[i].lng();
		if (lat > maxlat)
		{
			maxlat = lat;
		} 
		if (lat < minlat)
		{
			minlat = lat;
		}
		if (lng > maxlng)
		{
			maxlng = lng;
		}
		if (lng < minlng)
		{
			minlng = lng;
		}
	}
	
	bounds = new google.maps.LatLngBounds(new google.maps.LatLng(minlat, minlng), 
										  new google.maps.LatLng(maxlat, maxlng));	
	
	return bounds;
} 

// return true if (i,i+1) crosses (k,k+1)
function isCrossing(i, k){
	
	if ( i == k || i == k + 1 || i == k - 1){
		return false;
	}
	
	
	var path1 = [pointarray[i].LatLng, pointarray[i + 1].LatLng, pointarray[k].LatLng];
	var path2 = [pointarray[i].LatLng, pointarray[i + 1].LatLng, pointarray[k + 1].LatLng];
	var path3 = [pointarray[k].LatLng, pointarray[k + 1].LatLng, pointarray[i].LatLng];
	var path4 = [pointarray[k].LatLng, pointarray[k + 1].LatLng, pointarray[i + 1].LatLng];
	
	var area1 = google.maps.geometry.spherical.computeSignedArea(path1);
	var area2 = google.maps.geometry.spherical.computeSignedArea(path2);

	var area3 = google.maps.geometry.spherical.computeSignedArea(path3);
	var area4 = google.maps.geometry.spherical.computeSignedArea(path4);
	var s1 = area1 * area2; var s2 = area3 * area4;
	
	if ((s1 < 0) && (s2 < 0))
	{
		// exclude some pathological cases
		// otherwise rounding errors in computeSignedArea can lead
		// two wrong results
		if (s1 < -1 && s2 < -1){
			return true;
		} 
	}
	
	return false;
}

// when segments (i,i+1) and (k,k+1) cross each other, return
// the intersection point as the interpolation on the first segment 
// (i,i+1)
// determine the intersection point by the Cramer-rule
function getIntersection (i, k) {
	var det = dx(i,i + 1) * dy(k,k + 1) - dx(k, k +1 ) * dy(i, i + 1);
	var s = dx(i,k) * dy (k,k + 1) - dx(k,k + 1) * dy(i, k); s = s / det;
	var t = dy(i,k) * dx (i,i + 1) - dy(i,i + 1) * dx(i, k); t = t / det;
	return s;
}

// the longitudinal distance between points i and k
function dx(i, k){
	var latlng = new google.maps.LatLng(pointarray[i].LatLng.lat(), pointarray[k].LatLng.lng());
	var sign = (pointarray[k].LatLng.lng() > pointarray[i].LatLng.lng()) ? 1 : -1;
	return sign * google.maps.geometry.spherical.computeDistanceBetween(pointarray[i].LatLng, latlng);
}

// the lateral distance between points i and k
function dy(i, k){
	var latlng = new google.maps.LatLng(pointarray[k].LatLng.lat(), pointarray[i].LatLng.lng());
	var sign = (pointarray[k].LatLng.lat() > pointarray[i].LatLng.lat()) ? 1 : -1;
	return sign * google.maps.geometry.spherical.computeDistanceBetween(latlng, pointarray[i].LatLng);
}

function mapInit() {

	var centerOfMap = pointarray[0].LatLng;

	var latLngBnds = new google.maps.LatLngBounds(new google.maps.LatLng(minlat, minlon),
		new google.maps.LatLng(maxlat, maxlon));

	centerOfMap = new google.maps.LatLng((maxlat + minlat)/2, (maxlon + minlon)/2);
	var mapOptions = {
		streetViewControl: false ,
		fullscreenControl: true , 
    	zoom: 8	,
	};

	map = new google.maps.Map(document.getElementById('map-canvas'),
    	  mapOptions);
	map.fitBounds(latLngBnds);

	var polyOptions = {
   		strokeColor: '#FF0000',
    	strokeOpacity: 1.0,
    	strokeWeight: 2,
    	map: map,
	};

	poly = new google.maps.Polyline(polyOptions);

	var path = [];
	for (var i = 0; i< pointarray.length; i++){
    	path.push(pointarray[i].LatLng);
	}

	poly.setPath(path);

	var image = 'blueDotSmall.png';

	planePosition = new google.maps.Marker({
		position: pointarray[0].LatLng,
 		map: map,
 		icon: image
	});
}	


function mapSetPoly(rows) {

	var centerOfMap;
	var mapBounds;

	var path = [];
	poly.setVisible(false);

	console.log(rows);
	for (var i = 0; i< rows.length; i++){
    	path.push(pointarray[rows[i]].LatLng);
	}

	mapBounds = getBounds(rows[0], rows[rows.length - 1]);
	centerOfMap = mapBounds.getCenter();

	offset = rows[0];

	var polyOptions = {
    	strokeColor: '#FF0000',
    	strokeOpacity: 1.0,
    	strokeWeight: 2,
    	map: map,
	};


	map.setCenter(centerOfMap);
	map.fitBounds(mapBounds);

	poly = new google.maps.Polyline(polyOptions);
	poly.setPath(path);
	setPlanePosition(0);
	poly.setVisible(true);

}

function toggleDisplaySteepTurns(){
	
	if (firstCallFindSteepTurns == true){
		// every loop closed in less than 90 seconds is considered to be a steep turn
		findSteepTurns(0, pointarray.length, 90);
		firstCallFindSteepTurns = false;
	}
	
	if (loops.length == 0){ return; }
		
	if (displaySteepTurns == false){
		showLoops();
		displaySteepTurns = true;
	} else {
		hideLoops ();
		displaySteepTurns = false;
	}	
}	

function findSteepTurns(s,e, maxseconds)
{
	var totalCrossings = 0;
	var lastStart = s;
	var lastExit = e;
	
	for (var i = s; i < e - 1; i++){
		var starttime = pointarray[i].time; 

    	for (var k = i + 2; k < e - 1; k++){

    		var timediff = pointarray[k].time - starttime;

    		if (timediff > (maxseconds * 1000))
    		{
    			break;
    		}
    		
    		if (isCrossing(i,k) == true){
    			if (k < lastExit && lastExit != e){
    				loops.pop();
    			}
    			var l = new Loop (i, k);
    			loops.push(l); 
    			totalCrossings++; 
    			lastExit = k; 
    			break;
    		}
		}
	}
	for (i = 0; i < loops.length; i++)
	{
		console.log("loop[" + i + "]" + loops[i].log());
	}
}

function displayFlightInfos() {
	return;
}

