# Main script for client-side logic (form validation, dynamic content)

function toggleLogin() {
    const loginButton = document.querySelector(".login-register button");
  
    if (loginButton.innerText === "Login/Register") {
      loginButton.innerText = "My Account"; // Dynamically change text after login
    } else {
      loginButton.innerText = "Login/Register";
    }
  }