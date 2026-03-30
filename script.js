const W = 400, H = 180;
const cols = 6;
const colWidth = W / cols;
const paddingX = 6;
const maxBarH = H - 20;

let numbers = generateRandomNumbers();
let isAnimating = false;
let cancelFlag = false;

const chart = d3.select("#chart");
const svg = chart.append("svg").attr("width", W).attr("height", H);

const playBtn = document.getElementById("playBtn");
const randomizeBtn = document.getElementById("randomizeBtn");
const replayBtn = document.getElementById("replayBtn");

drawBars(numbers);

// kick off sort
playBtn.addEventListener("click", () => {
    window.parent?.postMessage({ eventType: "play", timestamp: Date.now() }, "*");
    startSort();
});

// cancel ongoing sort and restart from beginning
replayBtn.addEventListener("click", () => {
    window.parent?.postMessage({ eventType: "replay", timestamp: Date.now() }, "*");
    if (!isAnimating) {
        startSort();
        return;
    }
    cancelFlag = true;
});

// reset with fresh numbers and disable replay
randomizeBtn.addEventListener("click", () => {
    window.parent?.postMessage({ eventType: "randomize", timestamp: Date.now() }, "*");
    if (isAnimating) {
        cancelFlag = true;
        const wait = setInterval(() => {
            if (!isAnimating) {
                clearInterval(wait);
                numbers = generateRandomNumbers();
                drawBars(numbers);
            }
        }, 50);
        return;
    }
    numbers = generateRandomNumbers();
    drawBars(numbers);
    replayBtn.disabled = true;
});

// manages animation state, saves snapshot for replay, handles cancel and restart
async function startSort() {
    if (isAnimating) return;
    isAnimating = true;
    cancelFlag = false;
    playBtn.disabled = true;
    replayBtn.disabled = false;
    randomizeBtn.disabled = true;

    const snapshot = [...numbers];
    await selectionSort();

    isAnimating = false;

    if (cancelFlag) {
        cancelFlag = false;
        numbers = [...snapshot];
        drawBars(numbers);
        await new Promise(r => setTimeout(r, 200));
        startSort();
    } else {
        playBtn.disabled = false;
        randomizeBtn.disabled = false;
    }
}

// random numbers generation 
function generateRandomNumbers() {
    return Array.from({ length: cols }, () => Math.floor(Math.random() * 91) + 5);
}

// maps sort state to a color
function barColor(state) {
    if (state === "sorted") return "#00E676";
    if (state === "current") return "#FFEA00";
    if (state === "min") return "#FF1744";
    if (state === "compare") return "#FF00FF";
    return "#00E5FF";
}

// renders bars and labels 
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
        .attr("fill", "#00E5FF");

    groups.append("text")
        .attr("class", "bar-label")
        .attr("x", (d, i) => i * colWidth + colWidth / 2)
        .attr("y", d => H - (d / 100) * maxBarH - 4)
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("font-weight", "bold")
        .attr("fill", "#00E5FF")
        .text(d => d);
}

// updates bar positions, heights and colors
function updateBars(data, states) {
    svg.selectAll(".bar-group").data(data).each(function (d, i) {
        d3.select(this).select(".bar")
            .attr("x", i * colWidth + paddingX)
            .attr("y", H - (d / 100) * maxBarH)
            .attr("height", (d / 100) * maxBarH)
            .attr("fill", barColor(states[i]));
        d3.select(this).select(".bar-label")
            .attr("x", i * colWidth + colWidth / 2)
            .attr("y", H - (d / 100) * maxBarH - 4)
            .attr("fill", barColor(states[i]))
            .text(d);
    });
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// animates two bars sliding into each other's positions
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

// core sort loop, checks cancelFlag at every step to support mid-sort interruption
async function selectionSort() {
    for (let i = 0; i < numbers.length - 1; i++) {
        if (cancelFlag) return;

        let min = i;
        updateBars(numbers, buildStates(i, min, -1, i));
        await sleep(600);
        if (cancelFlag) return;

        for (let j = i + 1; j < numbers.length; j++) {
            if (cancelFlag) return;

            updateBars(numbers, buildStates(i, min, j, i));
            await sleep(600);
            if (cancelFlag) return;

            if (numbers[j] < numbers[min]) {
                min = j;
                updateBars(numbers, buildStates(i, min, j, i));
                await sleep(600);
                if (cancelFlag) return;
            }
        }

        if (min !== i) {
            await swapAnimation(i, min);
            if (cancelFlag) return;
            [numbers[i], numbers[min]] = [numbers[min], numbers[i]];

            // reorder DOM nodes to match swapped array so colors apply correctly
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
            // already in place, mark sorted and pause before next pass
            const states = numbers.map((_, idx) => idx <= i ? "sorted" : "default");
            updateBars(numbers, states);
            await sleep(1000);
            if (cancelFlag) return;
        }
    }

    if (!cancelFlag) {
        updateBars(numbers, Array(cols).fill("sorted"));
    }
}

// builds a state array for coloring based on current sort positions
function buildStates(current, minIdx, compareIdx, sortedBoundary) {
    return numbers.map((_, i) => {
        if (i < sortedBoundary) return "sorted";
        if (i === current) return "current";
        if (i === minIdx) return "min";
        if (i === compareIdx) return "compare";
        return "default";
    });
}

//window.addEventListener("message", e => console.log("Caught:", e.data));