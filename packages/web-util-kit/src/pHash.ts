// Perceptual image hash calculation tool based on algorithm descibed in
// Block Mean Value Based Image Perceptual Hashing by Bian Yang, Fan Gu and Xiamu Niu
//
// Copyright 2014 Commons Machinery http://commonsmachinery.se/
// Distributed under an MIT license, please see LICENSE in the top dir.


const one_bits = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/* Calculate the hamming distance for two hashes in hex format */
export function hammingDistance(hash1: string, hash2: string) {
    let d = 0;
    let i;

    if (hash1.length !== hash2.length) {
        throw new Error("Can't compare hashes with different length");
    }

    for (i = 0; i < hash1.length; i++) {
        let n1 = parseInt(hash1[i], 16);
        let n2 = parseInt(hash2[i], 16);
        d += one_bits[n1 ^ n2];
    }
    return d;
};

function median(data: any) {
    let mdarr = data.slice(0);
    mdarr.sort(function(a: any, b: any) { return a-b; });
    if (mdarr.length % 2 === 0) {
        return (mdarr[mdarr.length/2 - 1] + mdarr[mdarr.length/2]) / 2.0;
    }
    return mdarr[Math.floor(mdarr.length/2)];
};

function translate_blocks_to_bits(blocks: number[], pixels_per_block: number) {
    let half_block_value = pixels_per_block * 256 * 3 / 2;
    let bandsize = blocks.length / 4;

    // Compare medians across four horizontal bands
    for (let i = 0; i < 4; i++) {
        let m = median(blocks.slice(i * bandsize, (i + 1) * bandsize));
        for (let j = i * bandsize; j < (i + 1) * bandsize; j++) {
            let v = blocks[j];

            // Output a 1 if the block is brighter than the median.
            // With images dominated by black or white, the median may
            // end up being 0 or the max value, and thus having a lot
            // of blocks of value equal to the median.  To avoid
            // generating hashes of all zeros or ones, in that case output
            // 0 if the median is in the lower value space, 1 otherwise
            blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > half_block_value));
        }
    }
};

function bits_to_hexhash(bitsArray: number[]) {
    let hex = [];
    for (let i = 0; i < bitsArray.length; i += 4) {
        let nibble = bitsArray.slice(i, i + 4);
        hex.push(parseInt(nibble.join(''), 2).toString(16));
    }

    return hex.join('');
};

function bmvbhash_even(data: ImageData, bits: number) {
    let blocksize_x = Math.floor(data.width / bits);
    let blocksize_y = Math.floor(data.height / bits);

    let result: number[] = [];

    for (let y = 0; y < bits; y++) {
        for (let x = 0; x < bits; x++) {
            let total = 0;

            for (let iy = 0; iy < blocksize_y; iy++) {
                for (let ix = 0; ix < blocksize_x; ix++) {
                    let cx = x * blocksize_x + ix;
                    let cy = y * blocksize_y + iy;
                    let ii = (cy * data.width + cx) * 4;

                    let alpha = data.data[ii+3];
                    if (alpha === 0) {
                        total += 765;
                    } else {
                        total += data.data[ii] + data.data[ii+1] + data.data[ii+2];
                    }
                }
            }

            result.push(total);
        }
    }

    translate_blocks_to_bits(result, blocksize_x * blocksize_y);
    return bits_to_hexhash(result);
};

function bmvbhash(data: ImageData, bits: number) {
    let result: number[] = [];

    let i, j, x, y;
    let block_width, block_height;
    let weight_top, weight_bottom, weight_left, weight_right;
    let block_top, block_bottom, block_left, block_right;
    let y_mod, y_frac, y_int;
    let x_mod, x_frac, x_int;
    let blocks: any[] = [];

    let even_x = data.width % bits === 0;
    let even_y = data.height % bits === 0;

    if (even_x && even_y) {
        return bmvbhash_even(data, bits);
    }

    // initialize blocks array with 0s
    for (i = 0; i < bits; i++) {
        blocks.push([]);
        for (j = 0; j < bits; j++) {
            blocks[i].push(0);
        }
    }

    block_width = data.width / bits;
    block_height = data.height / bits;

    for (y = 0; y < data.height; y++) {
        if (even_y) {
            // don't bother dividing y, if the size evenly divides by bits
            block_top = block_bottom = Math.floor(y / block_height);
            weight_top = 1;
            weight_bottom = 0;
        } else {
            y_mod = (y + 1) % block_height;
            y_frac = y_mod - Math.floor(y_mod);
            y_int = y_mod - y_frac;

            weight_top = (1 - y_frac);
            weight_bottom = (y_frac);

            // y_int will be 0 on bottom/right borders and on block boundaries
            if (y_int > 0 || (y + 1) === data.height) {
                block_top = block_bottom = Math.floor(y / block_height);
            } else {
                block_top = Math.floor(y / block_height);
                block_bottom = Math.ceil(y / block_height);
            }
        }

        for (x = 0; x < data.width; x++) {
            let ii = (y * data.width + x) * 4;

            let avgvalue, alpha = data.data[ii+3];
            if (alpha === 0) {
                avgvalue = 765;
            } else {
                avgvalue = data.data[ii] + data.data[ii+1] + data.data[ii+2];
            }

            if (even_x) {
                block_left = block_right = Math.floor(x / block_width);
                weight_left = 1;
                weight_right = 0;
            } else {
                x_mod = (x + 1) % block_width;
                x_frac = x_mod - Math.floor(x_mod);
                x_int = x_mod - x_frac;

                weight_left = (1 - x_frac);
                weight_right = x_frac;

                // x_int will be 0 on bottom/right borders and on block boundaries
                if (x_int > 0 || (x + 1) === data.width) {
                    block_left = block_right = Math.floor(x / block_width);
                } else {
                    block_left = Math.floor(x / block_width);
                    block_right = Math.ceil(x / block_width);
                }
            }

            // add weighted pixel value to relevant blocks
            blocks[block_top][block_left] += avgvalue * weight_top * weight_left;
            blocks[block_top][block_right] += avgvalue * weight_top * weight_right;
            blocks[block_bottom][block_left] += avgvalue * weight_bottom * weight_left;
            blocks[block_bottom][block_right] += avgvalue * weight_bottom * weight_right;
        }
    }

    for (i = 0; i < bits; i++) {
        for (j = 0; j < bits; j++) {
            result.push(blocks[i][j]);
        }
    }

    translate_blocks_to_bits(result, block_width * block_height);
    return bits_to_hexhash(result);
};

export function blockhashData(imgData: ImageData, bits: number = 16, method: number = 1) {
    let hash;

    if (method === 1) {
        hash = bmvbhash_even(imgData, bits);
    }
    else if (method === 2) {
        hash = bmvbhash(imgData, bits);
    }
    else {
        throw new Error("Bad hashing method");
    }

    return hash;
};




