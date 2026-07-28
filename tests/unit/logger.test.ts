/**
 * Unit tests for Logger
 */

import { Logger } from '../../src/utils/logger';

describe('Logger', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    Logger.setLevel('debug');
    Logger.setColor(true);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('setLevel', () => {
    it('should allow error level messages only when level is error', () => {
      Logger.setLevel('error');
      Logger.error('e');
      Logger.warn('w');
      Logger.info('i');
      Logger.debug('d');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should allow error and warn when level is warn', () => {
      Logger.setLevel('warn');
      Logger.error('e');
      Logger.warn('w');
      Logger.info('i');
      Logger.debug('d');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should allow error, warn, info when level is info', () => {
      Logger.setLevel('info');
      Logger.error('e');
      Logger.warn('w');
      Logger.info('i');
      Logger.debug('d');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should allow all levels when level is debug', () => {
      Logger.setLevel('debug');
      Logger.error('e');
      Logger.warn('w');
      Logger.info('i');
      Logger.debug('d');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('setColor', () => {
    it('should output with ANSI codes when color enabled', () => {
      Logger.setColor(true);
      Logger.error('err');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('\x1b[')
      );
    });

    it('should output plain message when color disabled', () => {
      Logger.setColor(false);
      Logger.error('err');

      expect(consoleErrorSpy).toHaveBeenCalledWith('err');
      expect(consoleErrorSpy.mock.calls[0][0]).not.toMatch(/\x1b\[/);
    });
  });

  describe('error', () => {
    it('should call console.error with formatted message', () => {
      Logger.setLevel('error');
      Logger.error('Something failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Something failed')
      );
    });

    it('should pass additional args', () => {
      Logger.setLevel('error');
      Logger.error('Failed', { code: 1 });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        { code: 1 }
      );
    });
  });

  describe('warn', () => {
    it('should call console.warn with formatted message', () => {
      Logger.setLevel('warn');
      Logger.warn('Deprecation warning');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deprecation warning')
      );
    });
  });

  describe('info', () => {
    it('should call console.info with formatted message', () => {
      Logger.setLevel('info');
      Logger.info('Initializing');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initializing')
      );
    });
  });

  describe('debug', () => {
    it('should call console.debug with formatted message', () => {
      Logger.setLevel('debug');
      Logger.debug('Debug detail');

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug detail')
      );
    });
  });

  describe('success', () => {
    it('should log at info level with message', () => {
      Logger.setLevel('info');
      Logger.success('Done');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Done')
      );
    });

    it('should not log when level is warn', () => {
      Logger.setLevel('warn');
      Logger.success('Done');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });
});
