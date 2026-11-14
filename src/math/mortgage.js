/**
 * Fixed-rate mortgage payments, estimated balances, and payoff projections.
 *
 * Converts the annual rate to a monthly rate, values scheduled installments,
 * estimates the balance from payment history, and handles a partial final
 * payment when projecting a custom schedule.
 *
 * @author Ilya Tsivilskiy
 * @see monthlyRate
 * @see annuityFactor
 * @see scheduledPayment
 * @see historicalBalance
 * @see projectPayoff
 */

(function () {
  const app = window.Mortgage;

  /**
   * Converts a nominal annual percentage rate to a monthly rate.
   * @param {number} annualRatePercent Annual rate expressed as a percentage.
   * @returns {number}
   */
  function monthlyRate(annualRatePercent) {
    return annualRatePercent / 1200;
  }

  /**
   * Returns the present value of one unit paid monthly for the given period.
   * @param {number} rate Monthly interest rate.
   * @param {number} months Payment periods.
   * @returns {number}
   */
  function annuityFactor(rate, months) {
    const logDiscount = -months * Math.log1p(rate);
    if (-logDiscount < Number.EPSILON) {
      return months;
    }

    return -Math.expm1(logDiscount) / rate;
  }

  /**
   * Calculates the level installment that clears the balance by the last month.
   * @param {number} balance Outstanding principal.
   * @param {number} rate Monthly interest rate.
   * @param {number} months Remaining installments.
   * @returns {number}
   */
  function scheduledPayment(balance, rate, months) {
    if (balance === 0 || months === 0) {
      return 0;
    }

    return balance / annuityFactor(rate, months);
  }

  /**
   * Estimates today's balance by spreading past payments evenly across elapsed months.
   * @param {number} principal Original principal.
   * @param {number} rate Monthly interest rate.
   * @param {number} monthsPaid Elapsed monthly payment periods.
   * @param {number} totalPaid Total principal and interest paid across those periods.
   * @returns {number}
   */
  function historicalBalance(principal, rate, monthsPaid, totalPaid) {
    if (monthsPaid === 0 || principal === 0) {
      return principal;
    }

    if (rate === 0) {
      return Math.max(0, principal - totalPaid);
    }

    const monthlyInterest = principal * rate;
    const monthlyPayment = totalPaid / monthsPaid;
    const monthlyDifference = monthlyInterest - monthlyPayment;
    if (Math.abs(monthlyDifference) <= 2 * Number.EPSILON * monthlyInterest) {
      // Interest-only payments leave principal unchanged, even across long histories.
      return principal;
    }

    const logGrowth = monthsPaid * Math.log1p(rate);
    const accumulation = logGrowth < Number.EPSILON ? monthsPaid : Math.expm1(logGrowth) / rate;
    return Math.max(0, principal + monthlyDifference * accumulation);
  }

  /**
   * Solves the annuity equation for the continuous payment count.
   * @param {number} balance Outstanding principal.
   * @param {number} rate Monthly interest rate.
   * @param {number} payment Fixed monthly payment.
   * @param {number} monthlyInterest Interest charged in the first month.
   * @returns {number}
   */
  function payoffPeriods(balance, rate, payment, monthlyInterest) {
    if (rate === 0) {
      return balance / payment;
    }

    const logGrowth = Math.log1p(rate);
    const interestShare = monthlyInterest / payment;
    if (interestShare > 0.5) {
      // Use the positive difference directly when interest is close to payment.
      return -Math.log((payment - monthlyInterest) / payment) / logGrowth;
    }

    // Factoring out the zero-rate result preserves precision at very small rates.
    const correction = interestShare === 0 ? 1 : -Math.log1p(-interestShare) / interestShare;
    return (balance / payment) * (rate / logGrowth) * correction;
  }

  /**
   * Projects the payoff, including a smaller final installment when needed.
   * @param {number} balance Outstanding principal.
   * @param {number} rate Monthly interest rate.
   * @param {number} payment Fixed monthly payment.
   * @param {number} [scheduledMonths=0] Exact term when payment is calculated by scheduledPayment.
   * @returns {{ months: number, total: number, interest: number, lastPayment: number } | null}
   */
  function projectPayoff(balance, rate, payment, scheduledMonths = 0) {
    if (balance === 0) {
      return { months: 0, total: 0, interest: 0, lastPayment: 0 };
    }

    if (scheduledMonths > 0) {
      const total = rate === 0 ? balance : payment * scheduledMonths;
      const interest = Math.max(0, total - balance);
      return { months: scheduledMonths, total, interest, lastPayment: payment };
    }

    const monthlyInterest = balance * rate;
    // Products such as 100,000 × 0.00015 can land just below the exact value.
    const interestTolerance = 2 * Number.EPSILON * monthlyInterest;
    if (payment - monthlyInterest <= interestTolerance) {
      return null;
    }

    const firstMonthPayoff = balance + monthlyInterest;
    if (payment >= firstMonthPayoff) {
      return {
        months: 1,
        total: firstMonthPayoff,
        interest: monthlyInterest,
        lastPayment: firstMonthPayoff,
      };
    }

    const periods = payoffPeriods(balance, rate, payment, monthlyInterest);
    const nearestMonth = Math.round(periods);
    const tolerance = Math.min(1e-7, 8 * Number.EPSILON * periods);
    // Treat floating-point noise around a whole installment as an exact payoff.
    const exactMonths = Math.abs(periods - nearestMonth) <= tolerance;
    const months = exactMonths ? nearestMonth : Math.ceil(periods);
    const fullPayments = (months - 1) * payment;
    let lastPayment = payment;
    if (!exactMonths) {
      const finalPeriod = periods - (months - 1);
      lastPayment = rate === 0 ? balance - fullPayments : payment * annuityFactor(rate, finalPeriod) * (1 + rate);
    }

    const total = rate === 0 ? balance : fullPayments + lastPayment;
    const interest = Math.max(0, total - balance);

    return { months, total, interest, lastPayment };
  }

  Object.assign(app, {
    monthlyRate,
    annuityFactor,
    scheduledPayment,
    historicalBalance,
    projectPayoff,
  });
})();
