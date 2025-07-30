import { EventEmitter } from 'events';

export const exec = jest.fn();
export const spawn = jest.fn();

// Helper to create a mock child process
export const createMockChildProcess = () => {
  const mockProcess = new EventEmitter() as any;
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = new EventEmitter();
  mockProcess.kill = jest.fn();
  mockProcess.pid = Math.floor(Math.random() * 10000);
  mockProcess.killed = false;
  
  return mockProcess;
};