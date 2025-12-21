/**
 * Variable templating utility
 * Resolves template variables in configuration
 */

/**
 * Template resolution utility
 */
export class TemplateUtils {
  /**
   * Resolve template variables in a string
   * Supports ${VAR} syntax
   * @param template - Template string with ${VAR} placeholders
   * @param vars - Variables to substitute
   * @returns Resolved string
   */
  static resolve(template: string, vars: Record<string, string>): string {
    if (typeof template !== 'string') {
      return template;
    }

    return template.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const trimmedVarName = varName.trim();
      if (vars[trimmedVarName] !== undefined) {
        return vars[trimmedVarName];
      }
      // If variable not found, return the original placeholder
      return match;
    });
  }

  /**
   * Resolve all template variables in an object recursively
   * @param obj - Object to resolve templates in
   * @param vars - Variables to substitute
   * @returns Object with templates resolved
   */
  static resolveObject<T extends Record<string, unknown>>(obj: T, vars: Record<string, string>): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return TemplateUtils.resolve(obj, vars) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => TemplateUtils.resolveObject(item, vars)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const resolved: Record<string, unknown> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (typeof value === 'string') {
            resolved[key] = TemplateUtils.resolve(value, vars);
          } else if (typeof value === 'object' && value !== null) {
            resolved[key] = TemplateUtils.resolveObject(value as Record<string, unknown>, vars);
          } else {
            resolved[key] = value;
          }
        }
      }
      return resolved as T;
    }

    return obj;
  }
}
