// Layout variables
let width = 750,
    height = 450;
let margin = { top: 20, right: 15, bottom: 30, left: 40 };
let w = width - margin.left - margin.right;
let h = height - margin.top - margin.bottom;

// Map visualization variables
let states;
let projection, generator, g, map;

// Data visualization variables
let dataset, ranges, filter_query;
let tooltip, stats;
let attributes = ["date", "fatalities", "injured", "total_victims", "age_of_shooter", "latitude", "longitude", "year"]
// let attributes = ["case", "location", "date", "summary", "fatalities", "injured", "total_victims", "location2", "age_of_shooter", "prior_signs_mental_health_issues", "mental_health_details", "weapons_obtained_legally", "where_obtained", "weapon_type", "weapon_details", "race", "gender", "sources", "mental_health_sources", "sources_additional_age", "latitude", "longitude", "type", "year"]
let dateParser = d3.timeParse("%-m/%-d/%Y");
let dateFormatter = d3.timeFormat("%-m/%-d/%Y");
let dateToYear = d3.timeFormat("%Y")


// Main functions

async function setup() {
    // Load US states map data
    states = await d3.json("states.json");

    // Setup projection, generator, and map
    projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(states, states.objects.usStates));
    generator = d3.geoPath().projection(projection);
    g = d3.select("#visualization").append("g")
    map = g.append("svg")
        .attr("width", width)
        .attr("height", height)

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
    filter_query = {};
    for (let attr of attributes) {
        let column = dataset.map(d => d[attr]);
        ranges[attr] = (attr != "date") ? [d3.min(column), d3.max(column)] : [+dateToYear(d3.min(column)), +dateToYear(d3.max(column))]
        // Initialize filter query to full ranges
        filter_query[attr] = {
            type: "quantitative",
            range: [
                ranges[attr][0],
                ranges[attr][1]
            ]
        }
    }

    // Create scales

    // Initiate tooltip
    tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Statistics text
    stats = g.append("text")
        .attr("font-family", "sans-serif")
        .attr("font-size", "20px")
        .attr("fill", "red");
    
    // Create sliders
    generateSlider("date", ranges.date[0], ranges.date[1]);
    generateSlider("fatalities", ranges.fatalities[0], ranges.fatalities[1]);
    generateSlider("injured", ranges.injured[0], 70, moreValues = true);
    generateSlider("age_of_shooter", ranges.age_of_shooter[0], ranges.age_of_shooter[1]);

    // Draw the initial visualization
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
        .style("fill", "red")
        .attr("r", 4)
        .style("stroke", "black")
        .style("opacity", 0.5)
        .on("mouseover", function (event, d, i) {
            d3.select(this).attr("r", 8);
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(generateTooltip(d))
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function (d, i) {
            d3.select(this).attr("r", 4);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0.0);
        });
    
    // Aggregate statistics
    let sumFatalities = d3.sum(_dataset, d => d.fatalities);
    let sumInjured = d3.sum(_dataset, d => d.injured);
    let sumTotalVictims = d3.sum(_dataset, d => d.total_victims);

    // Update stats text
    stats.html("Statistics of all currently visualzied data points:<br> \
                Total fatalities: " + sumFatalities + "<br> \
                Total injured: " + sumInjured + "<br> \
                Total victims: " + sumTotalVictims);
}

function filterData() {
    // Update filter query, filter the data, pass it to drawVis
    let filteredData = dataset;

    // let selectedFilters = $.map($("#myselectform option:selected"), opt => opt.value)
    // let filteredData = (selectedFilters.includes("all")) ? dataset : dataset.filter(point => selectedFilters.includes(point["type"]));

    for (const [attr, variable] of Object.entries(filter_query)) {
        if (variable.type == "quantitative") {
            if (attr == "date") {
                filteredData = filteredData.filter(point => { return dateToYear(point[attr]) >= variable.range[0] && dateToYear(point[attr]) <= variable.range[1] });
            } else {
                filteredData = filteredData.filter(point => { return point[attr] >= variable.range[0] && point[attr] <= variable.range[1] });
            }
        }
    }

    drawVis(filteredData);
}

// Generator functions

function generateTooltip(d) {
    let race = (d.race == "Other") ? "" : d.race
    return "<b>" + d.case + "</b> (" + d.type + ") <br>" + d.location + " - [" + d['location 1'] + "]<br>" + dateFormatter(d.date) + "<br>" +
            "Fatalities: " + d.fatalities + "<br>Injured: " + d.injured + "<br>Total victims: " + d.total_victims + "<br>" +
            "Shooter info: " + race + " " + d.gender + ", " + d.age_of_shooter + " years old<br>" +
            "Prior signs of mental health issues? - " + d.prior_signs_mental_health_issues + "<br>" +
            "Weapons obtained legally? - " + d.weapons_obtained_legally

}

function generateSlider(attr, min, max, moreValues=false) {
    let plusIndicator = moreValues ? "+" : "";
    $(function () {
        $("#"+attr).slider({
            range: true,
            min: min,
            max: max,
            values: [min, max],
            slide: function (event, ui) {
                plusIndicator = (moreValues && ui.values[1] == max) ? "+" : "";
                $("#"+attr+"_amount").val(ui.values[0] + " - " + ui.values[1] + plusIndicator);
                let upper = (ui.values[1] == max) ? Infinity : ui.values[1];
                filter_query[attr].range = [ui.values[0], upper];
                filterData();
            }
        });
        $("#"+attr+"_amount").val($("#"+attr).slider("values", 0) +
            " - " + $("#"+attr).slider("values", 1) + plusIndicator);
    });
}


window.onload = setup;