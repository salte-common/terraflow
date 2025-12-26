const { main } = require('../main/index');

describe('aws-javascript', () => {
  it('should run main function', () => {
    expect(() => main()).not.toThrow();
  });
});

