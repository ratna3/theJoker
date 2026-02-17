/**
 * The Joker - Agentic Terminal
 * Coding Module Exports
 */

export * from './generator';
export * from './indexer';

// Export from parser - explicitly list to avoid conflicts with indexer types
export { 
  codeParser,
  CodeParser,
  SupportedLanguage,
  ComplexityMetrics,
  CodeSmell,
  CommentInfo,
  TypeDefinition,
  TypeProperty,
  ParsedCode,
  ParserOptions
} from './parser';

// Export from analyzer - explicitly list to avoid re-exporting indexer types
export {
  Usage,
  AnalysisComplexityMetrics,
  AnalysisCodeSmell,
  Duplicate,
  UnusedCode,
  Suggestion,
  AnalysisResult,
  ExportSummary,
  CodeSummary,
  AnalyzerSearchResult,
  AnalyzerOptions,
  CodeAnalyzer,
  SemanticCodeSearch,
  getCodeAnalyzer,
  codeAnalyzer,
  getSemanticSearch,
  semanticSearch,
  createAnalyzer
} from './analyzer';

// Export from test-generator - explicitly list to avoid conflicts with indexer types
// Note: FunctionInfo, ClassInfo, PropertyInfo from test-generator are excluded (use indexer's versions)
export {
  TestCase,
  GeneratedTest,
  MockSpec,
  TestGenerationOptions,
  TestFramework,
  TestRunResult,
  TestSuiteResult,
  IndividualTestResult,
  TestFailure,
  CoverageResult,
  CoverageMetric,
  FileCoverage,
  QualityResult,
  QualityIssue,
  QualityMetrics,
  LintResult,
  LintIssue,
  FormatResult,
  CodeAnalysis,
  ParamInfo,
  TestGenerator,
  TestRunner,
  QualityChecker,
  getTestGenerator,
  createTestGenerator,
  getTestRunner,
  createTestRunner,
  getQualityChecker,
  createQualityChecker,
  testGenerator,
  testRunner,
  qualityChecker
} from './test-generator';

// Re-export defaults
export { codeGenerator } from './generator';
export { fileIndexer, DependencyGraph } from './indexer';
