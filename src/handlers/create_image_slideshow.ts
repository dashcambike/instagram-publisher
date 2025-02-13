import { MIN_SLIDESHOW_IMAGES, MAX_SLIDESHOW_IMAGES } from '../config';
import {
  MIN_2_IMAGES_ERR,
  MAX_10_IMAGES_ERR,
  LOCATION_NOT_FOUND,
} from '../errors';
import HTTP_CLIENT from '../http';
import {
  Image,
  LinkablePostPublished,
  LocationSearchRes,
  MediaUploadRes,
  PostPublished,
} from '../types';
import getLocation from './common/get_location';
import uploadPhoto from './common/upload_photo';
import {
  validateCaption,
  validateImageAspectRatio,
  validateImageExists,
  validateImageJPG,
} from './common/validators';
const sizeOf = require('image-size');

async function createImageSlideshowHandler({
  images = [],
  caption = '',
  location,
  verbose,
}: {
  images: string[];
  caption: string;
  location?: string;
  verbose: boolean;
}) : Promise<LinkablePostPublished> {
  _validateImages(images);
  validateCaption(caption);

  const photosUploaded: MediaUploadRes[] = [];
  const errors: String[] = [];

  // upload photos
  for (let idx = 0; idx < images.length; idx++) {
    const photo = images[idx];
    try {
      const uploadResponse = await uploadPhoto(photo);
      photosUploaded.push(uploadResponse);
    } catch (error) {
      errors.push(
        `[InstagramPublisher/createSlideshow] - Photo ${photo} not uploaded`
      );
    }
  }

  // create slideshow
  if (photosUploaded.length > 0) {
    const createSlideshowResponse = await _saveSlideshow({
      photosUploaded,
      caption,
      location,
    });
    if (verbose)
      console.info(
        `[InstagramPublisher] - Image Slideshow Created: ${createSlideshowResponse.status}`
      );
    return {succeeded: createSlideshowResponse.status === 'ok',
            code: createSlideshowResponse.media.code};
  }
  return {succeeded: false, code: ""};
}

async function _saveSlideshow({
  photosUploaded,
  caption,
  location,
}: {
  photosUploaded: MediaUploadRes[];
  caption: string;
  location?: string;
}): Promise<PostPublished> {
  const payload: any = {
    caption,
    children_metadata: [...photosUploaded],
    client_sidecar_id: Date.now().toString(),
    disable_comments: '0',
    like_and_view_counts_disabled: false,
    source_type: 'library',
  };

  if (location) {
    try {
      const locationData: LocationSearchRes = await getLocation(location);
      payload.location = {
        lat: locationData.venues[0].lat,
        lng: locationData.venues[0].lng,
        facebook_places_id: locationData.venues[0].external_id,
      };
      payload.geotag_enabled = 'true';
    } catch (error) {
      throw new Error(LOCATION_NOT_FOUND);
    }
  }

  const requestHeaders = {
    'x-asbd-id': '198387',
    'x-ig-app-id': '936619743392459',
  };

  const uploadResponse = await HTTP_CLIENT.request({
    uri: `/api/v1/media/configure_sidecar/`,
    method: 'POST',
    json: payload,
    headers: requestHeaders,
  });

  return uploadResponse;
}

function _validateImages(images: string[]) {
  if (images.length < MIN_SLIDESHOW_IMAGES) {
    throw new Error(MIN_2_IMAGES_ERR);
  }
  if (images.length > MAX_SLIDESHOW_IMAGES) {
    throw new Error(MAX_10_IMAGES_ERR);
  }

  images.map(img => validateImageExists(img));

  const _images: Image[] = images.map(sizeOf);

  _images.map(img => validateImageJPG(img));
  _images.map(validateImageAspectRatio);
}

export default createImageSlideshowHandler;
