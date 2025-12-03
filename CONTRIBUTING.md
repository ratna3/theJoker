# 🤝 Contributing to The Joker

<div align="center">

[![Contributions Welcome](https://img.shields.io/badge/Contributions-Welcome-brightgreen?style=for-the-badge&logo=github)](https://github.com/ratna3/theJoker)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-blue?style=for-the-badge&logo=git)](https://github.com/ratna3/theJoker/pulls)
[![Code Style](https://img.shields.io/badge/Code%20Style-Prettier-ff69b4?style=for-the-badge&logo=prettier)](https://prettier.io/)

**Thank you for your interest in contributing to The Joker! 🃏**

*Your contributions make this project better for everyone.*

</div>

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Before You Start](#-before-you-start)
- [How to Contribute](#-how-to-contribute)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Coding Standards](#-coding-standards)
- [Testing Requirements](#-testing-requirements)
- [Pull Request Process](#-pull-request-process)
- [Issue Guidelines](#-issue-guidelines)
- [Recognition](#-recognition)
- [Contact](#-contact)

---

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. By participating in this project, you agree to:

- **Be Respectful** - Treat everyone with respect and kindness
- **Be Constructive** - Provide helpful, constructive feedback
- **Be Inclusive** - Welcome people of all backgrounds and skill levels
- **Be Professional** - Maintain a harassment-free environment

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting, or derogatory remarks
- Personal or political attacks
- Publishing others' private information
- Any conduct inappropriate for a professional setting

### Enforcement

Violations may result in:
1. Warning
2. Temporary ban
3. Permanent ban

Report issues to: [ratnakirtiscr@gmail.com](mailto:ratnakirtiscr@gmail.com)

---

## ⚠️ Before You Start

### Important License Notice

**Please read carefully before contributing:**

The Joker is released under the **The Joker Contribution License (TJCL)**.

By contributing, you agree that:

1. ✅ Your contributions become part of the project under the same license
2. ✅ You grant the author an irrevocable license to use your contributions
3. ✅ You have the right to submit your contributions
4. ❌ You may NOT clone, fork, or redistribute this project
5. ❌ Commercial use is NOT permitted

**If you agree to these terms, we welcome your contributions!**

---

## 🎯 How to Contribute

### Types of Contributions

| Contribution | Description | Difficulty |
|--------------|-------------|------------|
| 🐛 Bug Reports | Report issues you find | Easy |
| 💡 Feature Requests | Suggest new features | Easy |
| 📝 Documentation | Improve docs and examples | Easy |
| 🔧 Bug Fixes | Fix reported issues | Medium |
| ✨ New Features | Implement new functionality | Hard |
| ⚡ Performance | Optimize existing code | Hard |
| 🧪 Tests | Add or improve tests | Medium |

### Quick Start

1. **Find an Issue** - Check [open issues](https://github.com/ratna3/theJoker/issues) or create one
2. **Discuss** - Comment on the issue to get assigned
3. **Setup** - Follow the [Development Setup](#-development-setup)
4. **Code** - Make your changes following our standards
5. **Test** - Ensure all tests pass
6. **Submit** - Create a Pull Request

---

## 🛠️ Development Setup

### Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | ≥ 20.x | `node --version` |
| npm | ≥ 10.x | `npm --version` |
| Git | ≥ 2.x | `git --version` |
| TypeScript | ≥ 5.x | `npx tsc --version` |

### Installation

```bash
# 1. Clone (for contribution purposes only)
# Note: You must have contributor access
git clone https://github.com/ratna3/theJoker.git
cd theJoker

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Run tests to verify setup
npm test
```

### Environment Setup

Create a `.env` file:

```env
# LLM Configuration
LLM_BASE_URL=http://localhost:1234
LLM_MODEL=your-model-name

# Development Settings
LOG_LEVEL=debug
NODE_ENV=development
```

### Available Scripts

```bash
# Development
npm run build          # Compile TypeScript
npm run start          # Run the application
npm run dev            # Development mode

# Testing
npm test               # Run all tests
npm run test:coverage  # Run with coverage
npm run test:watch     # Watch mode

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix linting issues
npm run format         # Run Prettier
npm run format:check   # Check formatting
```

---

## 📁 Project Structure

```
theJoker/
├── src/                    # Source code
│   ├── agents/            # AI agent implementations
│   │   ├── agent.ts       # Main agent class
│   │   ├── executor.ts    # Task executor
│   │   ├── memory.ts      # Agent memory
│   │   └── planner.ts     # Task planner
│   ├── cli/               # Command line interface
│   │   ├── commands.ts    # CLI commands
│   │   ├── display.ts     # Output display
│   │   ├── formatter.ts   # Text formatting
│   │   └── terminal.ts    # Terminal utilities
│   ├── errors/            # Error handling
│   │   ├── handler.ts     # Error handler
│   │   ├── retry.ts       # Retry logic
│   │   └── circuit-breaker.ts
│   ├── llm/               # LLM integration
│   │   ├── client.ts      # LLM client
│   │   ├── parser.ts      # Response parser
│   │   └── prompts.ts     # Prompt templates
│   ├── scraper/           # Web scraping
│   │   ├── browser.ts     # Browser control
│   │   ├── extractor.ts   # Content extraction
│   │   └── stealth.ts     # Stealth mode
│   ├── tools/             # Tool implementations
│   │   ├── code.ts        # Code tools
│   │   ├── file.ts        # File tools
│   │   ├── search.ts      # Search tools
│   │   └── registry.ts    # Tool registry
│   ├── project/           # Project management
│   │   ├── scaffolder.ts  # Project scaffolding
│   │   ├── packager.ts    # Package management
│   │   └── deployer.ts    # Deployment
│   └── utils/             # Utilities
│       ├── config.ts      # Configuration
│       ├── logger.ts      # Logging
│       └── cleaner.ts     # Content cleaning
├── tests/                  # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── mocks/             # Test mocks
├── docs/                   # Documentation
└── coverage/               # Test coverage reports
```

---

## 📏 Coding Standards

### TypeScript Guidelines

```typescript
// ✅ Good: Use explicit types
function processData(input: string): ProcessedData {
  return { value: input };
}

// ❌ Bad: Avoid 'any' type
function processData(input: any): any {
  return { value: input };
}

// ✅ Good: Use interfaces for objects
interface UserConfig {
  name: string;
  timeout: number;
  options?: ConfigOptions;
}

// ✅ Good: Use async/await
async function fetchData(): Promise<Data> {
  const response = await api.get('/data');
  return response.data;
}

// ❌ Bad: Avoid nested promises
function fetchData(): Promise<Data> {
  return api.get('/data').then(response => {
    return response.data;
  });
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-service.ts` |
| Classes | PascalCase | `UserService` |
| Functions | camelCase | `processUserData` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Interfaces | PascalCase (I prefix optional) | `UserConfig` |
| Types | PascalCase | `ProcessedResult` |

### Code Style

- **Indentation:** 2 spaces
- **Quotes:** Single quotes for strings
- **Semicolons:** Required
- **Line Length:** Max 100 characters
- **Trailing Commas:** ES5 style

```bash
# Format code before committing
npm run format
npm run lint:fix
```

### Documentation

```typescript
/**
 * Processes user input and returns a validated result.
 * 
 * @param input - The raw user input to process
 * @param options - Optional processing configuration
 * @returns The validated and processed result
 * @throws {ValidationError} When input fails validation
 * 
 * @example
 * ```typescript
 * const result = await processInput('user data', { strict: true });
 * console.log(result.value);
 * ```
 */
async function processInput(
  input: string,
  options?: ProcessOptions
): Promise<ProcessedResult> {
  // Implementation
}
```

---

## 🧪 Testing Requirements

### Test Coverage

| Category | Minimum Coverage |
|----------|------------------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

### Writing Tests

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  afterEach(() => {
    service.cleanup();
  });

  describe('processData', () => {
    it('should process valid input correctly', async () => {
      // Arrange
      const input = 'test data';
      const expected = { value: 'test data', processed: true };

      // Act
      const result = await service.processData(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should throw error for invalid input', async () => {
      // Arrange
      const invalidInput = '';

      // Act & Assert
      await expect(service.processData(invalidInput))
        .rejects.toThrow('Invalid input');
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/agents/agent.test.ts

# Run tests in watch mode
npm run test:watch
```

---

## 📥 Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated if needed
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Commit messages are clear and descriptive

### PR Title Format

```
<type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance

Examples:
feat(agent): add memory persistence
fix(scraper): handle timeout errors
docs: update contribution guidelines
```

### PR Description Template

```markdown
## Description
[Clear description of the changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
[Describe how you tested]

## Related Issues
Closes #[issue number]

## Screenshots (if applicable)
[Add screenshots]
```

### Review Process

1. **Automated Checks** - CI/CD must pass
2. **Code Review** - Maintainer review required
3. **Testing** - Verify all tests pass
4. **Approval** - At least one approval needed
5. **Merge** - Squash and merge preferred

---

## 🐛 Issue Guidelines

### Bug Reports

```markdown
**Bug Description**
[Clear description of the bug]

**To Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
[What should happen]

**Actual Behavior**
[What actually happens]

**Environment**
- OS: [e.g., Windows 11]
- Node.js: [e.g., 20.10.0]
- Version: [e.g., 1.0.0]

**Screenshots/Logs**
[Add if applicable]
```

### Feature Requests

```markdown
**Feature Description**
[Clear description of the feature]

**Problem it Solves**
[What problem does this solve?]

**Proposed Solution**
[How would you implement it?]

**Alternatives Considered**
[What alternatives did you consider?]

**Additional Context**
[Any other context]
```

---

## 🏆 Recognition

### Hall of Fame

Contributors will be recognized in:

- **README.md** - Contributors section
- **Release Notes** - For significant contributions
- **Social Media** - Shoutouts on Twitter/Discord

### Types of Recognition

| Contribution Level | Recognition |
|--------------------|-------------|
| First-time | Welcome message |
| Bug fix | Credit in release notes |
| Feature | Credit + social media mention |
| Major | Credit + special thanks |
| Outstanding | Potential collaborator status |

---

## 📞 Contact

### Need Help?

| Channel | Purpose | Link |
|---------|---------|------|
| **Issues** | Bug reports, features | [GitHub Issues](https://github.com/ratna3/theJoker/issues) |
| **Discussions** | Questions, ideas | [GitHub Discussions](https://github.com/ratna3/theJoker/discussions) |
| **Discord** | Real-time chat | [discord.gg/VRPSujmH](https://discord.gg/VRPSujmH) |
| **Twitter/X** | Updates, announcements | [@RatnaKirti1](https://x.com/RatnaKirti1) |
| **Email** | Private inquiries | [ratnakirtiscr@gmail.com](mailto:ratnakirtiscr@gmail.com) |

---

<div align="center">

## 🙏 Thank You!

**Every contribution, no matter how small, makes a difference.**

Your efforts help make The Joker better for everyone. 🃏❤️

[![GitHub](https://img.shields.io/badge/GitHub-ratna3-181717?style=flat-square&logo=github)](https://github.com/ratna3)
[![Twitter](https://img.shields.io/badge/Twitter-@RatnaKirti1-1DA1F2?style=flat-square&logo=twitter)](https://x.com/RatnaKirti1)
[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=flat-square&logo=discord)](https://discord.gg/VRPSujmH)
[![Email](https://img.shields.io/badge/Email-Contact-D14836?style=flat-square&logo=gmail)](mailto:ratnakirtiscr@gmail.com)

</div>
