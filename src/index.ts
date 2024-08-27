import { Handler } from 'aws-lambda'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'

type ProductType = {
	id: number
	price: number
	description: string
	quantity: number
	vendorId: number
}

type VendorType = {
	id: number
	name: string
	x: number
	y: number
	idx: number
	stock: ProductType[]
}

type CoordsType = {
	x: number
	y: number
}

export const handler: Handler = async (event: any) => {
	const eventBody = event.body || event

	if (eventBody.Records && eventBody.Records.length) {
		const [eventRecord] = eventBody.Records

		const client = new S3Client({
			region: 'us-west-2'
		})

		const getObjectCommand = new GetObjectCommand({
			Bucket: eventRecord.s3.bucket.name,
			Key: decodeURIComponent(eventRecord.s3.object.key).replace(/\+/g, ' '),
		})

		const data = await client.send(getObjectCommand)
		const body = await data.Body?.transformToString() || ''
	
		const vendors = parseVendors(body)

		const putObjectCommand = new PutObjectCommand({
			Bucket: 'outlands-pawnshop-persistence',
			Key: `vendor-census-${getFilenameDate()}.json`,
			ContentType: 'application/json',
			Body: JSON.stringify(vendors),
		})

		const putInfo = await client.send(putObjectCommand)

		console.log({putInfo})

		return putInfo
	}
}

function getFilenameDate() {
	const now = new Date()
	const twoDigitMonth = now.getMonth() + 1 < 10 ? `0${now.getMonth() + 1}` : `${now.getMonth() + 1}`

	return `${now.getFullYear()}-${twoDigitMonth}-${now.getDate()}:${now.getMilliseconds()}`
}

function parseVendors(body: string) {
	const lines = body.split(/\r\n/)

	const relevantLines = lines.filter((line: string) => {
		const locationPattern = /\(\d+,\s\d+,\s\d+\)/
		const ellipsisPattern = /…/

		return locationPattern.test(line) || ellipsisPattern.test(line)
	})

	const vendors: VendorType[] = processVendorLines(relevantLines)

	vendors.forEach((vendor: VendorType, vendorIndex) => {
		for (let i = vendor.idx; i < vendors[vendorIndex + 1]?.idx; i++) {
			const relevantLine = relevantLines[i]
			const splitRelevantLine = relevantLine.split(':')
			const productId = splitRelevantLine[3]?.replace(' Price', '')						
			const lineWithoutParens = relevantLine.replace(/\(.+\)/g, '').trim()
			const isQuantity = /\:\s\d+$/.test(lineWithoutParens)
			const quantity = isQuantity ? parseInt(/\:\s\d+$/.exec(lineWithoutParens)![0].replace(': ', '')) : 1
			const productInfo = relevantLine.split('Price: ')[1]

			if (productInfo) {
				const priceRegex = /(^[\d,]+)/
				const [price] = priceRegex.exec(productInfo) || []
				const description = productInfo
				const shortDescription = description?.replace('item ID:Price: ', '')
				
				vendor.stock.push({
					id: parseInt(productId.trim()),
					price: parseInt(price?.replace(',', '') || '0') || 0,
					description: shortDescription || '',
					quantity,
					vendorId: vendor.id,
				})
			}
		}
	})

	return vendors
}

function getCoordinates(line: string) {
	const locationPattern = /\(\d+,\s\d+,\s\d+\)/

	if (locationPattern.test(line)) {
		const matches = locationPattern.exec(line)
		const match = matches![0].replace('(', '').replace(')', '').replace(' ', '')
		const [x, y] = match.split(',')

		return {
			x: parseInt(x), 
			y: parseInt(y),
		}
	} else {
		return {
			x: 0,
			y: 0,
		}
	}
}

function processVendorLines(lines: string[]) {
	const vendors: VendorType[] = []
	let coords: CoordsType
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
			const { x, y } = coords

			vendors.push({
				name: noDiscount,
				id: vendorID,
				idx,
				x, 
				y,
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
