// Scatterplot setup
const margin = { top: 20, right: 20, bottom: 40, left: 50 };
const width = 500, height = 500;
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;


let svg = d3.select("svg#scatterplot")
  .attr("width", width)
  .attr("height", height)
  .style("background", "#eee");

let g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

let xAxisG = g.append("g").attr("transform", `translate(0,${innerH})`);
let yAxisG = g.append("g");
let pointsG = g.append("g");
let xScale = d3.scaleLinear().range([0, innerW]);
let yScale = d3.scaleLinear().range([innerH, 0]);

// Centroid setup
let centroidsG = g.append("g");
const colorScale = d3.scaleOrdinal(d3.schemeCategory10); // random color scheme for clusters

let currentData = [];
let centroids = [];

// Controls for changing datasets and picking number of clusters
d3.select("#dataset").on("change", initialize);
d3.select("#n_clusters").on("change", initialize);

initialize();

// Main function to load dataset, set up scales, axes, and initial centroids
function initialize() {
  const dataset = d3.select("#dataset").property("value");
  const nClusters = +d3.select("#n_clusters").property("value");
  d3.select("#step").text("0");

  d3.csv(`static/datasets/${dataset}.csv`, d3.autoType).then(data => {
    currentData = data;

    // Set domains for the scatter plot so that all points are actually visible
    const xExt = d3.extent(data, d => d.x);
    const yExt = d3.extent(data, d => d.y);
    const xPad = (xExt[1] - xExt[0]) * 0.05;
    const yPad = (yExt[1] - yExt[0]) * 0.05;
    xScale.domain([xExt[0] - xPad, xExt[1] + xPad]);
    yScale.domain([yExt[0] - yPad, yExt[1] + yPad]);

    // Axis drawing and points rendering
    xAxisG.call(d3.axisBottom(xScale));
    yAxisG.call(d3.axisLeft(yScale));
    pointsG.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("r", 5)
      .attr("fill", "#ffb700")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y));


    // Initialize centroids randomly from the data points
    centroids = [];
    for (let i = 0; i < nClusters; i++) {
      const randomPoint = data[Math.floor(Math.random() * data.length)];
      centroids.push({ x: randomPoint.x, y: randomPoint.y });
    }
    drawCentroids();


  });
}

// Draw centroids as circles
function drawCentroids() {
  centroidsG.selectAll("circle")
    .data(centroids)
    .join("circle")
    .attr("r", 8)
    .attr("fill", (d, i) => colorScale(i))
    .attr("stroke", "#000")
    .attr("stroke-width", 1.5)
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y))
    .style("cursor", "grab")
    
    // Make centroids draggable
    .call(d3.drag()
      .on("drag", function (event) {
        const [mx, my] = d3.pointer(event, g.node());
        const d = d3.select(this).datum();
        d.x = xScale.invert(mx);
        d.y = yScale.invert(my);
        d3.select(this)
          .attr("cx", xScale(d.x))
          .attr("cy", yScale(d.y));
      })
    );
}