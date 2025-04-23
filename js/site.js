"use strict";

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("judge0-year").innerText = new Date().getFullYear();
});

/**
 * Dropdown component consists of the following elements:
 * 1. A wrapper div with class "judge0-dropdown".
 * 2. A button with class "judge0-dropdown-btn".
 * 3. A span with class "judge0-dropdown-value".
 * 4. A div with class "judge0-dropdown-menu" that contains the dropdown options.
 * 5. A list of options with class "judge0-dropdown-option".
 *
 * If the dropdown is not select dropdown then classes (3) and (5) are not required.
 */

window.addEventListener("load", function () {
  document.body.removeAttribute("style");
});
