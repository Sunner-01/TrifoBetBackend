// src/common/providers/image-upload.service.ts
import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';


@Injectable()
export class ImageUploadService {
  async uploadImage(fileBuffer: Buffer, folderPath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result!.secure_url);
        },
      );
      stream.end(fileBuffer);
    });
  }
}
