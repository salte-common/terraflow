import { main } from '../main/index';

describe('azure-typescript', () => {
  it('should run main function', () => {
    expect(() => main()).not.toThrow();
  });
});

