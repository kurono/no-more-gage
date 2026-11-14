/**
 * Handles form localization, validation, theme selection, and results.
 *
 * Parses numbers using the selected locale, reports input errors, and renders
 * estimates and optimization recommendations.
 *
 * @author Ilya Tsivilskiy
 * @see initializeTheme
 * @see setLanguage
 * @see readLoan
 * @see readOptimizationRange
 * @see renderEstimate
 * @see renderOptimization
 */

(function () {
  const app = window.Mortgage;
  const { controls, outputs, fieldErrors, state, messages, locales } = app;
  const maxMoney = 999999999999.99;
  const maxTerm = 50 * 12;
  const maxElapsedMonths = 100 * 12;
  const moneyFields = ["propertyPrice", "downPayment", "principal", "totalPaid", "balanceOverride", "monthlyPayment"];
  const integerFields = ["termYears", "termMonths", "elapsedMonths"];
  const localizedText = document.querySelectorAll("[data-message]");
  const localizedLabels = document.querySelectorAll("[data-label]");
  const themeStorageKey = "mortgage-calculator-theme";
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const brandMark = document.getElementById("brandMark");
  const siteIcon = document.getElementById("siteIcon");
  let formatters;

  /** Restores the saved theme and keeps the native selector in sync. */
  function initializeTheme() {
    const root = document.documentElement;

    function applyTheme(value) {
      const theme = value === "dark" ? "dark" : "light";
      controls.theme.value = theme;
      root.dataset.theme = theme;
      themeColor.content = getComputedStyle(root).getPropertyValue("--bg").trim();
      brandMark.src = `assets/nomoregage-${theme}.png`;
      siteIcon.href = `assets/nomoregage-${theme}.ico`;
    }

    let savedTheme = null;
    try {
      savedTheme = window.localStorage.getItem(themeStorageKey);
    } catch {
      // File URLs or browser privacy settings may disable storage.
    }
    applyTheme(savedTheme);
    controls.theme.addEventListener("change", () => {
      applyTheme(controls.theme.value);
      try {
        window.localStorage.setItem(themeStorageKey, controls.theme.value);
      } catch {
        // The theme still applies for the current page.
      }
    });
  }

  /** Looks up a message and replaces any named placeholders. */
  function translate(key, values = {}) {
    return messages[state.language][key].replace(/\{(\w+)\}/g, (_, name) => values[name]);
  }

  /** Parses a decimal input while respecting the selected locale's separators. */
  function readNumber(value, allowGrouping) {
    const text = value.trim().replace(/[\u00a0\u202f]/g, " ");
    const { group, groupedNumber } = formatters;
    let normalized = text;

    if (allowGrouping && groupedNumber.test(text)) {
      normalized = normalized.replaceAll(group, "").replaceAll(" ", "");
    }

    normalized = normalized.replace(",", ".");

    if (!/^\d+(?:\.\d*)?$|^\.\d+$/.test(normalized)) {
      return null;
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? { number, decimals: (normalized.split(".")[1] || "").length } : null;
  }

  /** Updates page language and reformats valid inputs without changing their values. */
  function setLanguage(language) {
    const previousValues = formatters
      ? Object.keys(fieldErrors).map((id) => [id, readNumber(controls[id].value, moneyFields.includes(id))])
      : [];

    state.language = language;
    document.documentElement.lang = language;
    localizedText.forEach((element) => {
      element.textContent = translate(element.dataset.message);
    });
    localizedLabels.forEach((element) => {
      element.setAttribute("aria-label", translate(element.dataset.label));
    });

    const locale = locales[language];
    const money = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const decimalNumber = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 20 });
    const integer = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const percent = new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const wholePercent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
    const parts = money.formatToParts(1234567.89);
    const decimal = parts.find((part) => part.type === "decimal").value;
    const group = parts.find((part) => part.type === "group").value.replace(/[\u00a0\u202f]/g, " ");
    const groupingPattern = group === "." ? "[. ]" : group === "," ? "[, ]" : " ";
    const decimalPattern = decimal === "." ? "[.]" : ",";
    formatters = {
      money,
      decimalNumber,
      integer,
      percent,
      wholePercent,
      group,
      groupedNumber: new RegExp(`^[1-9]\\d{0,2}(${groupingPattern})\\d{3}(?:\\1\\d{3})*(?:${decimalPattern}\\d*)?$`),
    };

    for (const [id, value] of previousValues) {
      if (value && !controls[id].hasAttribute("aria-invalid")) {
        controls[id].value = formatInput(id, value.number);
      }
    }
  }

  function formatInput(id, value) {
    return moneyFields.includes(id) ? formatMoney(value) : formatters.decimalNumber.format(value);
  }

  function readInputNumber(id) {
    return readNumber(controls[id].value, moneyFields.includes(id))?.number ?? null;
  }

  function formatMoney(value) {
    return value === null ? "—" : formatters.money.format(value);
  }

  function formatPercent(ratio, whole = false) {
    const formatter = whole ? formatters.wholePercent : formatters.percent;
    return ratio === null ? "—" : formatter.format(ratio);
  }

  /** Formats an input on leaving the field so typing and cursor movement stay natural. */
  function formatField(id) {
    const field = controls[id];
    const value = readNumber(field.value, moneyFields.includes(id));
    if (value && !field.hasAttribute("aria-invalid")) {
      field.value = formatInput(id, value.number);
    }
  }

  /** Copies field errors to their associated descriptions and accessible state. */
  function renderErrors(errors) {
    for (const [id, element] of Object.entries(fieldErrors)) {
      const error = errors[id];
      element.textContent = error ? translate(error.key, error.values) : "";
      element.hidden = !error;
      if (error) {
        controls[id].setAttribute("aria-invalid", "true");
      } else {
        controls[id].removeAttribute("aria-invalid");
      }
    }
  }

  /**
   * Reads the current inputs. Property price and the last edited financing
   * amount determine the other financing amount.
   */
  function readLoan() {
    const errors = {};

    function readField(id) {
      const isMoney = moneyFields.includes(id);
      const parsed = readNumber(controls[id].value, isMoney);

      if (!parsed) {
        errors[id] = { key: "invalidNumber" };
      } else if (isMoney && parsed.decimals > 2) {
        errors[id] = { key: "invalidMoney" };
      } else if (isMoney && parsed.number > maxMoney) {
        errors[id] = { key: "moneyLimit", values: { max: formatters.money.format(maxMoney) } };
      } else if (integerFields.includes(id) && !Number.isSafeInteger(parsed.number)) {
        errors[id] = { key: "wholeNumber" };
      }

      return errors[id] ? null : parsed.number;
    }

    const price = readField("propertyPrice");
    if (price === 0) {
      errors.propertyPrice = { key: "pricePositive" };
    }

    const source = state.amountSource;
    const dependent = source === "downPayment" ? "principal" : "downPayment";
    const amount = readField(source);
    let principal = null;

    if (price > 0 && amount !== null && amount <= price) {
      // Subtract in cents so linked edits do not accumulate floating-point noise.
      const difference = (Math.round(price * 100) - Math.round(amount * 100)) / 100;
      controls[dependent].value = formatInput(dependent, difference);
      principal = source === "principal" ? amount : difference;
    } else {
      controls[dependent].value = "";
      if (price > 0 && amount > price) {
        errors[source] = { key: source === "principal" ? "principalLimit" : "downLimit" };
      }
    }

    const annualRate = readField("annualRate");
    if (annualRate > 100) {
      errors.annualRate = { key: "rateLimit" };
    }

    const years = readField("termYears");
    const months = readField("termMonths");
    const term = years * 12 + months;

    let totalPaid = 0;
    let elapsedMonths = 0;
    let override = null;
    if (controls.existingLoan.checked) {
      totalPaid = readField("totalPaid");
      elapsedMonths = readField("elapsedMonths");
      if (elapsedMonths > maxElapsedMonths) {
        errors.elapsedMonths = { key: "elapsedLimit", values: { max: formatters.integer.format(maxElapsedMonths) } };
      } else if (elapsedMonths === 0 && totalPaid > 0) {
        errors.elapsedMonths = { key: "paymentWithoutMonths" };
      }
      if (controls.balanceOverride.value.trim()) {
        override = readField("balanceOverride");
      }
    }

    // Applying a recommendation can add up to maxTerm future months to the loan history.
    const termLimit = maxTerm + (errors.elapsedMonths ? 0 : elapsedMonths);
    if (months > 11) {
      errors.termMonths = { key: "monthsLimit" };
    } else if (years !== null && months !== null && (term < 1 || term > termLimit)) {
      errors.termYears = { key: "termLimit", values: { max: formatDuration(termLimit) } };
    }

    const payment = state.customPayment ? readField("monthlyPayment") : null;
    return { principal, annualRate, term, elapsedMonths, totalPaid, override, payment, errors };
  }

  function formatDuration(count) {
    const years = Math.floor(count / 12);
    const months = count % 12;
    const values = { years: formatters.integer.format(years), months: formatters.integer.format(months) };

    if (!count) {
      return translate("zeroDuration");
    }
    if (years && months) {
      return translate("durationBoth", values);
    }
    return translate(years ? "durationYears" : "durationMonths", values);
  }

  /** Reads the inclusive payoff bounds independently of the loan fields. */
  function readOptimizationRange(fallbackMonths) {
    const errors = {};

    function readBound(id, fallback) {
      const value = controls[id].value.trim();
      if (!value) {
        return fallback;
      }

      const parsed = readNumber(value, false);
      if (!parsed || !Number.isInteger(parsed.number) || parsed.number < 1 || parsed.number > maxTerm) {
        errors[id] = translate("optimizeTermLimit", { max: formatters.integer.format(maxTerm) });
        return null;
      }

      return parsed.number;
    }

    const minMonths = readBound("optimizeMinMonths", 1);
    const maxMonths = readBound("optimizeMaxMonths", fallbackMonths);
    if (minMonths !== null && maxMonths > 0 && minMonths > maxMonths) {
      errors.optimizeMaxMonths = translate("optimizeInvalidRange", { min: formatters.integer.format(minMonths) });
    }

    return { minMonths, maxMonths, errors };
  }

  function renderOptimization({ minMonths, maxMonths, errors }, recommendation, notice) {
    outputs.optimizeHint.textContent = maxMonths && !Object.keys(errors).length
      ? translate("optimizeHint", { min: formatDuration(minMonths), max: formatDuration(maxMonths) })
      : translate("optimizeTermOnly");
    outputs.optimizeCompromise.hidden = !(controls.minimizePayment.checked && controls.minimizeInterest.checked);
    for (const id of ["optimizeMinMonths", "optimizeMaxMonths"]) {
      const error = errors[id];
      const output = outputs[`${id}Error`];
      output.hidden = !error;
      output.textContent = error || "";
      if (error) {
        controls[id].setAttribute("aria-invalid", "true");
      } else {
        controls[id].removeAttribute("aria-invalid");
      }
    }
    const message = notice ? translate(notice) : "";
    if (outputs.optimizationStatus.textContent !== message) {
      outputs.optimizationStatus.textContent = message;
    }

    outputs.optimizationResult.hidden = !recommendation;
    if (recommendation) {
      const { payment, payoff, overpayment } = recommendation;
      outputs.optimizedPayment.textContent = formatters.money.format(payment);
      outputs.optimizedTerm.textContent = formatDuration(payoff.months);
      outputs.optimizedInterest.textContent = formatters.money.format(payoff.interest);
      outputs.optimizedOverpaymentRow.hidden = !overpayment;
      outputs.optimizedOverpayment.textContent = overpayment ? formatters.money.format(overpayment.amount) : "";
    }
  }

  /** Renders known amounts even when the chosen payment cannot produce a payoff. */
  function renderEstimate({
    balance = null, payment = null, payoff = null, notice = null,
    overpayment = null, incompletePaymentHistory = false,
  } = {}) {
    outputs.paymentResult.textContent = formatMoney(payment);
    outputs.balanceResult.textContent = formatMoney(balance);
    outputs.durationResult.textContent = payoff ? formatDuration(payoff.months) : "—";
    outputs.breakdownPrincipal.textContent = formatMoney(balance);
    outputs.interestResult.textContent = formatMoney(payoff ? payoff.interest : null);
    outputs.totalResult.textContent = formatMoney(payoff ? payoff.total : null);
    outputs.lastPaymentResult.textContent = formatMoney(payoff ? payoff.lastPayment : null);
    outputs.overpaymentResult.textContent = formatMoney(overpayment?.amount ?? null);
    const ratio = overpayment?.ratio ?? null;
    outputs.overpaymentPercent.hidden = ratio === null;
    outputs.overpaymentPercent.textContent = ratio === null
      ? ""
      : translate("overpaymentOfPrincipal", { percent: formatPercent(ratio) });
    outputs.overpaymentNotice.hidden = !incompletePaymentHistory;
    outputs.overpaymentNotice.textContent = incompletePaymentHistory ? translate("incompletePaymentHistory") : "";
    outputs.principalShare.parentElement.hidden = !payoff || payoff.total === 0;
    outputs.principalShare.style.width = payoff?.total ? `${100 * (balance / payoff.total)}%` : "0%";

    const message = notice ? translate(notice.key, notice.values) : "";
    outputs.estimateNotice.hidden = !message;
    if (outputs.estimateNotice.textContent !== message) {
      outputs.estimateNotice.textContent = message;
    }
  }

  Object.assign(app, {
    initializeTheme,
    setLanguage,
    formatField,
    readLoan,
    readOptimizationRange,
    renderOptimization,
    renderErrors,
    renderEstimate,
    formatInput,
    readInputNumber,
    formatMoney,
    formatPercent,
    formatDuration,
    translate,
    maxTerm,
    maxElapsedMonths,
  });
})();
