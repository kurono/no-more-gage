/**
 * Synchronizes range sliders with the corresponding text inputs.
 *
 * Updates slider positions, scales, and localized labels after form changes.
 * Sends slider edits through the form's input handlers and keeps the two
 * optimizer bounds in order during slider adjustments.
 *
 * @author Ilya Tsivilskiy
 * @see initializeSliders
 * @see syncSliders
 * @see readOptimizationRange
 */

(function () {
  const app = window.Mortgage;
  const {
    controls, maxTerm, maxElapsedMonths, readInputNumber, formatInput,
    formatDuration, formatPercent, readOptimizationRange, translate,
  } = app;
  const sliders = Array.from(document.querySelectorAll("[data-slider-for]"), (element) => {
    const id = element.dataset.sliderFor;
    return {
      id,
      element,
      baseMax: Number(element.max),
      label: document.getElementById(element.dataset.sliderLabel),
      start: document.querySelector(`[data-slider-start="${id}"]`),
      end: document.querySelector(`[data-slider-end="${id}"]`),
    };
  });
  let annualSliderActive = false;
  let remainingMonths = 0;

  function formatSliderValue(id, value) {
    return id === "annualRate" ? formatPercent(value / 100) : formatDuration(value);
  }

  function elapsedMonths() {
    const months = controls.existingLoan.checked ? readInputNumber("elapsedMonths") : null;
    return Number.isInteger(months) && months >= 0 && months <= maxElapsedMonths ? months : 0;
  }

  /** Refreshes the sliders after typing, resetting, translating, or applying a plan. */
  function syncSliders(loan) {
    remainingMonths = loan?.months ?? 0;
    const range = readOptimizationRange(remainingMonths);

    for (const { id, element, baseMax, label, start, end } of sliders) {
      let value = readInputNumber(id);
      if (id === "annualRate" && !annualSliderActive) {
        // Let a precisely typed outlier expand the rate scale without changing it mid-drag.
        element.max = Math.min(100, Math.max(baseMax, Math.ceil((value ?? 0) / baseMax) * baseMax));
      } else if (id === "termYears") {
        element.max = maxTerm + elapsedMonths();
        value = value === null ? null : value * 12 + (readInputNumber("termMonths") ?? 0);
      } else if (id === "optimizeMinMonths") {
        value = range.minMonths;
      } else if (id === "optimizeMaxMonths") {
        value = range.maxMonths || range.minMonths;
      }

      if (value !== null) {
        element.value = String(value);
      }
      const minimum = Number(element.min);
      const maximum = Number(element.max);
      const selected = element.valueAsNumber;
      element.style.setProperty("--slider-progress", `${100 * (selected - minimum) / (maximum - minimum)}%`);
      element.setAttribute("aria-valuetext", formatSliderValue(id, selected));
      if (label) {
        element.setAttribute("aria-label", translate("adjustSlider", { field: label.textContent.trim() }));
      }

      if (start) {
        start.textContent = formatSliderValue(id, minimum);
      }
      if (end) {
        end.textContent = formatSliderValue(id, maximum);
      }
    }
  }

  /** Routes slider input through the same listeners as the corresponding typed field. */
  function initializeSliders() {
    for (const { id, element } of sliders) {
      element.addEventListener("input", (event) => {
        event.stopPropagation();
        let value = element.valueAsNumber;

        if (id === "termYears") {
          controls.termMonths.value = formatInput("termMonths", value % 12);
          value = Math.floor(value / 12);
        } else if (id === "optimizeMinMonths" || id === "optimizeMaxMonths") {
          const { minMonths, maxMonths } = readOptimizationRange(remainingMonths);
          if (id === "optimizeMinMonths" && maxMonths > 0) {
            value = Math.min(value, maxMonths);
          } else if (id === "optimizeMaxMonths" && minMonths !== null) {
            value = Math.max(value, minMonths);
          }
        }

        controls[id].value = formatInput(id, value);
        annualSliderActive = id === "annualRate";
        controls[id].dispatchEvent(new Event("input", { bubbles: true }));
        annualSliderActive = false;
      });
    }
  }

  Object.assign(app, { initializeSliders, syncSliders });
})();
