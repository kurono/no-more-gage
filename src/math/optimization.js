/**
 * Compares fixed-rate level-payment schedules within an inclusive term range.
 *
 * Selects a schedule for the lowest payment, lowest interest, or the combined
 * objective. The combined comparison scales both measures to their ranges
 * and favors the lower monthly payment when scores tie.
 *
 * @author Ilya Tsivilskiy
 * @see optimizePayment
 * @see interestCoordinate
 * @see scheduledPayment
 */

(function () {
  const app = window.Mortgage;
  const { scheduledPayment } = app;

  /**
   * Returns an affine transform of total interest. A shared affine transform
   * leaves the normalized interest score unchanged. Scaling by the log rate
   * and using a series near zero keeps the score stable at small rates.
   * @param {number} logGrowth Logarithm of one plus the monthly rate.
   * @param {number} months Number of equal installments.
   * @returns {number}
   */
  function interestCoordinate(logGrowth, months) {
    const exponent = logGrowth * months;
    if (exponent < 0.01) {
      const square = exponent * exponent;
      return months * (0.5 + exponent * (1 / 12 - square * (1 / 720 - square / 30240)));
    }

    return (exponent / -Math.expm1(-exponent) - 1) / logGrowth;
  }

  /**
   * Picks a payoff schedule for the selected objectives. For the combined
   * objective, normalize each measure to its range and give each equal weight.
   * @param {number} balance Outstanding principal.
   * @param {number} rate Monthly interest rate.
   * @param {number} minMonths Shortest eligible payoff term in whole months.
   * @param {number} maxMonths Longest eligible payoff term in whole months.
   * @param {boolean} minimizePayment Whether to favor lower monthly payments.
   * @param {boolean} minimizeInterest Whether to favor lower total interest.
   * @returns {{ payment: number, months: number } | null}
   */
  function optimizePayment(balance, rate, minMonths, maxMonths, minimizePayment, minimizeInterest) {
    if ((!minimizePayment && !minimizeInterest) || balance <= 0 ||
        !Number.isSafeInteger(minMonths) || !Number.isSafeInteger(maxMonths) ||
        minMonths < 1 || minMonths > maxMonths) {
      return null;
    }

    if (!minimizeInterest || rate === 0 || minMonths === maxMonths) {
      return { payment: scheduledPayment(balance, rate, maxMonths), months: maxMonths };
    }

    if (!minimizePayment) {
      return { payment: scheduledPayment(balance, rate, minMonths), months: minMonths };
    }

    const logGrowth = Math.log1p(rate);
    const minimumTermFactor = -Math.expm1(-logGrowth * minMonths);
    const rangeFactor = -Math.expm1(-logGrowth * (maxMonths - minMonths));
    const minimumInterest = interestCoordinate(logGrowth, minMonths);
    const interestRange = interestCoordinate(logGrowth, maxMonths) - minimumInterest;
    let months = maxMonths;
    let bestScore = 1;

    // Both endpoints score one, so prefer the lower payment when scores tie.
    for (let candidate = maxMonths - 1; candidate > minMonths; candidate -= 1) {
      // Cancel the shared factors in the payment score to avoid subtracting
      // nearly identical payments for long terms at high rates.
      const discountRatio = Math.exp(-logGrowth * (candidate - minMonths));
      const remainingFactor = -Math.expm1(-logGrowth * (maxMonths - candidate));
      const termFactor = -Math.expm1(-logGrowth * candidate);
      const paymentScore = discountRatio * (remainingFactor / rangeFactor) * (minimumTermFactor / termFactor);
      const interestScore = (interestCoordinate(logGrowth, candidate) - minimumInterest) / interestRange;
      const score = paymentScore + interestScore;
      if (score < bestScore - 4 * Number.EPSILON) {
        months = candidate;
        bestScore = score;
      }
    }

    return { payment: scheduledPayment(balance, rate, months), months };
  }

  Object.assign(app, { optimizePayment });
})();
