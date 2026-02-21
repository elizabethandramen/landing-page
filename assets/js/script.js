function typeText() {
  const texts = ["Computer Science Student | Designer | Video Game Enthusiast | Future Engineer | Activist | Inventor | Artist"];
  let index = 0;
  const typingSpeed = 100; // Speed of typing in milliseconds
  const deletingSpeed = 50; // Speed of deleting in milliseconds
  const delayBetweenTexts = 1500; // Delay before deleting

  function typeNextText() {
    const element = document.getElementById("typing-text");
    const text = texts[index];
    let i = 0;

    // Typing animation
    const typingInterval = setInterval(() => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
      } else {
        clearInterval(typingInterval);
        setTimeout(deleteText, delayBetweenTexts); // Wait before deleting
      }
    }, typingSpeed);
  }

  function deleteText() {
    const element = document.getElementById("typing-text");
    const text = element.textContent;
    let i = text.length;

    // Deleting animation
    const deletingInterval = setInterval(() => {
      if (i > 0) {
        element.textContent = text.substring(0, i - 1);
        i--;
      } else {
        clearInterval(deletingInterval);
        index = (index + 1) % texts.length; // Move to the next text
        setTimeout(typeNextText, delayBetweenTexts); // Wait before typing the next text
      }
    }, deletingSpeed);
  }

  typeNextText(); // Start the animation
}

document.addEventListener("DOMContentLoaded", typeText);

// Loading screen: matcha pour on every homepage load (including refresh)
document.addEventListener("DOMContentLoaded", function() {
  const loadingScreen = document.getElementById("loading-screen");
  const body = document.body;
  if (!loadingScreen) return;

  loadingScreen.classList.add("pour");

  setTimeout(function() {
    loadingScreen.classList.add("show-welcome");
  }, 2200);

  setTimeout(function() {
    loadingScreen.classList.add("drain");
  }, 3800);

  setTimeout(function() {
    loadingScreen.classList.add("loaded");
    body.classList.remove("loading");
  }, 5200);
});
