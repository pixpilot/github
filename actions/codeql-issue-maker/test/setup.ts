import * as process from 'node:process';

// Test setup file
globalThis.console = {
  ...console,
  // Uncomment to ignore specific console methods in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set NODE_ENV for tests
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}
