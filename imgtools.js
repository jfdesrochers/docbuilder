const fs = require('fs');
const { off } = require('process');

// from https://stackoverflow.com/a/33915673
function* _parsePNGChunks(data) {
    let offset = 8; // skip PNG header

    while (offset < data.length) {
        const dataLength = data.readUInt32BE(offset);
        //const chunkLength = dataLength + 12;
        const typeStart = offset + 4;
        const dataStart = offset + 8;
        const dataEnd = offset + 8 + dataLength;
        const crcEnd = dataEnd + 4;

        yield {
            type: data.toString('ascii', typeStart, dataStart),
            data: data.slice(dataStart, dataEnd),
            crc: data.slice(dataEnd, crcEnd),
        };

        offset = crcEnd;
    }
}

function getInfofromPNGfile(filepath) {
    const image = fs.readFileSync(filepath);
    let width, height, dpi;
    for (let chunk of _parsePNGChunks(image)) {
        // Extract pixel information
        if (chunk.type === 'pHYs') {
            const ppuX = chunk.data.readUInt32BE(0);
            const ppuY = chunk.data.readUInt32BE(4);
            const unit = chunk.data.readUInt8(8); // should always be `1`

            if (unit === 1) {
                // ppuX is in pixels per meter, so we convert to pixels per inch
                dpi = Math.round(ppuX * 0.0254);
            } else {
                // file does not contain DPI information, we assume default (72 DPI)
                dpi = 72;
            }
        } else if (chunk.type === 'IHDR') {
            width = chunk.data.readUInt32BE(0);
            height = chunk.data.readUInt32BE(4);
        }
        if (width && height && dpi) break;
    }

    // Sometimes the image doesn't include DPI info.
    // We use screen DPI (96) as a default in those cases.
    if (!dpi) dpi = 96;

    return [width, height, dpi];
}

function* _parseJPEGMarkers(data) {
    let offset = 0;

    while (offset < data.length) {
        if (data.readUInt8(offset) !== 0xFF) throw new Error('Invalid marker found, JPEG File is likely corrupted.');
        const markerType = data.readUInt8(++offset);

        if (markerType === 0x01 || (markerType >= 0xD1 && markerType <= 0xD9)) {
            // Markers 0x01 and 0xD1-0xD9 have no data, skip over them
            offset++;
            continue;
        } else if (markerType === 0xDA) {
            // We stop parsing at the Start Of Scan marker
            return;
        }

        const dataLength = data.readUInt16BE(++offset);
        const dataStart = offset + 2;
        const dataEnd = offset + dataLength;

        yield {
            type: markerType,
            data: data.slice(dataStart, dataEnd)
        };

        offset = dataEnd;
    }
}

function TIFFBufferReader(byteOrder, buf) {
    return (offset, byteCount, signed = false) => {
        switch (byteCount) {
            case 1:
                return signed ? buf.readInt8(offset) : buf.readUInt8(offset);
            case 2:
                if (byteOrder === 'II') {
                    return signed ? buf.readInt16LE(offset) : buf.readUInt16LE(offset);
                } else {
                    return signed ? buf.readInt16BE(offset) : buf.readUInt16BE(offset);
                }
            case 4:
                if (byteOrder === 'II') {
                    return signed ? buf.readInt32LE(offset) : buf.readUInt32LE(offset);
                } else {
                    return signed ? buf.readInt32BE(offset) : buf.readUInt32BE(offset);
                }
        }
    }
}

function getInfofromJPEGfile(filepath) {
    const image = fs.readFileSync(filepath);
    let width, height, dpi;
    for (let marker of _parseJPEGMarkers(image)) {
        if (marker.type === 0xE0) {
            // APP0 - We check for JFIF header, skip processing if not
            let headerType = marker.data.toString('ascii', 0, 4).toUpperCase();
            if (headerType !== 'JFIF') continue;

            // JFIF header, we skip the irrelevant portion
            let offset = 7;

            const unit = marker.data.readUInt8(offset);
            const ppuX = marker.data.readUInt16BE(offset + 1);
            const ppuY = marker.data.readUInt16BE(offset + 3);

            if (unit === 1) {
                // ppuX is in pixels per inch, we return it
                dpi = ppuX;
            } else if (unit === 2) {
                // ppuX is in pixels per cm, so we convert to pixels per inch
                dpi = Math.round(ppuX * 2.54);
            } else {
                // file does not contain DPI information, we assume default (72 DPI)
                dpi = 72;
            }
        } else if (marker.type === 0xE1) {
            // APP1 - We check for EXIF header, skip processing if not
            let headerType = marker.data.toString('ascii', 0, 4).toUpperCase();
            if (headerType !== 'EXIF') continue;

            // EXIF header, we get a slice of the contained TIFF file
            const startOffset = 6; // Past the EXIF header
            const data = marker.data.slice(startOffset, marker.data.length);
            let offset = 0;
            const endian = data.toString('ascii', offset, offset + 2);
            const reader = TIFFBufferReader(endian, data);

            offset = reader(offset + 4, 4) + 2;
            let tag = reader(offset, 2);
            let unit, ppuX, ppuY;

            while (tag !== 0x8769) {
                if (tag === 0x011A) {
                    let addr = reader(offset + 8, 4);
                    ppuX = reader(addr, 4);
                } else if (tag === 0x011B) {
                    let addr = reader(offset + 8, 4);
                    ppuY = reader(addr, 4);
                } else if (tag === 0x0128) {
                    unit = reader(offset + 8, 4);
                }
                offset += 12;
                tag = reader(offset, 2);
            }

            if (unit === 2) {
                // ppuX is in pixels per inch, we return it
                dpi = ppuX;
            } else if (unit === 3) {
                // ppuX is in pixels per cm, so we convert to pixels per inch
                dpi = Math.round(ppuX * 2.54);
            } else {
                // file does not contain DPI information, we assume default (72 DPI)
                dpi = 72;
            }
        } else if (marker.type === 0xC0 || marker.type === 0xC2) {
            // Start Of Frame marker, includes width and height
            let offset = 1;

            height = marker.data.readUInt16BE(offset);
            width = marker.data.readUInt16BE(offset + 2);
        }
        if (width && height && dpi) break;
    }

    // Sometimes the image doesn't include DPI info.
    // We use screen DPI (96) as a default in those cases.
    if (!dpi) dpi = 96;

    return [width, height, dpi];
}

function convertImageDimsForPrint(width, height, dpi) {
    if (isNaN(width) || isNaN(height) || isNaN(dpi)) return [undefined, undefined];
    return [Math.round(width * 72 / dpi), Math.round(height * 72 / dpi)];
}

module.exports = {getInfofromJPEGfile, getInfofromPNGfile, convertImageDimsForPrint};