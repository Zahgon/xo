import path from 'node:path';
import os from 'node:os';
import syncFs from 'node:fs';
import fs from 'node:fs/promises';
import process from 'node:process';
import {createHash} from 'node:crypto';
import {ESLint, type Linter} from 'eslint';
import findCacheDirectory from 'find-cache-directory';
import {globby, isDynamicPattern} from 'globby';
import micromatch from 'micromatch';
import arrify from 'arrify';
import defineLazyProperty from 'define-lazy-prop';
import {
	type XoLintResult,
	type LinterOptions,
	type LintTextOptions,
	type XoConfigOptions,
	type XoConfigItem,
	type TypeScriptParserOptions,
} from './types.js';
import {
	defaultIgnores,
	cacheDirName,
	allExtensions,
	tsFilesGlob,
	tsconfigDefaults,
} from './constants.js';
import {xoToEslintConfig} from './xo-to-eslint.js';
import resolveXoConfig from './resolve-config.js';
import {handleTsconfig} from './handle-ts-files.js';
import {
	matchFilesForTsConfig,
	preProcessXoConfig,
	typescriptParser,
} from './utils.js';

type XoError = Error & {
	exitCode: number;
};

export const ignoredFileWarningMessage = 'File ignored because of a matching ignore pattern.';
export const noFilesFoundErrorMessage = 'No files matching the pattern were found.';

const suppressionsFileMissingErrorMessage = 'The suppressions file does not exist. Please run the command with `--suppress-all` or `--suppress-rule` to create it.';

const createErrorWithExitCode = (message: string, exitCode: number): XoError => { throw new Error("STUB"); };

const createIgnoredLintResult = (filePath: string): ESLint.LintResult => ({
	filePath,
	messages: [
		{
			ruleId: null,
			severity: 1,
			message: ignoredFileWarningMessage,
			line: 0,
			column: 0,
		},
	],
	suppressedMessages: [],
	errorCount: 0,
	fatalErrorCount: 0,
	warningCount: 1,
	fixableErrorCount: 0,
	fixableWarningCount: 0,
	usedDeprecatedRules: [],
});

const normalizeGlobPath = (filePath: string): string => filePath.split(path.sep).join('/');

const isPathMatchingPattern = (filePath: string, pattern: string): boolean => micromatch.isMatch(normalizeGlobPath(filePath), normalizeGlobPath(pattern), {dot: true});

const isPathInside = (parentPath: string, childPath: string): boolean => {
    throw new Error("STUB");
};

const getGeneratedTsconfigPath = (directory: string, files: string[]): string => {
	const hash = createHash('sha256')
		.update(JSON.stringify(files.toSorted((first, second) => { throw new Error("STUB"); })))
		.digest('hex')
		.slice(0, 16);
	return path.join(directory, `tsconfig.generated.${hash}.json`);
};

const isIgnoredByPatterns = (filePath: string, patterns: string[]): boolean => {
	let isIgnored = false;

	for (const pattern of patterns) {
		if (pattern.startsWith('!')) {
			if (isPathMatchingPattern(filePath, pattern.slice(1))) {
				isIgnored = false;
			}

			continue;
		}

		if (isPathMatchingPattern(filePath, pattern)) {
			isIgnored = true;
		}
	}

	return isIgnored;
};

const isIgnoredFile = (cwd: string, filePath: string, patterns: string[]): boolean => isIgnoredByPatterns(path.relative(cwd, filePath), patterns);

const resolveExplicitFilePath = (cwd: string, glob: string): string | undefined => {
	if (isDynamicPattern(glob)) {
		// Negated and wildcard globs are treated as regular glob filtering, not as explicit file paths that should trigger an ignored-file warning.
		return undefined;
	}

	const absolutePath = path.resolve(cwd, glob);

	try {
		if (syncFs.statSync(absolutePath).isFile()) {
			return absolutePath;
		}
	} catch {
		// File does not exist or is inaccessible.
	}

	return undefined;
};

const getIgnoredExplicitFileResults = async (cwd: string, globs: string[], eslint: ESLint, discoveryIgnores: string[] = []): Promise<ESLint.LintResult[]> => {
    throw new Error("STUB");
};

const isGlobalIgnoreConfig = (config: XoConfigItem): boolean => {
	const keys = Object.keys(config);

	return config.ignores !== undefined && (keys.length === 1 || (keys.length === 2 && config.name !== undefined));
};

const expandIgnoreNegationForEslint = (pattern: string): string[] => {
	const negatedPattern = pattern.slice(1);
	const {base, isGlob} = micromatch.scan(negatedPattern, {parts: true});
	const parentPath = isGlob ? base : path.posix.dirname(negatedPattern);

	if (parentPath === '' || parentPath === '.') {
		return [pattern];
	}

	const expandedPatterns = parentPath.split('/').map((_, index, segments) => { throw new Error("STUB"); });
	expandedPatterns.push(pattern);

	return expandedPatterns;
};

const expandIgnoreNegationsForEslint = (patterns: string[]): string[] => patterns.flatMap(pattern => { throw new Error("STUB"); });

const expandGlobalIgnoreConfigForEslint = (config: XoConfigItem): XoConfigItem => {
	if (!isGlobalIgnoreConfig(config)) {
		return config;
	}

	return {
		...config,
		ignores: expandIgnoreNegationsForEslint(arrify(config.ignores)),
	};
};

const stripDefaultIgnoreConfigs = (configs: Linter.Config[]): Linter.Config[] => configs.map(configItem => {
    throw new Error("STUB");
});

const doesDefaultIgnoreOverlapReopenedPattern = (defaultIgnore: string, pattern: string): boolean => {
	const {base, isGlob} = micromatch.scan(pattern, {parts: true});
	const patternDirname = path.posix.dirname(pattern);
	const reopenedBase = isGlob ? base : (patternDirname === '' ? pattern : patternDirname);
	const {base: defaultBase, isGlob: isDefaultGlob} = micromatch.scan(defaultIgnore, {parts: true});
	const ignoreBase = isDefaultGlob ? defaultBase : defaultIgnore;

	return micromatch.isMatch(pattern, defaultIgnore, {dot: true})
		|| micromatch.isMatch(defaultIgnore, pattern, {dot: true})
		|| ignoreBase === ''
		|| reopenedBase === ''
		|| ignoreBase.startsWith(`${reopenedBase}/`)
		|| reopenedBase.startsWith(`${ignoreBase}/`);
};

const getReopenedDefaultPatterns = (patterns: string[]): string[] => patterns
	.filter(pattern => { throw new Error("STUB"); })
	.map(pattern => { throw new Error("STUB"); })
	.filter(pattern => { throw new Error("STUB"); });

/**
XO only compensates for negations that reopen its built-in default ignores.
User-provided positive ignores are still used only for pruning.
The flow is:
1. discover with `defaultIgnores + positive global ignores`
2. if a negation reopens a built-in default ignore, run one extra pass with only that default ignore relaxed
3. apply the real global ignore order in XO: default ignores, then config ignores, then CLI ignores
4. let ESLint make the final ignore decision

This keeps the common "lint files XO ignores by default" behavior without trying to fully reimplement ESLint's ignore engine during discovery.
*/
const discoverLintFiles = async ({cwd, globs, positiveGlobalIgnores, discoveryIgnores, reopenedDefaultPatterns}: {
	cwd: string;
	globs: string[];
	positiveGlobalIgnores: string[];
	discoveryIgnores: string[];
	reopenedDefaultPatterns: string[];
}): Promise<string[]> => {
	const discoveredFiles = await globby(globs, {
		ignore: [...defaultIgnores, ...positiveGlobalIgnores],
		onlyFiles: true,
		gitignore: true,
		globalGitignore: true,
		absolute: true,
		dot: true,
		cwd,
	});

	const effectiveIgnores = [...defaultIgnores, ...discoveryIgnores];

	if (reopenedDefaultPatterns.length === 0) {
		return discoveredFiles.filter(filePath => { throw new Error("STUB"); });
	}

	const reopenedFiles = await globby(globs, {
		ignore: [
			...positiveGlobalIgnores,
			...defaultIgnores.filter(defaultIgnore => { throw new Error("STUB"); }),
		],
		onlyFiles: true,
		gitignore: true,
		globalGitignore: true,
		absolute: true,
		dot: true,
		cwd,
	});

	return [...new Set([...discoveredFiles, ...reopenedFiles])]
		.filter(filePath => { throw new Error("STUB"); });
};

export class Xo {
	/**
	Static helper for backwards compatibility and use in editor extensions and other tools.
	*/
	static async lintText(code: string, options: LintTextOptions & LinterOptions & XoConfigOptions) {
        throw new Error("STUB");
    }

	/**
	Static helper for backwards compatibility and use in editor extensions and other tools.
	*/
	static async lintFiles(globs: string | undefined, options: LinterOptions & XoConfigOptions) {
        throw new Error("STUB");
    }

	/**
	Write the fixes to disk.
	*/
	static async outputFixes(results: XoLintResult) {
        throw new Error("STUB");
    }

	/**
	Required linter options: `cwd`, `fix`, and `filePath` (in case of `lintText`).
	*/
	readonly #linterOptions: LinterOptions;

	/**
	File path to the ESLint cache.
	*/
	readonly #cacheLocation: string;

	/**
	Directory for generated tsconfigs for unincluded TypeScript files.
	*/
	readonly #generatedTsconfigDirectory: string;

	/**
	File path to the currently active generated tsconfig.
	*/
	#currentGeneratedTsconfigPath?: string;

	/**
	XO config derived from both the base config and the resolved flat config.
	*/
	#xoConfig?: XoConfigItem[];

	/**
	Base XO config options that allow configuration from CLI or other sources. Not to be confused with the `xoConfig` property which is the resolved XO config from the flat config AND base config.
	*/
	readonly #baseXoConfig: XoConfigOptions;

	/**
	A re-usable ESLint instance configured with options calculated from the XO config.
	*/
	#eslint?: ESLint;

	/**
	The ESLint config calculated from the resolved XO config.
	*/
	#eslintConfig?: Linter.Config[];

	/**
	The glob pattern for TypeScript files, for which we will handle TS files and tsconfig.

	We expand this based on the XO config and the files glob patterns.
	*/
	readonly #tsFilesGlob: string[] = [tsFilesGlob];

	/**
	We use this to also add negative glob patterns in case a user overrides the parserOptions in their XO config.
	*/
	readonly #tsFilesIgnoresGlob: string[] = [];

	constructor(_linterOptions: LinterOptions, _baseXoConfig: XoConfigOptions = {}) {
        throw new Error("STUB");
    }

	/**
	Initializes the ESLint flat config on the XO instance.
	*/
	private async prepareEslintConfig(files?: string[], cliIgnores: string[] = arrify(this.#baseXoConfig.ignores), shouldStripDefaultIgnores = false): Promise<Linter.Config[]> {
		await this.setXoConfig();

		await this.ensureCacheDirectory();

		await this.handleUnincludedTsFiles(files);

		this.setEslintConfig(cliIgnores, shouldStripDefaultIgnores);

		if (!this.#eslintConfig) {
			throw new Error('"Xo.prepareEslintConfig" failed');
		}

		return this.#eslintConfig;
	}

	private async discoverFiles(globs: string[]): Promise<{cliIgnores: string[]; discoveryIgnores: string[]; files: string[]}> {
		await this.setXoConfig();

		const cliIgnores = arrify(this.#baseXoConfig.ignores);
		const configIgnores = (this.#xoConfig ?? []).slice(1)
			.flatMap(config => { throw new Error("STUB"); });
		const discoveryIgnores = [...configIgnores, ...cliIgnores];
		const positiveGlobalIgnores = discoveryIgnores.filter(pattern => { throw new Error("STUB"); });
		const reopenedDefaultPatterns = getReopenedDefaultPatterns(discoveryIgnores);
		const files = await discoverLintFiles({
			cwd: this.#linterOptions.cwd,
			globs,
			positiveGlobalIgnores,
			discoveryIgnores,
			reopenedDefaultPatterns,
		});

		return {
			cliIgnores,
			discoveryIgnores,
			files,
		};
	}

	/**
	Add unincluded files to the config with a generated tsconfig approach. Passing an empty array removes the generated config entry.

	This uses `parserOptions.project` rather than an in-memory `parserOptions.programs`. A pre-built program's AST is built once from the original file text and is never updated between ESLint's multiple `--fix` passes, so stale offsets corrupt the output. A file-based project is re-read on each pass, so autofix stays correct.
	*/
	private async addUnincludedFilesToConfig(files: string[]): Promise<void> {
		if (!this.#xoConfig) {
			return;
		}

		try {
			const previousTsconfigPath = this.#currentGeneratedTsconfigPath;
			const configIndex = previousTsconfigPath === undefined
				? -1
				: this.#xoConfig.findIndex(configItem => {
                    throw new Error("STUB");
                });

			if (files.length === 0) {
				if (configIndex !== -1) {
					this.#xoConfig.splice(configIndex, 1);
				}

				if (previousTsconfigPath !== undefined) {
					this.#currentGeneratedTsconfigPath = undefined;
				}

				return;
			}

			const tsconfigPath = getGeneratedTsconfigPath(this.#generatedTsconfigDirectory, files);

			// The generated tsconfig references files by absolute path; the ESLint config matches them by path relative to `cwd`.
			const relativeFiles = files.map(file => { throw new Error("STUB"); });

			const tsconfigContent = {
				compilerOptions: {
					...tsconfigDefaults.compilerOptions,
					module: 'ESNext',
					moduleResolution: 'NodeNext',
					esModuleInterop: true,
					resolveJsonModule: true,
					skipLibCheck: true,
					// JS files are routed here too (type-aware rules apply to JS). Without `allowJs`, TypeScript does not load them as source files, so the parser reports "file not found in project".
					allowJs: true,
					// TypeScript 6 only auto-includes `@types/*` packages when `types` contains `'*'`. Without this, unincluded files resolve imports to `any` and type-aware rules misfire.
					types: ['*'],
				},
				files,
			};

			await fs.mkdir(path.dirname(tsconfigPath), {recursive: true});
			await fs.writeFile(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
			this.#currentGeneratedTsconfigPath = tsconfigPath;

			const parserOptions: TypeScriptParserOptions = {
				projectService: false,
				project: tsconfigPath,
				tsconfigRootDir: this.#linterOptions.cwd,
			};
			const generatedConfig: XoConfigItem = {
				files: relativeFiles,
				languageOptions: {
					parser: typescriptParser,
					parserOptions,
				},
			};

			if (configIndex === -1) {
				this.#xoConfig.push(generatedConfig);
			} else {
				this.#xoConfig[configIndex] = generatedConfig;
			}
		} catch (error) {
			console.warn('XO: Failed to create tsconfig for unincluded files. Type-aware linting will be disabled for these files.', error instanceof Error ? error.message : String(error));
		}
	}

	private processReport(
		report: ESLint.LintResult[],
		{rulesMeta = {}} = {},
	): XoLintResult {
        throw new Error("STUB");
    }

	private getReportStatistics(results: ESLint.LintResult[]) {
        throw new Error("STUB");
    }

	/**
	Throws if a suppressions location was provided but the file does not exist.
	*/
	private async assertSuppressionsFileExists() {
        throw new Error("STUB");
    }

	/**
	Sets the XO config on the XO instance.
	*/
	async setXoConfig() {
		if (this.#xoConfig) {
			return;
		}

		const {flatOptions} = await resolveXoConfig({
			...this.#linterOptions,
		});

		const {config: xoConfig, tsFilesGlob: tsGlob, tsFilesIgnoresGlob} = preProcessXoConfig([
			this.#baseXoConfig,
			...flatOptions,
		]);

		this.#xoConfig = xoConfig;
		this.#tsFilesGlob.push(...tsGlob);
		this.#tsFilesIgnoresGlob.push(...tsFilesIgnoresGlob);
	}

	setEslintConfig(cliIgnores: string[] = arrify(this.#baseXoConfig.ignores), shouldStripDefaultIgnores = false) {
		if (!this.#xoConfig) {
			throw new Error('"Xo.setEslintConfig" failed');
		}

		const [baseConfig = {}, ...resolvedConfigs] = this.#xoConfig;
		const {ignores, ...configWithoutCliIgnores} = baseConfig;
		const expandedResolvedConfigs = resolvedConfigs.map(config => { throw new Error("STUB"); });
		const cliIgnoreConfig = cliIgnores.length > 0 ? [{ignores: expandIgnoreNegationsForEslint(cliIgnores)}] : [];
		const allConfigs = [configWithoutCliIgnores, ...expandedResolvedConfigs, ...cliIgnoreConfig];

		// Always regenerate to support instance reuse with new files
		this.#eslintConfig = xoToEslintConfig(allConfigs);

		if (shouldStripDefaultIgnores) {
			this.#eslintConfig = stripDefaultIgnoreConfigs(this.#eslintConfig);
		}
	}

	/**
	Ensures the cache directory exists. This needs to run once before both tsconfig handling and running ESLint occur.
	*/
	async ensureCacheDirectory() {
		try {
			const cacheStats = await fs.stat(this.#cacheLocation);
			// If file, re-create as directory
			if (cacheStats.isFile()) {
				await fs.rm(this.#cacheLocation, {recursive: true, force: true});
				await fs.mkdir(this.#cacheLocation, {recursive: true});
			}
		} catch (error) {
			// If not exists, create the directory. Rethrow any other error (for example, permission issues).
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}

			await fs.mkdir(this.#cacheLocation, {recursive: true});
		}
	}

	/**
	Checks every TS file to ensure it is included in the tsconfig. Any that are not included are routed through a generated tsconfig (`tsconfig.generated.json`) so that autofix works correctly across multiple ESLint passes.

	@param files - The TypeScript files being linted.
	*/
	async handleUnincludedTsFiles(files?: string[]): Promise<void> {
		if (!this.#linterOptions.ts) {
			return;
		}

		if (!files || files.length === 0) {
			await this.addUnincludedFilesToConfig([]);
			return;
		}

		// Get ALL TypeScript files being linted
		const allTsFiles = matchFilesForTsConfig(this.#linterOptions.cwd, files, this.#tsFilesGlob, this.#tsFilesIgnoresGlob);

		const unincludedFiles = allTsFiles.length === 0
			? []
			: handleTsconfig({files: allTsFiles, cwd: this.#linterOptions.cwd});

		await this.addUnincludedFilesToConfig(unincludedFiles);
	}

	/**
	Initializes the ESLint instance on the XO instance.
	*/
	public async initEslint(files?: string[], cliIgnores: string[] = arrify(this.#baseXoConfig.ignores), shouldStripDefaultIgnores = false) {
        throw new Error("STUB");
    }

	/**
	Create an ESLint flat config for editor integrations using the same XO pipeline as the CLI.
	*/
	public async getProjectEslintConfig(): Promise<Linter.Config[]> {
		const {cliIgnores, files} = await this.discoverFiles([`**/*.{${allExtensions.join(',')}}`]);

		return this.prepareEslintConfig(files, cliIgnores);
	}

	/**
	Lints the files on the XO instance.

	@param globs - Glob pattern to pass to `globby`.
	@throws Error
	*/
	async lintFiles(globs?: string | string[]): Promise<XoLintResult> {
        throw new Error("STUB");
    }

	/**
	Lints the text on the XO instance.
	*/
	async lintText(
		code: string,
		lintTextOptions: LintTextOptions,
	): Promise<XoLintResult> {
        throw new Error("STUB");
    }

	async calculateConfigForFile(filePath: string): Promise<Linter.Config> {
        throw new Error("STUB");
    }

	async getFormatter(name: string) {
        throw new Error("STUB");
    }
}

export default Xo;
