/**
 * Artillery Processor Functions
 * Helper functions for Artillery load tests
 */

module.exports = {
  setRandomCity,
  generateUserId,
};

function setRandomCity(context, events, done) {
  const cities = ['Milano', 'Istanbul', 'Berlin', 'Paris', 'London'];
  context.vars.city = cities[Math.floor(Math.random() * cities.length)];
  context.vars.userId = `test-user-${Math.floor(Math.random() * 10000)}`;
  return done();
}

function generateUserId(context, events, done) {
  context.vars.userId = `test-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return done();
}
