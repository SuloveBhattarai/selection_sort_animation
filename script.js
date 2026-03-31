const W = 400, H = 180;
const cols = 6;
const colWidth = W / cols;
const paddingX = 6;
const maxBarH = H - 20;

let numbers = generateRandomNumbers();
let originalNumbers = [...numbers]; // snapshot of unsorted order for replay
let isAnimating = false;
let cancelFlag = false;
let hasStarted = false; // tracks if sort has been run at least once

const chart = d3.select("#chart");
const svg = chart.append("svg").attr("width", W).attr("height", H + 30).attr("overflow", "visible");

// Define SVG patterns for textures
const defs = svg.append("defs");

// Sorted: green + horizontal lines
const patternSorted = defs.append("pattern")
    .attr("id", "pattern-sorted")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6).attr("height", 6);
patternSorted.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#00E676");
patternSorted.append("line").attr("x1", 0).attr("y1", 3).attr("x2", 6).attr("y2", 3)
    .attr("stroke", "rgba(0,0,0,0.25)").attr("stroke-width", 1.5);

// Min: red + diagonal hatch
const patternMin = defs.append("pattern")
    .attr("id", "pattern-min")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6).attr("height", 6);
patternMin.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#FF1744");
patternMin.append("line").attr("x1", 0).attr("y1", 6).attr("x2", 6).attr("y2", 0)
    .attr("stroke", "rgba(0,0,0,0.3)").attr("stroke-width", 1.5);

// Compare: magenta + dots
const patternCompare = defs.append("pattern")
    .attr("id", "pattern-compare")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6).attr("height", 6);
patternCompare.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#FF00FF");
patternCompare.append("circle").attr("cx", 3).attr("cy", 3).attr("r", 1.2)
    .attr("fill", "rgba(0,0,0,0.3)");

// Default: cyan + vertical lines
const patternDefault = defs.append("pattern")
    .attr("id", "pattern-default")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 6).attr("height", 6);
patternDefault.append("rect").attr("width", 6).attr("height", 6).attr("fill", "#00E5FF");
patternDefault.append("line").attr("x1", 3).attr("y1", 0).attr("x2", 3).attr("y2", 6)
    .attr("stroke", "rgba(0,0,0,0.18)").attr("stroke-width", 1.5);

// Arrow group for "smallest" indicator — rendered above bars
const arrowGroup = svg.append("g").attr("class", "arrow-group").style("display", "none");
arrowGroup.append("line")
    .attr("class", "arrow-line")
    .attr("stroke", "#FF1744")
    .attr("stroke-width", 2)
    .attr("marker-end", "url(#arrowhead)");
arrowGroup.append("text")
    .attr("class", "arrow-label")
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("font-weight", "bold")
    .attr("fill", "#FF1744")
    .text("smallest");

// Arrowhead marker
defs.append("marker")
    .attr("id", "arrowhead")
    .attr("markerWidth", 8).attr("markerHeight", 8)
    .attr("refX", 4).attr("refY", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,0 L0,8 L8,4 z")
    .attr("fill", "#FF1744");

const playBtn = document.getElementById("playBtn");
const randomizeBtn = document.getElementById("randomizeBtn");

drawBars(numbers);

playBtn.addEventListener("click", () => {
    window.parent?.postMessage({ eventType: hasStarted ? "replay" : "play", timestamp: Date.now() }, "*");
    if (hasStarted) {
        // Replay: reset to original order then re-sort
        if (isAnimating) {
            cancelFlag = true;
        }
        // startSort will be called after cancel resolves (handled in startSort)
        startSort(true);
    } else {
        startSort(false);
    }
});

randomizeBtn.addEventListener("click", () => {
    window.parent?.postMessage({ eventType: "randomize", timestamp: Date.now() }, "*");
    cancelFlag = true;
    const doRandomize = () => {
        numbers = generateRandomNumbers();
        originalNumbers = [...numbers]; // save new snapshot
        drawBars(numbers);
        hideArrow();
        hasStarted = false;
        playBtn.textContent = "Play";
    };
    if (isAnimating) {
        const wait = setInterval(() => {
            if (!isAnimating) {
                clearInterval(wait);
                doRandomize();
            }
        }, 50);
    } else {
        doRandomize();
    }
});

async function startSort(isReplay) {
    // If already animating, cancel and wait
    if (isAnimating) {
        cancelFlag = true;
        await new Promise(r => {
            const wait = setInterval(() => {
                if (!isAnimating) { clearInterval(wait); r(); }
            }, 50);
        });
    }

    hasStarted = true;
    playBtn.textContent = "Replay";
    isAnimating = true;
    cancelFlag = false;
    randomizeBtn.disabled = false; // always enabled

    if (isReplay) {
        numbers = [...originalNumbers]; // restore the original unsorted order
        drawBars(numbers);
        hideArrow();
        await new Promise(r => setTimeout(r, 200));
    }

    await selectionSort();

    isAnimating = false;
    cancelFlag = false;
    hideArrow();
}

function generateRandomNumbers() {
    return Array.from({ length: cols }, () => Math.floor(Math.random() * 91) + 5);
}

function barFill(state) {
    if (state === "sorted") return "url(#pattern-sorted)";
    if (state === "min") return "url(#pattern-min)";
    if (state === "compare") return "url(#pattern-compare)";
    return "url(#pattern-default)";
}

function barColor(state) {
    if (state === "sorted") return "#00E676";
    if (state === "min") return "#FF1744";
    if (state === "compare") return "#FF00FF";
    return "#00E5FF";
}

function drawBars(data) {
    svg.selectAll(".bar-group").remove();
    const groups = svg.selectAll(".bar-group")
        .data(data).enter().append("g").attr("class", "bar-group");

    groups.append("rect")
        .attr("class", "bar")
        .attr("x", (d, i) => i * colWidth + paddingX)
        .attr("width", colWidth - paddingX * 2)
        .attr("y", d => H - (d / 100) * maxBarH)
        .attr("height", d => (d / 100) * maxBarH)
        .attr("rx", 3)
        .attr("fill", "url(#pattern-default)");

    groups.append("text")
        .attr("class", "bar-label")
        .attr("x", (d, i) => i * colWidth + colWidth / 2)
        .attr("y", H + 14)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#cdd6f4")
        .text(d => d);
}

function updateBars(data, states) {
    svg.selectAll(".bar-group").data(data).each(function (d, i) {
        d3.select(this).select(".bar")
            .attr("x", i * colWidth + paddingX)
            .attr("y", H - (d / 100) * maxBarH)
            .attr("height", (d / 100) * maxBarH)
            .attr("fill", barFill(states[i]));
        d3.select(this).select(".bar-label")
            .attr("x", i * colWidth + colWidth / 2)
            .attr("y", H + 14)
            .attr("fill", "#cdd6f4")
            .text(d);
    });
}

function showArrow(minIdx, barTopY) {
    const cx = minIdx * colWidth + colWidth / 2;
    const arrowTopY = barTopY - 28;
    const arrowBottomY = barTopY - 6;

    arrowGroup.style("display", null);
    arrowGroup.select(".arrow-line")
        .attr("x1", cx).attr("y1", arrowTopY)
        .attr("x2", cx).attr("y2", arrowBottomY);
    arrowGroup.select(".arrow-label")
        .attr("x", cx)
        .attr("y", arrowTopY - 4);
}

function hideArrow() {
    arrowGroup.style("display", "none");
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function swapAnimation(i, min) {
    const xi = i * colWidth + paddingX;
    const xmin = min * colWidth + paddingX;
    const xiLabel = i * colWidth + colWidth / 2;
    const xminLabel = min * colWidth + colWidth / 2;

    const nodes = svg.selectAll(".bar-group").nodes();
    const gi = d3.select(nodes[i]);
    const gmin = d3.select(nodes[min]);

    await Promise.all([
        gi.select(".bar").transition().duration(500).attr("x", xmin).end(),
        gi.select(".bar-label").transition().duration(500).attr("x", xminLabel).end(),
        gmin.select(".bar").transition().duration(500).attr("x", xi).end(),
        gmin.select(".bar-label").transition().duration(500).attr("x", xiLabel).end(),
    ]);
}

async function selectionSort() {
    for (let i = 0; i < numbers.length - 1; i++) {
        if (cancelFlag) return;

        let min = i;
        const states0 = buildStates(i, min, -1, i);
        updateBars(numbers, states0);
        const topY0 = H - (numbers[min] / 100) * maxBarH;
        showArrow(min, topY0);
        await sleep(600);
        if (cancelFlag) return;

        for (let j = i + 1; j < numbers.length; j++) {
            if (cancelFlag) return;

            updateBars(numbers, buildStates(i, min, j, i));
            const topY = H - (numbers[min] / 100) * maxBarH;
            showArrow(min, topY);
            await sleep(600);
            if (cancelFlag) return;

            if (numbers[j] < numbers[min]) {
                min = j;
                updateBars(numbers, buildStates(i, min, j, i));
                const newTopY = H - (numbers[min] / 100) * maxBarH;
                showArrow(min, newTopY);
                await sleep(600);
                if (cancelFlag) return;
            }
        }

        if (min !== i) {
            hideArrow();
            await swapAnimation(i, min);
            if (cancelFlag) return;
            [numbers[i], numbers[min]] = [numbers[min], numbers[i]];

            const nodes = svg.selectAll(".bar-group").nodes();
            const parent = svg.node();
            const temp = nodes[i];
            parent.insertBefore(nodes[min], temp);
            parent.insertBefore(temp, nodes[min].nextSibling);

            const states = numbers.map((_, idx) => idx <= i ? "sorted" : "default");
            updateBars(numbers, states);
            await sleep(1000);
            if (cancelFlag) return;
        } else {
            hideArrow();
            const states = numbers.map((_, idx) => idx <= i ? "sorted" : "default");
            updateBars(numbers, states);
            await sleep(1000);
            if (cancelFlag) return;
        }
    }

    if (!cancelFlag) {
        hideArrow();
        updateBars(numbers, Array(cols).fill("sorted"));
    }
}

function buildStates(current, minIdx, compareIdx, sortedBoundary) {
    return numbers.map((_, i) => {
        if (i < sortedBoundary) return "sorted";
        if (i === minIdx) return "min";
        if (i === compareIdx) return "compare";
        return "default";
    });
}
window.addEventListener("message", e => console.log("Caught:", e.data));