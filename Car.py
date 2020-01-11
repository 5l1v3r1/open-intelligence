import os
from module import fileutils, license_plate_detection, configparser
from objects import File

time_offset_hours = int(configparser.app_config()['time_offset_hours'])
print('time offset: ' + str(time_offset_hours))

# Folder containing car labels
folder = os.getcwd() + '/output/car/'


def app():
    # Image objects stored here
    image_file_objects = []

    # Create image objects, Check for 'processed' folder existence
    fileutils.create_directory(folder + 'processed/')
    # Process files
    for file_name in fileutils.get_camera_image_names(folder):
        if file_name != 'processed':
            gm_time = fileutils.get_file_create_time(folder, file_name)
            file = File.File(
                None,
                folder,
                file_name,
                fileutils.get_file_extension(folder, file_name),
                fileutils.get_file_create_year(gm_time),
                fileutils.get_file_create_month(gm_time),
                fileutils.get_file_create_day(gm_time),
                fileutils.get_file_create_hour(gm_time, time_offset_hours),
                fileutils.get_file_create_minute(gm_time),
                fileutils.get_file_create_second(gm_time)
            )
            image_file_objects.append(file)

    # Analyze image objects
    for image_object in image_file_objects:
        try:
            license_plate_detection.detect_license_plate(
                image_object,
                configparser.app_config()['move_to_processed'] == 'True',
                configparser.app_config()['use_database'] == 'True'
            )
        except Exception as e:
            print(e)


app()
