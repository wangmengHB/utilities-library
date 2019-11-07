/**
 * @filter           Brightness / Contrast
 * @description      Provides additive brightness and multiplicative contrast control.
 * @param brightness -1 to 1 (-1 is solid black, 0 is no change, and 1 is solid white)
 * @param contrast   -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */

export const GLSL_FS_brightnessContrast = `
precision highp float;
uniform sampler2D texture;
uniform float brightness;
uniform float contrast;
varying vec2 texCoord;
void main() {
    vec4 color = texture2D(texture, texCoord);
    color.rgb += brightness;
    if (contrast > 0.0) {
        color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
    } else {
        color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
    }
    gl_FragColor = color;
}
`;


/**
 * @filter           Hue / Saturation
 * @description      Provides rotational hue and multiplicative saturation control. RGB color space
 *                   can be imagined as a cube where the axes are the red, green, and blue color
 *                   values. Hue changing works by rotating the color vector around the grayscale
 *                   line, which is the straight line from black (0, 0, 0) to white (1, 1, 1).
 *                   Saturation is implemented by scaling all color channel values either toward
 *                   or away from the average color channel value.
 * @param hue        -1 to 1 (-1 is 180 degree rotation in the negative direction, 0 is no change,
 *                   and 1 is 180 degree rotation in the positive direction)
 * @param saturation -1 to 1 (-1 is solid gray, 0 is no change, and 1 is maximum contrast)
 */
export const GLSL_FS_hueSaturation = `
precision highp float;
uniform sampler2D texture;
uniform float hue;
uniform float saturation;
varying vec2 texCoord;
void main() {
    vec4 color = texture2D(texture, texCoord);
    
    /* hue adjustment, wolfram alpha: RotationTransform[angle, {1, 1, 1}][{x, y, z}] */
    float angle = hue * 3.14159265;
    float s = sin(angle), c = cos(angle);
    vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
    float len = length(color.rgb);
    color.rgb = vec3(
        dot(color.rgb, weights.xyz),
        dot(color.rgb, weights.zxy),
        dot(color.rgb, weights.yzx)
    );
    
    /* saturation adjustment */
    float average = (color.r + color.g + color.b) / 3.0;
    if (saturation > 0.0) {
        color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - saturation));
    } else {
        color.rgb += (average - color.rgb) * (-saturation);
    }
    
    gl_FragColor = color;
}
`;

/**
 * @filter         Sepia
 * @description    Gives the image a reddish-brown monochrome tint that imitates an old photograph.
 * @param sepia_amount   0 to 1 (0 for no effect, 1 for full sepia coloring)
 */
export const GLSL_FS_sepia = `
precision highp float;
uniform sampler2D texture;
uniform float sepia_amount;
varying vec2 texCoord;
void main() {
    vec4 color = texture2D(texture, texCoord);
    float r = color.r;
    float g = color.g;
    float b = color.b;
    
    color.r = min(1.0, (r * (1.0 - (0.607 * sepia_amount))) + (g * (0.769 * sepia_amount)) + (b * (0.189 * sepia_amount)));
    color.g = min(1.0, (r * 0.349 * sepia_amount) + (g * (1.0 - (0.314 * sepia_amount))) + (b * 0.168 * sepia_amount));
    color.b = min(1.0, (r * 0.272 * sepia_amount) + (g * 0.534 * sepia_amount) + (b * (1.0 - (0.869 * sepia_amount))));
    
    gl_FragColor = color;
}    
`;


/**
 * @filter       Vibrance
 * @description  Modifies the saturation of desaturated colors, leaving saturated colors unmodified.
 * @param vibrance_amount -1 to 1 (-1 is minimum vibrance, 0 is no change, and 1 is maximum vibrance)
 */
export const GLSL_FS_vibrance =`
precision highp float;
uniform sampler2D texture;
uniform float vibrance_amount;
varying vec2 texCoord;
void main() {
    vec4 color = texture2D(texture, texCoord);
    float average = (color.r + color.g + color.b) / 3.0;
    float mx = max(color.r, max(color.g, color.b));
    float amt = (mx - average) * (-vibrance_amount * 3.0);
    color.rgb = mix(color.rgb, vec3(mx), amt);
    gl_FragColor = color;
}
`;


/**
 * @filter         Vignette
 * @description    Adds a simulated lens edge darkening effect.
 * @param vignette_size     0 to 1 (0 for center of frame, 1 for edge of frame)
 * @param vignette_amount   0 to 1 (0 for no effect, 1 for maximum lens darkening)
 */
export const GLSL_FS_vignette =`
precision highp float;
uniform sampler2D texture;
uniform float vignette_size;
uniform float vignette_amount;
varying vec2 texCoord;
void main() {
    vec4 color = texture2D(texture, texCoord);
    
    float dist = distance(texCoord, vec2(0.5, 0.5));
    color.rgb *= smoothstep(0.8, vignette_size * 0.799, dist * (vignette_amount + vignette_size));
    
    gl_FragColor = color;
}
`;






