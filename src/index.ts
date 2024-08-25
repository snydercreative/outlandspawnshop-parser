import fs from 'fs'
import { Handler } from 'aws-lambda'

type ProductType = {
	id: number
	price: number
	description: string
	seen: string
}

type VendorType = {
	id: number,
	name: string
	coords: string | undefined
	idx: number
	stock: ProductType[]
}

export const handler: Handler = async (event: any) => {
	const eventBody = event.body || event

	if (eventBody.Records && eventBody.Records.length) {
		const [eventRecord] = eventBody.Records
		
		console.log({
			bucket: eventRecord.s3.bucket.name,
			arn: eventRecord.s3.bucket.arn,
			key: eventRecord.s3.object.key,
		})		
	}

	// fs.readdir(FOLDER, readdirCallback)
	
	return eventBody
}

const FOLDER = "C:\\Program Files (x86)\\Ultima Online Outlands\\ClassicUO\\Data\\Client\\JournalLogs\\__scans"

// fs.readdir(FOLDER, readdirCallback)

function readdirCallback(err: NodeJS.ErrnoException | null, files: string[]) {
	const sortedfFilenames = files.sort(() => -1)
	const latestFile = sortedfFilenames.length && sortedfFilenames[0]
	const pathToLatestFile = `${FOLDER}/${latestFile}`

	fs.readFile(pathToLatestFile, readFileCallback)
}

function readFileCallback(err: NodeJS.ErrnoException | null, data: Buffer) {
	if (err) console.log(err)

	const readFileData = data.toString()
	const lines = readFileData.split(/\r\n/)

	const relevantLines = lines.filter((line: string) => {
		const locationPattern = /\(\d+,\s\d+,\s\d+\)/
		const ellipsisPattern = /…/

		return locationPattern.test(line) || ellipsisPattern.test(line)
	})

	const vendors: VendorType[] = processVendorLines(relevantLines)

	vendors.forEach((vendor: VendorType, vendorIndex) => {
		for (let i = vendor.idx; i < vendors[vendorIndex + 1]?.idx; i++) {
			const relevantLine = relevantLines[i]
			const itemInfo = relevantLine.split(':')[3]?.replace(' Price', '')
			const productInfo = relevantLine.split('Price: ')[1]

			if (productInfo) {
				const priceRegex = /(^[\d,]+)/

				const [price] = priceRegex.exec(productInfo) || []
				const description = productInfo

				const shortDescription = description?.replace('item ID:Price: ', '')

				vendor.stock.push({
					id: parseInt(itemInfo.trim()),
					price: parseInt(price?.replace(',', '') || '0') || 0,
					description: shortDescription || '',
					seen: (new Date()).toLocaleString()
				})
			}
		}
	})

	const fileBuffer = Buffer.from(JSON.stringify(vendors))

	fs.writeFile('data/test.json', fileBuffer, (err) => {
		(err && console.log({ err })) || console.log('Done.')
	})
}

function getCoordinates(line: string) {
	const locationPattern = /\(\d+,\s\d+,\s\d+\)/

	if (locationPattern.test(line)) {
		const matches = locationPattern.exec(line)

		return matches![0].replace('(', '').replace(')', '')
	} else {
		return ''
	}
}

function processVendorLines(lines: string[]) {
	const vendors: VendorType[] = []
	let coords = ''
	const vendorIDPattern = /\d+\s/

	lines.map((line, idx) => {
		const cleanLine = line.split('…')[1] || line

		if (cleanLine.indexOf('Current location is') > -1) {
			coords = getCoordinates(line)
		} else if (cleanLine.indexOf('vendorStart') > -1) {
			const noVendorStart = cleanLine.replace('vendorStart ', '')
			const noVendorIDs = noVendorStart.replace(vendorIDPattern, '')
			const noDiscount = noVendorIDs.replace(/^\[.+\]\s/, '')
			const vendorIDMatches = vendorIDPattern.test(noVendorStart) ? vendorIDPattern.exec(noVendorStart) : ''
			const vendorID = parseInt(vendorIDMatches![0])


			vendors.push({
				name: noDiscount,
				id: vendorID,
				idx,
				coords,
				stock: [],
			})
		}
	})

	const sorted = vendors.sort((a: VendorType, b: VendorType) => {
		if (a.idx > b.idx) return 1
		if (a.idx < b.idx) return -1

		return 0
	})

	return sorted
}
