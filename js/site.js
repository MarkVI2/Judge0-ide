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
document.body.addEventListener("click", function (event) {
    const dropdown = event.target.closest(".judge0-dropdown");
    const dropdownBtn = event.target.closest(".judge0-dropdown-btn");

    if (event.target && dropdownBtn && dropdownBtn.contains(event.target)) {
        dropdown.querySelector(".judge0-dropdown-menu").classList.toggle("hidden");
    } else if (event.target && event.target.classList.contains("judge0-dropdown-option")) {
        const span = dropdown.querySelector("span.judge0-dropdown-value");
        span.innerText = event.target.innerText;
        dropdown.querySelector(".judge0-dropdown-menu").classList.toggle("hidden");
    }

    /**
     * For each dropdown menu check if it needs to be hidden.
     * Hide the dropdown menu if all applies:
     * 1. The click is outside of the dropdown menu.
     * 2. The dropdown menu is not the dropdown menu of the just clicked dropdown button.
     */
    document.querySelectorAll(".judge0-dropdown-menu").forEach(function (dropdownMenu) {
        if (!dropdownMenu.contains(event.target) && dropdown !== dropdownMenu.closest(".judge0-dropdown")) {
            dropdownMenu.classList.add("hidden");
        }
    });
});

window.addEventListener("load", function() {
    document.body.removeAttribute("style");
});
