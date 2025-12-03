/**
 * The Joker - Agentic Terminal
 * Project Module Exports
 */

export { 
  ProjectScaffolder, 
  projectScaffolder,
  type FrameworkDetectionResult,
  type ScaffoldOptions,
  type FileTemplate,
  type PackageJsonSpec
} from './scaffolder';

export {
  PackageManager,
  DependencyDetector,
  VersionResolver,
  packageManager,
  dependencyDetector,
  versionResolver,
  type InstalledPackage,
  type PackageJson,
  type NpmPackageInfo,
  type DependencyAnalysis,
  type PackagerEvents
} from './packager';
