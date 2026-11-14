/**
 * Initializes the shared NoMoreGage namespace and application state.
 *
 * Caches form controls, result elements, and field error elements before the
 * calculation and UI scripts run.
 *
 * @author Ilya Tsivilskiy
 * @see window.Mortgage
 * @see controls
 * @see outputs
 * @see fieldErrors
 * @see state
 */

(function () {
  const app = (window.Mortgage = window.Mortgage || {});

  const fieldIds = [
    "propertyPrice", "downPayment", "principal", "annualRate", "termYears",
    "termMonths", "totalPaid", "elapsedMonths", "balanceOverride", "monthlyPayment",
  ];
  const controlIds = [
    "loanForm", "language", "theme", "resetLoan", "existingLoan", "existingLoanFields",
    "useCalculated", "estimate", "optimizerForm", "minimizePayment",
    "minimizeInterest", "optimizeMinMonths", "optimizeMaxMonths", "recommendationTitle", "useOptimized",
    ...fieldIds,
  ];
  const outputIds = [
    "paymentResult", "balanceResult", "durationResult", "estimateNotice",
    "principalShare", "breakdownPrincipal", "interestResult", "totalResult",
    "lastPaymentResult", "overpaymentResult", "overpaymentPercent", "overpaymentNotice",
    "optimizeHint", "optimizeCompromise", "optimizeMinMonthsError", "optimizeMaxMonthsError",
    "optimizationStatus",
    "optimizationResult", "optimizedPayment", "optimizedTerm", "optimizedInterest",
    "optimizedOverpaymentRow", "optimizedOverpayment",
  ];

  const controls = Object.fromEntries(controlIds.map((id) => [id, document.getElementById(id)]));
  const outputs = Object.fromEntries(outputIds.map((id) => [id, document.getElementById(id)]));
  const fieldErrors = Object.fromEntries(fieldIds.map((id) => [id, document.getElementById(`${id}Error`)]));

  const state = {
    language: "en",
    amountSource: "downPayment",
    customPayment: false,
  };

  Object.assign(app, { controls, outputs, fieldErrors, state });
})();
