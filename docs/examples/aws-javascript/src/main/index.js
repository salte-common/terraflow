/**
 * Main application entry point
 */

function main() {
  console.log('Hello from aws-javascript!');
}

if (require.main === module) {
  main();
}

module.exports = { main };

