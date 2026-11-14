/**
 * Coordinates loan estimates, optimization, and user interactions.
 *
 * Prepares the current loan for both calculations, updates the dashboard as
 * inputs change, and applies the recommended payoff term to the form.
 *
 * @author Ilya Tsivilskiy
 * @see prepareLoan
 * @see calculateOverpayment
 * @see updateOptimization
 * @see updateEstimate
 */

(function () {
  const app = window.Mortgage;
  const {
    controls, state, fieldErrors, initializeTheme, setLanguage, formatField, readLoan, renderErrors,
    renderEstimate, formatInput, monthlyRate, scheduledPayment, historicalBalance,
    projectPayoff, optimizePayment, readOptimizationRange, renderOptimization,
    initializeSliders, syncSliders, renderVisuals, renderTradeoff,
  } = app;

  let currentLoan = null;
  let recommendation = null;
  let optimizationNotice = null;

  /** Shares the same balance and rate between the estimate and the optimizer. */
  function prepareLoan(loan) {
    if (Object.keys(loan.errors).some((id) => id !== "monthlyPayment")) {
      return null;
    }

    const rate = monthlyRate(loan.annualRate);
    const months = Math.max(0, loan.term - loan.elapsedMonths);
    const balance = loan.override ?? historicalBalance(loan.principal, rate, loan.elapsedMonths, loan.totalPaid);
    // With a statement balance, the reduction in principal cannot exceed the amount paid.
    const incompletePaymentHistory = loan.override !== null &&
      Math.round(loan.totalPaid * 100) + Math.round(balance * 100) < Math.round(loan.principal * 100);
    return { ...loan, rate, months, balance, incompletePaymentHistory };
  }

  function calculateOverpayment(loan, payoff) {
    if (!payoff || loan.incompletePaymentHistory) {
      return null;
    }

    const amount = Math.max(0, loan.totalPaid + payoff.total - loan.principal);
    return { amount, ratio: loan.principal > 0 ? amount / loan.principal : null };
  }

  function updateOptimization() {
    const range = readOptimizationRange(currentLoan?.months ?? 0);
    renderOptimization(range, recommendation, optimizationNotice);
    renderTradeoff(recommendation?.tradeoff ?? null);
    syncSliders(currentLoan);
  }

  function clearRecommendation() {
    recommendation = null;
    optimizationNotice = null;
  }

  function updateEstimate() {
    controls.existingLoanFields.hidden = !controls.existingLoan.checked;
    controls.useCalculated.hidden = !state.customPayment;

    const loan = readLoan();
    currentLoan = prepareLoan(loan);
    updateOptimization();
    if (Object.keys(loan.errors).length) {
      renderErrors(loan.errors);
      if (!state.customPayment) {
        controls.monthlyPayment.value = "";
      }
      renderEstimate({ notice: { key: "invalidEstimate" } });
      renderVisuals(currentLoan ?? {});
      return;
    }

    const { rate, months, balance, incompletePaymentHistory } = currentLoan;
    if (!state.customPayment && balance > 0 && months === 0) {
      controls.monthlyPayment.value = "";
      renderErrors({ monthlyPayment: { key: "expiredTerm" } });
      renderEstimate({ balance, notice: { key: "expiredTerm" }, incompletePaymentHistory });
      renderVisuals(currentLoan);
      return;
    }

    renderErrors({});
    const payment = state.customPayment ? loan.payment : scheduledPayment(balance, rate, months);
    if (!state.customPayment) {
      controls.monthlyPayment.value = formatInput("monthlyPayment", payment);
    }

    const payoff = projectPayoff(balance, rate, payment, state.customPayment ? 0 : months);
    let notice = null;
    if (!balance) {
      notice = { key: "noLoan" };
    } else if (!payoff) {
      const interestInCents = balance * rate * 100;
      const monthlyInterest = Math.floor(interestInCents + 2 * Number.EPSILON * interestInCents) / 100;
      notice = { key: "nonAmortizing", values: { amount: formatInput("monthlyPayment", monthlyInterest) } };
    } else if (payoff.months > months) {
      notice = { key: "extendedPayoff" };
    }

    const overpayment = calculateOverpayment(currentLoan, payoff);
    renderEstimate({ balance, payment: balance ? payment : 0, payoff, notice, overpayment, incompletePaymentHistory });
    renderVisuals({ balance, principal: loan.principal, rate, payment, payoff });
  }

  controls.optimizerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearRecommendation();

    const minimizePayment = controls.minimizePayment.checked;
    const minimizeInterest = controls.minimizeInterest.checked;
    const range = readOptimizationRange(currentLoan?.months ?? 0);
    if (!minimizePayment && !minimizeInterest) {
      optimizationNotice = "chooseObjective";
    } else if (!currentLoan) {
      optimizationNotice = "optimizeInvalidLoan";
    } else if (!currentLoan.balance) {
      optimizationNotice = "optimizeNoBalance";
    } else if (Object.keys(range.errors).length) {
      const firstInvalid = Object.keys(range.errors)[0];
      controls[firstInvalid].focus();
    } else if (!range.maxMonths) {
      optimizationNotice = "optimizeExpiryHint";
    } else {
      const { balance, rate } = currentLoan;
      const { minMonths, maxMonths } = range;
      const { payment, months } = optimizePayment(balance, rate, minMonths, maxMonths, minimizePayment, minimizeInterest);
      const payoff = projectPayoff(balance, rate, payment, months);
      const tradeoff = { balance, rate, minMonths, maxMonths, selectedMonths: months };
      recommendation = { payment, payoff, overpayment: calculateOverpayment(currentLoan, payoff), tradeoff };
    }

    renderOptimization(range, recommendation, optimizationNotice);
    renderTradeoff(recommendation?.tradeoff ?? null);
    if (recommendation) {
      controls.recommendationTitle.focus();
    }
  });

  controls.optimizerForm.addEventListener("input", () => {
    clearRecommendation();
    updateOptimization();
  });
  controls.useOptimized.addEventListener("click", () => {
    if (recommendation) {
      state.customPayment = false;
      // The term field covers the entire loan, including months already elapsed.
      const term = currentLoan.elapsedMonths + recommendation.payoff.months;
      controls.termYears.value = formatInput("termYears", Math.floor(term / 12));
      controls.termMonths.value = formatInput("termMonths", term % 12);
      optimizationNotice = "optimizeApplied";
      updateEstimate();
      controls.estimate.focus();
    }
  });

  controls.loanForm.addEventListener("submit", (event) => event.preventDefault());
  controls.loanForm.addEventListener("input", (event) => {
    const id = event.target.id;
    if (id === "principal" || id === "downPayment") {
      state.amountSource = id;
    }
    if (id === "monthlyPayment") {
      state.customPayment = true;
      optimizationNotice = null;
    } else {
      clearRecommendation();
    }
    updateEstimate();
  });

  for (const id of Object.keys(fieldErrors)) {
    controls[id].addEventListener("blur", () => formatField(id));
  }

  controls.language.addEventListener("change", () => {
    setLanguage(controls.language.value);
    updateEstimate();
  });
  controls.theme.addEventListener("change", updateEstimate);
  controls.useCalculated.addEventListener("click", () => {
    state.customPayment = false;
    optimizationNotice = null;
    updateEstimate();
    controls.monthlyPayment.focus({ preventScroll: true });
  });
  controls.resetLoan.addEventListener("click", () => {
    controls.loanForm.reset();
    controls.optimizerForm.reset();
    state.amountSource = "downPayment";
    state.customPayment = false;
    clearRecommendation();
    updateEstimate();
    for (const id of Object.keys(fieldErrors)) {
      formatField(id);
    }
  });

  initializeTheme();
  setLanguage(state.language);
  initializeSliders();
  updateEstimate();
  for (const id of Object.keys(fieldErrors)) {
    formatField(id);
  }
})();
