// Same-origin by default (FastAPI serves this frontend).
// If the frontend is hosted separately, set e.g. "https://your-api.onrender.com"
const API_BASE = "";

const $ = (s) => document.querySelector(s);
const form = $("#form"), btn = $("#submitBtn"), errEl = $("#error"), card = $("#result");
const pctEl = $("#pct"), fill = $("#fill"), mark = $("#mark"), tick = $("#tick");
const CIRC = 553; // 2 * PI * 88
let busy = false, raf = 0;

const PRESETS = {
  low: { person_age: 40, person_income: 110000, person_home_ownership: "MORTGAGE", person_emp_length: 12,
         loan_intent: "DEBTCONSOLIDATION", loan_grade: "A", loan_amnt: 8000, loan_int_rate: 7.2,
         cb_person_default_on_file: "N", cb_person_cred_hist_length: 15 },
  high: { person_age: 23, person_income: 18000, person_home_ownership: "RENT", person_emp_length: 0,
          loan_intent: "MEDICAL", loan_grade: "F", loan_amnt: 12000, loan_int_rate: 19.5,
          cb_person_default_on_file: "Y", cb_person_cred_hist_length: 2 },
};

function pctIncome() {
  const inc = parseFloat(form.person_income.value), amt = parseFloat(form.loan_amnt.value);
  const v = inc > 0 && amt >= 0 ? amt / inc : 0;
  $("#pctIncome").textContent = v.toFixed(2);
  return Math.round(v * 100) / 100;
}

function setForm(values) {
  Object.entries(values).forEach(([k, v]) => {
    const radio = form.querySelector(`input[type=radio][name="${k}"][value="${v}"]`);
    if (radio) radio.checked = true; else if (form[k]) form[k].value = v;
  });
  pctIncome(); clearError();
}

function clearError() {
  errEl.textContent = "";
  form.querySelectorAll(".invalid").forEach((e) => e.classList.remove("invalid"));
}

function resetResult() {
  cancelAnimationFrame(raf);
  card.classList.remove("low", "high", "pop");
  fill.style.strokeDashoffset = CIRC;
  mark.style.left = "0%"; tick.style.opacity = 0;
  pctEl.textContent = "0";
  $("#badge").textContent = "Awaiting input";
  $("#msg").innerHTML = "Fill in the form and press <b>Analyze risk</b>.";
  $("#thrTxt").textContent = "Threshold: -";
}

function countUp(to) {
  cancelAnimationFrame(raf);
  const start = performance.now(), dur = 1300;
  const step = (t) => {
    const p = Math.min((t - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
    pctEl.textContent = (to * e).toFixed(1);
    if (p < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

function showResult(d) {
  const prob = Math.min(Math.max(d.default_probability, 0), 1) * 100;
  const thr = Math.min(Math.max(d.threshold, 0), 1) * 100;
  const high = d.default_prediction === 1;
  card.classList.remove("low", "high", "pop");
  void card.offsetWidth; // restart animation
  card.classList.add(high ? "high" : "low", "pop");
  fill.style.strokeDashoffset = CIRC * (1 - prob / 100);
  mark.style.left = prob + "%";
  tick.style.left = thr + "%"; tick.style.opacity = 1;
  $("#badge").textContent = high ? "High risk" : "Low risk";
  $("#msg").textContent = high
    ? "The model estimates a high chance of default for this application."
    : "The model estimates a low chance of default for this application.";
  $("#thrTxt").textContent = `Threshold: ${thr.toFixed(1)}%`;
  countUp(prob);
}

function validate() {
  clearError();
  let ok = true;
  form.querySelectorAll("input[type=number],select").forEach((el) => {
    if (!el.checkValidity()) { el.classList.add("invalid"); ok = false; }
  });
  ["loan_grade", "cb_person_default_on_file"].forEach((n) => {
    if (!form.querySelector(`input[name="${n}"]:checked`)) ok = false;
  });
  if (!ok) errEl.textContent = "Please complete all fields with valid values.";
  return ok;
}

function payload() {
  const num = (n) => parseFloat(form[n].value);
  return {
    person_age: parseInt(form.person_age.value, 10),
    person_income: num("person_income"),
    person_home_ownership: form.person_home_ownership.value,
    person_emp_length: num("person_emp_length"),
    loan_intent: form.loan_intent.value,
    loan_grade: form.querySelector('input[name="loan_grade"]:checked').value,
    loan_amnt: num("loan_amnt"),
    loan_int_rate: num("loan_int_rate"),
    loan_percent_income: pctIncome(),
    cb_person_default_on_file: form.querySelector('input[name="cb_person_default_on_file"]:checked').value,
    cb_person_cred_hist_length: parseInt(form.cb_person_cred_hist_length.value, 10),
  };
}

form.addEventListener("input", () => { pctIncome(); if (errEl.textContent) clearError(); });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy || !validate()) return;
  busy = true; btn.disabled = true; btn.classList.add("loading");
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 45000);
  const slow = setTimeout(() => (errEl.textContent = "Waking up the server, this can take a few seconds..."), 4000);
  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()), signal: ctrl.signal,
    });
    if (!res.ok) {
      let msg = `Server error (${res.status}).`;
      try {
        const j = await res.json();
        if (Array.isArray(j.detail) && j.detail[0]) msg = `${j.detail[0].loc.slice(1).join(".")}: ${j.detail[0].msg}`;
      } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    clearError();
    showResult(data);
  } catch (err) {
    errEl.textContent = err.name === "AbortError" ? "Request timed out. Please try again." : (err.message || "Could not reach the API.");
  } finally {
    clearTimeout(timeout); clearTimeout(slow);
    busy = false; btn.disabled = false; btn.classList.remove("loading");
  }
});

document.querySelectorAll("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => { setForm(PRESETS[b.dataset.preset]); resetResult(); }));
$("#resetBtn").addEventListener("click", () => { form.reset(); pctIncome(); clearError(); resetResult(); });
