/**
 * Tests for Code Parser
 * 
 * Tests the CodeParser class that provides AST-based parsing
 * for multiple programming languages.
 */

import { CodeParser, codeParser, SupportedLanguage } from '../../../src/coding/parser';

describe('CodeParser', () => {
  let parser: CodeParser;

  beforeEach(() => {
    parser = new CodeParser();
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(parser.detectLanguage('.ts')).toBe('typescript');
      expect(parser.detectLanguage('.tsx')).toBe('typescript');
    });

    it('should detect JavaScript', () => {
      expect(parser.detectLanguage('.js')).toBe('javascript');
      expect(parser.detectLanguage('.jsx')).toBe('javascript');
      expect(parser.detectLanguage('.mjs')).toBe('javascript');
    });

    it('should detect Python', () => {
      expect(parser.detectLanguage('.py')).toBe('python');
    });

    it('should detect Go', () => {
      expect(parser.detectLanguage('.go')).toBe('go');
    });

    it('should detect Rust', () => {
      expect(parser.detectLanguage('.rs')).toBe('rust');
    });

    it('should detect Java', () => {
      expect(parser.detectLanguage('.java')).toBe('java');
    });

    it('should return unknown for unrecognized extensions', () => {
      expect(parser.detectLanguage('.xyz')).toBe('unknown');
    });
  });

  describe('parse', () => {
    describe('TypeScript parsing', () => {
      const lang: SupportedLanguage = 'typescript';

      it('should parse function declarations', () => {
        const code = `
          function hello(name: string): void {
            console.log('Hello ' + name);
          }
        `;

        const result = parser.parse(code, lang);

        expect(result.functions.length).toBe(1);
        expect(result.functions[0].name).toBe('hello');
        expect(result.functions[0].isAsync).toBe(false);
      });

      it('should parse async function declarations', () => {
        const code = `
          async function fetchData(): Promise<string> {
            return await fetch('/api/data');
          }
        `;

        const result = parser.parse(code, lang);

        expect(result.functions.length).toBe(1);
        expect(result.functions[0].name).toBe('fetchData');
        expect(result.functions[0].isAsync).toBe(true);
      });

      it('should parse arrow functions assigned to const', () => {
        const code = `
          const add = (a: number, b: number): number => a + b;
          const greet = async (name: string) => {
            return 'Hello ' + name;
          };
        `;

        const result = parser.parse(code, lang);

        expect(result.functions.some(f => f.name === 'add')).toBe(true);
        expect(result.functions.some(f => f.name === 'greet')).toBe(true);
      });

      it('should parse class declarations', () => {
        const code = `
          class Person {
            private name: string;
            
            constructor(name: string) {
              this.name = name;
            }
            
            greet(): string {
              return 'Hello ' + this.name;
            }
          }
        `;

        const result = parser.parse(code, lang);

        expect(result.classes.length).toBe(1);
        expect(result.classes[0].name).toBe('Person');
        expect(result.classes[0].methods.length).toBeGreaterThan(0);
      });

      it('should parse import declarations', () => {
        const code = `
          import { readFile, writeFile } from 'fs/promises';
          import path from 'path';
          import * as utils from './utils';
        `;

        const result = parser.parse(code, lang);

        expect(result.imports.length).toBe(3);
        expect(result.imports.some(i => i.source === 'fs/promises')).toBe(true);
        expect(result.imports.some(i => i.source === 'path')).toBe(true);
      });

      it('should parse export declarations', () => {
        const code = `
          export const CONFIG = { debug: true };
          export function helper() {}
          export class Service {}
          export default MainClass;
        `;

        const result = parser.parse(code, lang);

        expect(result.exports.length).toBeGreaterThan(0);
      });

      it('should parse variables', () => {
        const code = `
          const MAX_SIZE = 100;
          let counter = 0;
          var legacy = true;
        `;

        const result = parser.parse(code, lang);

        expect(result.variables.length).toBe(3);
        expect(result.variables.find(v => v.name === 'MAX_SIZE')?.kind).toBe('const');
        expect(result.variables.find(v => v.name === 'counter')?.kind).toBe('let');
        expect(result.variables.find(v => v.name === 'legacy')?.kind).toBe('var');
      });
    });

    describe('JavaScript parsing', () => {
      const lang: SupportedLanguage = 'javascript';

      it('should parse JavaScript functions', () => {
        const code = `
          function greet(name) {
            return 'Hello ' + name;
          }
        `;

        const result = parser.parse(code, lang);

        expect(result.functions.length).toBe(1);
        expect(result.functions[0].name).toBe('greet');
      });

      it('should parse ES6 classes', () => {
        const code = `
          class Animal {
            constructor(name) {
              this.name = name;
            }
            
            speak() {
              console.log(this.name + ' makes a sound.');
            }
          }
        `;

        const result = parser.parse(code, lang);

        expect(result.classes.length).toBe(1);
        expect(result.classes[0].name).toBe('Animal');
      });
    });

    describe('Python parsing', () => {
      const lang: SupportedLanguage = 'python';

      it('should parse Python function definitions', () => {
        const code = `
def hello(name):
    print(f"Hello {name}")

async def fetch_data():
    return await get_data()
        `;

        const result = parser.parse(code, lang);

        expect(result.functions.length).toBe(2);
        expect(result.functions.some(f => f.name === 'hello')).toBe(true);
        expect(result.functions.some(f => f.name === 'fetch_data')).toBe(true);
      });

      it('should parse Python class definitions', () => {
        const code = `
class Person:
    def __init__(self, name):
        self.name = name
    
    def greet(self):
        return f"Hello {self.name}"
        `;

        const result = parser.parse(code, lang);

        expect(result.classes.length).toBe(1);
        expect(result.classes[0].name).toBe('Person');
      });

      it('should parse Python imports', () => {
        const code = `
import os
import sys
from pathlib import Path
from typing import List, Dict
        `;

        const result = parser.parse(code, lang);

        expect(result.imports.length).toBeGreaterThan(0);
      });
    });

    describe('Go parsing', () => {
      const lang: SupportedLanguage = 'go';

      it('should parse Go function definitions', () => {
        const code = `
package main

func hello(name string) string {
    return "Hello " + name
}

func main() {
    fmt.Println(hello("World"))
}
        `;

        const result = parser.parse(code, lang);

        expect(result.functions.length).toBe(2);
        expect(result.functions.some(f => f.name === 'hello')).toBe(true);
        expect(result.functions.some(f => f.name === 'main')).toBe(true);
      });

      it('should parse Go struct definitions', () => {
        const code = `
package main

type Person struct {
    Name string
    Age  int
}

type Config struct {
    Host string
    Port int
}
        `;

        const result = parser.parse(code, lang);

        expect(result.classes.length).toBe(2);
        expect(result.classes.some(c => c.name === 'Person')).toBe(true);
        expect(result.classes.some(c => c.name === 'Config')).toBe(true);
      });

      it('should parse Go imports', () => {
        const code = `
package main

import (
    "fmt"
    "os"
)
        `;

        const result = parser.parse(code, lang);

        expect(result.imports.length).toBeGreaterThan(0);
      });
    });

    describe('Rust parsing', () => {
      const lang: SupportedLanguage = 'rust';

      it('should parse Rust function definitions', () => {
        const code = `
fn hello(name: &str) -> String {
    format!("Hello {}", name)
}

async fn fetch_data() -> Result<String, Error> {
    Ok(String::new())
}
        `;

        const result = parser.parse(code, lang);

        expect(result.functions.length).toBe(2);
        expect(result.functions.some(f => f.name === 'hello')).toBe(true);
        expect(result.functions.some(f => f.name === 'fetch_data')).toBe(true);
      });

      it('should parse Rust struct definitions', () => {
        const code = `
struct Person {
    name: String,
    age: u32,
}

pub struct Config {
    host: String,
    port: u16,
}
        `;

        const result = parser.parse(code, lang);

        expect(result.classes.length).toBe(2);
        expect(result.classes.some(c => c.name === 'Person')).toBe(true);
        expect(result.classes.some(c => c.name === 'Config')).toBe(true);
      });

      it('should parse Rust use statements', () => {
        const code = `
use std::io;
use std::collections::HashMap;
        `;

        const result = parser.parse(code, lang);

        expect(result.imports.length).toBe(2);
      });
    });

    describe('Java parsing', () => {
      const lang: SupportedLanguage = 'java';

      it('should parse Java class definitions', () => {
        const code = `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
    
    private String greet(String name) {
        return "Hello " + name;
    }
}
        `;

        const result = parser.parse(code, lang);

        expect(result.classes.length).toBe(1);
        expect(result.classes[0].name).toBe('Main');
        expect(result.classes[0].methods.length).toBeGreaterThan(0);
      });

      it('should parse Java imports', () => {
        const code = `
import java.util.List;
import java.util.ArrayList;
import java.io.*;
        `;

        const result = parser.parse(code, lang);

        expect(result.imports.length).toBe(3);
      });
    });
  });

  describe('complexity metrics', () => {
    it('should calculate basic complexity for simple code', () => {
      const code = `
        function simple() {
          return 1;
        }
      `;

      const result = parser.parse(code, 'typescript');
      expect(result.metrics.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
    });

    it('should calculate higher complexity for conditionals', () => {
      const code = `
        function complex(a, b) {
          if (a > 0) {
            if (b > 0) {
              return a + b;
            } else {
              return a - b;
            }
          } else {
            return 0;
          }
        }
      `;

      const result = parser.parse(code, 'typescript');
      expect(result.metrics.cyclomaticComplexity).toBeGreaterThan(1);
    });

    it('should calculate higher complexity for loops', () => {
      const code = `
        function withLoops(items) {
          for (const item of items) {
            while (item.hasMore) {
              process(item);
            }
          }
        }
      `;

      const result = parser.parse(code, 'typescript');
      expect(result.metrics.cyclomaticComplexity).toBeGreaterThan(1);
    });
  });

  describe('error handling', () => {
    it('should handle invalid syntax gracefully', () => {
      const code = `
        function invalid(
      `;

      const result = parser.parse(code, 'typescript');
      
      // Should return empty or partial result, not throw
      expect(result).toBeDefined();
    });

    it('should handle empty code', () => {
      const result = parser.parse('', 'typescript');

      expect(result).toBeDefined();
      expect(result.functions).toEqual([]);
      expect(result.classes).toEqual([]);
    });
  });
});

describe('codeParser singleton', () => {
  it('should export a singleton instance', () => {
    expect(codeParser).toBeInstanceOf(CodeParser);
  });
});
