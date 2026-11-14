# NoMoreGage

Estimate a fixed-rate mortgage payment or project the payoff of an existing loan. The interface supports English (default), Spanish, Tatar, and Russian. Use the same currency for all amounts.

## Run locally

Open [index.html](./index.html) in a browser. Keep [styles.css](./styles.css), [assets](./assets/), and [src](./src/) alongside it. The calculator runs offline with no installation or build step.

Choose **Light** or **Dark** from the **Theme** menu. Your choice is saved on the current browser when local storage is available.

## Use the calculator

Use the sliders to adjust the interest rate, repayment term, or optimizer bounds. The text fields beside them let you enter exact values. In **Payoff timeline**, move the slider to see the projected balance and both gauges as of the selected month. The principal gauge shows the share of the original loan repaid through that month. The interest gauge shows the share of payments still to come that will go toward interest. At payoff, the principal gauge shows 100% and the interest gauge shows a dash because no payments remain.

1. Enter the property price, either the down payment or the original loan principal, the annual interest rate, and the original term in years and months. The calculator updates the other financing amount. When you change the price, the most recently edited financing amount stays fixed.
2. For an existing mortgage, turn on **Existing mortgage**. Enter the total you have paid toward principal and interest, including extra payments, and the number of elapsed months covered by that total. Include months with missed payments in the elapsed period. The estimate treats the total as equal end-of-month installments. If you know the outstanding principal from a statement for the same period, enter it to account for the actual timing of your payments.
3. The **Monthly payment** field starts with the amount needed to clear the current balance within the remaining original term. Edit it to project a different payoff from today. Use **Use calculated payment** to return to the automatic amount. If the original term has ended and a balance remains, enter a monthly payment to project the payoff.
4. **Projected lifetime overpayment** shows how much the mortgage costs above the original principal, both as an amount and as a percentage of that principal. It includes past payments and projected future payments.

### Optimize payment

Select **Minimum monthly payment**, **Minimum total interest paid**, or both, then click **Find optimum**. Use **Minimum payoff term** and **Maximum payoff term** to set the inclusive range of eligible terms. Each bound accepts 1 to 600 whole months. A blank minimum starts at 1 month. A blank maximum uses the remaining original term, so enter a maximum if that term has ended. Enter the same value in both fields to evaluate a single term. The comparison uses the current balance and interest rate.

- **Minimum monthly payment** uses the longest allowed term.
- **Minimum total interest paid** uses the shortest allowed term at a positive rate. At 0% all terms cost the same in interest, so the longest allowed term gives the lowest monthly payment.
- **Both goals** give equal weight to the payment and interest after scaling each across its range. Ties favor the lower monthly payment.

**Use this payment** updates the monthly payment and the **Original repayment term** fields. For an existing loan, the updated term includes elapsed months plus the recommended months remaining. If you later enter a custom monthly payment, **Use calculated payment** recalculates it from the term currently in the form.

The optimizer's plot shows how monthly payment and remaining interest vary across the eligible terms, with a marker on the recommended option.

The estimate assumes a fixed nominal rate, monthly compounding, and payments at the end of each month. It covers principal and interest. Taxes, insurance, fees, and lender-specific rounding are excluded. Calculations use full precision internally and display amounts to two decimal places. A custom amount entered to the cent can lead to a final installment that differs from the one shown in calculated mode.

## Mortgage formulas

### Original principal and monthly rate

Let $H$ be the property price, $D$ the down payment, $P$ the original principal, and $a$ the nominal annual interest rate entered as a percentage. Let $Y$ and $m$ be the years and additional months of the original term.

$$
P = H - D,\qquad D = H - P,\qquad r = \frac{a}{1200},\qquad N = 12Y + m
$$

### Estimated balance from payment history

Let $Q$ be the total already paid toward principal and interest, and $k$ the number of months covered. For $k>0$, the calculator models the amount as $Q/k$ paid at the end of each month. The recurrence before the balance reaches zero is $B_j = (1+r)B_{j-1}-Q/k$, with $B_0=P$.

$$
B_{\mathrm{history}} =
\begin{cases}
P, & k=0 \\[6pt]
\max(0,\,P-Q), & k>0,\ r=0 \\[6pt]
\max\!\left(0,\,
P+\left(rP-\dfrac{Q}{k}\right)\dfrac{(1+r)^k-1}{r}\right), & k>0,\ r>0
\end{cases}
$$

An entered statement balance supplies $B$ directly. Otherwise, $B=B_{\mathrm{history}}$. The timing of extra payments affects the actual balance, so two loans with the same total paid and elapsed months can have different statement balances.

### Recalculated monthly payment

For a balance of $B$ repaid in $s$ monthly installments, the level payment is the balance divided by the present-value factor $A(r,s)$.

$$
A(r,s) =
\begin{cases}
\dfrac{1-(1+r)^{-s}}{r}, & r>0 \\[6pt]
s, & r=0
\end{cases}
\qquad
M_{\mathrm{calc}} = \frac{B}{A(r,s)} \quad (s>0)
$$

The calculator uses the original term less the elapsed months for the remaining installments.

$$
s=\max(0,\,N-k)
$$

For a new loan, $k=0$ and $B=P$. A zero balance has zero future payment, interest, and payoff time. If $B>0$ and $s=0$, a custom payment is needed to project the payoff.

### Payoff with a custom monthly payment

Each month $j$ starts with principal $B_{j-1}$ and accrues interest of $rB_{j-1}$. With a chosen payment $M$, the final installment is capped at the amount owed. Use $B_0=B$.

$$
M_j=\min\!\left(M,\,(1+r)B_{j-1}\right),
\qquad
B_j=(1+r)B_{j-1}-M_j
$$

For $B>0$, a payment at or below $rB$ cannot reduce the starting balance, so the calculator leaves the payoff time and future cost undefined. Otherwise, solving the annuity equation for the continuous number of months $t$ and rounding up gives the number of future installments $n$.

$$
t=
\begin{cases}
\dfrac{-\ln(1-rB/M)}{\ln(1+r)}, & r>0,\ M>rB \\[6pt]
\dfrac{B}{M}, & r=0,\ M>0
\end{cases}
\qquad
n=\lceil t\rceil
$$

The future payment total $T$ and remaining interest $I$ use the smaller final installment when the payoff falls between two whole installments.

$$
M_n=M(1+r)\,A\bigl(r,t-(n-1)\bigr),\qquad
T=(n-1)M+M_n,\qquad I=T-B
$$

For the calculated payment, $n=s$ and all $s$ installments use $M_{\mathrm{calc}}$. The breakdown bar allocates $B/T$ to principal and $I/T$ to interest when $T>0$.

### Lifetime overpayment

Add the past and projected future principal-and-interest payments and subtract the original amount borrowed. Divide by the original principal to express the overpayment as a percentage.

$$
O = Q + T - P,\qquad
\text{Lifetime overpayment percentage} = 100\,\frac{O}{P}\quad(P>0)
$$

The percentage covers the life of the loan. The annual rate determines how much interest accrues each month on the outstanding balance. If the chosen payment has no projected payoff, the lifetime overpayment is unavailable. A statement balance that implies a larger principal reduction than the recorded payments also leaves the lifetime figure unavailable until the entered amounts are corrected.

### Optimizing the payment and term

For each whole-month term $n$ from the selected minimum $n_{\min}$ through the selected maximum $n_{\max}$, compute the monthly payment $M_n$ and projected remaining interest $I_n$.

$$
M_n = \frac{B}{A(r,n)}, \qquad I_n = nM_n-B, \qquad 1 \le n_{\min} \le n \le n_{\max}
$$

When both goals are selected, choose the term with the smallest combined score. The minimums and maximums below use only terms in the selected range. Each component ranges from 0 to 1, where 0 is best. A component whose value is identical for all eligible terms contributes 0.

$$
S_n = \frac{1}{2}\left(
\frac{M_n - \min_j M_j}{\max_j M_j - \min_j M_j}
+ \frac{I_n - \min_j I_j}{\max_j I_j - \min_j I_j}
\right)
$$

Past payments are fixed across the comparison. Minimizing remaining interest also minimizes lifetime overpayment, since $O = I_n + Q + B - P$.

### Worked example

A property priced at 375,000.00 with a down payment of 75,000.00 leaves a principal of 300,000.00. At 6% for 30 years, the calculated monthly payment is 1,798.65. If you paid a total of 120,000.00 over 60 months, the estimated principal balance is 265,114.98. The monthly payment recalculates to 1,708.14 over the remaining 300 months. The projected future payments total 512,441.87, making the lifetime overpayment 332,441.87, or 110.81% of the original principal.

With both goals selected on that existing loan and a maximum of 300 months, the optimizer recommends 14,661.53 per month for 19 months, with 13,454.06 in remaining interest.

## Source structure

Classic scripts load in order from `index.html` and share the `window.Mortgage` namespace.

```text
index.html
styles.css
assets/            Light and dark logo and favicon files
src/
  core/
    bootstrap.js    Shared namespace, DOM references, and UI state
  math/
    mortgage.js     Fixed-rate mortgage math
    optimization.js  Payment and interest comparisons across payoff terms
  ui/
    language.js     Interface translations and locale definitions
    controls.js     Input parsing, validation, and rendering
    sliders.js      Synchronization between sliders and exact inputs
    visuals.js      Payoff timeline, gauges, and optimizer plot
  app/
    main.js         Event wiring and projection updates
```

## License

Copyright (c) 2026 Ilya Tsivilskiy
All rights reserved.

No permission is granted to use, copy, modify, merge, publish, distribute,
sublicense, sell, or otherwise exploit this software or its documentation,
in whole or in part, for any purpose, including commercial purposes, without
prior written permission from the copyright holder.

No express or implied patent license is granted.

Viewing the source code on GitHub or downloading it where technically enabled
does not grant any license or other rights beyond those required for normal
browsing of the repository on GitHub.

[LICENSE](./LICENSE)
