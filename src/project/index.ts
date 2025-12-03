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

export {
  BuildManager,
  DevServerManager,
  buildManager,
  devServerManager,
  getBuildManager,
  createBuildManager,
  getDevServerManager,
  type BuildStatus,
  type ServerStatus,
  type ErrorSeverity,
  type BuildError,
  type BuildResult,
  type DevServerInfo,
  type BuildConfig,
  type AutoFixResult,
  type WatchOptions,
  type ScriptInfo,
  type BuilderEvents
} from './builder';

export {
  DeploymentManager,
  deploymentManager,
  getDeploymentManager,
  createDeploymentManager,
  type DeploymentPlatform,
  type CICDProvider,
  type BuildMode,
  type DeploymentStatus,
  type ContainerRuntime,
  type DockerConfig,
  type ComposeServiceConfig,
  type ComposeConfig,
  type CICDConfig,
  type PlatformConfig,
  type BuildOptimization,
  type DeploymentResult,
  type GeneratedFile,
  type DeployerEvents
} from './deployer';
