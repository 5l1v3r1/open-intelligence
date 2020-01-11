[app]
move_to_processed=True
process_sleep_seconds=4
use_database=True
write_object_detection_images=True
time_offset_hours=2

[camera]
camera_names=TestCamera1,TestCamera2
camera_folders=D:/testCamera1Folder/,D:/testCamera2Folder/,

[postgresql]
host=localhost
database=intelligence
user=postgres
password=

[openalpr]
region=eu
use_plate_char_length=True
plate_char_length=6
