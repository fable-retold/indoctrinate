/**
* Unit tests for Indoctrinate Processing Task file hashing
*
* @author      Steven Velozo <steven@velozo.com>
*/

const libPict = require('pict-service-commandlineutility');
const libIndoctrinateProcessingTask = require('../source/services/processor/Indoctrinate-Service-ProcessingTask.js');
const libIndoctrinateUnderstandFile = require('../source/services/processor/understand/Indoctrinate-Understand-File.js');

const libFS = require('fs');
const libOS = require('os');
const libPath = require('path');
const libCrypto = require('crypto');

const Chai = require("chai");
const Expect = Chai.expect;

const MEBIBYTE = 1024 * 1024;

const referenceMD5 = (pBuffer) =>
{
	return libCrypto.createHash('md5').update(pBuffer).digest('hex');
};

// Wrap the fs calls the hasher uses so the tests can see how much is read at once and that descriptors get closed.
const spyOnFileSystem = () =>
{
	const tmpOriginals = (
		{
			readFileSync: libFS.readFileSync,
			readSync: libFS.readSync,
			openSync: libFS.openSync,
			closeSync: libFS.closeSync
		});
	const tmpRecord = (
		{
			ReadFileSyncCalls: 0,
			Reads: [],
			Opened: [],
			Closed: []
		});

	libFS.readFileSync = function (...pArguments)
	{
		tmpRecord.ReadFileSyncCalls++;
		return tmpOriginals.readFileSync.apply(libFS, pArguments);
	};
	libFS.readSync = function (pFileDescriptor, pBuffer, pOffset, pLength, pPosition)
	{
		const tmpBytesRead = tmpOriginals.readSync.call(libFS, pFileDescriptor, pBuffer, pOffset, pLength, pPosition);
		tmpRecord.Reads.push({ Buffer: pBuffer, Length: pLength, BytesRead: tmpBytesRead });
		return tmpBytesRead;
	};
	libFS.openSync = function (...pArguments)
	{
		const tmpFileDescriptor = tmpOriginals.openSync.apply(libFS, pArguments);
		tmpRecord.Opened.push(tmpFileDescriptor);
		return tmpFileDescriptor;
	};
	libFS.closeSync = function (pFileDescriptor)
	{
		tmpRecord.Closed.push(pFileDescriptor);
		return tmpOriginals.closeSync.call(libFS, pFileDescriptor);
	};

	tmpRecord.restore = () =>
	{
		Object.assign(libFS, tmpOriginals);
	};
	return tmpRecord;
};

// Hash with the fs spy in place, always restoring fs afterward.
const hashWithSpy = (pTask, pContentDescription) =>
{
	const tmpSpy = spyOnFileSystem();
	try
	{
		tmpSpy.Digest = pTask.computeMD5Sync(pContentDescription);
	}
	catch (pError)
	{
		tmpSpy.Error = pError;
	}
	finally
	{
		tmpSpy.restore();
	}
	return tmpSpy;
};

const expectBoundedReads = (pSpy, pChunkSize, pExpectedTotalBytes) =>
{
	Expect(pSpy.ReadFileSyncCalls).to.equal(0, 'The whole file should never be read in one call.');
	Expect(pSpy.Reads.length).to.be.greaterThan(0);

	let tmpTotalBytesRead = 0;
	for (let i = 0; i < pSpy.Reads.length; i++)
	{
		Expect(pSpy.Reads[i].Length).to.be.at.most(pChunkSize, `Read ${i} asked for more than a chunk.`);
		Expect(pSpy.Reads[i].Buffer.length).to.be.at.most(pChunkSize, `Read ${i} used a buffer larger than a chunk.`);
		Expect(pSpy.Reads[i].Buffer).to.equal(pSpy.Reads[0].Buffer, 'The same buffer should be reused for every chunk.');
		tmpTotalBytesRead += pSpy.Reads[i].BytesRead;
	}
	Expect(tmpTotalBytesRead).to.equal(pExpectedTotalBytes);

	Expect(pSpy.Opened.length).to.equal(1);
	Expect(pSpy.Closed).to.deep.equal(pSpy.Opened, 'The file descriptor should be closed.');
};

suite
(
	'Indoctrinate Processing Task MD5',
	() =>
	{
		let _Pict;
		let _TemporaryFolder;
		let _LargeFileBuffer;

		const newProcessingTask = () =>
		{
			return new libIndoctrinateProcessingTask(_Pict, {}, 'ProcessingTaskMD5Test');
		};

		const writeTestFile = (pName, pBuffer) =>
		{
			libFS.writeFileSync(libPath.join(_TemporaryFolder, pName), pBuffer);
			return { Location: _TemporaryFolder, Name: pName };
		};

		suiteSetup
		(
			() =>
			{
				_Pict = new libPict();
				_TemporaryFolder = libFS.mkdtempSync(libPath.join(libOS.tmpdir(), 'indoctrinate-md5-'));
				// Random bytes so a chunk that was skipped or hashed twice can't produce the same digest by accident.
				_LargeFileBuffer = libCrypto.randomBytes((newProcessingTask().hashChunkSize * 2) + 12345);
			}
		);

		suiteTeardown
		(
			() =>
			{
				libFS.rmSync(_TemporaryFolder, { recursive: true, force: true });
			}
		);

		suite
		(
			'Chunked Hashing',
			() =>
			{
				test
				(
					'The default chunk size should be between 1 and 8 MiB',
					() =>
					{
						let tmpTask = newProcessingTask();
						Expect(tmpTask.hashChunkSize).to.be.at.least(1 * MEBIBYTE);
						Expect(tmpTask.hashChunkSize).to.be.at.most(8 * MEBIBYTE);
					}
				);
				test
				(
					'An empty file should hash to the reference MD5',
					() =>
					{
						let tmpTask = newProcessingTask();
						let tmpContentDescription = writeTestFile('empty.bin', Buffer.alloc(0));

						let tmpSpy = hashWithSpy(tmpTask, tmpContentDescription);

						Expect(tmpSpy.Error).to.equal(undefined);
						Expect(tmpSpy.Digest).to.equal('d41d8cd98f00b204e9800998ecf8427e');
						expectBoundedReads(tmpSpy, tmpTask.hashChunkSize, 0);
					}
				);
				test
				(
					'A small file should hash to the reference MD5',
					() =>
					{
						let tmpTask = newProcessingTask();
						let tmpContentDescription = writeTestFile('small.txt', Buffer.from('The quick brown fox jumps over the lazy dog'));

						let tmpSpy = hashWithSpy(tmpTask, tmpContentDescription);

						Expect(tmpSpy.Error).to.equal(undefined);
						Expect(tmpSpy.Digest).to.equal('9e107d9d372bb6826bd81d3542a419d6');
						expectBoundedReads(tmpSpy, tmpTask.hashChunkSize, 43);
					}
				);
				test
				(
					'A file larger than the chunk size should hash to the reference MD5 using bounded reads',
					() =>
					{
						let tmpTask = newProcessingTask();
						let tmpContentDescription = writeTestFile('large.bin', _LargeFileBuffer);

						let tmpSpy = hashWithSpy(tmpTask, tmpContentDescription);

						Expect(tmpSpy.Error).to.equal(undefined);
						Expect(tmpSpy.Digest).to.equal(referenceMD5(_LargeFileBuffer));
						Expect(tmpSpy.Digest).to.match(/^[0-9a-f]{32}$/);
						// Two full chunks, the 12345 byte remainder, then end of file.
						Expect(tmpSpy.Reads.length).to.be.at.least(3);
						expectBoundedReads(tmpSpy, tmpTask.hashChunkSize, _LargeFileBuffer.length);
					}
				);
				test
				(
					'Files that end exactly on or just past a chunk boundary should hash to the reference MD5',
					() =>
					{
						let tmpTask = newProcessingTask();
						tmpTask.hashChunkSize = 1024;

						let tmpSizes = [1023, 1024, 1025, 3072, 3073];
						for (let i = 0; i < tmpSizes.length; i++)
						{
							let tmpBuffer = libCrypto.randomBytes(tmpSizes[i]);
							let tmpContentDescription = writeTestFile(`boundary-${tmpSizes[i]}.bin`, tmpBuffer);

							let tmpSpy = hashWithSpy(tmpTask, tmpContentDescription);

							Expect(tmpSpy.Error).to.equal(undefined);
							Expect(tmpSpy.Digest).to.equal(referenceMD5(tmpBuffer), `Digest mismatch for a ${tmpSizes[i]} byte file.`);
							Expect(tmpSpy.Reads.length).to.equal(Math.ceil(tmpSizes[i] / 1024) + 1, `Unexpected read count for a ${tmpSizes[i]} byte file.`);
							expectBoundedReads(tmpSpy, 1024, tmpSizes[i]);
						}
					}
				);
				test
				(
					'The file descriptor should be closed when hashing fails',
					() =>
					{
						let tmpTask = newProcessingTask();
						libFS.mkdirSync(libPath.join(_TemporaryFolder, 'not-a-file'));

						let tmpSpy = hashWithSpy(tmpTask, { Location: _TemporaryFolder, Name: 'not-a-file' });

						Expect(tmpSpy.Error).to.be.an('error');
						Expect(tmpSpy.Closed).to.deep.equal(tmpSpy.Opened);
					}
				);
			}
		);

		suite
		(
			'Understand File Integration',
			() =>
			{
				test
				(
					'The Understand File task should record the chunked digest under FILE_MD5',
					(fNext) =>
					{
						_Pict.addServiceTypeIfNotExists('IndoctrinateProcessorUnderstandFile', libIndoctrinateUnderstandFile);
						let tmpUnderstandFile = _Pict.instantiateServiceProviderWithoutRegistration('IndoctrinateProcessorUnderstandFile');
						let tmpContentDescription = writeTestFile('understand-large.bin', _LargeFileBuffer);

						tmpUnderstandFile.processContentFile(
							(pError) =>
							{
								Expect(pError).to.equal(undefined);
								Expect(tmpContentDescription.ExtendedContent).to.have.property('FILE_MD5');
								Expect(tmpContentDescription.ExtendedContent.FILE_MD5).to.equal(referenceMD5(_LargeFileBuffer));
								return fNext();
							}, tmpContentDescription);
					}
				);
			}
		);
	}
);
