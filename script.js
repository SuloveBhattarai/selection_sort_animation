const width = 400;
const height = 50;
const cols = 5;
const colWidth = width / cols;

let numbers = generateRandomNumbers();
let isAnimating = false;
let playCount = 0;

const chart = d3.select("#chart");

const svg = chart
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const playBtn = document.getElementById("playBtn");
const randomizeBtn = document.getElementById("randomizeBtn");

drawStaticBox();
drawNumbers(numbers);

playBtn.addEventListener("click", async () => {
    if (isAnimating) return;

    playCount++;

    window.parent.postMessage({
        eventType: "play",
        timestamp: Date.now(),
        playCount: playCount
    }, "*");

    isAnimating = true;
    playBtn.disabled = true;
    randomizeBtn.disabled = true;

    await selectionSort();

    isAnimating = false;
    playBtn.disabled = false;
    randomizeBtn.disabled = false;
});

randomizeBtn.addEventListener("click", () => {
    if (isAnimating) return;

    numbers = generateRandomNumbers();
    redrawNumbers(numbers);

    // window.parent.postMessage({
    //     eventType: "randomize",
    //     timestamp: Date.now()
    // }, "*");
});

function generateRandomNumbers() {
    return Array.from({ length: cols }, () => Math.floor(Math.random() * 100));
}

function drawStaticBox() {
    svg
        .append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#181825")
        .attr("stroke", "#45475a")
        .attr("stroke-width", 2)
        .attr("rx", 6);

    for (let i = 1; i < cols; i++) {
        svg
            .append("line")
            .attr("x1", i * colWidth)
            .attr("x2", i * colWidth)
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "#313244");
    }
}

function drawNumbers(data) {
    svg
        .selectAll(".num")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "num")
        .attr("x", (d, i) => i * colWidth + colWidth / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "20px")
        .attr("font-weight", "bold")
        .attr("fill", "#00E5FF")
        .text(d => d);
}

function redrawNumbers(data) {
    svg
        .selectAll(".num")
        .data(data)
        .join("text")
        .attr("class", "num")
        .attr("x", (d, i) => i * colWidth + colWidth / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-size", "20px")
        .attr("font-weight", "bold")
        .attr("fill", "#00E5FF")
        .text(d => d);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function updateColors(currentIndex, minIndex, compareIndex, sortedBoundary) {
    svg.selectAll(".num")
        .attr("fill", (d, i) => {
            if (i < sortedBoundary) return "#00E676";
            if (i === currentIndex) return "#FFEA00";
            if (i === minIndex) return "#FF1744";
            if (i === compareIndex) return "#FF00FF";
            return "#00E5FF";
        });
}

async function swapAnimation(i, min) {
    const xi = i * colWidth + colWidth / 2;
    const xmin = min * colWidth + colWidth / 2;

    const textNodes = svg.selectAll(".num");
    const textI = textNodes.filter((d, idx) => idx === i);
    const textMin = textNodes.filter((d, idx) => idx === min);

    await Promise.all([
        textI.transition().duration(700).attr("x", xmin).end(),
        textMin.transition().duration(700).attr("x", xi).end()
    ]);
}

async function selectionSort() {
    for (let i = 0; i < numbers.length - 1; i++) {
        let min = i;
        updateColors(i, min, -1, i);
        await sleep(800);

        for (let j = i + 1; j < numbers.length; j++) {
            updateColors(i, min, j, i);
            await sleep(800);

            if (numbers[j] < numbers[min]) {
                min = j;
                updateColors(i, min, j, i);
                await sleep(800);
            }
        }

        if (min !== i) {
            await swapAnimation(i, min);
            [numbers[i], numbers[min]] = [numbers[min], numbers[i]];
            redrawNumbers(numbers);
            await sleep(400);
        }

        updateColors(i, min, -1, i + 1);
        await sleep(400);
    }

    updateColors(-1, -1, -1, numbers.length);
}

window.addEventListener("message", (event) => {
    console.log("Caught:", event.data);
});