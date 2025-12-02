/**
 * File Tool - File system operations for The Joker
 * Supports reading, writing, and managing files
 */

import { Tool, ToolCategory, ToolResult, toolRegistry } from './registry';
import { log } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const appendFile = promisify(fs.appendFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const copyFile = promisify(fs.copyFile);
const rename = promisify(fs.rename);

/**
 * Read a file
 */
async function readFileTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    filePath,
    encoding = 'utf8',
    lineRange
  } = params;

  if (!filePath) {
    return { success: false, error: 'File path is required' };
  }

  try {
    const fullPath = path.resolve(filePath);
    log.info(`Reading file: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${fullPath}` };
    }

    let content = await readFile(fullPath, encoding as BufferEncoding);

    // Handle line range
    if (lineRange) {
      const lines = content.split('\n');
      const start = Math.max(0, (lineRange.start || 1) - 1);
      const end = lineRange.end || lines.length;
      content = lines.slice(start, end).join('\n');
    }

    const stats = await stat(fullPath);

    return {
      success: true,
      data: {
        path: fullPath,
        content,
        size: stats.size,
        modified: stats.mtime,
        lineCount: content.split('\n').length
      }
    };

  } catch (error: any) {
    log.error(`Read file failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Write to a file
 */
async function writeFileTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    filePath,
    content,
    encoding = 'utf8',
    createDirs = true,
    overwrite = true
  } = params;

  if (!filePath) {
    return { success: false, error: 'File path is required' };
  }

  if (content === undefined) {
    return { success: false, error: 'Content is required' };
  }

  try {
    const fullPath = path.resolve(filePath);
    log.info(`Writing file: ${fullPath}`);

    // Check if file exists
    if (fs.existsSync(fullPath) && !overwrite) {
      return { success: false, error: 'File already exists and overwrite is false' };
    }

    // Create directories if needed
    if (createDirs) {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    await writeFile(fullPath, content, encoding as BufferEncoding);

    const stats = await stat(fullPath);

    return {
      success: true,
      data: {
        path: fullPath,
        size: stats.size,
        created: !fs.existsSync(fullPath),
        encoding
      }
    };

  } catch (error: any) {
    log.error(`Write file failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Append to a file
 */
async function appendFileTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    filePath,
    content,
    encoding = 'utf8',
    createIfMissing = true,
    addNewline = true
  } = params;

  if (!filePath) {
    return { success: false, error: 'File path is required' };
  }

  if (!content) {
    return { success: false, error: 'Content is required' };
  }

  try {
    const fullPath = path.resolve(filePath);
    log.info(`Appending to file: ${fullPath}`);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      if (!createIfMissing) {
        return { success: false, error: 'File does not exist' };
      }
      // Create directories if needed
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    const finalContent = addNewline ? content + '\n' : content;
    await appendFile(fullPath, finalContent, encoding as BufferEncoding);

    const stats = await stat(fullPath);

    return {
      success: true,
      data: {
        path: fullPath,
        size: stats.size,
        appended: content.length
      }
    };

  } catch (error: any) {
    log.error(`Append file failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a file
 */
async function deleteFileTool(params: Record<string, any>): Promise<ToolResult> {
  const { filePath } = params;

  if (!filePath) {
    return { success: false, error: 'File path is required' };
  }

  try {
    const fullPath = path.resolve(filePath);
    log.info(`Deleting file: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'File does not exist' };
    }

    await unlink(fullPath);

    return {
      success: true,
      data: {
        path: fullPath,
        deleted: true
      }
    };

  } catch (error: any) {
    log.error(`Delete file failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List directory contents
 */
async function listDirTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    dirPath,
    recursive = false,
    includeHidden = false,
    filter
  } = params;

  if (!dirPath) {
    return { success: false, error: 'Directory path is required' };
  }

  try {
    const fullPath = path.resolve(dirPath);
    log.info(`Listing directory: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      return { success: false, error: 'Directory does not exist' };
    }

    const getFiles = async (dir: string, baseDir: string = dir): Promise<any[]> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const files: any[] = [];

      for (const entry of entries) {
        // Skip hidden files
        if (!includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Apply filter
        if (filter) {
          const regex = new RegExp(filter);
          if (!regex.test(entry.name)) {
            continue;
          }
        }

        const entryPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, entryPath);
        const stats = await stat(entryPath);

        const fileInfo = {
          name: entry.name,
          path: relativePath,
          fullPath: entryPath,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          size: stats.size,
          modified: stats.mtime
        };

        files.push(fileInfo);

        if (recursive && entry.isDirectory()) {
          const subFiles = await getFiles(entryPath, baseDir);
          files.push(...subFiles);
        }
      }

      return files;
    };

    const files = await getFiles(fullPath);

    return {
      success: true,
      data: {
        path: fullPath,
        count: files.length,
        files: files.sort((a, b) => {
          // Directories first
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        })
      }
    };

  } catch (error: any) {
    log.error(`List directory failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Copy a file
 */
async function copyFileTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    source,
    destination,
    overwrite = false
  } = params;

  if (!source || !destination) {
    return { success: false, error: 'Source and destination paths are required' };
  }

  try {
    const srcPath = path.resolve(source);
    const destPath = path.resolve(destination);
    log.info(`Copying file: ${srcPath} -> ${destPath}`);

    if (!fs.existsSync(srcPath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    if (fs.existsSync(destPath) && !overwrite) {
      return { success: false, error: 'Destination file already exists' };
    }

    // Create destination directory if needed
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      await mkdir(destDir, { recursive: true });
    }

    await copyFile(srcPath, destPath);

    const stats = await stat(destPath);

    return {
      success: true,
      data: {
        source: srcPath,
        destination: destPath,
        size: stats.size
      }
    };

  } catch (error: any) {
    log.error(`Copy file failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Move/rename a file
 */
async function moveFileTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    source,
    destination,
    overwrite = false
  } = params;

  if (!source || !destination) {
    return { success: false, error: 'Source and destination paths are required' };
  }

  try {
    const srcPath = path.resolve(source);
    const destPath = path.resolve(destination);
    log.info(`Moving file: ${srcPath} -> ${destPath}`);

    if (!fs.existsSync(srcPath)) {
      return { success: false, error: 'Source file does not exist' };
    }

    if (fs.existsSync(destPath) && !overwrite) {
      return { success: false, error: 'Destination file already exists' };
    }

    // Create destination directory if needed
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      await mkdir(destDir, { recursive: true });
    }

    await rename(srcPath, destPath);

    return {
      success: true,
      data: {
        source: srcPath,
        destination: destPath,
        moved: true
      }
    };

  } catch (error: any) {
    log.error(`Move file failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if file exists
 */
async function fileExistsTool(params: Record<string, any>): Promise<ToolResult> {
  const { filePath } = params;

  if (!filePath) {
    return { success: false, error: 'File path is required' };
  }

  try {
    const fullPath = path.resolve(filePath);
    const exists = fs.existsSync(fullPath);

    let info = null;
    if (exists) {
      const stats = await stat(fullPath);
      info = {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    }

    return {
      success: true,
      data: {
        path: fullPath,
        exists,
        info
      }
    };

  } catch (error: any) {
    log.error(`File exists check failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a directory
 */
async function createDirTool(params: Record<string, any>): Promise<ToolResult> {
  const {
    dirPath,
    recursive = true
  } = params;

  if (!dirPath) {
    return { success: false, error: 'Directory path is required' };
  }

  try {
    const fullPath = path.resolve(dirPath);
    log.info(`Creating directory: ${fullPath}`);

    if (fs.existsSync(fullPath)) {
      return {
        success: true,
        data: {
          path: fullPath,
          created: false,
          message: 'Directory already exists'
        }
      };
    }

    await mkdir(fullPath, { recursive });

    return {
      success: true,
      data: {
        path: fullPath,
        created: true
      }
    };

  } catch (error: any) {
    log.error(`Create directory failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Define tools
export const readFileToolDef: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to the file to read',
      required: true
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding',
      required: false,
      default: 'utf8'
    },
    {
      name: 'lineRange',
      type: 'object',
      description: 'Read specific lines (start, end)',
      required: false
    }
  ],
  execute: readFileTool
};

export const writeFileToolDef: Tool = {
  name: 'write_file',
  description: 'Write content to a file.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to the file to write',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to write',
      required: true
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding',
      required: false,
      default: 'utf8'
    },
    {
      name: 'createDirs',
      type: 'boolean',
      description: 'Create parent directories if they don\'t exist',
      required: false,
      default: true
    },
    {
      name: 'overwrite',
      type: 'boolean',
      description: 'Overwrite existing file',
      required: false,
      default: true
    }
  ],
  execute: writeFileTool
};

export const appendFileToolDef: Tool = {
  name: 'append_file',
  description: 'Append content to a file.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to the file',
      required: true
    },
    {
      name: 'content',
      type: 'string',
      description: 'Content to append',
      required: true
    },
    {
      name: 'createIfMissing',
      type: 'boolean',
      description: 'Create file if it doesn\'t exist',
      required: false,
      default: true
    }
  ],
  execute: appendFileTool
};

export const deleteFileToolDef: Tool = {
  name: 'delete_file',
  description: 'Delete a file.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to the file to delete',
      required: true
    }
  ],
  execute: deleteFileTool
};

export const listDirToolDef: Tool = {
  name: 'list_dir',
  description: 'List contents of a directory.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'dirPath',
      type: 'string',
      description: 'Path to the directory',
      required: true
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'List subdirectories recursively',
      required: false,
      default: false
    },
    {
      name: 'includeHidden',
      type: 'boolean',
      description: 'Include hidden files',
      required: false,
      default: false
    },
    {
      name: 'filter',
      type: 'string',
      description: 'Regex pattern to filter files',
      required: false
    }
  ],
  execute: listDirTool
};

export const copyFileToolDef: Tool = {
  name: 'copy_file',
  description: 'Copy a file to a new location.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'source',
      type: 'string',
      description: 'Source file path',
      required: true
    },
    {
      name: 'destination',
      type: 'string',
      description: 'Destination file path',
      required: true
    },
    {
      name: 'overwrite',
      type: 'boolean',
      description: 'Overwrite if destination exists',
      required: false,
      default: false
    }
  ],
  execute: copyFileTool
};

export const moveFileToolDef: Tool = {
  name: 'move_file',
  description: 'Move or rename a file.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'source',
      type: 'string',
      description: 'Source file path',
      required: true
    },
    {
      name: 'destination',
      type: 'string',
      description: 'Destination file path',
      required: true
    },
    {
      name: 'overwrite',
      type: 'boolean',
      description: 'Overwrite if destination exists',
      required: false,
      default: false
    }
  ],
  execute: moveFileTool
};

export const fileExistsToolDef: Tool = {
  name: 'file_exists',
  description: 'Check if a file or directory exists.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to check',
      required: true
    }
  ],
  execute: fileExistsTool
};

export const createDirToolDef: Tool = {
  name: 'create_dir',
  description: 'Create a directory.',
  category: ToolCategory.FILE,
  parameters: [
    {
      name: 'dirPath',
      type: 'string',
      description: 'Path to the directory to create',
      required: true
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'Create parent directories if needed',
      required: false,
      default: true
    }
  ],
  execute: createDirTool
};

/**
 * Register all file tools
 */
export function registerFileTools(): void {
  toolRegistry.register(readFileToolDef);
  toolRegistry.register(writeFileToolDef);
  toolRegistry.register(appendFileToolDef);
  toolRegistry.register(deleteFileToolDef);
  toolRegistry.register(listDirToolDef);
  toolRegistry.register(copyFileToolDef);
  toolRegistry.register(moveFileToolDef);
  toolRegistry.register(fileExistsToolDef);
  toolRegistry.register(createDirToolDef);
  log.info('File tools registered');
}

export {
  readFileTool,
  writeFileTool,
  appendFileTool,
  deleteFileTool,
  listDirTool,
  copyFileTool,
  moveFileTool,
  fileExistsTool,
  createDirTool
};
