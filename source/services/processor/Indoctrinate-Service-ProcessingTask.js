const libPictServiceCommandLineUtility = require('pict-service-commandlineutility');

const libFS = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');

// Files are hashed in chunks of this size so memory use does not grow with file size.
const DEFAULT_HASH_CHUNK_SIZE = 4 * 1024 * 1024;
// Floor for the hash buffer so files that stat as 0 bytes but still have content (e.g. procfs) read in sane chunks.
const MINIMUM_HASH_BUFFER_SIZE = 64 * 1024;

class IndoctrinateServiceProcessingTask extends libPictServiceCommandLineUtility.ServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'IndoctrinateProcessor';
		this.hashChunkSize = DEFAULT_HASH_CHUNK_SIZE;
		//this.log.info('Constructed Extended Processor Service.');
	}

	readBytesSync(pContentDescription, pStartByte, pLength)
	{
		const tmpFileName = this.constructFileName(pContentDescription);
		const tmpFileDescriptor = libFS.openSync(tmpFileName, 'r');
		try
		{
			const tmpByteBuffer = Buffer.alloc(pLength);
			libFS.readSync(tmpFileDescriptor, tmpByteBuffer, 0, pLength, pStartByte);
			return tmpByteBuffer;
		}
		finally
		{
			libFS.closeSync(tmpFileDescriptor);
		}
	}

	readTailBytesSync(pContentDescription, pLength)
	{
		const tmpFileName = this.constructFileName(pContentDescription);
		const tmpStat = libFS.statSync(tmpFileName);
		let tmpActualLength = pLength;
		if (tmpStat.size < tmpActualLength)
		{
			tmpActualLength = tmpStat.size;
		}
		const tmpStartByte = tmpStat.size - tmpActualLength;
		return this.readBytesSync(pContentDescription, tmpStartByte, tmpActualLength);
	}

	computeMD5Sync(pContentDescription)
	{
		const tmpFileName = this.constructFileName(pContentDescription);
		const tmpHash = libCrypto.createHash('md5');
		const tmpFileDescriptor = libFS.openSync(tmpFileName, 'r');
		try
		{
			// One buffer per file, never larger than a chunk; small files don't pay for a full chunk.
			const tmpFileSize = libFS.fstatSync(tmpFileDescriptor).size;
			const tmpBuffer = Buffer.allocUnsafe(Math.min(this.hashChunkSize, Math.max(tmpFileSize, MINIMUM_HASH_BUFFER_SIZE)));
			let tmpBytesRead = libFS.readSync(tmpFileDescriptor, tmpBuffer, 0, tmpBuffer.length, null);
			while (tmpBytesRead > 0)
			{
				tmpHash.update(tmpBuffer.subarray(0, tmpBytesRead));
				tmpBytesRead = libFS.readSync(tmpFileDescriptor, tmpBuffer, 0, tmpBuffer.length, null);
			}
		}
		finally
		{
			libFS.closeSync(tmpFileDescriptor);
		}
		return tmpHash.digest('hex');
	}

	constructFileName(pContentDescription)
	{
		return libPath.join(pContentDescription.Location, pContentDescription.Name);
	}

	processContentFile(fCallback, pContentDescription)
	{
		return fCallback();
	}

	prepareDescriptionForExtendedContent(pContentDescription)
	{
		if (typeof(pContentDescription) != 'object')
		{
			this.log.error('Attempted to prepare extended content description for undefined content but object was not passed in.');
			return false;
		}

		if (!('ExtendedContent' in pContentDescription))
		{
			pContentDescription.ExtendedContent = {};
		}

		return true;
	}

	addContentToExtendedCatalogData(pContentDescription, pContentToAdd, pExtendedContentAddress)
	{
		let tmpExtendedContentAddress = (typeof(pExtendedContentAddress) === 'undefined') ? this.serviceType : pExtendedContentAddress;

		if (typeof(pContentToAdd) === 'undefined')
		{
			this.log.error(`Attempted to add undefined content to extended catalog data for ${this.constructFileName(pContentDescription)}`);
			return false;
		}

		this.prepareDescriptionForExtendedContent(pContentDescription);

		if (tmpExtendedContentAddress in pContentDescription.ExtendedContent)
		{
			this.log.warn(`Adding content to extended catalog data for ${this.constructFileName(pContentDescription)} to extended content address ${tmpExtendedContentAddress} and data already exists.  It will be overwritten.`);
		}

		pContentDescription.ExtendedContent[tmpExtendedContentAddress] = pContentToAdd;
		return true;
	}
}

module.exports = IndoctrinateServiceProcessingTask;