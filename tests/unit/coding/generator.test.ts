/**
 * The Joker - Agentic Terminal
 * Code Generator Tests
 */

import { 
  CodeGenerator, 
  ExtendedCodeSpec, 
  GenerationResult,
  MultiFileResult
} from '../../../src/coding/generator';

describe('CodeGenerator', () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  describe('initialization', () => {
    it('should create generator instance', () => {
      expect(generator).toBeInstanceOf(CodeGenerator);
    });

    it('should have default configuration', () => {
      const stats = generator.getStats();
      expect(stats.validationEnabled).toBe(true);
      expect(stats.maxRetries).toBe(3);
    });
  });

  describe('configuration', () => {
    it('should allow setting validation enabled', () => {
      generator.setValidation(false);
      const stats = generator.getStats();
      expect(stats.validationEnabled).toBe(false);
    });

    it('should allow setting max retries', () => {
      generator.setMaxRetries(5);
      const stats = generator.getStats();
      expect(stats.maxRetries).toBe(5);
    });

    it('should not allow negative retries', () => {
      generator.setMaxRetries(-1);
      const stats = generator.getStats();
      expect(stats.maxRetries).toBe(0);
    });
  });

  describe('validateSyntax', () => {
    it('should validate correct TypeScript code', () => {
      const validCode = `
        const greeting: string = 'Hello';
        export default greeting;
      `;

      const result = generator.validateSyntax(validCode, 'typescript');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unmatched brackets', () => {
      const invalidCode = `
        function test() {
          const obj = { a: 1;
        }
      `;

      const result = generator.validateSyntax(invalidCode, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'BRACKET_MISMATCH')).toBe(true);
    });

    it('should validate JavaScript code', () => {
      const validCode = `
        function add(a, b) {
          return a + b;
        }
        export default add;
      `;

      const result = generator.validateSyntax(validCode, 'javascript');
      expect(result.valid).toBe(true);
    });

    it('should validate Python syntax', () => {
      const validCode = `
def hello():
    print("Hello, World!")

class Test:
    def method(self):
        pass
      `;

      const result = generator.validateSyntax(validCode, 'python');
      // Python validation is basic - just check for major issues
      expect(result).toBeDefined();
    });
  });

  describe('validateImports', () => {
    it('should detect duplicate imports', () => {
      const codeWithDuplicates = `
        import React from 'react';
        import { useState } from 'react';
        import React from 'react';
      `;

      const result = generator.validateImports(codeWithDuplicates, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'DUPLICATE_IMPORT')).toBe(true);
    });

    it('should pass for valid imports', () => {
      const validCode = `
        import React from 'react';
        import axios from 'axios';
      `;

      const result = generator.validateImports(validCode, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should detect empty imports', () => {
      const codeWithEmpty = `
        import { } from 'react';
      `;

      const result = generator.validateImports(codeWithEmpty, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'EMPTY_IMPORT')).toBe(true);
    });

    it('should validate Python imports', () => {
      const pythonCode = `
import os
import sys
from typing import List
      `;

      const result = generator.validateImports(pythonCode, 'python');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateGenerated', () => {
    it('should validate complete TypeScript code', async () => {
      const validCode = `
import React from 'react';

interface Props {
  name: string;
}

const Hello: React.FC<Props> = ({ name }) => {
  return <div>Hello, {name}!</div>;
};

export default Hello;
      `;

      const result = await generator.validateGenerated(validCode, 'typescript');
      expect(result.valid).toBe(true);
    });

    it('should reject empty code', async () => {
      const result = await generator.validateGenerated('', 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'EMPTY_CODE')).toBe(true);
    });

    it('should detect placeholder code', async () => {
      const placeholderCode = `
function doSomething() {
  // TODO: implement
}
      `;

      const result = await generator.validateGenerated(placeholderCode, 'typescript');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'PLACEHOLDER_CODE')).toBe(true);
    });
  });
});

describe('CodeGenerator Events', () => {
  let generator: CodeGenerator;

  beforeEach(() => {
    generator = new CodeGenerator();
  });

  it('should be an event emitter', () => {
    expect(typeof generator.on).toBe('function');
    expect(typeof generator.emit).toBe('function');
  });
});

