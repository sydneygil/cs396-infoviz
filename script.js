// Layout variables
let width = 750,
    height = 450;
let margin = { top: 20, right: 15, bottom: 30, left: 40 };
let w = width - margin.left - margin.right;
let h = height - margin.top - margin.bottom;

// Map visualization variables
let states;
let projection = d3.geoAlbersUsa();
let path = d3.geoPath()
    .projection(projection);

let map = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

// Data visualization variables
let dataset, ranges, filter_query;
let chart, tooltip, x, y, col;
let attributes = ["date", "summary", "fatalities", "injured", "total_victims", "location", "age_of_shooter", "prior_signs_mental_health_issues", "mental_health_details", "weapons_obtained_legally", "where_obtained", "weapon_type", "weapon_details", "race", "gender", "sources", "mental_health_sources", "sources_additional_age", "latitude", "longitude", "type", "year"] // list of attributes
    // let attributes = ["case", "location", "date", "summary", "fatalities", "injured", "total_victims", "location", "age_of_shooter", "prior_signs_mental_health_issues", "mental_health_details", "weapons_obtained_legally", "where_obtained", "weapon_type", "weapon_details", "race", "gender", "sources", "mental_health_sources", "sources_additional_age", "latitude", "longitude", "type", "year"] // list of attributes

async function setup() {
    // Load US states map data
    states = await d3.json("states.json");

    // Draw the states
    map.append("path")
        .attr("class", "states")
        .datum(topojson.feature(states, states.objects.usStates))
        .attr("d", path);

    // Initialize the data visualization
    initialize()
}

function setupMap() {

}

async function initialize() {
    // Read and clean data
    let crime = await d3.csv("mass_shootings.csv");
    crime.forEach(function(d) {
        d.date = d3.timeParse("%b %d, %Y");
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
        console.log("Attr: " + attr + " Col: " + column)
        ranges[attr] = [
            d3.min(column),
            d3.max(column)
        ]
        filter_query.push({
            key: attr,
            range: [ // deep copy
                ranges[attr][0],
                ranges[attr][1]
            ]
        })
    }

    // Allow multiple selections on type dropdown
    $('#myselectform option').mousedown(function(e) {
        e.preventDefault();
        $(this).prop('selected', !$(this).prop('selected'));

        // Deselect all other options if selected "all", and deselect "all" if any other option was selected.
        if (e.target.value == "all") {
            $('#myselectform option').each(function() {
                if (($(this).prop('value')) != "all") { $(this).prop('selected', false) }
            })
        } else {
            $("#myselectform option[value='all']").prop("selected", false);
        }

        // Fix scrolling bug when making selection
        var scrollTop = e.target.parentNode.scrollTop;
        setTimeout(() => e.target.parentNode.scrollTo(0, scrollTop), 0);

        filterData("type", []);
        return false;
    });

    // Initially select "all" type filter
    $('#myselectform option[value="all"]').prop("selected", true);


    // define any slider functions here, since depend on max of variables
    $(function() {
        $("#vol").slider({
            range: true,
            min: ranges.vol[0],
            max: ranges.vol[1],
            values: ranges.vol,
            slide: function(event, ui) {
                $("#volamount").val(ui.values[0] + " - " + ui.values[1]);
                filterData("vol", ui.values);
            }
        });
        $("#volamount").val($("#vol").slider("values", 0) +
            " - " + $("#vol").slider("values", 1));
    });

    $(function() {
        $("#delta").slider({
            range: true,
            min: ranges.delta[0],
            max: ranges.delta[1],
            values: ranges.delta,
            slide: function(event, ui) {
                $("#deltaamount").val(ui.values[0] + " - " + ui.values[1]);
                filterData("delta", ui.values);
            }
        });
        $("#deltaamount").val($("#delta").slider("values", 0) +
            " - " + $("#delta").slider("values", 1));
    });

    $(function() {
        $("#price").slider({
            range: true,
            min: ranges.price[0],
            max: ranges.price[1],
            values: ranges.price,
            slide: function(event, ui) {
                $("#priceamount").val(ui.values[0] + " - " + ui.values[1]);
                filterData("price", ui.values);
            }
        });
        $("#priceamount").val($("#price").slider("values", 0) +
            " - " + $("#price").slider("values", 1));
    });

    $(function() {
        $("#eValue").slider({
            range: true,
            min: ranges.eValue[0],
            max: ranges.eValue[1],
            values: ranges.eValue,
            slide: function(event, ui) {
                $("#eValueamount").val(ui.values[0] + " - " + ui.values[1]);
                filterData("eValue", ui.values);
            }
        });
        $("#eValueamount").val($("#eValue").slider("values", 0) +
            " - " + $("#eValue").slider("values", 1));
    });

    // get scales
    x = d3.scaleLinear()
        .domain([0, (Math.ceil(ranges.price[1] / 50) + 1) * 50]) // some offset
        .range([0, w]);

    y = d3.scaleLinear()
        .domain([0, (Math.ceil(ranges.eValue[1] / 50) + 1) * 50]) // some offset
        .range([h, 0]);

    col = d3.scaleOrdinal(d3.schemeCategory10);

    // chart object
    chart = d3.select(".chart")
        .attr("width", width)
        .attr("height", height + 15)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // initiate tooltip
    tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // draw axes
    chart.append("g")
        .attr("transform", "translate(0," + h + ")")
        .call(d3.axisBottom(x))
        .append("text")
        .attr("x", w)
        .attr("y", -6)
        .style("text-anchor", "end")
        .style("fill", "black")
        .text("Price");

    chart.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .style("fill", "black")
        .text("True Value");

    //all the data is now loaded, so draw the initial vis
    drawVis(dataset);
}

function drawVis(dataset) { //draw the circiles initially and on each interaction with a control
    let circle = chart.selectAll("circle")
        .data(dataset, d => d.name); // assign key!!!

    // filter out first
    circle.exit().remove();

    // enter (keyed data)
    circle.enter().append("circle")
        .attr("cx", d => x(d.price))
        .attr("cy", d => y(d.eValue))
        .style("fill", d => col(d.type))
        .attr("r", 4)
        .style("stroke", "black")
        .style("opacity", 0.5)
        .on("mouseover", function(event, d, i) {
            d3.select(this).attr("r", 8);
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html("Stock <b>" + d.name + "</b>: " + "price=" + d.price + ", eValue=" + d.eValue + "<br>" + "type=" + d.type + ", volume=" + d.vol + ", delta=" + d.delta)
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d, i) {
            d3.select(this).attr("r", 4);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0.5);
        });
}

//will need to do things slightly differently if all is selected in dropdown, so keep pattern for matching against mytype
let patt = new RegExp("all");

function filterData(_attr, values) {
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


// From stack overflow: https://stackoverflow.com/questions/11821261/how-to-get-all-selected-values-from-select-multiple-multiple
function getSelectValues(select) {
    var result = [];
    var options = select && select.options;
    var opt;

    for (var i = 0, iLen = options.length; i < iLen; i++) {
        opt = options[i];

        if (opt.selected) {
            result.push(opt.value || opt.text);
        }
    }
    return result;
}

window.onload = setup;