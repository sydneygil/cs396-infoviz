// Layout variables
let width = 750,
    height = 450;
let margin = { top: 20, right: 15, bottom: 30, left: 40 };
let w = width - margin.left - margin.right;
let h = height - margin.top - margin.bottom;

// Map visualization variables
let states;
let projection, generator, map;

// Data visualization variables
let dataset, ranges, filter_query;
let tooltip, x, y, col;
let attributes = ["date", "fatalities", "injured", "total_victims", "age_of_shooter", "latitude", "longitude", "year"]
// let attributes = ["case", "location", "date", "summary", "fatalities", "injured", "total_victims", "location", "age_of_shooter", "prior_signs_mental_health_issues", "mental_health_details", "weapons_obtained_legally", "where_obtained", "weapon_type", "weapon_details", "race", "gender", "sources", "mental_health_sources", "sources_additional_age", "latitude", "longitude", "type", "year"]
let dateParser = d3.timeParse("%-m/%-d/%Y");

async function setup() {
    // Load US states map data
    states = await d3.json("states.json");

    // Setup projection, generator, and map
    projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(states, states.objects.usStates));
    generator = d3.geoPath().projection(projection);
    map = d3.select("#visualization").append("svg")
        .attr("width", width)
        .attr("height", height);

    // Draw the states
    map.append("path")
        .attr("class", "states")
        .datum(topojson.feature(states, states.objects.usStates))
        .attr("d", generator);

    // Initialize the data visualization
    initialize()
}

async function initialize() {
    // Read and clean data
    let crime = await d3.csv("mass_shootings.csv");
    crime.forEach(function(d) {
        d.date = dateParser(d.date)
        d.fatalities = +d.fatalities;
        d.injured = +d.injured;
        d.total_victims = +d.total_victims;
        d.age_of_shooter = +d.age_of_shooter;
        d.latitude = +d.latitude;
        d.longitude = +d.longitude;
        d.year = +d.year;
    });
    dataset = crime;

    // Extract data statistics
    ranges = {};
    filter_query = [];
    for (let attr of attributes) {
        let column = dataset.map(d => d[attr]);
        ranges[attr] = [
                d3.min(column),
                d3.max(column)
            ]
        // Initialize filter query to full ranges
        filter_query.push({
            key: attr,
            range: [
                ranges[attr][0],
                ranges[attr][1]
            ]
        })
    }

    // // get scales
    // x = d3.scaleLinear()
    //     .domain([0, (Math.ceil(ranges.price[1] / 50) + 1) * 50]) // some offset
    //     .range([0, w]);

    // y = d3.scaleLinear()
    //     .domain([0, (Math.ceil(ranges.eValue[1] / 50) + 1) * 50]) // some offset
    //     .range([h, 0]);

    // col = d3.scaleOrdinal(d3.schemeCategory10);

    // // chart object
    // chart = d3.select(".chart")
    //     .attr("width", width)
    //     .attr("height", height + 15)
    //     .append("g")
    //     .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // // initiate tooltip
    // tooltip = d3.select("body").append("div")
    //     .attr("class", "tooltip")
    //     .style("opacity", 0);


    // //all the data is now loaded, so draw the initial vis
    drawVis(dataset);
}


function drawVis(_dataset) {
    let dataPt = map.selectAll("circle")
        .data(_dataset, d => d.case);

    // Filter out data
    dataPt.exit().remove();

    // Enter data
    dataPt.enter().append("circle")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .style("fill", d => d3.color("red"))
        .attr("r", 4)
        .style("stroke", "black")
        .style("opacity", 0.5)
}


function filterData() {
    //HERE update filter query, filter the data, pass it to drawVis
    let selectedFilters = $.map($("#myselectform option:selected"), opt => opt.value)
    let filteredData = (selectedFilters.includes("all")) ? dataset : dataset.filter(point => selectedFilters.includes(point["type"]));


    filter_query.forEach(attr => {
        if (attr.key == _attr) {
            attr.range = values;
        }
        filteredData = filteredData.filter(point => { return point[attr.key] >= attr.range[0] && point[attr.key] <= attr.range[1] });
    });

    drawVis(filteredData);
}


window.onload = setup;