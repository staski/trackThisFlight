var datapoints;
var chart;
var subStartIndex = 0;
var drawChart;
var onMouseOverHandler;

google.load('visualization', '1.0', {'packages':['corechart']});
google.load('visualization', '1.0', {'packages':['controls']});



function UIInit(){
	datapoints = null;
}

function onMouseOverHandlerC3(e){
	var position = e.index - subStartIndex;
	setPlanePosition(position);
}

function onMouseOverHandlerGC(e) {
	//subStartIndex is always 0
	var position = e['row'];
	setPlanePosition(position);
}

function fileButtonClick() {
	var chartProvider = "c3";
	var params = (new URL(document.location)).searchParams;
	chartProvider = params.get("render_chart"); 
	
	if (chartProvider === "google"){
		drawChart = drawChartGC
		onMouseOverHandler = onMouseOverHandlerGC;
	} 
	else
	{
		drawChart = drawChartC3;
		onMouseOverHandler = onMouseOverHandlerC3;
	}		
	
	globalInit();
	$("#theFile").click();
}

function infoButtonClick () {
	toggleDisplaySteepTurns();
}		

function handleFiles(myfiles) {
	var thisFile = myfiles[0];
	var reader  = new FileReader();
	reader.readAsText(thisFile);
	reader.onloadend = function( ) {
		var xmlDoc = $.parseXML(reader.result);
		var parser = new GPXParser(xmlDoc);
		parser.addTrackpoints();
  
		datapoints = parser.pts;
		  
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

//draw the chart using the C3 library
function drawChartC3( flightName ) 
{
	var datetime = [];
	var vel = []; var ele = [];
	
	var maxEle = 0, maxSpeed = 0;
	
	// setting filter div to 0 since C3 displays filter in same 
	// element as the chart (chart_div)
	$("#chart_div").height("200px");
	$("#filter_div").height("0px");
	
	datetime [0] = "time";
	vel [0] = "velocity";
	ele [0] = "altitude";
	for ( var i = 0; i < datapoints.length; i++){
		var d = new Date(datapoints[i].time);
		datetime[i + 1] = d;

		vel[i + 1] = Math.round(datapoints[i].vel);
		ele[i + 1] = Math.round(datapoints[i].ele);
		if (vel[i + 1] > maxSpeed){ maxSpeed = vel[i+1];}
		if (ele[i + 1] > maxEle){ maxEle = ele[i+1];}
	}
	
	var ytick = [];
	for (var i = 0; i*1000 < maxEle; i++){
		ytick.push((i+1)*1000);
	}
	
	var chart = c3.generate({
    bindto: '#chart_div',
    data: {
      x: 'time',
      axes: {
      	altitude: 'y',
      	velocity: 'y2'
      },
      columns: [
		datetime, 
		vel, 
		ele
      ],
      onmouseover: function (d) { onMouseOverHandlerC3(d);}
    },
    axis: {
      	x: {
      		type: 'timeseries',
      		tick: {
      			count: 5,
      			format: '%d.%m.%y %H:%M:%S'
      		}
      	},
      	y: {
      		max: maxEle + 100,
      		label : {
      			text: 'altitude [ft]',
      			position: 'outer-middle'
      		},
      		tick :{
      			values: ytick
      		}
      	},
      	y2: {
      		show: true,
      		label : {
      			text: 'speed [kts]',
      			position: 'outer-middle'
      		}
      	}      	
    },
    point: {
    	show: false
    },
    tooltip: {
 		 format: {
    		value: function (value, ratio, id, index) { 
    				if (id === 'altitude') { return value + ' ft'; } else
    					return value + ' kts';
    				}	
  		}
	},
    subchart: {
    	size: {
    		height: 30
    	},
    	onbrush: function (domain) { 
    		var filteredData = this.data()[0].values.filter(function (e, i) {
                return (e.x >= domain[0] && e.x <= domain[1])
            }).map(function (e, i) {
                return e.index;
            })
            mapSetPoly(filteredData);
            subStartIndex = filteredData[0];
            },
    	show: true
    }
    
  });	
}

//draw the chart using the google charts library 
function drawChartGC( flightName ) 
{
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
					 'onmouseover', onMouseOverHandlerGC);
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

