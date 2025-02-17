"use strict";

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("judge0-year").innerText = new Date().getFullYear();
});

document.body.addEventListener("click", function (event) {
    const dropdown = event.target.closest(".judge0-dropdown");
    const dropdownBtn = event.target.closest(".judge0-dropdown-btn");

    if (event.target && dropdownBtn && dropdownBtn.contains(event.target)) {
        dropdown.querySelector(".judge0-dropdown-menu").classList.toggle("hidden");
    } else if (event.target && event.target.classList.contains("judge0-dropdown-option")) {
        const span = dropdown.querySelector("span");
        span.innerText = event.target.innerText;
        dropdown.querySelector(".judge0-dropdown-menu").classList.toggle("hidden");
    }

    // For each dropdown menu check if it needs to be hidden.
    // If the click is outside of the dropdown menu and if that dropdown menu is not
    // the dropdown menu of the just clicked dropdown button, hide it.
    document.querySelectorAll(".judge0-dropdown-menu").forEach(function (dropdownMenu) {
        if (!dropdownMenu.contains(event.target) && dropdown !== dropdownMenu.closest(".judge0-dropdown")) {
            dropdownMenu.classList.add("hidden");
        }
    });
});

window.addEventListener("load", function() {
    document.body.removeAttribute("style");
});
