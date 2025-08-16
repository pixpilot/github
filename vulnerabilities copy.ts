// @ts-nocheck
/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable no-eval */
/* eslint-disable no-unused-vars */
// test-xss.js

function displayUserInput(userInput) {
  // VULNERABLE: Direct insertion of user input into DOM

  document.getElementById("content").innerHTML = userInput;

  // VULNERABLE: Using eval with user input
  eval(`var result = ${userInput}`);

  // VULNERABLE: Dynamic script creation

  const script = document.createElement("script");
  script.innerHTML = userInput;

  document.body.appendChild(script);
}

// VULNERABLE: Location-based XSS
// @ts-ignore
window.location.hash = decodeURIComponent(window.location.hash);
