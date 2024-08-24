import fs from 'fs'

type ProductType = {
	price: string
	description: string
}

type VendorType = {
	name: string
	idx: number
	stock: ProductType[]
}

(() => {
	const FOLDER = "C:\\Program Files (x86)\\Ultima Online Outlands\\ClassicUO\\Data\\Client\\JournalLogs"

	fs.readdir(FOLDER, readdirCallback)
})()

const FOLDER = "C:\\Program Files (x86)\\Ultima Online Outlands\\ClassicUO\\Data\\Client\\JournalLogs"

fs.readdir(FOLDER, readdirCallback)

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
	const relevantLines = lines.filter((line: string) => line.lastIndexOf("…") > -1)
	const vendors: VendorType[] = processVendorLines(relevantLines)

	vendors.forEach((vendor: VendorType, vendorIndex) => {	
		for (let i = vendor.idx; i < vendors[vendorIndex + 1]?.idx; i++) {
			const relevantLine = relevantLines[i]

			const productInfo = relevantLine.split('Price: ')[1]
			if (productInfo) {
				const priceRegex = /(^[\d,]+)/
				const descriptionRegex = /([^\d,\s].+)\w+/

				const [price] = priceRegex.exec(productInfo) || []
				const [description] = descriptionRegex.exec(productInfo) || []

				vendor.stock.push({
					price: price || '',
					description: description || '',
				})
			}
		}
	})

	const fileBuffer = Buffer.from(JSON.stringify(vendors))

	fs.writeFile('data/test.json', fileBuffer, (err) => {
		console.log({err})
		console.log('Done.')
	})
}

function processVendorLines(lines: string[]) {
	const vendors: VendorType[] = []

	lines.map((line, idx) => {
		const cleanLine = line.split('…')[1]

		if (cleanLine.lastIndexOf('vendorStart') > -1) {
			const noVendorStart = cleanLine.replace('vendorStart ', '')
			const noVendorIDs = noVendorStart.replace(/\d+\s/, '')
			const noDiscount = noVendorIDs.replace(/^\[.+\]\s/, '')

			vendors.push({
				name: noDiscount,
				idx,
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
