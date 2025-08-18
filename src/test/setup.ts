import '@testing-library/jest-dom';

// Mock fetch for tests
global.fetch = vi.fn();

// Mock environment variables
process.env.NODE_ENV = 'test';