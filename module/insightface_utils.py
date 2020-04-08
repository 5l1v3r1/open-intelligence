from module import fileutils
import insightface
import cv2
import os

# Paths
output_images_path = os.getcwd() + '/output/insightface/faces/'

# Check folder existence
fileutils.create_directory(output_images_path)

# Load model
model = insightface.model_zoo.get_model('retinaface_r50_v1')
model.prepare(ctx_id=-1, nms=0.4)


# Process images
def face_detection(image_path_name_extension, file_name):
    # Loading image
    image = cv2.imread(image_path_name_extension)

    # Get image size
    image_h, image_w, image_c = image.shape

    # Only smaller images, will run out of memory fast with big ones
    if image_w < 800 and image_h < 800:

        # Detect face
        boxes, landmarks = model.detect(image, threshold=0.2, scale=1.0)

        if len(boxes) > 0:
            for box in boxes:
                # Should be only one person /image
                y, x, h, w, a = box
                # [176.440979   114.81748962 336.5977478  355.79165649   0.99876058]
                img_crop = image[int(x):int(w), int(y):int(h)]

                # Save face containing image
                try:
                    cv2.imwrite(output_images_path + file_name, img_crop)
                except Exception as e:
                    print(e)