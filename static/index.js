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
let history = [];
let currentStep = 0;
let isRunning = false;

// Controls for changing datasets and picking number of clusters
d3.select("#dataset").on("change", initialize);
d3.select("#n_clusters").on("change", initialize);
d3.select("#back").on("click", stepBack);
d3.select("#forward").on("click", stepForward);
d3.select("#run").on("click", runToConvergence);
d3.select("#reset").on("click", reset);

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

    // Initialize history with step 0 (no assignments yet)
    history = [{centroids: JSON.parse(JSON.stringify(centroids)), labels: null}];
    currentStep = 0;
    d3.select("#step").text(currentStep);
    
    drawCentroids();
    updatePointColors(null);

  });
}

// Perform one step of k-means: assign points to nearest centroid, then update centroids
function performStep() {
  if (currentStep >= history.length - 1) {
    // Assign points to nearest centroids
    const labels = assignPointsToCentroids(centroids, currentData);
    
    // Calculate new centroids based on assigned points
    const newCentroids = calculateNewCentroids(currentData, labels, centroids.length);
    
    // Check for convergence (centroids didn't change)
    const converged = centroidsEqual(centroids, newCentroids);
    
    // Store step in history
    history.push({
      centroids: JSON.parse(JSON.stringify(newCentroids)),
      labels: labels.slice()
    });
    currentStep++;
    
    // Update centroids
    centroids = newCentroids;
    
    // Update visualization
    drawCentroids();
    updatePointColors(labels);
    d3.select("#step").text(currentStep);
    
    return !converged; // Return false if converged
  }
  return true;
}

// Go back one step
function stepBack() {
  if (isRunning) return;
  if (currentStep > 0) {
    currentStep--;
    const step = history[currentStep];
    centroids = JSON.parse(JSON.stringify(step.centroids));
    drawCentroids();
    updatePointColors(step.labels);
    d3.select("#step").text(currentStep);
  }
}

// Go forward one step
function stepForward() {
  if (isRunning) return;
  if (currentStep < history.length - 1) {
    if (currentStep < history.length - 1) {
      history = history.slice(0, currentStep + 1);
    }
    performStep();
  } else {
    performStep();
  }
}

// Run until convergence
function runToConvergence() {
  if (isRunning) return;
  isRunning = true;
  
  function runStep() {
    if (currentStep < history.length - 1) {
      if (currentStep < history.length - 1) {
        history = history.slice(0, currentStep + 1);
      }
    }
    
    const notConverged = performStep();
    
    if (notConverged && currentStep < 100) {
      setTimeout(runStep, 100);
    } else {
      isRunning = false;
    }
  }
  
  runStep();
}

// Reset to initial state
function reset() {
  if (isRunning) return;
  initialize();
}

// Assign each point to nearest centroid
function assignPointsToCentroids(centroids, data) {
  const labels = [];
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    let minDist = Infinity;
    let closest = 0;
    for (let j = 0; j < centroids.length; j++) {
      const c = centroids[j];
      const dx = point.x - c.x;
      const dy = point.y - c.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        closest = j;
      }
    }
    labels.push(closest);
  }
  return labels;
}

// Calculate new centroids as mean of assigned points
function calculateNewCentroids(data, labels, k) {
  const sums = Array(k).fill().map(() => ({ x: 0, y: 0, count: 0 }));
  for (let i = 0; i < data.length; i++) {
    const label = labels[i];
    sums[label].x += data[i].x;
    sums[label].y += data[i].y;
    sums[label].count++;
  }
  
  const newCentroids = [];
  for (let i = 0; i < k; i++) {
    if (sums[i].count > 0) {
      newCentroids.push({
        x: sums[i].x / sums[i].count,
        y: sums[i].y / sums[i].count
      });
    } else {
      newCentroids.push({ x: centroids[i].x, y: centroids[i].y });
    }
  }
  return newCentroids;
}

// Check if centroids are equal
function centroidsEqual(c1, c2) {
  if (c1.length !== c2.length) return false;
  for (let i = 0; i < c1.length; i++) {
    if (Math.abs(c1[i].x - c2[i].x) > 1e-6 || Math.abs(c1[i].y - c2[i].y) > 1e-6) {
      return false;
    }
  }
  return true;
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
        
        history = [{centroids: JSON.parse(JSON.stringify(centroids)), labels: null}];
        currentStep = 0;
        d3.select("#step").text(currentStep);
        updatePointColors(null);
        
      })
    );
}

// Update point colors based on cluster assignments
function updatePointColors(labels) {
  pointsG.selectAll("circle")
    .data(currentData)
    .join("circle")
    .attr("r", 5)
    .attr("fill", (d, i) => {
      if (labels && labels[i] !== undefined) {
        return colorScale(labels[i]);
      }
      return "#ffb700";
    })
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.5)
    .attr("cx", d => xScale(d.x))
    .attr("cy", d => yScale(d.y));
}