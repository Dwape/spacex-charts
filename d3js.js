window.addEventListener('scroll', function() {
    if (window.pageYOffset > 50) {
        d3.selectAll(".topnav")
            .transition()
            .ease(d3.easeLinear)
            .duration(150)
            .style("opacity", 0)
    } else {
        d3.selectAll(".topnav")
            .transition()
            .ease(d3.easeLinear)
            .duration(150)
            .style("opacity", 1)
    }
});

let rocketDictionary = {}

// Fetch rocket data

d3.json("https://api.spacexdata.com/v4/rockets")
    .then(function(data) {
    rocketDictionary = parseRocketData(data);
});

// Fetch data

// This request should be done after the first one.
d3.json("https://api.spacexdata.com/v4/launches/past")
    .then(function(data) {

    let grouped = parseLaunchData(data);
    drawBarChart(grouped);

    let rocketData = parseLaunchRocketData(data);
    drawDonutChart(rocketData);
});

function groupByArray(xs, key) { 
    return xs.reduce(function (rv, x) { 
        let v = key instanceof Function ? key(x) : x[key];
        let el = rv.find((r) => r && r.key === v);
        if (el) { 
            el.values.push(x); 
        } else { 
            rv.push({ key: v, values: [x] }); 
        } 
        return rv; 
    }, []); }

function parseRocketData(data) {
    let dictionary = {};
    data.forEach(rocket => dictionary[rocket.id] = rocket.name);
    return dictionary;
}

function parseLaunchData(data) {
    let parsed = data
        .map(launch => { return {
            year: utcDateToYear(launch.date_utc),
            name: launch.name,
            success: launch.success
        }});
    return groupByArray(parsed, "year")
        .map(value => {
            let successes = value.values.filter(launch => launch.success);
            let failures = value.values.filter(launch => !launch.success);
            return {
                year: value.key, 
                launches: successes.concat(failures), // .map(launch => {return {name: launch.name, success: launch.success}})
                successes: successes.length,
                failures: failures.length
            }
        });
}

function parseLaunchRocketData(data) {
    let parsed = data
        .map(launch => {return {rocket: rocketDictionary[launch.rocket]}})
    return groupByArray(parsed, "rocket")
        .map(value => {
            return {
                rocket: value.key,
                amount: value.values.length
            }
        })
}

function utcDateToYear(date) {
    return date.split('-')[0];
}

function drawBarChart(grouped) {

    let svg = d3.selectAll("#bar-chart-svg"),
    horizontalMargin = 300,
    verticalMargin = 150,
    width = svg.attr("width") - horizontalMargin,
    height = svg.attr("height") - verticalMargin

    const animationTime = 500;

    // Create y scale

    let yScale = d3.scaleLinear()
        .range([height, 0])
        .domain([0, d3.max(grouped, function(d) { return d.launches.length; })]);

    // Create x scale
    
    let xScale = d3.scaleBand()
        .range([0, width])
        .domain(grouped.map(function(d) { return d.year; }));

    // Add graph title

    svg.append("text")
        .attr("transform", "translate(100,0)")
        .attr("x", 150)
        .attr("y", 75)
        .attr("class", "chart-title")
        .text("SpaceX Launches")

    // Add main group

    let g = svg.append("g")
        .attr("transform", "translate(" + 100 + "," + 100 + ")");

    // Add x axis

    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale))
        .append("text")
        .attr("y", height - 400)
        .attr("x", width - 10)
        .attr("text-anchor", "end")
        .text("Year");

    // Add y axis

    g.append("g")
        .call(d3.axisLeft(yScale).ticks(10))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 10)
        .attr("dy", "-5.1em")
        .attr("text-anchor", "end")
        .text("Launches");

    // Add key

    let key = g.append("g")
        .attr("transform", "translate(20, 480)")
        

    key.append("rect")
        .attr("height", 20)
        .attr("width", 20)
        .classed("success", true)

    key.append("text")
        .attr("x", 30)
        .attr("y", 14)
        .text("Successful Launches")

    key.append("rect")
        .attr("height", 20)
        .attr("width", 20)
        .attr("x", 150)
        .classed("failure", true)

    key.append("text")
        .attr("x", 180)
        .attr("y", 14)
        .text("Failed Launches")

    // Add bar groups

    let bars = g.selectAll(".bar-container")
        .data(grouped.reverse()) // Reverse data to ensure proper draw order.
        .join("g")
        .attr("class", "bar-container")

    // Add mouse over events

    bars
        .on("mouseover", function(){
            d3.selectAll(".bar")
                .classed("faded", true);
            d3.selectAll(".bar-text")
                .classed("hidden", true);
            d3.select(this)
                .selectAll(".bar")
                .classed("faded", false);   
            d3.select(this)
                .selectAll(".mission-name")
                .classed("hidden", false);
            d3.select(this)
                .selectAll(".bar-text")
                .classed("hidden", false)         
            })
            
        .on("mouseout", function(){
            d3.selectAll(".bar")
                .classed("faded", false)
            d3.selectAll(".bar-text")
                .classed("hidden", false);
            d3.select(this)
                .selectAll(".mission-name")
                .classed("hidden", true)         
            })

    // Add failure bars

    bars.selectAll(".failure-bar")
        .data(d => [d])
        .join("rect")
        .attr("class", "failure-bar bar")
        .attr("x", function(d) { return xScale(d.year) + 2; })
        .attr("y", function(d) { return yScale(0)})
        .attr("width", xScale.bandwidth() - 4) // -2
        .transition()
        .ease(d3.easeLinear)
        .duration(function(d) {return animationTime / d.launches.length * d.failures})
        .attr("y", function(d) { return yScale(d.failures)})
        .attr("height", function(d) { 
        if (d.failures === 0) this.remove()
        else return height - yScale(d.failures) - 1; // margin
        })

    // Add success bars

    bars.selectAll(".success-bar")
        .data(d => [d])
        .join("rect")
        .attr("class", "success-bar bar")
        .attr("x", function(d) { return xScale(d.year) + 2; })
        .attr("y", function(d) { return yScale(d.failures) - 1}) // margin
        .attr("width", xScale.bandwidth() - 4) // -2
        .transition()
        .ease(d3.easeLinear)
        .delay(function(d) {return animationTime / d.launches.length * d.failures})
        .duration(function(d) {return animationTime / d.launches.length * d.successes})
        .attr("y", function(d) { return yScale(d.successes) - height + yScale(d.failures) })
        .attr("height", function(d) { 
            if (d.successes === 0) this.remove()
            else return height - yScale(d.successes) - 1; // margin
        })
    
    // Add mission names

    bars.selectAll(".mission-name")
        .data(d => d.launches.reverse())
        .join("text")
        .attr("fill", "black") // make text color depend on if it is a success or a failure.
        //.attr("text-anchor", "end")
        .attr("text-align", "left")
        .attr("font-weight", "bold")
        .attr("class", "mission-name hidden")
        .attr("x", function(d) {return xScale(d.year) + xScale.bandwidth()})
        .attr("y", function(d, i) {
            return height - 7 - 21 * i; // margin 
        })
        .text(function(d) {return d.name});
    
    // Add failure bar amount text

    bars.selectAll(".failure-bar-text")
        .data(d => [d])
        .join("text")
        .attr("fill", "white")
        .attr("text-anchor", "end")
        .style("opacity", 0)
        .attr("class", "failure-bar-text bar-text")
        .attr("x", function(d) { // Check if this can be simplified using text-anchor center
            let margin = 2 + (d.failures.toString().length - 1)*4;
            return xScale(d.year) + margin + xScale.bandwidth()/2
        })
        .attr("y", function(d) {return yScale(d.failures) + 8}) // margin
        .attr("dy", ".35em")
        .text(function(d) { 
            if (d.failures === 0) this.remove()
            else return d.failures; 
        })
        .transition()
        .duration(50)
        .delay(animationTime)
        .style("opacity", 1);

    // Add success bar amount text

    bars.selectAll(".success-bar-text")
        .data(d => [d])
        .join("text")
        .attr("fill", "white")
        .attr("text-anchor", "end")
        .style("opacity", 0)
        .attr("class", "success-bar-text bar-text")
        .attr("x", function(d) {  // Check if this can be simplified using text-anchor center
            let margin = 2 + (d.successes.toString().length - 1)*4;
            return xScale(d.year) + margin + xScale.bandwidth()/2
        })
        .attr("y", function(d) {return yScale(d.launches.length) + 8}) // margin
        .attr("dy", ".35em")
        .text(function(d) { 
        if (d.successes === 0) this.remove()
        else return d.successes; 
        })
        .transition()
        .duration(50)
        .delay(animationTime)
        .style("opacity", 1);
}

function drawDonutChart(data) {
    let svg = d3.selectAll("#donut-chart-svg"),
    width = svg.attr("width"),
    height = svg.attr("height"),
    radius = 150,
    g = svg
        .append("g")
        .attr("transform", "translate(" + (width / 2) + "," + (height / 2) + ")"); // + 50

    let color = d3.scaleOrdinal(['#5680e9', '#5ab9ea','#84ceeb', '#8860d0', '#c1c8e4'])
    // let color = d3.scaleOrdinal(['#4daf4a','#377eb8','#ff7f00','#984ea3','#e41a1c']);

    // Add graph title

    svg.append("text")
        .attr("transform", "translate(100,0)")
        .attr("x", 100)
        .attr("y", 75)
        .attr("text-anchor", "middle")
        .attr("class", "chart-title")
        .text("SpaceX Rockets")

    // Generate the pie
    let pie = d3.pie()
        .value(function (d) {
            return d.amount
        })
        .sort(null) // What is this for?
        .padAngle(.02);

    // Generate the arcs
    let arc = d3.arc()
        .innerRadius(100)
        .outerRadius(radius);

    let largerArc = d3.arc()
        .innerRadius(100 * 1.1)
        .outerRadius(radius * 1.1)

    //Generate groups
    let arcs = g.selectAll("arc")
                // .data(pie(data.map(launch => launch.amount)))
                .data(pie(data))
                .join("g")
                .attr("class", "arc")
                .style("stroke-opacity", 0)
    
    // Add rocket name
    arcs.selectAll(".stat-text-rocket")
        .data((d, i) => [data[i]])
        .join("text")
        .attr("class", "stat-text-rocket")
        .text(function(d) {
            return d.rocket
        })
        .style("font-size", 20)
        .attr("text-anchor", "middle")
        .classed("hidden", true);

    // Add amount of flights
    arcs.selectAll(".stat-text-flights")
        .data((d, i) => [data[i]])
        .join("text")
        .attr("class", "stat-text-flights")
        .text(function(d) {
            return `${d.amount} flights`
        })
        .attr("dy", 24)
        .style("font-size", 16)
        .attr("text-anchor", "middle")
        .classed("hidden", true);

    // Add mouse over events
    arcs.on("mouseover", function() {
            let selected = d3.select(this)

            d3.selectAll(".arc-path")
                .classed("faded", true)
            
            selected.select("path")
                .classed("faded", false)
                .transition()
                .duration(200)
                .attr("d", largerArc)

            selected.selectAll("text")
                .classed("hidden", false)
        })
        .on("mouseout", function() {
            let selected = d3.select(this)

            d3.selectAll(".arc-path")
                .classed("faded", false)

            selected.select("path")
                .transition()
                .duration(200)
                .attr("d", arc)
            
            selected.selectAll("text")
                .classed("hidden", true)
        })

    // Draw arc paths
    arcs.append("path")
        .attr("class", "arc-path")
        .attr("fill", function(d, i) {
            return color(i);
        })
        .attr("d", arc)  
        
    // Add key
    let key = g.append("g")
        .attr("transform", "translate(-50, 200)") // How much should we translate this?
        

    key.selectAll(".donut-chart-key")
        .data(data)
        .join("rect")
        .attr("class", "donut-chart-key")
        .attr("height", 20)
        .attr("width", 20)
        .attr("y", function(d, i) {return i * 30})
        .attr("fill", function(d, i) {
            return color(i);
        })

    key.selectAll(".rocket-key")
        .data(data)
        .join("text")
        .attr("class", "rocket-key")
        .text(function(d) {return d.rocket})
        .attr("x", 30)
        .attr("y", function(d, i) {return 14 + (30 * i)})
}