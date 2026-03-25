// js/main.js

/**
 * Main JavaScript file for global functionality
 */

document.addEventListener('DOMContentLoaded', () => {
  // Add scroll effect to navbar
  const navbar = document.querySelector('.navbar');
  
  window.addEventListener('scroll', Utils.debounce(() => {
    if (window.scrollY > 50) {
      navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    } else {
      navbar.style.boxShadow = 'none';
    }
  }, 100));
});