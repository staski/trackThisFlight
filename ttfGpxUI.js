var datapoints;
var chart;
var position;

google.load('visualization', '1.0', {'packages':['corechart']});
google.load('visualization', '1.0', {'packages':['controls']});

function UIInit(){
	datapoints = null;
}
function onMouseOverHandler(e) {
	position = e['row'];
	//console.log(position);
	setPlanePosition(position);
}

function fileButtonClick() {
	globalInit();
	$("#theFile").click();
}

function infoButtonClick () {
	toggleDisplaySteepTurns();
}		

function handleFiles(myfiles) {
	var thisFile = myfiles[0];
	console.log(thisFile.name);
	var reader  = new FileReader();
	reader.readAsText(thisFile);
	reader.onloadend = function( ) {
		var xmlDoc = $.parseXML(reader.result);
		var parser = new GPXParser(xmlDoc);
		parser.addTrackpoints();
  
		datapoints = parser.pts;
		console.log(datapoints.length);
		  
		$( "div" ).remove('#button-canvas');
		$( "#dashboard_div" ).removeAttr("hidden");
		//initAeroDromes ();		  		
		mapInit();
		setPlanePosition(0);

		$("#heading").css("visibility", "visible");
		$("#altitude").css("visibility", "visible");
		$("#groundspeed").css("visibility", "visible");
		$("#climbrate").css("visibility", "visible");
		$("#bNewFlight").css("visibility", "visible"); 
		$("#bInfo").css("visibility", "visible"); 
		
		drawChart(thisFile.name);

	}
}		
	
function drawChart( flightName ) 
{
	position = 0;
	var data = new google.visualization.DataTable();

	data.addColumn('datetime', 'Datetime');
	data.addColumn('number', 'Altitude');
	data.addColumn('number', 'Speed');

	for (var i = 0; i < datapoints.length; i++)
	{
		data.addRow([new Date(datapoints[i].time), 
					 datapoints[i].ele,
					 datapoints[i].vel
					]);
	}
			
	var lineChartOptions = { 
		chart: {
			title: flightName
			},
		crosshair : {
			orientation: 'both',
			trigger: 'both' 
			},
		series: {
			// Gives each series an axis name that matches the Y-axis below.
			0: {targetAxisIndex: 0},
			1: {targetAxisIndex: 1},
			2: {targetAxisIndex: 1}          					
			},
		hAxis: {
			viewWindowMode: 'maximized',
			//gridlines: {
			//	color:  '#f00',
			//}
			},
		vAxes: {
			// Adds labels to each axis; they don't have to match the axis names.
			0: {title: 'Altitude (ft)'        				},
			1: {title: 'Groundspeed (kts)'        				}
			}      
		};
			
		var chartRangeFilterOptions = { 
			filterColumnIndex: 0,
			series: {
				0: {targetAxisIndex: 0}
				},
			ui : {
				snapToData : true
				}
		};
		
		
		var dashboard = new google.visualization.Dashboard(document.getElementById('dashboard_div'));					
			
		// Create a range slider, passing some options
		var chartRangeSlider = new google.visualization.ControlWrapper({
								'controlType': 'ChartRangeFilter',
								'containerId': 'filter_div',
								'options': chartRangeFilterOptions
								});
			
		// Instantiate and draw our chart, passing in some options.
		chart = new google.visualization.ChartWrapper({
				'chartType': 'LineChart',
				'containerId': 'chart_div',
				'options' : lineChartOptions			 
				});
		
		dashboard.bind(chartRangeSlider, chart);
		dashboard.draw(data);
			
		google.visualization.events.addListener(chart, 'ready', function (e) {
				google.visualization.events.addListener(chart.getChart(),
					 'onmouseover', onMouseOverHandler);
			});
			
		google.visualization.events.addListener(chartRangeSlider, 'statechange', 
			function(e) {
				var state = chartRangeSlider.getState();
				var rows = data.getFilteredRows([{
					column: 0,
					minValue: state.range.start, 
					maxValue: state.range.end
					}]);
				mapSetPoly(rows);
			});

}
