/* exif.js
 * Handles reading EXIF metadata & extracting GPS coordinates.
 */

function dmsToDd(d, m, s, ref) {
    let dd = d + m / 60 + s / 3600;
    return ref === 'S' || ref === 'W' ? -dd : dd;
}

window.GBA_EXIF = {
    extractGPS(dataURL) {
        try {
            const exif = piexif.load(dataURL);
            const gps = exif.GPS;

            if (!gps || !gps[piexif.GPSIFD.GPSLatitude]) {
                return null;
            }

            const latArr = gps[piexif.GPSIFD.GPSLatitude];
            const lonArr = gps[piexif.GPSIFD.GPSLongitude];

            const lat = dmsToDd(
                latArr[0][0] / latArr[0][1],
                latArr[1][0] / latArr[1][1],
                latArr[2][0] / latArr[2][1],
                gps[piexif.GPSIFD.GPSLatitudeRef]
            );

            const lon = dmsToDd(
                lonArr[0][0] / lonArr[0][1],
                lonArr[1][0] / lonArr[1][1],
                lonArr[2][0] / lonArr[2][1],
                gps[piexif.GPSIFD.GPSLongitudeRef]
            );

            return { lat, lon };
        } catch (err) {
            return null;
        }
    }
};
