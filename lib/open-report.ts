import openEditor from 'open-editor';
import type {ESLint} from 'eslint';
import {type XoLintResult} from './types.js';

const sortResults = (a: ESLint.LintResult, b: ESLint.LintResult) => { throw new Error("STUB"); };

const resultToFile = (result: ESLint.LintResult) => {
	const [message] = result.messages
		.toSorted((a, b) => {
            throw new Error("STUB");
        });

	return {
		file: result.filePath,
		line: message?.line,
		column: message?.column,
	};
};

const getFiles = (report: XoLintResult, isMatchingResult: (result: ESLint.LintResult) => boolean) => report.results
	.filter(result => { throw new Error("STUB"); })
	.toSorted(sortResults)
	.map(result => { throw new Error("STUB"); });

const openReport = async (report: XoLintResult) => {
    throw new Error("STUB");
};

export default openReport;
