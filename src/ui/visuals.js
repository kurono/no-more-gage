/**
 * Renders the payoff timeline, payoff gauges, and optimization trade-off plot.
 *
 * Projects the balance at the selected payment month, updates both gauges,
 * and plots the monthly payment and interest for eligible payoff terms.
 *
 * @author Ilya Tsivilskiy
 * @see balanceAtMonth
 * @see updateSelection
 * @see renderVisuals
 * @see renderTradeoff
 */

(function () {
  const app = window.Mortgage;
  const { formatMoney, formatDuration, formatPercent, translate, annuityFactor, scheduledPayment } = app;
  const balanceChart = document.getElementById("balanceChart");
  const tradeoffChart = document.getElementById("tradeoffChart");
  const chartFrame = document.getElementById("chartFrame");
  const chartExplorer = document.getElementById("chartExplorer");
  const chartEmpty = document.getElementById("chartEmpty");
  const chartMonth = document.getElementById("chartMonth");
  const chartStart = document.getElementById("chartStart");
  const chartEnd = document.getElementById("chartEnd");
  const chartMidValue = document.getElementById("chartMidValue");
  const chartMidTerm = document.getElementById("chartMidTerm");
  const gaugeTitle = document.getElementById("gaugeTitle");
  const progressGauge = document.getElementById("progressGauge");
  const interestGauge = document.getElementById("interestGauge");
  const progressGaugeValue = document.getElementById("progressGaugeValue");
  const interestGaugeValue = document.getElementById("interestGaugeValue");

  const maxSliderSteps = 1000;
  const chartInset = 9;
  let timeline = null;
  let tradeoff = null;
  let sliderPosition = 0.5;
  let pendingDraw = false;

  /**
   * Values the payments remaining after a selected installment. Discounting
   * those payments avoids compounding large balances or iterating long loans.
   */
  function balanceAtMonth({ balance, rate, payment, payoff }, month) {
    if (month <= 0) {
      return balance;
    }
    if (month >= payoff.months) {
      return 0;
    }

    const periods = payoff.months - month;
    const lastPaymentValue = payoff.lastPayment * Math.exp(-periods * Math.log1p(rate));
    return Math.min(balance, payment * annuityFactor(rate, periods - 1) + lastPaymentValue);
  }

  /** Keeps the canvas sharp on high-density displays and reads theme colors. */
  function prepareCanvas(canvas) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const context = canvas.getContext("2d");
    if (!context || width === 0 || height === 0) {
      return null;
    }

    const density = Math.min(window.devicePixelRatio || 1, 3);
    const pixelWidth = Math.round(width * density);
    const pixelHeight = Math.round(height * density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
    context.clearRect(0, 0, width, height);
    const style = getComputedStyle(canvas);
    const color = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
    return {
      context, width, height,
      line: color("--chart-line", "#267659"),
      grid: color("--chart-grid", "#d7e1da"),
      fill: color("--chart-fill", "#3d9b7133"),
      fade: color("--chart-fade", "#3d9b7105"),
      axis: color("--chart-axis", "#516359"),
      dot: color("--chart-dot", "#fff"),
    };
  }

  function drawGrid(context, color, left, top, right, bottom, columns, rows) {
    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle = color;
    for (let row = 0; row <= rows; row += 1) {
      const y = top + (bottom - top) * row / rows;
      context.moveTo(left, y);
      context.lineTo(right, y);
    }
    for (let column = 0; column <= columns; column += 1) {
      const x = left + (right - left) * column / columns;
      context.moveTo(x, top);
      context.lineTo(x, bottom);
    }
    context.stroke();
  }

  function drawMarker(context, plot, x, y) {
    context.beginPath();
    context.arc(x, y, 4.5, 0, 2 * Math.PI);
    context.fillStyle = plot.dot;
    context.fill();
    context.lineWidth = 2.5;
    context.strokeStyle = plot.line;
    context.stroke();
  }

  function drawBalance() {
    if (!timeline) {
      return;
    }
    const plot = prepareCanvas(balanceChart);
    if (!plot) {
      return;
    }

    const { context, width, height } = plot;
    const left = chartInset;
    const right = width - chartInset;
    const top = 20;
    const bottom = height - 15;
    const totalMonths = timeline.payoff.months;
    const yForBalance = (value) => bottom - (value / timeline.balance) * (bottom - top);
    drawGrid(context, plot.grid, left, top, right, bottom, 6, 4);

    const steps = Math.min(Math.max(1, Math.floor(right - left)), totalMonths, 480);
    const points = [];
    for (let index = 0; index <= steps; index += 1) {
      const fraction = index / steps;
      const exactMonth = fraction * totalMonths;
      const month = Math.floor(exactMonth);
      const balance = balanceAtMonth(timeline, month);
      // Interpolate the sampled line between adjacent end-of-month values.
      const nextBalance = balanceAtMonth(timeline, month + 1);
      points.push({
        x: left + fraction * (right - left),
        y: yForBalance(balance + (nextBalance - balance) * (exactMonth - month)),
      });
    }

    const trace = () => {
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const { x, y } of points) {
        context.lineTo(x, y);
      }
    };
    const gradient = context.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, plot.fill);
    gradient.addColorStop(1, plot.fade);
    trace();
    context.lineTo(right, bottom);
    context.lineTo(left, bottom);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    trace();
    context.strokeStyle = plot.line;
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.stroke();

    const month = selectedMonth();
    const x = left + (month / totalMonths) * (right - left);
    const y = yForBalance(balanceAtMonth(timeline, month));
    context.beginPath();
    context.setLineDash([3, 4]);
    context.strokeStyle = plot.line;
    context.lineWidth = 1;
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
    context.setLineDash([]);
    drawMarker(context, plot, x, y);

    context.fillStyle = plot.axis;
    context.font = "11px sans-serif";
    const startLabel = formatMoney(timeline.balance);
    if (context.measureText(startLabel).width <= (right - left) * 0.7) {
      context.fillText(startLabel, left, 11);
    }
    context.fillText(formatMoney(0), left, height - 2);
  }

  function drawTradeoff() {
    if (!tradeoff || !tradeoffChart) {
      return;
    }
    const plot = prepareCanvas(tradeoffChart);
    if (!plot) {
      return;
    }

    const { context, width, height } = plot;
    const { balance, rate, minMonths, maxMonths, selectedMonths } = tradeoff;
    const left = chartInset;
    const right = width - chartInset;
    const top = 9;
    const bottom = height - 22;
    const maxPayment = scheduledPayment(balance, rate, minMonths);
    const minPayment = scheduledPayment(balance, rate, maxMonths);
    const maxInterestTotal = maxMonths * minPayment;
    const minInterestTotal = minMonths * maxPayment;
    const toPoint = (months) => {
      const payment = scheduledPayment(balance, rate, months);
      const interestTotal = months * payment;
      const paymentRange = maxPayment - minPayment;
      const interestRange = maxInterestTotal - minInterestTotal;
      const paymentFraction = paymentRange > 0 ? (payment - minPayment) / paymentRange : 0.5;
      const interestFraction = rate > 0 && interestRange > 0 ? (interestTotal - minInterestTotal) / interestRange : 0.5;
      return {
        x: left + paymentFraction * (right - left),
        y: bottom - interestFraction * (bottom - top),
      };
    };

    drawGrid(context, plot.grid, left, top, right, bottom, 4, 3);
    const steps = Math.min(Math.max(1, maxMonths - minMonths), 360);
    const start = toPoint(minMonths);
    context.beginPath();
    context.moveTo(start.x, start.y);
    for (let index = 1; index <= steps; index += 1) {
      const month = minMonths + Math.round((maxMonths - minMonths) * index / steps);
      const point = toPoint(month);
      context.lineTo(point.x, point.y);
    }
    context.strokeStyle = plot.line;
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.stroke();
    const marker = toPoint(selectedMonths);
    drawMarker(context, plot, marker.x, marker.y);

    context.fillStyle = plot.axis;
    context.font = "11px sans-serif";
    const minLabel = formatMoney(minPayment);
    const maxLabel = formatMoney(maxPayment);
    const minWidth = context.measureText(minLabel).width;
    const maxWidth = context.measureText(maxLabel).width;
    const labelY = height - 3;
    if (minLabel === maxLabel && minWidth <= right - left) {
      context.textAlign = "center";
      context.fillText(minLabel, (left + right) / 2, labelY);
    } else if (minWidth + maxWidth + 12 <= right - left) {
      context.textAlign = "left";
      context.fillText(minLabel, left, labelY);
      context.textAlign = "right";
      context.fillText(maxLabel, right, labelY);
    }
  }

  function draw() {
    if (!pendingDraw) {
      pendingDraw = true;
      requestAnimationFrame(() => {
        pendingDraw = false;
        drawBalance();
        drawTradeoff();
      });
    }
  }

  function selectedMonth() {
    return Math.round(Number(chartMonth.value) / Number(chartMonth.max) * timeline.payoff.months);
  }

  function updateSelection() {
    const month = selectedMonth();
    const duration = formatDuration(month);
    const balance = balanceAtMonth(timeline, month);
    const amount = formatMoney(balance);
    const { payoff, payment, principal } = timeline;
    const periods = payoff.months - month;
    // Only the installments after the selected month count, including any partial final payment.
    let remainingPayments = payoff.total;
    if (month > 0) {
      remainingPayments = periods > 0 ? (periods - 1) * payment + payoff.lastPayment : 0;
    }
    updateGauges(principal, balance, remainingPayments);
    chartMidTerm.textContent = duration;
    chartMidValue.textContent = amount;
    chartMonth.style.setProperty("--slider-progress", `${100 * Number(chartMonth.value) / Number(chartMonth.max)}%`);
    chartMonth.setAttribute("aria-valuetext", `${duration} · ${amount}`);
    draw();
  }

  function updateGauge(gauge, valueElement, ratio) {
    const fill = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
    gauge.style.setProperty("--gauge-fill", `${100 * fill}%`);
    valueElement.textContent = ratio === null ? "—" : formatPercent(fill, fill === 1);
  }

  function updateGauges(principal, balance, remainingPayments) {
    const progress = balance !== null && principal > 0 ? (principal - balance) / principal : null;
    const interestShare = remainingPayments > 0 ? (remainingPayments - balance) / remainingPayments : null;
    updateGauge(progressGauge, progressGaugeValue, progress);
    updateGauge(interestGauge, interestGaugeValue, interestShare);
  }

  /** Refreshes the plot and gauges from the current estimate. */
  function renderVisuals({ balance = null, rate = 0, payment = 0, payoff = null, principal = null } = {}) {
    timeline = balance > 0 && payoff && payoff.months > 0 ? { balance, rate, payment, payoff, principal } : null;
    chartFrame.hidden = !timeline;
    chartExplorer.hidden = !timeline;
    chartEmpty.hidden = Boolean(timeline);
    chartMonth.disabled = !timeline;
    gaugeTitle.textContent = translate(timeline ? "gaugesAsOfMonth" : "chartToday");
    if (timeline) {
      chartStart.textContent = translate("chartToday");
      chartEnd.textContent = formatDuration(payoff.months);
      const steps = Math.min(payoff.months, maxSliderSteps);
      chartMonth.max = steps;
      chartMonth.value = Math.round(sliderPosition * steps);
      updateSelection();
    } else {
      updateGauges(principal, balance, payoff?.total ?? 0);
    }
  }

  /** Refreshes the curve for the selected optimization range. */
  function renderTradeoff(data) {
    tradeoff = data;
    if (tradeoff) {
      draw();
    }
  }

  function selectOnChart(event) {
    if (!timeline) {
      return;
    }
    const bounds = balanceChart.getBoundingClientRect();
    const fraction = (event.clientX - bounds.left - chartInset) / (bounds.width - 2 * chartInset);
    sliderPosition = Math.min(1, Math.max(0, fraction));
    chartMonth.value = Math.round(sliderPosition * Number(chartMonth.max));
    updateSelection();
  }

  chartMonth.addEventListener("input", () => {
    sliderPosition = Number(chartMonth.value) / Number(chartMonth.max);
    updateSelection();
  });
  balanceChart.addEventListener("pointerdown", selectOnChart);
  balanceChart.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") {
      selectOnChart(event);
    }
  });
  if (typeof ResizeObserver !== "undefined") {
    const resize = new ResizeObserver(draw);
    resize.observe(balanceChart);
    if (tradeoffChart) {
      resize.observe(tradeoffChart);
    }
  } else {
    window.addEventListener("resize", draw);
  }

  Object.assign(app, { renderVisuals, renderTradeoff });
})();
