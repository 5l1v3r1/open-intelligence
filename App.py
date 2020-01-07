import os
from module import fileutils, object_detection, configparser
from objects import File
import sys
import time

# Configure input image folders
image_folders = [
    # 'C:/Users/SomeUser/Desktop/image/',
    os.getcwd() + '/images/',
    os.getcwd() + '/images2/',
]


def app():
    # Image objects stored here
    image_file_objects = []

    # Create image objects
    for image_folder in image_folders:
        # Check for 'processed' folder existence
        fileutils.create_directory(image_folder + 'processed/')
        # Process files
        for file_name in fileutils.get_camera_image_names(image_folder):
            if file_name != 'processed':
                gm_time = fileutils.get_file_create_time(image_folder, file_name)
                file = File.File(
                    image_folder,
                    file_name,
                    fileutils.get_file_extension(image_folder, file_name),
                    fileutils.get_file_create_year(gm_time),
                    fileutils.get_file_create_month(gm_time),
                    fileutils.get_file_create_day(gm_time),
                    fileutils.get_file_create_hour(gm_time),
                    fileutils.get_file_create_minute(gm_time),
                    fileutils.get_file_create_second(gm_time)
                )
                image_file_objects.append(file)

    # Analyze image objects
    for image_object in image_file_objects:
        try:
            result = object_detection.analyze_image(
                image_object,
                configparser.app_config()['move_to_processed'] == 'True',
                configparser.app_config()['use_database'] == 'True',
                configparser.app_config()['write_object_detection_images'] == 'True',
            )
        except:
            print('object_detection.analyze_image exception')


# ---------------------------------------------------------------------
# Keeps program running

def main_loop():
    while 1:
        app()
        print('... running')
        time.sleep(int(configparser.app_config()['process_sleep_seconds']))


if __name__ == '__main__':
    try:
        main_loop()
    except KeyboardInterrupt:
        print >> sys.stderr, '\nExiting by user request.\n'
        sys.exit(0)

# ---------------------------------------------------------------------
