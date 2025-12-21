/**
 * Unit tests for template resolution
 */

import { TemplateUtils } from '../../src/utils/templates';

describe('TemplateUtils', () => {
  describe('resolve', () => {
    it('should resolve simple template variables', () => {
      const template = 'Hello ${NAME}, welcome to ${APP}';
      const vars = { NAME: 'Alice', APP: 'Terraflow' };
      const result = TemplateUtils.resolve(template, vars);
      expect(result).toBe('Hello Alice, welcome to Terraflow');
    });

    it('should handle missing variables by leaving placeholder', () => {
      const template = 'Hello ${NAME}, ${MISSING}';
      const vars = { NAME: 'Alice' };
      const result = TemplateUtils.resolve(template, vars);
      expect(result).toBe('Hello Alice, ${MISSING}');
    });

    it('should handle empty string variables', () => {
      const template = 'Value: ${EMPTY}';
      const vars = { EMPTY: '' };
      const result = TemplateUtils.resolve(template, vars);
      expect(result).toBe('Value: ');
    });

    it('should handle numeric string variables', () => {
      const template = 'Count: ${COUNT}';
      const vars = { COUNT: '42' };
      const result = TemplateUtils.resolve(template, vars);
      expect(result).toBe('Count: 42');
    });

    it('should handle variables with whitespace in name', () => {
      const template = 'Hello ${ NAME }, welcome';
      const vars = { NAME: 'Alice' };
      const result = TemplateUtils.resolve(template, vars);
      expect(result).toBe('Hello Alice, welcome');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = '${VAR} and ${VAR} again';
      const vars = { VAR: 'value' };
      const result = TemplateUtils.resolve(template, vars);
      expect(result).toBe('value and value again');
    });

    it('should return non-string values unchanged', () => {
      const result1 = TemplateUtils.resolve(null as unknown as string, {});
      expect(result1).toBeNull();

      const result2 = TemplateUtils.resolve(undefined as unknown as string, {});
      expect(result2).toBeUndefined();
    });
  });

  describe('resolveObject', () => {
    it('should resolve templates in object strings', () => {
      const obj = {
        name: '${NAME}',
        value: '${VALUE}',
      };
      const vars = { NAME: 'test', VALUE: '123' };
      const result = TemplateUtils.resolveObject(obj, vars);
      expect(result).toEqual({ name: 'test', value: '123' });
    });

    it('should resolve templates recursively in nested objects', () => {
      const obj = {
        top: '${TOP}',
        nested: {
          inner: '${INNER}',
          deep: {
            value: '${DEEP}',
          },
        },
      };
      const vars = { TOP: 'top', INNER: 'inner', DEEP: 'deep' };
      const result = TemplateUtils.resolveObject(obj, vars);
      expect(result).toEqual({
        top: 'top',
        nested: {
          inner: 'inner',
          deep: {
            value: 'deep',
          },
        },
      });
    });

    it('should resolve templates in arrays', () => {
      const obj = {
        items: ['${ITEM1}', '${ITEM2}', 'static'],
      };
      const vars = { ITEM1: 'one', ITEM2: 'two' };
      const result = TemplateUtils.resolveObject(obj, vars);
      expect(result).toEqual({
        items: ['one', 'two', 'static'],
      });
    });

    it('should handle nested arrays with templates', () => {
      const obj = {
        matrix: [
          ['${VAR1}', '${VAR2}'],
          ['${VAR3}', 'static'],
        ],
      };
      const vars = { VAR1: 'a', VAR2: 'b', VAR3: 'c' };
      const result = TemplateUtils.resolveObject(obj, vars);
      expect(result).toEqual({
        matrix: [
          ['a', 'b'],
          ['c', 'static'],
        ],
      });
    });

    it('should preserve non-string values', () => {
      const obj = {
        string: '${VAR}',
        number: 42,
        boolean: true,
        nullValue: null,
      };
      const vars = { VAR: 'resolved' };
      const result = TemplateUtils.resolveObject(obj, vars);
      expect(result).toEqual({
        string: 'resolved',
        number: 42,
        boolean: true,
        nullValue: null,
      });
    });

    it('should handle empty objects', () => {
      const obj = {};
      const vars = { VAR: 'value' };
      const result = TemplateUtils.resolveObject(obj, vars);
      expect(result).toEqual({});
    });

    it('should handle null and undefined', () => {
      expect(TemplateUtils.resolveObject(null as unknown as Record<string, unknown>, {})).toBeNull();
      expect(TemplateUtils.resolveObject(undefined as unknown as Record<string, unknown>, {})).toBeUndefined();
    });

    it('should handle strings directly', () => {
      const result = TemplateUtils.resolveObject('${VAR}' as unknown as Record<string, unknown>, { VAR: 'value' });
      expect(result).toBe('value');
    });

    it('should handle complex config-like structures', () => {
      const config = {
        workspace: '${WORKSPACE}',
        backend: {
          type: 's3',
          config: {
            bucket: '${BUCKET}',
            region: '${REGION}',
          },
        },
        variables: {
          environment: '${ENV}',
          count: 3,
        },
      };
      const vars = {
        WORKSPACE: 'production',
        BUCKET: 'my-terraform-state',
        REGION: 'us-east-1',
        ENV: 'prod',
      };
      const result = TemplateUtils.resolveObject(config, vars);
      expect(result).toEqual({
        workspace: 'production',
        backend: {
          type: 's3',
          config: {
            bucket: 'my-terraform-state',
            region: 'us-east-1',
          },
        },
        variables: {
          environment: 'prod',
          count: 3,
        },
      });
    });
  });
});

