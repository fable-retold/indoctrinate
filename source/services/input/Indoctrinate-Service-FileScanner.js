
const libPictServiceCommandLineUtility = require('pict-service-commandlineutility');

const libFS = require('fs');
const libPath = require('path');

class FileScanner extends libPictServiceCommandLineUtility.ServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'IndoctrinateFileScanner';
		this.log.info('Constructed File Scanner Service.');
	}

	buildIgnoredFileNameMap(pIgnoredFileNames)
	{
		this.ignoredFileNames = Array.isArray(pIgnoredFileNames) ? pIgnoredFileNames :
			Array.isArray(this.options.IgnoredFileNames) ? this.options.IgnoredFileNames :
				Array.isArray(this.fable.settings.IgnoredFileNames) ? this.fable.settings.IgnoredFileNames :
					["node_modules", ".git", ".DS_Store", ".nyc_output", "dist", "build", "coverage", "out", "tmp", ".build", ".swiftpm", "DerivedData", "Pods", ".gradle", "target", "__pycache__", ".pytest_cache", ".next", ".nuxt", ".svelte-kit", ".turbo", ".parcel-cache", ".cache"]

		this.ignoredFileNameMap = {};

		for (let i = 0; i < this.ignoredFileNames.length; i++)
		{
			this.ignoredFileNameMap[this.ignoredFileNames[i]] = true;
		}
	}

	decodeFileModeNumber(pMode)
	{
		const FILE_TYPE_MASK = 0o170000;
		const PERM_MASK = 0o777;

		// Use bitwise AND to extract the type and permission bits
		const tmpTypeBits = pMode & FILE_TYPE_MASK;
		// Use bitwise AND to extract the permission bits
		const tmpPermissionBits = pMode & PERM_MASK;

		// Create a cheat enumerator for the file type bits
		const tmpTypeCharEnum = {
			0o040000: 'd',  // directory
			0o100000: '-',  // regular file
			0o120000: 'l',  // symlink
			0o010000: 'p',  // FIFO/pipe
			0o060000: 'b',  // block device
			0o020000: 'c',  // char device
			0o140000: 's'   // socket
		}[tmpTypeBits] || '?';

		return {
			type: this.decodeFileTypeName(tmpTypeBits),
			permissions: tmpPermissionBits.toString(8),           // e.g., "644"
			symbolic: tmpTypeCharEnum + this.decodeModeToSymbolicPermissions(tmpPermissionBits)  // e.g., "-rw-r--r--"
		};
	}

	decodeFileTypeName(pFileTypeBits)
	{
		return {
			0o040000: 'directory',
			0o100000: 'file',
			0o120000: 'symlink',
			0o010000: 'fifo',
			0o060000: 'block device',
			0o020000: 'char device',
			0o140000: 'socket'
		}[pFileTypeBits] || 'unknown';
	}

	decodeModeToSymbolicPermissions(pPermissionBits)
	{
		// Convert all three sets of permissions bits into the common unix string symbolic format
		return ['USR', 'GRP', 'OTH'].map(
			(pPermissionContext, i) =>
			{
				// Each set of permissions has 3 bits: Read, Write, eXecute
				const pShiftedBits = 6 - (i * 3);
				return ['r', 'w', 'x'].map(
					(pBitCharacter, j) =>
					{
						return (pPermissionBits & (1 << (pShiftedBits - j))) ? pBitCharacter : '-';
					}).join('');
			}).join('');
	}


	buildFileStatObject(pFileStats)
	{
		let tmpFileStatObject = {};

		if (!pFileStats)
		{
			return tmpFileStatObject;
		}

		if (pFileStats.size)
		{
			tmpFileStatObject.Size = pFileStats.size;
		}
		if (pFileStats.birthtime)
		{
			tmpFileStatObject.Created = pFileStats.birthtime;
		}
		if (pFileStats.mtime)
		{
			tmpFileStatObject.Modified = pFileStats.mtime;
		}
		if (pFileStats.atime)
		{
			tmpFileStatObject.Accessed = pFileStats.atime;
		}
		if (pFileStats.mode)
		{
			tmpFileStatObject.Mode = pFileStats.mode;// this.decodeFileModeNumber(pFileStats.mode);
		}
		return tmpFileStatObject;
	}

	gatherFilesRecursively(pRootPath, pPath, fCallback)
	{
		libFS.readdir(pPath,
			(pError, pFiles) =>
			{
				this.fable.Utility.eachLimit(pFiles, 1,
					(pFileName, fEnumerationComplete) =>
					{
						let tmpFilePath = libPath.join(pPath, pFileName);
						let tmpStat = libFS.stat(tmpFilePath,
							(pFileStatError, pFileStats) =>
							{
								if (pFileStatError)
								{
									this.fable.log.error(`Error reading stats for file [${tmpFilePath}]: ${pFileStatError}`);
									return fEnumerationComplete();
								}

								if (this.ignoredFileNameMap.hasOwnProperty(pFileName))
								{
									// This is one of the ignored files; skip it and its children if it is a folder.
									this.fable.log.trace(`(ignoring) [${tmpFilePath}] - in ignore set!`);
									return fEnumerationComplete();
								}
								else if (pFileStats && pFileStats.isDirectory())
								{
									return this.gatherFilesRecursively(pRootPath, tmpFilePath, fEnumerationComplete);
								}
								else
								{
									let tmpContentDescription = this.fable.IndoctrinateIngestor.createContentDescriptionFromFile(tmpFilePath);
									tmpContentDescription.FSTAT = this.buildFileStatObject(pFileStats);
									this.fable.IndoctrinateServiceCatalog.catalogContent(tmpContentDescription);
									return fEnumerationComplete();
								}
							});
					},
					(pEnumerationError) =>
					{
						if (pEnumerationError)
						{
							return fCallback(`Error during recursive content file scan in folder [${pPath}]: ${pEnumerationError}`);
						}
						return fCallback();
					});
			});
	}
}

module.exports = FileScanner;