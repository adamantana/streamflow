const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');
const path = require('path');
const { paths } = require('./storage');

ffmpeg.setFfmpegPath(ffmpegPath);

const getVideoInfo = (filepath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, metadata) => {
      if (err) {
        console.error('Error getting video info:', err);
        return reject(err);
      }

      try {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        const duration = metadata.format.duration || 0;
        const format = metadata.format.format_name || '';
        const resolution = videoStream ? `${videoStream.width}x${videoStream.height}` : '';
        const bitrate = metadata.format.bit_rate ?
          Math.round(parseInt(metadata.format.bit_rate) / 1000) :
          null;

        let fps = null;
        if (videoStream && videoStream.avg_frame_rate) {
          const fpsRatio = videoStream.avg_frame_rate.split('/');
          if (fpsRatio.length === 2 && parseInt(fpsRatio[1]) !== 0) {
            fps = Math.round((parseInt(fpsRatio[0]) / parseInt(fpsRatio[1]) * 100)) / 100;
          } else {
            fps = parseInt(fpsRatio[0]) || null;
          }
        }

        const stats = fs.statSync(filepath);
        const fileSize = stats.size;

        resolve({
          duration,
          fileSize,
          format,
          resolution,
          bitrate,
          fps
        });
      } catch (processError) {
        console.error('Error processing metadata:', processError);
        reject(processError);
      }
    });
  });
};

const generateThumbnail = (videoPath, thumbnailName) => {
  return new Promise((resolve, reject) => {
    // Ensure thumbnails directory exists
    if (!fs.existsSync(paths.thumbnails)) {
      fs.mkdirSync(paths.thumbnails, { recursive: true });
    }

    const thumbnailPath = path.join(paths.thumbnails, thumbnailName);

    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        timestamps: ['10%'], // Take screenshot at 10% mark like in app.js
        folder: paths.thumbnails,
        filename: thumbnailName,
        size: '854x480' // Standardize size
      })
      .on('end', () => {
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        console.error('Error generating thumbnail:', err);
        reject(err);
      });
  });
};

const generateImageThumbnail = (imagePath, thumbnailName) => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(paths.thumbnails)) {
      fs.mkdirSync(paths.thumbnails, { recursive: true });
    }

    const thumbnailPath = path.join(paths.thumbnails, thumbnailName);
    ffmpeg(imagePath)
      .outputOptions([
        '-vf', 'scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2'
      ])
      .output(thumbnailPath)
      .on('end', () => {
        resolve(thumbnailPath);
      })
      .on('error', (err) => {
        console.error('Error generating image thumbnail:', err);
        reject(err);
      })
      .run();
  });
};

module.exports = {
  getVideoInfo,
  generateThumbnail,
  generateImageThumbnail
};