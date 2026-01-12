const fs = require('fs-extra');
const path = require('path');
const { paths } = require('../utils/storage');
const Video = require('../models/Video');
const { getVideoInfo, generateThumbnail } = require('../utils/videoProcessor');

const ALLOWED_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];

class LibraryScannerService {
    async scanLibrary(userId) {
        const stats = {
            added: 0,
            skipped: 0,
            errors: 0,
            details: []
        };

        try {
            // Ensure directory exists
            await fs.ensureDir(paths.videos);

            // Get all files in videos directory
            const files = await fs.readdir(paths.videos);

            console.log(`Scanning ${files.length} files in ${paths.videos}`);

            for (const file of files) {
                const ext = path.extname(file).toLowerCase();
                if (!ALLOWED_EXTENSIONS.includes(ext)) {
                    continue;
                }

                const relativePath = `/uploads/videos/${file}`;

                try {
                    // Check if video already exists in DB
                    const existingVideo = await Video.findByPath(relativePath);

                    if (existingVideo) {
                        stats.skipped++;
                        continue;
                    }

                    console.log(`Processing new video: ${file}`);
                    const fullPath = path.join(paths.videos, file);

                    // Get video metadata
                    const metadata = await getVideoInfo(fullPath);

                    // Generate thumbnail
                    const thumbnailFilename = `thumb-${path.parse(file).name}.jpg`;
                    const thumbnailRelativePath = `/uploads/thumbnails/${thumbnailFilename}`;

                    try {
                        await generateThumbnail(fullPath, thumbnailFilename);
                    } catch (thumbErr) {
                        console.error(`Failed to generate thumbnail for ${file}, continuing without it`, thumbErr);
                        // Proceed even if thumbnail fails? Yes, but maybe use a default?
                        // For now we'll just log it. metadata can be used to retry later if we had that logic.
                    }

                    const videoData = {
                        title: path.parse(file).name,
                        filepath: relativePath,
                        thumbnail_path: thumbnailRelativePath,
                        file_size: metadata.fileSize,
                        duration: metadata.duration,
                        format: metadata.format,
                        resolution: metadata.resolution,
                        bitrate: metadata.bitrate,
                        fps: metadata.fps,
                        user_id: userId
                    };

                    await Video.create(videoData);
                    stats.added++;
                    stats.details.push({ file, status: 'added' });

                } catch (err) {
                    console.error(`Error processing file ${file}:`, err);
                    stats.errors++;
                    stats.details.push({ file, status: 'error', error: err.message });
                }
            }

        } catch (error) {
            console.error('Library scan failed:', error);
            throw error;
        }

        return stats;
    }
}

module.exports = new LibraryScannerService();
