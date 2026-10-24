import {fileURLToPath, pathToFileURL} from 'node:url';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';
import {getGlobalSettings} from '../core/settings';
import {minimatch} from 'minimatch';
import {getEditorState} from '../core/editorState';

// Glob matching compiles the pattern on every call, and the analyzer asks about every file on every reanalysis.
// The answers only change with the settings or the workspace folder, so they are cached against both.
const angelScriptFileCache = new Map<string, boolean>();
const excludeFileCache = new Map<string, boolean>();
let matchCacheSettings: unknown;
let matchCacheWorkspace: string | undefined;

function validateMatchCache() {
    const settings = getGlobalSettings();
    const workspace = getEditorState().workspaceFolderUris[0];
    if (settings !== matchCacheSettings || workspace !== matchCacheWorkspace) {
        angelScriptFileCache.clear();
        excludeFileCache.clear();
        matchCacheSettings = settings;
        matchCacheWorkspace = workspace;
    }
}

export function isAngelScriptFile(relativeOrAbsolute: string): boolean {
    validateMatchCache();
    const cached = angelScriptFileCache.get(relativeOrAbsolute);
    if (cached !== undefined) {
        return cached;
    }

    const patterns = getGlobalSettings().files.angelScript;
    const fileName = path.basename(relativeOrAbsolute);
    const result = patterns.some(pattern => minimatch(fileName, pattern) || minimatch(relativeOrAbsolute, pattern));
    angelScriptFileCache.set(relativeOrAbsolute, result);
    return result;
}

export function shouldExcludeFile(uri: string): boolean {
    validateMatchCache();
    const cached = excludeFileCache.get(uri);
    if (cached !== undefined) {
        return cached;
    }

    const patterns = getGlobalSettings().files.exclude;
    const cwd = (getEditorState().workspaceFolderUris[0] ?? '') + '/';
    const result = patterns.some(pattern => minimatch(uri, pattern) || minimatch(uri, resolveUri(cwd, pattern)));
    excludeFileCache.set(uri, result);
    return result;
}

/**
 * Extract file extension from a glob pattern (e.g., "*.as" -> ".as").
 * Returns the first extension found, or ".as" as default.
 */
function extractExtensionFromPattern(pattern: string): string {
    // Match patterns like "*.ext", "**/*.ext", or "*.spec.ts"
    const match = pattern.match(/\*(\.[^*]+)$/);
    if (match && match[1]) {
        return match[1];
    }

    // For exact filenames like "as.predefined", return empty (no extension to append)
    if (!pattern.includes('*')) {
        return '';
    }

    // Default fallback
    return '.as';
}

/**
 * Resolves a relative file path against a base file URI and returns the resulting URI as a string.
 *
 * @param baseUri - The base file or directory URI as a string (e.g., "file:///path/to/file.as").
 * @param relativePath - A relative path from the base URI (e.g., "src/index.as").
 * @returns The resolved file URI as a string, or an empty string if resolution fails.
 */
export function resolveUri(baseUri: string, relativePath: string): string {
    try {
        const base = new URL(baseUri);
        const u = new URL(relativePath, base);

        let href: string = u.href;

        if (u.protocol === 'file:') {
            href = normalizeFileUri(href);
        }

        return href;
    } catch (error) {
        return '';
    }
}

function normalizeFileUri(uri: string) {
    // Case 1: Normalize a drive letter ":" to "%3A"
    // Example: file:///C:/... --> file:///c%3A/...
    uri = uri.replace(/^file:\/\/\/([A-Za-z]):/, (_m, d: string) => `file:///${d.toLowerCase()}%3A`);

    // Case 2: Special handling for root-only paths
    // Example: file:///c%3A/ --> file:///c%3A
    uri = uri.replace(/^file:\/\/\/([a-z])%3A\/(?=[?#]|$)/, 'file:///$1%3A');

    return uri;
}

export function resolveIncludeUri(baseUri: string, relativeOrAbsolute: string): string {
    relativeOrAbsolute = relativeOrAbsolute.replace(/\\+/g, '/');

    if (path.isAbsolute(relativeOrAbsolute)) {
        return normalizeFileUri(url.pathToFileURL(relativeOrAbsolute).toString());
    }

    if (!isAngelScriptFile(relativeOrAbsolute) && !relativeOrAbsolute.endsWith('as.predefined')) {
        // If the file does not match any pattern, try to extract extension from first file pattern
        // and append it (defaults to .as)
        const defaultExt = extractExtensionFromPattern(getGlobalSettings().files.angelScript[0] || '*.as');
        if (defaultExt) {
            relativeOrAbsolute = relativeOrAbsolute + defaultExt;
        }
    }

    const primaryUri = resolveUri(baseUri, relativeOrAbsolute);
    if (isFileUri(primaryUri)) {
        return primaryUri;
    }

    for (const includePath of getGlobalSettings().includePath) {
        const includeUri = pathToFileURL(toAbsolutePath(includePath)).toString() + '/';
        const fallbackUri = resolveUri(includeUri, relativeOrAbsolute);
        if (isFileUri(fallbackUri)) {
            return fallbackUri;
        }
    }

    return primaryUri;
}

export function getIncludeUriList(): {path: string; uri: string}[] {
    const list: {path: string; uri: string}[] = [];
    for (const includePath of getGlobalSettings().includePath) {
        const includeUri = pathToFileURL(toAbsolutePath(includePath)).toString() + '/';
        list.push({path: includePath, uri: includeUri});
    }

    return list;
}

function toAbsolutePath(inputPath: string, baseDir: string = process.cwd()): string {
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(baseDir, inputPath);
}

// Include resolution stats the same files for every record on every reanalysis.
// A short lifetime keeps the answers fresh enough for files created or deleted outside the editor.
const fileExistenceLifetime = 2000; // ms

const fileExistenceCache = new Map<string, {isFile: boolean; checkedAt: number}>();

export function isFileUri(uri: string): boolean {
    const now = Date.now();
    const cached = fileExistenceCache.get(uri);
    if (cached !== undefined && now - cached.checkedAt < fileExistenceLifetime) {
        return cached.isFile;
    }

    let isFile: boolean;
    try {
        isFile = fs.statSync(fileURLToPath(uri)).isFile();
    } catch (error) {
        isFile = false;
    }

    fileExistenceCache.set(uri, {isFile: isFile, checkedAt: now});
    return isFile;
}

/**
 * Forget cached file existence, e.g. when the editor reports that files were created or deleted.
 */
export function clearFileExistenceCache() {
    fileExistenceCache.clear();
}

export function readFileContent(uri: string): string | undefined {
    try {
        if (isFileUri(uri) === false) {
            return undefined;
        }

        return fs.readFileSync(fileURLToPath(uri), 'utf8');
    } catch (error) {
        return undefined;
    }
}

export function getParentDirectoryList(uri: string): string[] {
    const parsedUrl = url.parse(uri);
    const currentPath = parsedUrl.pathname;
    if (currentPath === null) {
        return [];
    }

    const directories: string[] = [];
    let parentPath = currentPath;

    // Repeat until the directory reaches the root
    while (parentPath !== path.dirname(parentPath)) {
        parentPath = path.dirname(parentPath);
        directories.push(
            url.format({
                protocol: parsedUrl.protocol,
                slashes: true,
                hostname: parsedUrl.hostname,
                pathname: parentPath
            })
        );
    }

    return directories;
}
