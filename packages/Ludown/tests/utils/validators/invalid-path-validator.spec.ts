import * as mockFs from 'mock-fs';
import * as path from 'path';
import { ERROR_CODE } from '../../../src/models/error-codes';
import { invalidPathValidatorFactory } from '../../../src/utils/validators/invalid-path-validator';

describe('Invalid path validator', () => {
	beforeEach(() => mockFs({ 'mock.txt': 'Sample mocked text file', 'mock-dir': {} }));
	afterEach(() => mockFs.restore());

	it('should resolve when directory flag is false and path resolves to an existent file.', async done => {
		const data = await invalidPathValidatorFactory(false).execute('./mock.txt');

		expect(data).toBeTruthy();
		done();
	});

	it('should resolve when directory flag is true and path resolves to an existent directory.', async done => {
		const data = await invalidPathValidatorFactory(true).execute('./mock-dir');

		expect(data).toBeTruthy();
		done();
	});

	it('should reject when path does not exist.', async done => {
		try {
			await invalidPathValidatorFactory(true).execute('./non-existent-file.txt');
		} catch (err) {
			const resolvedPath = path.resolve('./non-existent-file.txt');

			expect(err).toEqual({
				code: ERROR_CODE.PATH_NOT_FOUND,
				data: resolvedPath,
				message: `The path ("${resolvedPath}") does not exist.`
			});
			done();
		}
	});

	it('should reject when directory flag is true and path is of a file.', async done => {
		try {
			await invalidPathValidatorFactory(true).execute('./mock.txt');
		} catch (err) {
			const resolvedPath = path.resolve('./mock.txt');

			expect(err).toEqual({
				code: ERROR_CODE.NOT_A_DIRECTORY,
				data: resolvedPath,
				message: `The path ("${resolvedPath}") is not a directory.`
			});
			done();
		}
	});

	it('should reject when directory flag is false and path is of a directory.', async done => {
		try {
			await invalidPathValidatorFactory(false).execute('./mock-dir');
		} catch (err) {
			const resolvedPath = path.resolve('./mock-dir');

			expect(err).toEqual({
				code: ERROR_CODE.NOT_A_FILE,
				data: resolvedPath,
				message: `The path ("${resolvedPath}") is not a file.`
			});
			done();
		}
	});
});