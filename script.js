// Layout variables
let width = 750,
    height = 450;
let margin = { top: 20, right: 15, bottom: 30, left: 40 };
let w = width - margin.left - margin.right;
let h = height - margin.top - margin.bottom;

// Map visualization variables
let states;
let projection, generator, g, map;
const zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', zoomed);

// Data visualization variables
let dataset, ranges, filter_query, default_filters;
let tooltip, stats;
let attributes = ["date", "fatalities", "injured", "total_victims", "age_of_shooter", "latitude", "longitude", "year"];
let dateParser = d3.timeParse("%-m/%-d/%Y");
let dateFormatter = d3.timeFormat("%-m/%-d/%Y");
let dateToYear = d3.timeFormat("%Y");
let colors = ["red", "blue", "green", "yellow", "orange", "purple"];
let color_scales = {};
let selected_attribute = "none";


// Main functions

async function setup() {
    // Load US states map data
    states = await d3.json("states.json");

    // Setup projection, generator, and map
    projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(states, states.objects.usStates));
    generator = d3.geoPath().projection(projection);
    g = d3.select("#visualization").append("g")
        .attr("id", "viz_group");
    map = g.append("svg")
        .attr("width", width)
        .attr("height", height)

    map.call(zoom);

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
        d.latitude = +d.latitude + Math.random() * .1;
        d.longitude = +d.longitude + Math.random() * .1;
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
    default_filters = JSON.parse(JSON.stringify(filter_query))

    // Initiate tooltip
    tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Statistics text
    stats = g.append("text")
        .attr("font-family", "sans-serif")
        .attr("font-size", "20px")
        .attr("fill", "red")
        .attr("id", "stats");

    
    // Create sliders
    generateSlider("date", ranges.date[0], ranges.date[1]);
    generateSlider("fatalities", ranges.fatalities[0], ranges.fatalities[1]);
    generateSlider("injured", ranges.injured[0], 70, moreValues = true);
    generateSlider("age_of_shooter", ranges.age_of_shooter[0], ranges.age_of_shooter[1]);

    // Create selectors
    generateSelector("location_1", ["All", "Other", "Workplace", "School", "Religious", "Military", "Airport"], document.getElementById("location_1_selector"));
    generateSelector("type", ["All", "Mass", "Spree"], document.getElementById("type_selector"));
    generateSelector("race", ["All", "White", "Black", "Latino", "Asian", "Native American", "Other"], document.getElementById("race_selector"));
    generateSelector("gender", ["All", "Male", "Female", "Male & Female"], document.getElementById("gender_selector"));
    generateSelector("prior_signs_mental_health_issues", ["All", "Yes", "No", "Unknown"], document.getElementById("prior_signs_mental_health_issues_selector"));
    generateSelector("weapons_obtained_legally", ["All", "Yes", "No", "Unknown"], document.getElementById("weapons_obtained_legally_selector"));

    // Initiate default color scale
    color_scales["none"] = {
        scale: function () { return "#ef4565" }
    }

    // Draw the initial visualization
    drawVis(dataset);
}

function drawVis(_dataset) {
    let dataPt = map.selectAll("circle")
        .data(_dataset, d => d.case);

    // Filter out data
    dataPt.exit().remove();

    // Enter data
    let zoomConstant;
    dataPt.enter().append("circle")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", 4)
        .style("opacity", 0.5)
        .on("mouseover", function (event, d, i) {
            zoomConstant = d3.zoomTransform(this).k;
            d3.select(this).attr("r", 8 / zoomConstant);
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(generateTooltip(d))
                .style("left", (event.pageX + 5) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function (d, i) {
            zoomConstant = d3.zoomTransform(this).k;
            d3.select(this).attr("r", 4 / zoomConstant);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0.0);
        });

    // Color data with respect to selected attribute
    map.selectAll("circle")
        .style("fill", d => colorPoint(d));

    // Apply zoom transformations
    zoomed({ transform: d3.zoomTransform(map.select('path').node())});
    
    // Aggregate statistics
    let totalVisualized = _dataset.length;
    let sumFatalities = d3.sum(_dataset, d => d.fatalities);
    let sumInjured = d3.sum(_dataset, d => d.injured);
    let sumTotalVictims = d3.sum(_dataset, d => d.total_victims);
    let percentVisualized = (totalVisualized / dataset.length * 100).toFixed(1)
    let percentFatalities = (sumFatalities / d3.sum(dataset, d => d.fatalities) * 100).toFixed(1)
    let percentInjured = (sumInjured / d3.sum(dataset, d => d.injured) * 100).toFixed(1)
    let percentTotalVictims = (sumTotalVictims / d3.sum(dataset, d => d.total_victims) * 100).toFixed(1)

    // Update stats text
    stats.html(`Statistics of all currently visualzied data points:<br>
                Cases visualized: ${totalVisualized} (${percentVisualized}%) <br>
                Total fatalities: ${sumFatalities} (${percentFatalities}%) <br>
                Total injured: ${sumInjured} (${percentInjured}%) <br>
                Total victims: ${sumTotalVictims} (${percentTotalVictims}%)`);
}

function filterData() {
    // Update filter query, filter the data, pass it to drawVis
    let filteredData = dataset;

    for (const [attr, variable] of Object.entries(filter_query)) {
        if (variable.type == "quantitative") {
            if (attr == "date") {
                filteredData = filteredData.filter(point => dateToYear(point[attr]) >= variable.range[0] && dateToYear(point[attr]) <= variable.range[1]);
            } else {
                filteredData = filteredData.filter(point => point[attr] >= variable.range[0] && point[attr] <= variable.range[1]);
            }
        } else if (variable.type == "nominal") {
            let selectedFilters = $.map($(`#${attr} option:selected`), opt => opt.value);
            filteredData = (selectedFilters.includes("All")) ? filteredData : filteredData.filter(point => selectedFilters.includes(point[attr]));
        }
    }

    drawVis(filteredData);
}

// Generator functions

function generateTooltip(d) {
    let race = (d.race == "Other") ? "" : d.race
    return "<b>" + d.case + "</b> (" + d.type + ") <br>" + d.location + " - [" + d.location_1 + "]<br>" + dateFormatter(d.date) + "<br>" +
            "Fatalities: " + d.fatalities + "<br>Injured: " + d.injured + "<br>Total victims: " + d.total_victims + "<br>" +
            "Shooter info: " + race + " " + d.gender + ", " + d.age_of_shooter + " years old<br>" +
            "Prior signs of mental health issues? - " + d.prior_signs_mental_health_issues + "<br>" +
            "Weapons obtained legally? - " + d.weapons_obtained_legally
}

function generateSelector(attr, options, parent) {
    let selectEle = document.createElement("select")
    selectEle.classList.add("multiSelect");
    selectEle.id = attr;
    // selectEle.setAttribute("size", options.length);

    options.forEach(option => {
        let optionEle = document.createElement("option");
        optionEle.value = option;
        optionEle.text = option.charAt(0).toUpperCase() + option.slice(1);
        selectEle.appendChild(optionEle);
    });

    // Initialize filter_query key
    filter_query[attr] = {
        type: "nominal"
    }
    parent.appendChild(selectEle);

    // Initialize color scale
    color_scales[attr] = {
        'scale': d3.scaleOrdinal()
            .domain([...options].splice(1, options.length))
            .range([...colors].splice(0, options.length - 1))
    }

    // Configure selector
    // Allow multiple selections on type dropdown
    $(`#${attr}`).attr("multiple", "multiple");
    $(`#${attr} option`).mousedown(function (e) {
        e.preventDefault();
        $(this).prop('selected', !$(this).prop('selected'));

        // Deselect all other options if selected "all", and deselect "all" if any other option was selected.
        if (e.target.value == "All") {
            $(`#${attr} option`).each(function () {
                if (($(this).prop('value')) != "All") { $(this).prop('selected', false) }
            })
        } else {
            $(`#${attr} option[value='All']`).prop("selected", false);
        }

        // Select "all" if none are selected
        if ($.map($(`#${attr} option:selected`), opt => opt.value).length == 0) {
            $(`#${attr} option[value='All']`).prop("selected", true);
        }

        // Fix scrolling bug when making selection
        var scrollTop = e.target.parentNode.scrollTop;
        setTimeout(() => e.target.parentNode.scrollTo(0, scrollTop), 0);

        filterData();
    });

    // Initially select "all" type filter
    $(`#${attr} option[value='All']`).prop("selected", true);
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

    // Initialize color scale
    color_scales[attr] = {
        'scale': d3.scaleOrdinal()
            .domain([min, max])
            .range(["#bee4ff", "#094067"])
    }
}

// Helper functions

function zoomed(e) {
    map.selectAll('path, circle').attr('transform', e.transform);
    map.selectAll('circle')
        .attr("r", 4/e.transform.k)

}

function updateColorScale(newSelectedAttr) {
    selected_attribute = newSelectedAttr;
    filterData();
}

function colorPoint(d) {
    return color_scales[selected_attribute].scale(d[selected_attribute]);
}

function resetFilters() {
    filter_query = default_filters;
    $("select.multiSelect").each(function() {
        filter_query[$(this).attr('id')] = {
            type: "nominal"
        }
    })

    $(`.multiSelect option`).each(function () {
        if (($(this).prop('value')) != "All") { $(this).prop('selected', false) } else { $(this).prop('selected', true); }
    })

    $(".slider div[id]").each(function () { 
        $(this).slider("values", ranges[$(this).attr("id")]);
        $(this).slider("option", "slide").call($(this), null, { values: $(this).slider("values") });
    })

    filterData();
}

window.onload = setup;